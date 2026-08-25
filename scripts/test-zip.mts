/**
 * Menguji jalur unduhan sampai zip jadi, tanpa lewat basis data.
 *
 *   npx tsx scripts/test-zip.mts
 *
 * Isi zip dibaca dengan pembaca kecil di bawah, bukan pustaka: zip di proyek
 * ini ditulis dengan metode "store", jadi setiap berkas tersimpan apa adanya
 * dan bisa dibaca langsung dari buffer.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { cetakZip } from "../lib/license/zip";
import { pecahNomor } from "../lib/license/nomor";
import type { Pesanan } from "../lib/license/build";

import { wajibAdaSalt } from "./_env.mts";

wajibAdaSalt();

/** Nama dan isi setiap berkas dalam zip. */
function bacaZip(buf: Buffer): Map<string, Buffer> {
  const keluar = new Map<string, Buffer>();
  let i = 0;
  while (i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const metode = buf.readUInt16LE(i + 8);
    const terkompres = buf.readUInt32LE(i + 18);
    const panjangNama = buf.readUInt16LE(i + 26);
    const panjangExtra = buf.readUInt16LE(i + 28);
    const nama = buf.toString("utf8", i + 30, i + 30 + panjangNama);
    const awal = i + 30 + panjangNama + panjangExtra;
    const mentah = buf.subarray(awal, awal + terkompres);
    keluar.set(nama, metode === 8 ? inflateRawSync(mentah) : mentah);
    i = awal + terkompres;
  }
  return keluar;
}

/**
 * Berapa kali satu nama muncul sebagai entri zip.
 *
 * Sengaja membaca header mentah, bukan hasil bacaZip: Map menelan duplikat,
 * sehingga pemeriksaan entri ganda lewat Map tidak akan pernah menyala.
 */
function hitungEntri(buf: Buffer, cari: string): number {
  let i = 0, n = 0;
  while (i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18);
    const nl = buf.readUInt16LE(i + 26);
    const el = buf.readUInt16LE(i + 28);
    if (buf.toString("utf8", i + 30, i + 30 + nl) === cari) n++;
    i = i + 30 + nl + el + size;
  }
  return n;
}

/* ---- pecahNomor ---- */
console.log("pecahNomor:");
for (const masuk of ["082193047243", "62 821 9304 7243", "+6282193047243", "0811-1200-1036"]) {
  const n = pecahNomor(masuk);
  console.log(`  ${masuk.padEnd(20)} -> wa=${n.wa}  tampil=${n.tampil}`);
}
for (const buruk of ["", "12345", "62812345678901234", "999999999999"]) {
  try {
    pecahNomor(buruk);
    console.log(`  ${JSON.stringify(buruk).padEnd(20)} -> LOLOS PADAHAL BURUK`);
  } catch (e) {
    console.log(`  ${JSON.stringify(buruk).padEnd(20)} -> ditolak: ${(e as Error).message}`);
  }
}

/* Logo kecil 1x1 PNG, cukup untuk membuktikan gambar ikut masuk zip. */
const LOGO_UJI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const pesanan: Pesanan = {
  templateSlug: "MSLP-SPSI-STARLINK",
  namaUsaha: "PT.SPSI STARLINK",
  merekA: "PT.SPSI",
  merekB: "STARLINK",
  merekSpasi: true,
  tagline: "INTERNET SATELIT CEPAT & STABIL",
  footerTagline: "Internet Satelit",
  waNomor: "6282193047243",
  waTampil: "0821-9304-7243",
  paket: [
    { nama: "9 JAM", harga: "5.000", metaAtas: "Masa aktif", metaBawah: "17 jam", warna: "#5ad6c0", rank: null },
    { nama: "24 JAM", harga: "10.000", metaAtas: "Masa aktif", metaBawah: "1 hari", warna: "#46c6e0", rank: null },
    { nama: "1 MINGGU", harga: "60.000", metaAtas: "Masa aktif", metaBawah: "7 hari", warna: "#3ea6ff", rank: null },
    { nama: "30 HARI", harga: "150.000", metaAtas: "Masa aktif", metaBawah: "30 hari", warna: "#2f7fe8", rank: null },
  ],
  warna: { utama: "#3ea6ff" },
  bank: { nama: "BANK MANDIRI", nomor: "1480019642589", atasNama: "EKO SANTOSO" },
  logoDataUrl: LOGO_UJI,
  bgDataUrl: "",
  routerIdentity: "SPSI-STARLINK",
};

