/**
 * Menyeragamkan enam template supaya generator hanya perlu satu jangkar,
 * bukan satu jangkar per tema.
 *
 * Dijalankan sekali, hasilnya dikomit. Aman diulang — setiap penggantian
 * memeriksa bentuk lamanya dulu, jadi menjalankan dua kali tidak merusak.
 *
 *   node scripts/normalise-templates.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const TEMPLATES = [
  "MSLP-NARUTO",
  "MSLP-ML",
  "MSLP-PUBG",
  "MSLP-FF",
  "MSLP-UMUM",
  "MSLP-SPSI-STARLINK",
];

let berubah = 0;

for (const t of TEMPLATES) {
  const berkas = `templates/${t}/login.html`;
  const asli = readFileSync(berkas, "utf8");
  let html = asli;
  const catatan = [];

  /* ---------------------------------------------------------------
     1. repeat(N,1fr) -> repeat(N,minmax(0,1fr))

     Trek 1fr menolak menyusut di bawah lebar min-content isinya, jadi
     kartu memaksa halaman melebar ke samping alih-alih ikut mengecil.
     Saat ini hanya NARUTO yang benar-benar lewat (361px di layar 360px),
     tapi begitu generator menulis harga atau nama paket yang lebih
     panjang, sisanya menyusul. minmax(0,1fr) mengizinkan penyusutan.
     --------------------------------------------------------------- */
  html = html.replace(
    /\.paket\{display:grid;grid-template-columns:repeat\((\d+),1fr\)/,
    (_m, n) => {
      catatan.push(`grid ${n} kolom -> minmax`);
      return `.paket{display:grid;grid-template-columns:repeat(${n},minmax(0,1fr))`;
    }
  );

  /* Baris yang sama dikutip di panduan dalam <style>; biarkan cocok. */
  html = html.replace(
    /\.paket\{grid-template-columns:repeat\((\d+),1fr\)/,
    (_m, n) => `.paket{grid-template-columns:repeat(${n},minmax(0,1fr))`
  );

  /* ---------------------------------------------------------------
     2. Logo teks selalu dua <span>

     MSLP-UMUM menaruh bagian putihnya sebagai teks telanjang, sehingga
     generator tidak punya tempat untuk menuliskannya. Membungkusnya
     dalam <span class="a"> tidak mengubah tampilan karena .wm .a tidak
     punya aturan warna sendiri di tema itu — warnanya diwarisi dari .wm.
     --------------------------------------------------------------- */
  html = html.replace(
    /<div class="wm">([^<]+)<span class="b">/,
    (_m, putih) => {
      catatan.push("logo teks dibungkus <span class=\"a\">");
      return `<div class="wm"><span class="a">${putih}</span><span class="b">`;
    }
  );

  if (html !== asli) {
    writeFileSync(berkas, html);
    berubah++;
    console.log(`  ${t.padEnd(22)} ${catatan.join(", ")}`);
  } else {
    console.log(`  ${t.padEnd(22)} sudah seragam`);
  }
}

console.log(`\n${berubah} template diubah.`);
