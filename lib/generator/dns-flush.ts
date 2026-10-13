import { args, ScriptBuilder } from "./script-builder";

/**
 * Script Autoflush DNS: scheduler RouterOS yang menjalankan
 * `/ip dns cache flush` secara berkala. Sintaksnya sama di RouterOS v6 dan v7.
 */

export type FlushUnit = "m" | "h" | "d" | "w";

export const FLUSH_UNIT_LABEL: Record<FlushUnit, string> = {
  m: "menit",
  h: "jam",
  d: "hari",
  w: "minggu",
};

export interface DnsFlushConfig {
  /** Nama scheduler di RouterOS. */
  name: string;
  everyValue: number;
  everyUnit: FlushUnit;
  /** Jam pertama berjalan (HH:MM atau HH:MM:SS). Kosong = mulai sekarang. */
  startTime: string;
  /** Catat ke log router setiap kali cache dibersihkan. */
  logFlush: boolean;
  /** Hapus scheduler lama bernama sama lalu buat ulang, bukan dilewati. */
  replaceExisting: boolean;
}

export const DEFAULT_DNS_FLUSH: DnsFlushConfig = {
  name: "autoflush-dns",
  everyValue: 1,
  everyUnit: "d",
  startTime: "03:00:00",
  logFlush: false,
  replaceExisting: true,
};

export interface DnsFlushIssue {
  level: "error" | "warn";
  text: string;
}

/** HH:MM atau HH:MM:SS → HH:MM:SS; null bila tidak valid. */
export function normalizeTime(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [h, min, s] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  if (h > 23 || min > 59 || s > 59) return null;
  return [h, min, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function intervalText(config: DnsFlushConfig): string {
  return `${config.everyValue}${config.everyUnit}`;
}

function intervalMinutes(config: DnsFlushConfig): number {
  const factor: Record<FlushUnit, number> = { m: 1, h: 60, d: 1440, w: 10080 };
  return config.everyValue * factor[config.everyUnit];
}

export function validateDnsFlush(config: DnsFlushConfig): DnsFlushIssue[] {
  const issues: DnsFlushIssue[] = [];
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(config.name.trim())) {
    issues.push({
      level: "error",
      text: "Nama scheduler hanya boleh huruf, angka, titik, garis bawah, dan strip (maks 40 karakter).",
    });
  }
  if (!Number.isInteger(config.everyValue) || config.everyValue < 1 || config.everyValue > 999) {
    issues.push({ level: "error", text: "Interval harus bilangan bulat 1–999." });
  }
  if (config.startTime.trim() && normalizeTime(config.startTime) === null) {
    issues.push({ level: "error", text: "Jam mulai harus berformat JJ:MM atau JJ:MM:SS, mis. 03:00 atau 03:00:30." });
  }
  if (issues.length === 0 && intervalMinutes(config) < 5) {
    issues.push({
      level: "warn",
      text: "Interval kurang dari 5 menit terlalu sering: cache DNS terus kosong sehingga browsing justru terasa lebih lambat.",
    });
  }
  return issues;
}

export function generateDnsFlushScript(config: DnsFlushConfig): string {
  const name = config.name.trim();
  const interval = intervalText(config);
  const start = normalizeTime(config.startTime);
  const event = config.logFlush
    ? `:log info "Autoflush DNS: cache dibersihkan"; /ip dns cache flush`
    : "/ip dns cache flush";

  const s = new ScriptBuilder();
  s.banner([
    "AUTOFLUSH DNS CACHE (SCHEDULER)",
    "Generator Script Mikrotik by Mikrosetting.com",
    "",
    `Scheduler : ${name}`,
    `Interval  : setiap ${config.everyValue} ${FLUSH_UNIT_LABEL[config.everyUnit]}`,
    `Mulai     : ${start ?? "segera setelah script dijalankan"}`,
    "",
    "CARA PAKAI",
    "Buka Winbox/WebFig > New Terminal, paste seluruh isi script ini,",
    "lalu tekan Enter. Sintaks sama untuk RouterOS v6 dan v7.",
  ]);

  s.section("SCHEDULER FLUSH DNS CACHE", "Membersihkan cache DNS router secara berkala.");

  const addArgs = args([
    ["name", name],
    ["interval", interval],
    ["start-time", start ?? undefined],
    ["on-event", event],
    ["comment", "Autoflush DNS cache (Generator Script Mikrotik)"],
  ]);

  if (config.replaceExisting) {
    s.comment("Scheduler lama bernama sama dihapus dulu, lalu dibuat ulang.");
    s.line(`:if ([:len [/system scheduler find where name=${ScriptBuilder.q(name)}]] > 0) do={`);
    s.line(`  /system scheduler remove [find where name=${ScriptBuilder.q(name)}]`);
    s.line("}");
    s.line(`/system scheduler add ${addArgs}`);
  } else {
    s.addIfMissing("/system scheduler", [["name", name]], addArgs);
  }

  s.section(
    "VERIFIKASI",
    "Jalankan perintah ini untuk memeriksa hasilnya:\n" +
      `  /system scheduler print where name=${ScriptBuilder.q(name)}\n` +
      "  /ip dns cache print count-only\n" +
      "Untuk mencoba flush sekarang juga:\n" +
      "  /ip dns cache flush",
  );
  s.section(
    "MENGHAPUS SCHEDULER",
    `Bila tidak diperlukan lagi:\n  /system scheduler remove [find where name=${ScriptBuilder.q(name)}]`,
  );
  return s.toString();
}