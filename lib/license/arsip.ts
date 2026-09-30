import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Menyimpan salinan hasil cetak di server, supaya bisa diambil lewat File
 * Manager aaPanel tanpa membuka aplikasi.
 *
 * LETAKNYA DI LUAR public/. Nginx di aaPanel hanya meneruskan ke Next.js
 * (`location / { proxy_pass ... }`), jadi berkas di sini tidak punya alamat
 * web sama sekali. Menaruhnya di public/ akan membuat halaman berlisensi bisa
 * diunduh siapa pun yang menebak namanya.
 *
 * Satu pesanan = satu berkas yang ditimpa, bukan satu berkas per unduhan.
 * Arsip yang beranak setiap kali tombol ditekan akan memenuhi disk VPS dalam
 * hitungan bulan, dan yang lama tidak ada gunanya — isinya selalu bisa
 * dicetak ulang dari data pesanan.
 */

const AKAR = process.env.MSLP_ARSIP_DIR || path.join(process.cwd(), "data", "hasil");

/** Nama berkas yang stabil untuk satu pesanan. */
export function namaArsip(nomor: number | null, namaUsaha: string, templateSlug: string): string {
  const bersih = namaUsaha.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tanpa-nama";
  const awalan = nomor ? String(nomor).padStart(4, "0") : "draft";
  return `${awalan}-${bersih}-${templateSlug}.zip`;
}

/**
 * Menyimpan, lalu mengembalikan jalur lengkapnya — atau null kalau gagal.
 *
 * Kegagalan menulis TIDAK boleh membatalkan unduhan. Arsip ini kemudahan
 * tambahan; yang dibutuhkan pengguna saat menekan tombol adalah berkasnya
 * sampai ke tangannya, bukan salinannya sampai ke disk.
 */
export async function simpanArsip(nama: string, isi: Buffer): Promise<string | null> {
  try {
    await mkdir(AKAR, { recursive: true });
    const tujuan = path.join(AKAR, nama);
    await writeFile(tujuan, isi);
    return tujuan;
  } catch (e) {
    console.warn(`[lisensi] arsip gagal disimpan: ${(e as Error).message}`);
    return null;
  }
}

/** Jalur folder arsip, untuk ditampilkan ke admin. */
export function folderArsip(): string {
  return AKAR;
}

/**
 * Jalur lengkap arsip satu pesanan, dengan pemisah sesuai sistem operasi
 * server — backslash di Windows saat pengembangan, garis miring di VPS.
 */
export function jalurArsip(nomor: number | null, namaUsaha: string, templateSlug: string): string {
  return path.join(AKAR, namaArsip(nomor, namaUsaha, templateSlug));
}
