/**
 * Menu yang TIDAK punya properti `comment` pada perintah `add`.
 *
 * Menyertakannya membuat seluruh perintah gagal — RouterOS menjawab
 * "expected end of command" tepat di posisi `comment=`, dan objeknya sama
 * sekali tidak terbentuk. Dua yang pertama terbukti dari error router nyata;
 * dua sisanya satu keluarga dengan hotspot profile sehingga diperlakukan sama,
 * karena kehilangan penanda jauh lebih ringan akibatnya daripada gagal membuat
 * objeknya.
 */
const NO_COMMENT_ON_ADD = new Set([
  "/ip dhcp-server",
  "/ip hotspot profile",
  "/ip hotspot",
  "/interface pppoe-server server",
]);

/** Membuang `comment=...` di menu yang tidak mendukungnya. */
function stripUnsupportedComment(menu: string, addArgs: string): string {
  if (!NO_COMMENT_ON_ADD.has(menu)) return addArgs;
  return addArgs.replace(/\s*comment=(?:"(?:[^"\\]|\\.)*"|\S+)\s*$/, "");
}

/** Penyusun teks script RouterOS — menjaga format & komentar tetap konsisten. */
export class ScriptBuilder {
  private lines: string[] = [];
  private dirty = false;

  /** Nilai yang aman ditulis tanpa tanda kutip di RouterOS. */
  static q(value: string): string {
    const v = value ?? "";
    if (v === "") return '""';
    if (/^[A-Za-z0-9_.:,/+=-]+$/.test(v)) return v;
    return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$")}"`;
  }

  banner(lines: string[]): this {
    const width = 66;
    this.lines.push("#".repeat(width));
    for (const line of lines) this.lines.push(line ? `# ${line}` : "#");
    this.lines.push("#".repeat(width));
    this.dirty = true;
    return this;
  }

  section(title: string, description?: string): this {
    this.blank();
    this.lines.push(`# ---------------------------------------------------------------`);
    this.lines.push(`# ${title}`);
    if (description) {
      for (const line of description.split("\n")) this.lines.push(`# ${line}`);
    }
    this.lines.push(`# ---------------------------------------------------------------`);
    this.dirty = true;
    return this;
  }

  comment(text: string): this {
    for (const line of text.split("\n")) this.lines.push(`# ${line}`);
    this.dirty = true;
    return this;
  }

  line(text: string): this {
    this.lines.push(text);
    this.dirty = true;
    return this;
  }

  /**
   * `add` yang hanya berjalan bila objeknya belum ada.
   *
   * Router berkonfigurasi bawaan pabrik sudah punya sebagian objek ini
   * (interface-list WAN/LAN, DHCP client di ether1, alamat 192.168.88.1, ...).
   * Tanpa penjagaan, perintah `add` biasa akan gagal dan menampilkan deretan
   * pesan merah di terminal. Bentuk ini juga membuat script aman dijalankan
   * dua kali.
   *
   * Path menu ditulis lengkap di dalam `find` maupun `add` — tidak
   * mengandalkan konteks menu berjalan — supaya hasilnya sama baik saat
   * di-paste ke terminal maupun dijalankan lewat `import`.
   */
  addIfMissing(menu: string, findPairs: Array<[string, ArgValue]>, addArgs: string): this {
    this.line(`:if ([:len [${menu} find where ${findArgs(findPairs)}]] = 0) do={`);
    this.line(`  ${menu} add ${stripUnsupportedComment(menu, addArgs)}`);
    return this.line("}");
  }

  blank(): this {
    if (this.dirty && this.lines[this.lines.length - 1] !== "") this.lines.push("");
    return this;
  }

  toString(): string {
    return `${this.lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
  }
}

/**
 * Nilai yang ditulis apa adanya tanpa quoting — untuk sintaks RouterOS
 * seperti `!dstnat` yang justru rusak bila diberi tanda kutip.
 */
export interface RawValue {
  readonly raw: string;
}

export function raw(value: string): RawValue {
  return { raw: value };
}

export type ArgValue = string | number | boolean | RawValue | undefined | null;

function pair([key, value]: [string, ArgValue]): string {
  if (typeof value === "boolean") return `${key}=${value ? "yes" : "no"}`;
  if (value !== null && typeof value === "object") return `${key}=${value.raw}`;
  return `${key}=${ScriptBuilder.q(String(value))}`;
}

function present(pairs: Array<[string, ArgValue]>): Array<[string, ArgValue]> {
  return pairs.filter(([, value]) => value !== undefined && value !== null && value !== "");
}

/** Merangkai pasangan key=value, melewati nilai kosong. */
export function args(pairs: Array<[string, ArgValue]>): string {
  return present(pairs).map(pair).join(" ");
}

/**
 * Kondisi untuk `find where`. Beberapa syarat digabung dengan `and`, sesuai
 * bentuk yang dianjurkan manual RouterOS.
 */
export function findArgs(pairs: Array<[string, ArgValue]>): string {
  return present(pairs).map(pair).join(" and ");
}
