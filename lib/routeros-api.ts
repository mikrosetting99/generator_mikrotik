import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";

/**
 * Klien API RouterOS (port 8728, atau 8729 untuk TLS) tanpa pustaka tambahan, plus penerjemah
 * perintah gaya CLI ("/ip firewall nat print where chain=srcnat") ke kalimat API. Dipakai
 * AI Mikrotik Engineer untuk membaca dan mengubah konfigurasi router.
 */

export type Row = Record<string, string>;

export interface RouterTarget {
  /** Alamat IPv4/IPv6 hasil resolusi (yang benar-benar disambungi). */
  ip: string;
  /** Nama yang diketik pengguna; dipakai sebagai servername TLS. */
  host: string;
  port: number;
  tls: boolean;
  username: string;
  password: string;
}

/* ------------------------------------------------------------------ protokol */

export function encodeLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x4000) return Buffer.from([((len >> 8) & 0x3f) | 0x80, len & 0xff]);
  if (len < 0x200000) return Buffer.from([((len >> 16) & 0x1f) | 0xc0, (len >> 8) & 0xff, len & 0xff]);
  if (len < 0x10000000) return Buffer.from([((len >> 24) & 0x0f) | 0xe0, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  return Buffer.from([0xf0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
}

export function encodeSentence(words: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const w of words) {
    const b = Buffer.from(w, "utf8");
    parts.push(encodeLength(b.length), b);
  }
  parts.push(Buffer.from([0]));
  return Buffer.concat(parts);
}

/** Mengambil satu kalimat utuh dari awal buffer; null bila datanya belum lengkap. */
export function takeSentence(buf: Buffer): { words: string[]; rest: Buffer } | null {
  const words: string[] = [];
  let off = 0;
  for (;;) {
    if (off >= buf.length) return null;
    const b = buf[off];
    let len: number;
    let head: number;
    if (b < 0x80) {
      len = b;
      head = 1;
    } else if ((b & 0xc0) === 0x80) {
      head = 2;
      if (off + head > buf.length) return null;
      len = ((b & 0x3f) << 8) | buf[off + 1];
    } else if ((b & 0xe0) === 0xc0) {
      head = 3;
      if (off + head > buf.length) return null;
      len = ((b & 0x1f) << 16) | (buf[off + 1] << 8) | buf[off + 2];
    } else if ((b & 0xf0) === 0xe0) {
      head = 4;
      if (off + head > buf.length) return null;
      len = ((b & 0x0f) << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
    } else {
      head = 5;
      if (off + head > buf.length) return null;
      len = buf.readUInt32BE(off + 1);
    }
    if (len === 0) return { words, rest: buf.subarray(off + head) };
    if (off + head + len > buf.length) return null;
    words.push(buf.subarray(off + head, off + head + len).toString("utf8"));
    off += head + len;
  }
}

function parseAttrs(words: string[]): Row {
  const row: Row = {};
  for (const w of words) {
    if (w.startsWith("=")) {
      const i = w.indexOf("=", 1);
      if (i > 0) row[w.slice(1, i)] = w.slice(i + 1);
    }
  }
  return row;
}

/* ------------------------------------------------------------------- koneksi */

export class RouterOsConnection {
  private buf: Buffer = Buffer.alloc(0);
  private queue: string[][] = [];
  private waiter: { resolve: (s: string[]) => void; reject: (e: Error) => void } | null = null;
  private failure: Error | null = null;

  private constructor(private socket: net.Socket) {
    socket.on("data", (d: Buffer) => {
      this.buf = Buffer.concat([this.buf, d]);
      for (;;) {
        const s = takeSentence(this.buf);
        if (!s) break;
        this.buf = Buffer.from(s.rest);
        this.queue.push(s.words);
      }
      this.flush();
    });
    const fail = (e: Error) => {
      this.failure ??= e;
      this.flush();
    };
    socket.on("error", (e) => fail(e));
    socket.on("close", () => fail(new Error("Koneksi ke router terputus.")));
  }

  private flush() {
    if (!this.waiter) return;
    if (this.queue.length) {
      const w = this.waiter;
      this.waiter = null;
      w.resolve(this.queue.shift()!);
    } else if (this.failure) {
      const w = this.waiter;
      this.waiter = null;
      w.reject(this.failure);
    }
  }

  private next(timeoutMs: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error("Router tidak menjawab (waktu habis)."));
      }, timeoutMs);
      this.waiter = {
        resolve: (s) => {
          clearTimeout(timer);
          resolve(s);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      };
      this.flush();
    });
  }

  static connect(t: Pick<RouterTarget, "ip" | "host" | "port" | "tls">, timeoutMs = 8000): Promise<RouterOsConnection> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const done = (err: Error | null, conn?: RouterOsConnection) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(conn!);
      };
      const socket: net.Socket = t.tls
        ? tls.connect({ host: t.ip, port: t.port, servername: net.isIP(t.host) ? undefined : t.host, rejectUnauthorized: false }, () => done(null, new RouterOsConnection(socket)))
        : net.connect({ host: t.ip, port: t.port }, () => done(null, new RouterOsConnection(socket)));
      const timer = setTimeout(() => {
        socket.destroy();
        done(new Error(`Tidak bisa tersambung ke ${t.host}:${t.port} (waktu habis). Pastikan service API aktif dan IP server ini diizinkan di /ip service.`));
      }, timeoutMs);
      socket.once("error", (e: NodeJS.ErrnoException) => {
        const why =
          e.code === "ECONNREFUSED"
            ? "ditolak (service API belum aktif atau port salah)"
            : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH"
              ? "tidak terjangkau"
              : e.message;
        done(new Error(`Tidak bisa tersambung ke ${t.host}:${t.port}: ${why}.`));
      });
    });
  }

  /** Kirim satu perintah, kumpulkan semua baris !re sampai !done. */
  async talk(words: string[], opts: { timeoutMs?: number; maxRows?: number } = {}): Promise<Row[]> {
    const timeoutMs = opts.timeoutMs ?? 20_000;
    const maxRows = opts.maxRows ?? 500;
    this.socket.write(encodeSentence(words));
    const rows: Row[] = [];
    let trap = "";
    for (;;) {
      const s = await this.next(timeoutMs);
      const type = s[0];
      if (type === "!re") {
        if (rows.length < maxRows) rows.push(parseAttrs(s));
      } else if (type === "!trap") {
        trap = parseAttrs(s).message || "perintah ditolak router";
      } else if (type === "!fatal") {
        throw new Error(`Router menutup koneksi: ${s[1] ?? ""}`.trim());
      } else if (type === "!done") {
        if (trap) throw new Error(trap);
        const extra = parseAttrs(s);
        if (Object.keys(extra).length) rows.push(extra);
        return rows;
      }
    }
  }

  async login(username: string, password: string): Promise<void> {
    try {
      const reply = await this.talk(["/login", `=name=${username}`, `=password=${password}`]);
      const ret = reply.find((r) => r.ret)?.ret;
      if (ret) {
        // RouterOS lama (sebelum 6.43): jawab tantangan MD5.
        const challenge = Buffer.from(ret, "hex");
        const md5 = crypto.createHash("md5").update(Buffer.concat([Buffer.from([0]), Buffer.from(password, "utf8"), challenge])).digest("hex");
        await this.talk(["/login", `=name=${username}`, `=response=00${md5}`]);
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (/cannot log in|invalid user/i.test(m)) throw new Error("Login router gagal: username atau password salah.");
      throw e;
    }
  }

  close(): void {
    this.socket.destroy();
  }
}

