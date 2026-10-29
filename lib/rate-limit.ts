
/**
 * Pembatas percobaan sederhana (di memori, cukup untuk satu proses PM2).
 * Dipakai agar nomor HP tidak bisa ditebak dengan mencoba terus-menerus.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

/** Menghitung satu percobaan gagal; true bila sudah melewati batas. */
export function registerFailure(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return limit <= 1;
  }
  entry.count += 1;
  return entry.count > limit;
}

export function isBlocked(key: string, limit: number): boolean {
  const entry = hits.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= limit);
}

export function clearFailures(key: string): void {
  hits.delete(key);
}

/** Bersihkan entri kedaluwarsa agar memori tidak membengkak. */
export function sweepRateLimits(): void {
  const now = Date.now();
  for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
}