/**
 * Menolak rahasia yang bocor ke berkas yang dilacak git.
 *
 *   node scripts/periksa-rahasia.mjs
 *
 * Dibuat setelah kejadian nyata: salt lisensi tertulis di dalam enam berkas
 * template, lima panduan, dan empat skrip — semuanya siap ter-commit ke repo
 * yang PUBLIK. Kalau itu terlanjur ter-push, siapa pun bisa menghitung kunci
 * lisensi yang sah untuk router mana pun, dan tidak bisa ditarik kembali:
 * ada di fork, mirror, dan pengais otomatis. Menggantinya kemudian justru
 * mematikan kunci semua pelanggan yang sudah membeli.
 *
 * Nilai yang dicari dibaca dari .env.local, tidak pernah ditulis di sini —
 * pemeriksa rahasia yang memuat rahasianya sendiri tidak ada gunanya.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/* ---- nilai yang tidak boleh muncul ---- */

function bacaEnvLokal() {
  try {
    const isi = readFileSync(".env.local", "utf8");
    const peta = {};
    for (const baris of isi.split("\n")) {
      const b = baris.trim();
      if (!b || b.startsWith("#")) continue;
      const i = b.indexOf("=");
      if (i < 1) continue;
      peta[b.slice(0, i).trim()] = b.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
    return peta;
  } catch {
    return {};
  }
}

const env = bacaEnvLokal();
const rahasia = [
  ["MSLP_LICENSE_SALT", env.MSLP_LICENSE_SALT],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", env.NEXT_PUBLIC_SUPABASE_ANON_KEY],
].filter(([, nilai]) => nilai && nilai.length >= 8);

if (!rahasia.length) {
  console.log("Tidak ada rahasia di .env.local untuk diperiksa — dilewati.");
  process.exit(0);
}

/* ---- berkas yang dilacak git ---- */

const berkas = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

let temuan = 0;
for (const f of berkas) {
  let isi;
  try {
    isi = readFileSync(f, "utf8");
  } catch {
    continue; /* berkas biner */
  }
  for (const [nama, nilai] of rahasia) {
    if (isi.includes(nilai)) {
      console.error(`  BOCOR  ${f}  memuat ${nama}`);
      temuan++;
    }
  }
}

if (temuan) {
  console.error(
    `\nGAGAL: ${temuan} kebocoran. JANGAN commit sebelum diperbaiki.\n` +
      "Berkas template boleh memakai penanda; pencetak menimpanya dari environment."
  );
  process.exit(1);
}

console.log(`Bersih: ${berkas.length} berkas terlacak, ${rahasia.length} rahasia diperiksa.`);