/** Buka koneksi dan login; selalu tutup lewat finally di pemanggil. */
export async function openRouter(t: RouterTarget): Promise<RouterOsConnection> {
  const conn = await RouterOsConnection.connect(t);
  try {
    await conn.login(t.username, t.password);
    return conn;
  } catch (e) {
    conn.close();
    throw e;
  }
}

/* ------------------------------------------------- penerjemah perintah CLI -> API */

/** Memecah baris perintah: spasi memisahkan kata, "…" menyatukan, [ … ] tetap satu kata. */
export function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let cur = "";
  let has = false;
  let quote = false;
  let depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === "\\" && i + 1 < line.length) {
        cur += depth > 0 ? c + line[i + 1] : line[i + 1];
        i++;
      } else if (c === '"') {
        quote = false;
        if (depth > 0) cur += c;
      } else cur += c;
      continue;
    }
    if (c === '"') {
      quote = true;
      has = true;
      if (depth > 0) cur += c;
    } else if (c === "[") {
      depth++;
      has = true;
      cur += c;
    } else if (c === "]") {
      depth = Math.max(0, depth - 1);
      cur += c;
    } else if (/\s/.test(c) && depth === 0) {
      if (has) tokens.push(cur);
      cur = "";
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (quote) throw new Error("Tanda kutip belum ditutup.");
  if (depth > 0) throw new Error("Kurung siku [ ] belum ditutup.");
  if (has) tokens.push(cur);
  return tokens;
}

