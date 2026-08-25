/**
 * Membuat gambar kecil tiap tema untuk pemilih tema di /lisensi.
 *
 *   npx tsx scripts/buat-thumbnail.mts
 *
 * Gambarnya dirender dari hasil cetak yang SUNGGUHAN — pesanan contoh dilewatkan
 * ke pencetak yang sama dengan yang dipakai tombol unduh. Jadi kalau suatu saat
 * template berubah, jalankan ulang skrip ini dan pemilih temanya ikut benar.
 * Gambar hias yang digambar terpisah akan diam-diam basi.
 *
 * Butuh Google Chrome terpasang.
 */
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { cetakPratinjau } from "../lib/license/pratinjau";
import { TEMPLATES } from "../lib/license/templates";
import type { Pesanan } from "../lib/license/build";

const jalankan = promisify(execFile);

import { wajibAdaSalt } from "./_env.mts";

wajibAdaSalt();

const CHROME =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const KELUAR = path.join(process.cwd(), "public", "lisensi-thumb");
const SEMENTARA = path.join(process.cwd(), ".thumb-tmp");

/* Pesanan contoh yang netral: cukup mewakili tanpa menonjolkan merek mana pun. */
const CONTOH: Omit<Pesanan, "templateSlug"> = {
  namaUsaha: "WIFI DESA",
  merekA: "WIFI",
  merekB: "DESA",
  merekSpasi: true,
  tagline: "INTERNET CEPAT UNTUK SEMUA",
  footerTagline: "Internet Hotspot Voucher",
  waNomor: "6281112001036",
  waTampil: "0811-1200-1036",
  paket: [
    { nama: "6 JAM", harga: "3.000", metaAtas: "Masa aktif", metaBawah: "6 jam", warna: "#5ad6c0", rank: null },
    { nama: "1 HARI", harga: "5.000", metaAtas: "Masa aktif", metaBawah: "1 hari", warna: "#46c6e0", rank: null },
    { nama: "1 MINGGU", harga: "25.000", metaAtas: "Masa aktif", metaBawah: "7 hari", warna: "#3ea6ff", rank: null },
    { nama: "30 HARI", harga: "80.000", metaAtas: "Masa aktif", metaBawah: "30 hari", warna: "#2f7fe8", rank: null },
  ],
  warna: {},
  bank: null,
  logoDataUrl: "",
  bgDataUrl: "",
  routerIdentity: null,
};

await rm(SEMENTARA, { recursive: true, force: true });
await mkdir(SEMENTARA, { recursive: true });
await mkdir(KELUAR, { recursive: true });

for (const t of TEMPLATES) {
  const html = await cetakPratinjau({ ...CONTOH, templateSlug: t.slug });
  const berkas = path.join(SEMENTARA, `${t.slug}.html`);
  await writeFile(berkas, html);

  /* Chrome headless menolak jendela lebih sempit dari ~504px, jadi halaman
     dibungkus iframe selebar 390px. Tanpa ini gambarnya terpotong, bukan
     mengecil — pernah salah didiagnosis sebagai bug tata letak. */
  const bungkus = path.join(SEMENTARA, `w-${t.slug}.html`);
  await writeFile(
    bungkus,
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}
     iframe{display:block;width:390px;height:780px;border:0}</style>
     <iframe src="${t.slug}.html"></iframe>`
  );

  await jalankan(CHROME, [
    "--headless",
    "--disable-gpu",
    "--allow-file-access-from-files",
    "--hide-scrollbars",
    "--window-size=390,780",
    "--virtual-time-budget=6000",
    `--screenshot=${path.join(SEMENTARA, `${t.slug}.png`)}`,
    bungkus,
  ]).catch(() => {});

  console.log(`  ${t.slug} dirender`);
}

/* PNG mentah dipindahkan dulu; langkah berikutnya yang mengecilkannya. */
for (const nama of await readdir(SEMENTARA)) {
  if (nama.endsWith(".png")) await rename(path.join(SEMENTARA, nama), path.join(KELUAR, nama));
}
await rm(SEMENTARA, { recursive: true, force: true });

/* ------------------------------------------------------------------ *
 * PNG hasil tangkapan terlalu berat untuk pemilih tema yang memuat enam
 * gambar sekaligus (total ~1,4 MB). Dikecilkan ke lebar 320px lalu disimpan
 * sebagai JPEG lewat canvas di Chrome — proyek ini tidak punya pustaka
 * pengolah gambar, dan menambahkannya hanya untuk ini tidak sepadan.
 * ------------------------------------------------------------------ */

const LEBAR_KECIL = 320;
const daftar = (await readdir(KELUAR)).filter((n) => n.endsWith(".png"));

const halaman = path.join(process.cwd(), ".thumb-kecil.html");
await writeFile(
  halaman,
  `<!doctype html><meta charset="utf-8"><body><div id="out"></div><script>
   const nama = ${JSON.stringify(daftar)};
   const hasil = {};
   let sisa = nama.length;
   for (const n of nama) {
     const img = new Image();
     img.onload = () => {
       const s = ${LEBAR_KECIL} / img.naturalWidth;
       const c = document.createElement("canvas");
       c.width = ${LEBAR_KECIL}; c.height = Math.round(img.naturalHeight * s);
       c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
       hasil[n] = c.toDataURL("image/jpeg", 0.78);
       if (--sisa === 0) document.getElementById("out").textContent = JSON.stringify(hasil);
     };
     img.onerror = () => { if (--sisa === 0) document.getElementById("out").textContent = JSON.stringify(hasil); };
     img.src = "public/lisensi-thumb/" + n;
   }
   </script></body>`
);

const { stdout } = await jalankan(CHROME, [
  "--headless",
  "--disable-gpu",
  "--allow-file-access-from-files",
  "--virtual-time-budget=20000",
  "--dump-dom",
  halaman,
], { maxBuffer: 64 * 1024 * 1024 });

const cocok = stdout.match(/<div id="out">(\{[\s\S]*?\})<\/div>/);
if (cocok) {
  const peta: Record<string, string> = JSON.parse(cocok[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  for (const [nama, dataUrl] of Object.entries(peta)) {
    const jpg = nama.replace(/\.png$/, ".jpg");
    await writeFile(path.join(KELUAR, jpg), Buffer.from(dataUrl.split(",")[1], "base64"));
    await rm(path.join(KELUAR, nama));
  }
  console.log(`${Object.keys(peta).length} gambar dikecilkan ke ${LEBAR_KECIL}px JPEG`);
} else {
  console.log("PERINGATAN: pengecilan gagal, PNG dibiarkan apa adanya");
}
await rm(halaman, { force: true });

console.log("\nselesai: public/lisensi-thumb/");
