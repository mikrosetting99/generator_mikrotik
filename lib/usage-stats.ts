/**
 * Hitungan pemakaian modul per hari untuk Dashboard Admin. Tanggal memakai zona WIB supaya
 * "hari ini" sesuai jam kerja di Indonesia, bukan UTC. Murni tanpa database (diuji di
 * scripts/test-usage-stats.mts).
 */

export const USAGE_TZ = "Asia/Jakarta";
/** Rentang tren yang ditampilkan dan disimpan untuk dibaca. */
export const USAGE_DAYS = 30;

/** "YYYY-MM-DD" di zona WIB. */
export function wibDay(date: Date = new Date()): string {
  // en-CA memformat tanggal sebagai YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: USAGE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Daftar n tanggal berurutan, berakhir di `last` (inklusif), paling lama di depan. */
export function lastDays(n: number, last: string = wibDay()): string[] {
  const [y, m, d] = last.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

export interface DailyRow {
  menuId: string;
  day: string;
  count: number;
}

export interface MenuTrend {
  today: number;
  d7: number;
  d30: number;
  /** Hitungan per hari, sejajar dengan `days`. */
  series: number[];
}

export interface UsageStats {
  days: string[];
  perMenu: Record<string, MenuTrend>;
  /** Total semua modul per hari, sejajar dengan `days`. */
  totals: number[];
  today: number;
  d7: number;
  d30: number;
  /** Tanggal paling awal yang punya data harian (null bila belum ada). */
  since: string | null;
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

export function buildUsageStats(rows: DailyRow[], today: string = wibDay(), since: string | null = null): UsageStats {
  const days = lastDays(USAGE_DAYS, today);
  const index = new Map(days.map((d, i) => [d, i]));
  const perMenu: Record<string, MenuTrend> = {};
  const totals = days.map(() => 0);
  for (const r of rows) {
    const i = index.get(r.day);
    if (i === undefined) continue;
    const t = (perMenu[r.menuId] ??= { today: 0, d7: 0, d30: 0, series: days.map(() => 0) });
    t.series[i] += r.count;
    totals[i] += r.count;
  }
  for (const t of Object.values(perMenu)) {
    t.today = t.series[USAGE_DAYS - 1];
    t.d7 = sum(t.series.slice(-7));
    t.d30 = sum(t.series);
  }
  return { days, perMenu, totals, today: totals[USAGE_DAYS - 1], d7: sum(totals.slice(-7)), d30: sum(totals), since };
}

/** "14 Nov" */
export function shortDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}
