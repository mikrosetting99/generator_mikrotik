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

type ArgValue = string | number | boolean | RawValue | undefined | null;

/** Merangkai pasangan key=value, melewati nilai kosong. */
export function args(pairs: Array<[string, ArgValue]>): string {
  return pairs
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      if (typeof value === "boolean") return `${key}=${value ? "yes" : "no"}`;
      if (value !== null && typeof value === "object") return `${key}=${value.raw}`;
      return `${key}=${ScriptBuilder.q(String(value))}`;
    })
    .join(" ");
}
