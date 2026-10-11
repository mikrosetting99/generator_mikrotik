/**
 * Kirim hitungan pemakaian menu dari browser. Satu browser dihitung sekali per
 * menu dalam 30 menit, supaya muat ulang halaman tidak menggelembungkan angka.
 */
const WINDOW_MS = 30 * 60 * 1000;

export function trackMenu(id: string): void {
  try {
    const key = `menu-hit:${id}`;
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < WINDOW_MS) return;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // penyimpanan diblokir: tetap hitung, tanpa pembatasan
  }
  fetch("/api/menu-hit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
    keepalive: true,
  }).catch(() => {});
}