const VERBS = new Set(["print", "add", "set", "remove", "enable", "disable", "move", "get", "unset", "comment", "run"]);
const PRINT_IGNORED = new Set(["detail", "terse", "brief", "without-paging", "as-value", "stats", "value-list", "and", "&&"]);
const ATTR = /^[A-Za-z0-9_.-]+=/;

export type Safety = "read" | "write" | "danger" | "blocked";

export interface Prepared {
  line: string;
  /** Jalur menu API, mis. "/ip/firewall/nat". */
  path: string;
  verb: string;
  safety: Safety;
  /** Kata atribut (=k=v). */
  attrs: string[];
  /** Kata query (?k=v) untuk print. */
  queries: string[];
  /** Untuk set/remove/enable/disable/…: item yang dituju. */
  selector: null | { ids: string[]; queries: string[]; all: boolean };
  error?: string;
}

const DANGER = [
  /^\/system\/(reboot|shutdown)$/,
  /^\/system\/routerboard\/upgrade/,
  /^\/system\/package/,
  /^\/user(\/|$)/,
  /^\/ip\/service(\/|$)/,
  /^\/system\/license/,
];
const BLOCKED = [/^\/system\/reset-configuration$/, /^\/system\/reset$/];

function classify(path: string, verb: string): Safety {
  if (BLOCKED.some((r) => r.test(path))) return "blocked";
  if (verb === "print" || verb === "get" || /\/(ping|traceroute)$/.test(path)) return "read";
  if (DANGER.some((r) => r.test(path))) return "danger";
  return "write";
}

function parseFind(token: string): { queries: string[]; all: boolean } {
  const inner = token.slice(1, -1).trim();
  if (!/^find(\s|$)/.test(inner)) throw new Error(`Hanya [find …] yang didukung di dalam [ ], bukan: ${token}`);
  const rest = tokenize(inner.slice(4)).filter((t) => t !== "where" && t !== "and" && t !== "&&");
  const queries: string[] = [];
  for (const t of rest) {
    if (/^[A-Za-z0-9_.-]+!=/.test(t)) {
      const i = t.indexOf("!=");
      queries.push(`?${t.slice(0, i)}=${t.slice(i + 2)}`, "?#!");
    } else if (/~/.test(t) || /^[<>]/.test(t) || t.startsWith("!")) {
      throw new Error(`Filter tidak didukung lewat API: ${t}. Pakai kondisi sederhana seperti name=ether1.`);
    } else if (ATTR.test(t)) {
      queries.push(`?${t}`);
    } else {
      queries.push(`?name=${t}`);
    }
  }
  return { queries, all: queries.length === 0 };
}

