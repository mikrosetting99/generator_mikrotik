/**
 * Path tujuan setelah masuk, hanya bila benar-benar menunjuk ke dalam situs.
 *
 * Nilainya datang dari URL, jadi tidak boleh dipercaya. Dua bentuk yang wajib
 * ditolak: "//situs-lain.com" dan "/" diikuti garis miring terbalik — keduanya
 * dibaca browser sebagai alamat luar, dan menerimanya membuat halaman masuk ini
 * bisa dipakai melempar orang ke situs mana pun.
 *
 * Karakter kedua diperiksa lewat kodenya (47 = "/", 92 = garis miring terbalik)
 * supaya aturannya terbaca jelas tanpa perlu escaping di dalam pola.
 */
export function tujuanAman(nilai: unknown, cadangan = "/login-page-hotspot"): string {
  const path = typeof nilai === "string" ? nilai : "";
  if (!path.startsWith("/")) return cadangan;
  // "/" saja bukan tujuan yang berguna di sini — itu beranda, bukan halaman
  // yang tadi hendak dibuka. Jatuhkan ke cadangan supaya perilakunya pasti.
  if (path.length < 2) return cadangan;

  const kedua = path.charCodeAt(1);
  if (kedua === 47 || kedua === 92) return cadangan;

  return path;
}
