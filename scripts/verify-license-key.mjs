/**
 * Membuktikan lib/license/key.ts menghasilkan kunci yang sama persis dengan
 * implementasi JavaScript yang sudah beredar.
 *
 * Acuannya BUKAN salinan tulisan tangan: berkas generator-lisensi.html dibaca,
 * blok <script>-nya diambil, lalu dijalankan apa adanya. Jadi kalau generator
 * itu berubah, uji ini ikut berubah dan ketidakcocokan langsung ketahuan.
 *
 * Jalankan:  node scripts/verify-license-key.mjs
 */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const GENERATOR =
  "g:/My Drive/Work OOS/SETTING MIKROTIK/STANDAR LOGIN PAGE/_LISENSI-MIKROSETTING/generator-lisensi.html";

/* ---- acuan: jalankan JavaScript asli dari generator ---- */

const html = readFileSync(GENERATOR, "utf8");
const mulai = html.lastIndexOf("<script>");
const habis = html.lastIndexOf("</script>");
if (mulai < 0 || habis < 0) throw new Error("blok <script> tidak ketemu di generator");

const kode = html.slice(mulai + "<script>".length, habis);
const kotak = createContext({ document: { getElementById: () => null }, alert: () => {} });
runInContext(kode, kotak);

const saltAsli = runInContext("LIS_SALT", kotak);
const kunciAsli = (id) => {
  runInContext(`__id = ${JSON.stringify(id)}`, kotak);
  return runInContext("buatKunci(__id)", kotak);
};

/* ---- yang diuji: implementasi TypeScript ---- */

/* Node 24 melucuti anotasi tipe sendiri, jadi .ts bisa diimpor langsung. */
const { buatKunci } = await import("../lib/license/key.ts");

/* ---- masukan uji ---- */

const contoh = [
  "MikroTik",
  "MikroTik-WarungPakBudi",
  "SignalQu-LAB",
  "PT.SPSI STARLINK",
  "hotspot-01",
  "",
  " ",
  "a",
  "ID dengan spasi   di tengah",
  "Ünïcödé-Rôutér",
  "日本語ルーター",
  "192.168.88.1",
  "X".repeat(200),
  "!@#$%^&*()_+-=[]{}|;':\",./<>?",
];
for (let i = 0; i < 500; i++) {
  const n = 1 + (i % 40);
  let s = "";
  for (let j = 0; j < n; j++) s += String.fromCharCode(32 + ((i * 31 + j * 7) % 95));
  contoh.push(s);
}

/* ---- bandingkan ---- */

let beda = 0;
for (const id of contoh) {
  const a = kunciAsli(id);
  const b = buatKunci(id, saltAsli);
  if (a !== b) {
    beda++;
    if (beda <= 5) console.log(`  BEDA  ${JSON.stringify(id)}\n        asli=${a}\n        baru=${b}`);
  }
}

if (beda) {
  console.log(`\nGAGAL: ${beda} dari ${contoh.length} masukan menghasilkan kunci berbeda.`);
  process.exit(1);
}
console.log(`LULUS: ${contoh.length} masukan, semua kunci sama persis.`);
console.log(`  contoh  "MikroTik-WarungPakBudi"  ->  ${buatKunci("MikroTik-WarungPakBudi", saltAsli)}`);