/** Menyiapkan satu baris perintah CLI untuk dikirim lewat API; galat dikembalikan di field error. */
export function prepareCommand(line: string): Prepared {
  const base: Prepared = { line, path: "", verb: "", safety: "write", attrs: [], queries: [], selector: null };
  try {
    const trimmed = line.trim();
    if (!trimmed) throw new Error("Perintah kosong.");
    if (trimmed.startsWith(":")) throw new Error("Perintah scripting (diawali :) tidak didukung lewat API. Pakai perintah menu biasa seperti /ip address print.");
    if (!trimmed.startsWith("/")) throw new Error("Perintah harus diawali / (contoh: /ip address print).");
    let tokens = tokenize(trimmed);
    // "/ip/firewall/nat/add" → pecah di tanda "/"
    const first = tokens[0].replace(/^\//, "");
    tokens = [...first.split("/").filter(Boolean), ...tokens.slice(1)];

    const vi = tokens.findIndex((t) => VERBS.has(t));
    let pathWords: string[];
    let verb = "";
    let rest: string[];
    if (vi >= 0) {
      pathWords = tokens.slice(0, vi);
      verb = tokens[vi];
      rest = tokens.slice(vi + 1);
    } else {
      // Perintah tanpa kata kerja: /ping, /system reboot, /tool traceroute, …
      const ai = tokens.findIndex((t) => ATTR.test(t));
      pathWords = ai >= 0 ? tokens.slice(0, ai) : tokens;
      rest = ai >= 0 ? tokens.slice(ai) : [];
      // "/ping 8.8.8.8 count=3": alamat tanpa nama atribut adalah address.
      const pi = pathWords.findIndex((w) => w === "ping" || w === "traceroute");
      if (pi >= 0 && pi < pathWords.length - 1) {
        rest = [`address=${pathWords[pi + 1]}`, ...rest];
        pathWords = pathWords.slice(0, pi + 1);
      }
      if (pathWords.length === 0) throw new Error("Jalur menu tidak ditemukan.");
    }
    if (pathWords.some((w) => w === "export")) throw new Error("Perintah export tidak tersedia lewat API. Gunakan print pada menu terkait.");
    const path = "/" + pathWords.join("/");
    const p: Prepared = { ...base, path, verb, safety: classify(path, verb) };

    if (verb === "print") {
      let where = false;
      for (const t of rest) {
        if (t === "where") where = true;
        else if (PRINT_IGNORED.has(t)) continue;
        else if (/^(interval|follow|file)/.test(t) || t === "follow" || t === "follow-only") throw new Error("print dengan interval/follow/file tidak didukung lewat API.");
        else if (t === "count-only") p.attrs.push("=count-only=");
        else if (/^proplist=/.test(t)) p.attrs.push(`=.proplist=${t.slice(9)}`);
        else if (/^[A-Za-z0-9_.-]+!=/.test(t)) {
          const i = t.indexOf("!=");
          p.queries.push(`?${t.slice(0, i)}=${t.slice(i + 2)}`, "?#!");
        } else if (/~/.test(t) || /^[<>]/.test(t)) throw new Error(`Filter tidak didukung lewat API: ${t}. Pakai kondisi sederhana seperti name=ether1.`);
        else if (ATTR.test(t)) p.queries.push(`?${t}`);
        else if (where) throw new Error(`Kondisi where tidak dikenali: ${t}`);
        else if (t.startsWith("[")) throw new Error("Pakai print where nama=nilai, bukan [find].");
        // kata lain (mis. nama menu bertingkat) diabaikan
      }
      return p;
    }

    if (["set", "remove", "enable", "disable", "unset", "comment", "move", "get", "run"].includes(verb)) {
      // Argumen pertama tanpa "=" adalah item yang dituju: *id, nama, atau [find …].
      let target: string | null = null;
      const attrs: string[] = [];
      for (const t of rest) {
        if (target === null && !ATTR.test(t) && !t.startsWith("-")) target = t;
        else if (/^numbers=/.test(t) && target === null) target = t.slice(8);
        else if (ATTR.test(t)) attrs.push(`=${t}`);
        else throw new Error(`Argumen tidak dikenali: ${t}`);
      }
      p.attrs = attrs;
      if (target !== null) {
        if (target.startsWith("[")) {
          const f = parseFind(target);
          p.selector = { ids: [], queries: f.queries, all: f.all };
        } else if (/^\*[0-9A-Fa-f]+(,\*[0-9A-Fa-f]+)*$/.test(target)) {
          p.selector = { ids: target.split(","), queries: [], all: false };
        } else if (/^\d+$/.test(target)) {
          throw new Error(`Nomor urut (${target}) tidak bisa dipakai lewat API. Pakai [find name=…] atau .id seperti *1.`);
        } else {
          p.selector = { ids: [], queries: [`?name=${target}`], all: false };
        }
      }
      return p;
    }

    // add dan perintah tanpa kata kerja: semua argumen berupa atribut.
    for (const t of rest) {
      if (ATTR.test(t)) p.attrs.push(`=${t}`);
      else throw new Error(`Argumen tidak dikenali: ${t}`);
    }
    return p;
  } catch (e) {
    return { ...base, safety: "write", error: e instanceof Error ? e.message : "Perintah tidak valid." };
  }
}

/** Menjalankan hasil prepareCommand pada koneksi yang sudah login. */
export async function runPrepared(conn: RouterOsConnection, p: Prepared): Promise<Row[]> {
  if (p.error) throw new Error(p.error);
  const menu = p.verb ? `${p.path}/${p.verb === "get" ? "print" : p.verb}` : p.path;
  const words = [menu, ...p.attrs, ...p.queries];
  if (p.selector) {
    let ids = p.selector.ids;
    if (!ids.length) {
      const found = await conn.talk([`${p.path}/print`, "=.proplist=.id", ...p.selector.queries]);
      ids = found.map((r) => r[".id"]).filter(Boolean);
      if (!ids.length) throw new Error("Tidak ada item yang cocok dengan [find …] atau nama tersebut.");
    }
    words.splice(1, 0, `=.id=${ids.join(",")}`);
  }
  return conn.talk(words);
}

/** Baris hasil → teks ringkas untuk dibaca pengguna dan AI. */
export function formatRows(rows: Row[], maxChars = 6000): string {
  if (!rows.length) return "(tidak ada data)";
  const out: string[] = [];
  rows.forEach((r, i) => {
    const parts = Object.entries(r).map(([k, v]) => `${k}=${/[\s"]/.test(v) ? JSON.stringify(v) : v}`);
    out.push(`#${i} ${parts.join(" ")}`);
  });
  const text = out.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n… (dipotong, ${rows.length} baris)` : text;
}
