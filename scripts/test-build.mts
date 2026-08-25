/**
 * Mencetak keenam template dengan satu pesanan contoh, lalu memeriksanya.
 *
 *   npx tsx scripts/test-build.ts
 *
 * Hasilnya ditulis ke folder yang disebut di akhir supaya bisa dibuka di
 * browser dan dibandingkan dengan templatenya.
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { cetakLoginHtml, type Pesanan } from "../lib/license/build";
import { periksaLoginHtml } from "../lib/license/validate";
import { TEMPLATES } from "../lib/license/templates";

import { wajibAdaSalt } from "./_env.mts";

wajibAdaSalt();

const KELUAR = path.join(
  "C:/Users/arudi/AppData/Local/Temp/claude/d--Claude-Project-mikrosetting-website",
  "fcfd9ff4-097a-449a-8a2f-9bc8c9f28081/scratchpad/cetak-gm"
);

const paket: Pesanan["paket"] = [
  { nama: "6 JAM", harga: "3.000", metaAtas: "Masa aktif", metaBawah: "6 jam", warna: "#5ad6c0", rank: null },
  { nama: "1 HARI", harga: "5.000", metaAtas: "Masa aktif", metaBawah: "1 hari", warna: "#46c6e0", rank: null },
  { nama: "3 HARI", harga: "12.000", metaAtas: "Masa aktif", metaBawah: "3 hari", warna: "#3ea6ff", rank: null },
  { nama: "1 MINGGU", harga: "25.000", metaAtas: "Masa aktif", metaBawah: "7 hari", warna: "#2f7fe8", rank: null },
];

let gagal = 0;
await mkdir(KELUAR, { recursive: true });

for (const t of TEMPLATES) {
  const pesanan: Pesanan = {
    templateSlug: t.slug,
    namaUsaha: "WARUNG PAK BUDI",
    merekA: "WARUNG",
    merekB: "PAK BUDI",
    merekSpasi: true,
    tagline: "WIFI CEPAT HARGA MERAKYAT",
    footerTagline: "Internet Hotspot Voucher",
    waNomor: "6285712345678",
    waTampil: "0857-1234-5678",
    paket,
    warna: {},
    bank: null,
    logoDataUrl: "",
    bgDataUrl: "",
    routerIdentity: "MikroTik-WarungPakBudi",
  };

  try {
    const html = await cetakLoginHtml(pesanan);
    const temuan = periksaLoginHtml(html, {
      jumlahKartu: paket.length,
      waPembeli: pesanan.waNomor,
      waPenerbit: process.env.MSLP_LICENSOR_WA!,
    });

    const asli = await readFile(path.join("templates", t.slug, "login.html"), "utf8");
    const berat = temuan.filter((x) => x.berat);

    console.log(
      `  ${t.slug.padEnd(22)} ${String(asli.length).padStart(6)} -> ${String(html.length).padStart(6)} byte  ` +
        (berat.length ? `GAGAL (${berat.length})` : "lolos") +
        (temuan.length > berat.length ? `  +${temuan.length - berat.length} ringan` : "")
    );
    for (const x of temuan) console.log(`      ${x.berat ? "BERAT " : "ringan"} ${x.pesan}`);
    if (berat.length) gagal++;

    /* Versi pratinjau: buang kode khusus router supaya bisa dibuka di browser. */
    const pratinjau = html
      .replace(/\$\(if chap-id\)[\s\S]*?\$\(endif\)\n/, "")
      .replace(/\$\(if error\)[\s\S]*?\$\(endif\)/, "")
      .replace(/value="\$\(username\)"/g, 'value=""')
      .replace(/action="\$\(link-login-only\)"/g, 'action="#"')
      .replace(/value="\$\(link-orig\)"/g, 'value=""');
    await writeFile(path.join(KELUAR, `${t.slug}.html`), pratinjau);
  } catch (e) {
    gagal++;
    console.log(`  ${t.slug.padEnd(22)} ERROR  ${(e as Error).message}`);
  }
}

console.log(`\n${gagal ? `${gagal} template GAGAL` : "semua template lolos"}`);
console.log(`hasil: ${KELUAR}`);
