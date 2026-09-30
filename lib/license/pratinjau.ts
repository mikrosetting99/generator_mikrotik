import { readFile } from "node:fs/promises";
import path from "node:path";
import { cetakLoginHtml, type Pesanan } from "./build";

const AKAR_TEMPLATE = path.join(process.cwd(), "templates");

/** Gambar bawaan tema sebagai data URI, atau null kalau temanya tidak punya. */
async function gambarTemplate(slug: string, nama: string, mime: string): Promise<string | null> {
  try {
    const isi = await readFile(path.join(AKAR_TEMPLATE, slug, nama));
    return `data:${mime};base64,${isi.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Halaman login yang bisa dibuka langsung di browser.
 *
 * Dicetak lewat cetakLoginHtml yang sama dengan hasil unduhan — bukan jalur
 * terpisah — supaya yang dilihat memang yang akan diterima pembeli. Yang
 * berbeda hanya dua hal, dan keduanya memang tidak bisa dihindari:
 *
 * 1. Gambar disisipkan sebagai data URI. Di dalam iframe tidak ada folder
 *    img/, jadi tautan relatif tidak akan ketemu.
 * 2. Blok khusus router dibuang. $(if chap-id) dan kawan-kawannya hanya
 *    dimengerti servlet hotspot; di browser biasa itu tampil sebagai teks.
 *
 * Pemeriksa lisensi sengaja DIBIARKAN. Karena $(identity) tidak tersubstitusi,
 * pemeriksanya masuk mode uji dan meloloskan halaman — sekaligus membuktikan
 * blok lisensinya ikut tercetak dan tidak error.
 */
export async function cetakPratinjau(p: Pesanan): Promise<string> {
  let html = await cetakLoginHtml(p);

  const latar = p.bgDataUrl || (await gambarTemplate(p.templateSlug, "img/bg.jpg", "image/jpeg"));
  const logo = p.logoDataUrl || null;

  /* Kalau tidak ada gambarnya, tautan relatifnya sengaja dibiarkan gagal:
     halaman punya pengait onload/onerror yang justru menampilkan hiasan
     bawaan tema saat gambar tidak ketemu. Itu perilaku yang benar.

     Kalau ada, gambarnya disisipkan SEKALI saja. Mengganti setiap kemunculan
     "img/bg.jpg" tampak lebih sederhana tapi mahal: di tiap template kata itu
     muncul tujuh kali — empat di antaranya cuma komentar — dan pratinjau tema
     MOBA sempat membengkak dari 540 KB jadi 3,4 MB karenanya. */
  if (latar) {
    html = html.replace("url('img/bg.jpg')", `url('${latar}')`);
    /* Pengendus cukup diberi tahu langsung; memuat ulang gambar yang sama
       berarti salinan kedua data URI-nya. */
    html = html.replace("probe.src = 'img/bg.jpg';", "addCls('hasbg');");
    /* Poster video hanya dipakai kalau latar video dinyalakan, tapi tetap
       diminta browser. Dikosongkan supaya tidak ada permintaan yang gagal. */
    html = html.replace('poster="img/bg.jpg"', 'poster=""');
  }
  if (logo) html = html.split("img/logo.png").join(logo);

  return html
    .replace(/\$\(if chap-id\)[\s\S]*?\$\(endif\)\n/, "")
    .replace(/\$\(if error\)[\s\S]*?\$\(endif\)/, "")
    .replace(/action="\$\(link-login-only\)"/g, 'action="#"')
    .replace(/value="\$\((?:username|link-orig)\)"/g, 'value=""');
}