console.log("\ncetakZip:");
const hasil = await cetakZip(pesanan, 1);
console.log(`  nama berkas : ${hasil.namaBerkas}`);
console.log(`  ukuran      : ${(hasil.isi.length / 1024).toFixed(1)} KB`);
console.log(`  kunci       : ${hasil.kunci}`);

const isi = bacaZip(hasil.isi);
console.log(`  ${isi.size} berkas: ${[...isi.keys()].sort().join(", ")}`);

const html = isi.get("login.html")!.toString("utf8");
const panduan = isi.get("PANDUAN-EDIT.txt")!.toString("utf8");

const cek: [string, boolean][] = [
  ["kunci tertanam", html.includes(`var LIS_KEY  = "${hasil.kunci}";`)],
  ["nomor pembeli di kartu", (html.match(/wa\.me\/6282193047243/g) ?? []).length >= 5],
  ["nomor penerbit di tombol lisensi", html.includes('id="lisWa" href="https://wa.me/6281112001036"')],
  ["rekening terisi", html.includes("1480019642589") && html.includes("a.n. EKO SANTOSO")],
  ["4 kartu", (html.match(/<a class="pk"/g) ?? []).length === 4],
  ["grid 4 kolom", html.includes("repeat(4,minmax(0,1fr))")],
  ["tema Satelit tidak punya latar bawaan", !isi.has("img/bg.jpg")],
  ["logo yang ikut adalah milik pesanan, bukan logo penjual", (isi.get("img/logo.png")?.length ?? 0) < 200],
  ["font biner utuh", (isi.get("font/fontello.woff2")?.length ?? 0) > 1000],
  ["favicon biner utuh", (isi.get("favicon.ico")?.length ?? 0) > 100],
  ["preview.html tidak ikut", !isi.has("preview.html")],
  ["md5.js ikut", isi.has("md5.js")],
  ["bagian internal lisensi dipotong", !panduan.includes("khusus MIKROSETTING")],
  ["panduan tidak menyebut LIS_SALT", !panduan.includes("LIS_SALT")],
  ["panduan tidak menunjuk alat pembuat kunci", !panduan.includes("_LISENSI-MIKROSETTING")],
  ["panduan pakai nomor pembeli", panduan.includes("6282193047243")],
  ["bagian panduan lain utuh", panduan.includes("GANTI PAKET") && panduan.includes("UPLOAD KE MIKROTIK")],
];

let gagal = 0;
console.log();
for (const [nama, lolos] of cek) {
  if (!lolos) gagal++;
  console.log(`  ${lolos ? "ok    " : "GAGAL "} ${nama}`);
}

const keluar = path.join(
  "C:/Users/arudi/AppData/Local/Temp/claude/d--Claude-Project-mikrosetting-website",
  "fcfd9ff4-097a-449a-8a2f-9bc8c9f28081/scratchpad/cetak-gm/contoh.zip"
);
await writeFile(keluar, hasil.isi);
console.log(`\n${gagal ? `${gagal} pemeriksaan GAGAL` : "semua lolos"}\nzip: ${keluar}`);

/* ---- latar bawaan tema vs latar unggahan ---- */
console.log("\nlatar bawaan tema:");
const LATAR_UJI =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

for (const [judul, bg] of [["tanpa unggahan", ""], ["dengan unggahan", LATAR_UJI]] as const) {
  const h = await cetakZip({ ...pesanan, templateSlug: "MSLP-ML", bgDataUrl: bg }, 2);
  const daftar = bacaZip(h.isi);
  const bgIsi = daftar.get("img/bg.jpg");
  const jumlahBg = hitungEntri(h.isi, "img/bg.jpg");
  console.log(
    `  ${judul.padEnd(18)} img/bg.jpg ${bgIsi ? `${Math.round(bgIsi.length / 1024)} KB` : "TIDAK ADA"}` +
      `  entri ganda: ${jumlahBg > 1 ? "YA (BUG)" : "tidak"}` +
      `  total berkas: ${daftar.size}`
  );
}
