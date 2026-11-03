import { Client } from "ssh2";
import { classify, type RouterTarget, type Safety } from "@/lib/routeros-api";

/**
 * Koneksi ke RouterOS lewat SSH: tiap perintah dijalankan sebagai CLI apa adanya (tanpa penerjemahan
 * ke API), jadi /export dan filter print lengkap bisa dipakai. Karena CLI bisa menjalankan skrip,
 * baris perintah dibatasi ketat di sshLineError() sebelum dikirim.
 */

const READY_TIMEOUT_MS = 10_000;
const EXEC_TIMEOUT_MS = 20_000;
const MAX_OUTPUT = 120_000;

export interface SshInfo {
  identity: string;
  version: string;
  board: string;
  uptime: string;
  cpuLoad: string;
}

/** Membuka sesi SSH; galat dipetakan ke pesan berbahasa Indonesia. */
export function sshConnect(t: RouterTarget): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      client.end();
      reject(new Error(message));
    };
    client
      .on("ready", () => {
        if (settled) return;
        settled = true;
        resolve(client);
      })
      .on("error", (e: Error & { level?: string }) => {
        if (e.level === "client-authentication") fail("Username atau password salah.");
        else if (/ECONNREFUSED/.test(e.message)) fail("Koneksi SSH ditolak (port tertutup atau service ssh mati).");
        else if (/ETIMEDOUT|Timed out|timeout/i.test(e.message)) fail("Waktu habis saat menyambung SSH.");
        else if (/ENETUNREACH|EHOSTUNREACH/.test(e.message)) fail("Host tidak terjangkau.");
        else if (/handshake|no matching|kex|cipher|host key/i.test(e.message)) fail(`Negosiasi SSH gagal (${e.message}). Router mungkin terlalu lama; perbarui RouterOS atau pakai koneksi API.`);
        else fail(e.message || "Gagal tersambung lewat SSH.");
      })
      .connect({
        host: t.ip,
        port: t.port,
        username: t.username,
        password: t.password,
        readyTimeout: READY_TIMEOUT_MS,
        // Kunci host tidak disematkan (tidak ada tempat menyimpannya); lalu lintas tetap terenkripsi.
        tryKeyboard: false,
      });
  });
}

/** Menjalankan satu perintah dan mengembalikan teksnya; waktu habis memotong perintah yang menggantung. */
export function sshRun(client: Client, command: string, timeoutMs = EXEC_TIMEOUT_MS): Promise<{ output: string; code: number | null; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);
      let output = "";
      let code: number | null = null;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        stream.close();
      }, timeoutMs);
      const take = (d: Buffer) => {
        if (output.length < MAX_OUTPUT) output += d.toString("utf8");
      };
      stream.on("data", take);
      stream.stderr.on("data", take);
      stream.on("exit", (c: number | null) => {
        code = c;
      });
      stream.on("close", () => {
        clearTimeout(timer);
        resolve({ output: output.replace(/\r/g, "").trim().slice(0, MAX_OUTPUT), code, timedOut });
      });
    });
  });
}

/** Ciri keluaran RouterOS saat perintah gagal (kode keluar SSH tidak selalu bisa dipercaya). */
const FAIL_RE = /^(failure:|bad command name|syntax error|expected |invalid value|no such item|input does not match|ambiguous|not enough permissions|missing value|invalid internal item number|unknown parameter)/im;
export const sshFailed = (output: string, code: number | null) => FAIL_RE.test(output) || (code !== null && code !== 0 && !output);

/** Identity, versi, board, uptime, dan CPU dalam satu perintah. */
const INFO_CMD =
  ':put ([/system identity get name] . "|" . [/system resource get version] . "|" . [/system resource get board-name] . "|" . [/system resource get uptime] . "|" . [/system resource get cpu-load])';

export async function sshInfo(client: Client): Promise<SshInfo> {
  const r = await sshRun(client, INFO_CMD, 8000);
  const parts = r.output.split("|");
  if (parts.length < 5 || sshFailed(r.output, r.code)) throw new Error(r.output ? `Gagal membaca data: ${r.output.slice(0, 200)}` : "Gagal membaca data router.");
  const [identity, version, board, uptime, cpuLoad] = parts.map((p) => p.trim());
  return { identity, version, board, uptime, cpuLoad };
}

/** Membuka sesi, membaca info, lalu menutup: dipakai untuk pemeriksaan status. */
export async function sshCheckInfo(t: RouterTarget): Promise<SshInfo> {
  const client = await sshConnect(t);
  try {
    return await sshInfo(client);
  } finally {
    client.end();
  }
}

