import { readFileSync } from "node:fs";

/**
 * Memuat .env.local untuk skrip yang dijalankan langsung lewat tsx.
 *
 * Sebelumnya tiap skrip memakai nilai cadangan `process.env.X ||= "..."` yang
 * berisi salt sungguhan. Nyaman, tapi berarti salt itu tertulis di dalam kode
 * yang ter-commit — dan repo ini publik. Sekarang nilainya hanya ada di
 * .env.local, yang tidak pernah masuk git.
 */
export function muatEnvLokal(): void {
  let isi: string;
  try {
    isi = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }

  for (const baris of isi.split("\n")) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith("#")) continue;
    const batas = bersih.indexOf("=");
    if (batas < 1) continue;
    const kunci = bersih.slice(0, batas).trim();
    if (process.env[kunci] !== undefined) continue;
    process.env[kunci] = bersih.slice(batas + 1).trim().replace(/^["']|["']$/g, "");
  }
}

/** Memuat env lalu memastikan salt benar-benar ada. */
export function wajibAdaSalt(): void {
  muatEnvLokal();
  if (!process.env.MSLP_LICENSE_SALT) {
    console.error(
      "MSLP_LICENSE_SALT belum diisi.\n" +
        "Isi di .env.local, atau jalankan dengan: MSLP_LICENSE_SALT=... npx tsx <skrip>"
    );
    process.exit(1);
  }
  process.env.MSLP_LICENSOR_WA ||= "6281112001036";
}
