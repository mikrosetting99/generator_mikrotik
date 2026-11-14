/**
 * Trafik RX/TX dari selisih counter byte interface antar dua sampel.
 * Tidak memakai monitor-traffic: counter tetap benar walau interval polling 60 detik.
 */

/** Batas kewajaran: di atas ini hampir pasti counter melompat (bukan trafik sungguhan). */
export const MAX_PLAUSIBLE_BPS = 400e9;

export interface CounterPoint {
  at: number;
  uptimeSec: number | null;
  byte: number | null;
}

export type RateGap = "first" | "stale" | "reboot" | "reset" | "implausible";

/**
 * bit/detik antara dua titik counter. Mengembalikan null (celah di grafik, bukan lonjakan) bila:
 * belum ada sampel sebelumnya, jaraknya terlalu jauh, router reboot (uptime turun), counter
 * di-reset (nilai turun), atau hasilnya tidak masuk akal.
 */
export function counterRate(prev: CounterPoint | null, cur: CounterPoint, maxGapMs: number): { bps: number | null; gap?: RateGap } {
  if (!prev || prev.byte === null || cur.byte === null) return { bps: null, gap: "first" };
  const dt = (cur.at - prev.at) / 1000;
  if (dt <= 0 || cur.at - prev.at > maxGapMs) return { bps: null, gap: "stale" };
  if (prev.uptimeSec !== null && cur.uptimeSec !== null && cur.uptimeSec < prev.uptimeSec) return { bps: null, gap: "reboot" };
  if (cur.byte < prev.byte) return { bps: null, gap: "reset" };
  const bps = ((cur.byte - prev.byte) * 8) / dt;
  if (bps > MAX_PLAUSIBLE_BPS) return { bps: null, gap: "implausible" };
  return { bps: Math.round(bps) };
}

/** "1w2d03:04:05" (v6 lama) atau "1w2d3h4m5s" (v6/v7) → detik; null bila tidak dikenali. */
export function parseUptime(v: string | undefined | null): number | null {
  if (!v) return null;
  const s = v.trim();
  let total = 0;
  let matched = false;
  const unit = /(\d+)([wdhms])/g;
  const mult: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let rest = s;
  const clock = s.match(/(\d+):(\d{2}):(\d{2})$/);
  if (clock) {
    total += Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    rest = s.slice(0, clock.index);
    matched = true;
  }
  for (const m of rest.matchAll(unit)) {
    total += Number(m[1]) * mult[m[2]];
    matched = true;
  }
  return matched ? total : null;
}
