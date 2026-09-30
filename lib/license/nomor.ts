/**
 * Nomor WhatsApp dipakai dalam dua bentuk di halaman login: bentuk tautan
 * (62xxxxxxxxxx) dan bentuk yang terbaca (0821-9304-7243). Admin cukup
 * mengetik satu kali; keduanya diturunkan di sini.
 *
 * Alasannya bukan sekadar hemat ketikan. Di template lama kedua bentuk itu
 * diisi manual dan pernah tidak cocok — yang tertulis di layar 0811-1200-1036
 * sedangkan tautannya menuju nomor yang sama sekali berbeda, sehingga
 * pelanggan yang menyalin nomor dengan mata menghubungi orang lain.
 */

export type Nomor = { wa: string; tampil: string };

/**
 * Menerima 08xx, 62xx, +62xx, dengan atau tanpa spasi dan tanda hubung.
 * Melempar kalau hasilnya jelas bukan nomor Indonesia.
 */
export function pecahNomor(mentah: string): Nomor {
  const angka = mentah.replace(/[^0-9]/g, "");
  if (!angka) throw new Error("Nomor WhatsApp belum diisi.");

  let lokal: string;
  if (angka.startsWith("62")) lokal = "0" + angka.slice(2);
  else if (angka.startsWith("0")) lokal = angka;
  else lokal = "0" + angka;

  if (lokal.length < 10 || lokal.length > 14) {
    throw new Error(`Nomor WhatsApp "${mentah}" panjangnya tidak wajar (${lokal.length} digit).`);
  }
  if (!lokal.startsWith("08")) {
    throw new Error(`Nomor WhatsApp harus diawali 08, 62, atau +62. Diterima "${mentah}".`);
  }

  return {
    wa: "62" + lokal.slice(1),
    tampil: lokal.match(/.{1,4}/g)!.join("-"),
  };
}