/* ------------------------------------------------------------ keamanan perintah */

const SSH_FORBIDDEN_WORDS = /(^|[\s/])(follow|follow-only|monitor-traffic|torch|sniffer|bandwidth-test|import|execute)([\s/]|$)|^\/(system|tool)[\s/]+(ssh|telnet)([\s/]|$)/;
const BLOCKED_PATH = /^\/system\/(reset-configuration|reset)$/;

/**
 * Pemeriksaan satu baris sebelum dikirim lewat SSH. CLI RouterOS bisa menjalankan skrip, jadi hanya
 * perintah menu biasa yang boleh: tanpa ":", ";", "$", "{ }", backtick, atau sub-perintah selain [find …].
 */
export function sshLineError(line: string): string | null {
  const l = line.trim();
  if (!l) return "Perintah kosong.";
  if (!l.startsWith("/")) return "Perintah harus diawali / (contoh: /ip address print).";
  if (/[\r\n\0]/.test(l)) return "Satu perintah per baris.";
  // Kutipan dibuang dulu supaya karakter di dalam teks (mis. regex a|b) tidak dianggap sintaks.
  const bare = l.replace(/"(?:\\.|[^"\\])*"/g, '""');
  if (/[;`${}]/.test(bare)) return "Karakter ; $ { } dan backtick tidak diizinkan (itu sintaks skrip).";
  if (/&&|\|\|/.test(bare)) return "Gabungan perintah tidak diizinkan; kirim satu perintah per baris.";
  for (const m of bare.matchAll(/\[([^\]]*)\]?/g)) {
    if (!/^\s*find(\s|$)/.test(m[1]) || /[[]/.test(m[1])) return "Hanya [find …] yang boleh di dalam tanda [ ].";
  }
  if ((bare.match(/\[/g) ?? []).length !== (bare.match(/\]/g) ?? []).length) return "Tanda [ ] tidak seimbang.";
  if (SSH_FORBIDDEN_WORDS.test(bare)) return "Perintah ini tidak diizinkan lewat SSH (berjalan terus, membuka sesi lain, atau menjalankan skrip).";
  if (/(^|\s)monitor(\s|$)/.test(bare) && !/(^|\s)once(\s|$)/.test(bare)) return "Perintah monitor harus memakai once.";
  if (/(^|\s)show-sensitive(\s|=|$)/.test(bare)) return "show-sensitive tidak diizinkan (menampilkan password dan kunci).";
  return null;
}

/** Klasifikasi keselamatan untuk SSH; lebih ketat dari API karena tidak ada penerjemahan yang bisa gagal. */
export function sshSafety(line: string): Safety {
  const l = line.trim();
  const bare = l.replace(/"(?:\\.|[^"\\])*"/g, '""');
  // Kata menu = kata sebelum atribut (k=v) atau [ ] pertama.
  const words = bare.replace(/^\//, "").split(/[\s/]+/);
  // Alamat tanpa nama atribut (mis. "/ping 1.1.1.1" atau "/ping google.com") juga mengakhiri kata menu.
  const stop = words.findIndex((w) => w.includes("=") || w.startsWith("[") || w === "where" || /^[\d*]|[.:]/.test(w));
  const lead = (stop === -1 ? words : words.slice(0, stop)).filter(Boolean);
  const VERBS = ["print", "add", "set", "remove", "enable", "disable", "move", "get", "unset", "comment", "run", "export", "find"];
  const vi = lead.findIndex((w) => VERBS.includes(w));
  const verb = vi >= 0 ? lead[vi] : "";
  const path = "/" + (vi >= 0 ? lead.slice(0, vi) : lead).join("/");
  if (BLOCKED_PATH.test(path)) return "blocked";
  if (verb === "export") return /(^|\s)file=/.test(bare) ? "write" : "read";
  return classify(path, verb);
}

/** Perintah ping tanpa count akan jalan terus; batasi supaya selesai sendiri. */
export function sshPrepare(line: string): string {
  let l = line.trim();
  if (/^\/ping(\s|$)/.test(l) && !/(^|\s)count=/.test(l)) l += " count=4";
  if (/^\/tool\s+traceroute(\s|$)/.test(l) && !/(^|\s)count=/.test(l)) l += " count=1";
  if (/(^|\s|\/)export(\s|$)/.test(l) && !/hide-sensitive/.test(l)) l += " hide-sensitive";
  return l;
}
