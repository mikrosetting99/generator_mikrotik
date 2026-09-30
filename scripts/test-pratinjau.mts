/**
 * Menguji pencetak pratinjau untuk semua tema.
 *
 *   npx tsx scripts/test-pratinjau.mts
 *
 * Rutenya sendiri terjaga middleware sehingga tidak bisa diuji dengan curl
 * tanpa sesi; rute itu tipis dan hanya membaca form lalu memanggil fungsi ini.
 */
import { cetakPratinjau } from "../lib/license/pratinjau";
import { TEMPLATES } from "../lib/license/templates";
import type { Pesanan } from "../lib/license/build";

import { wajibAdaSalt } from "./_env.mts";

wajibAdaSalt();

const dasar: Omit<Pesanan, "templateSlug"> = {
  namaUsaha: "WARUNG PAK BUDI", merekA: "WARUNG", merekB: "PAK BUDI", merekSpasi: true,
  tagline: "WIFI CEPAT HARGA MERAKYAT", footerTagline: "Internet Hotspot Voucher",
  waNomor: "6285712345678", waTampil: "0857-1234-5678",
  paket: [
    { nama: "6 JAM", harga: "3.000", metaAtas: "Masa aktif", metaBawah: "6 jam", warna: "#5ad6c0", rank: null },
    { nama: "1 HARI", harga: "5.000", metaAtas: "Masa aktif", metaBawah: "1 hari", warna: "#46c6e0", rank: null },
  ],
  warna: {}, bank: null, logoDataUrl: "", bgDataUrl: "", routerIdentity: null,
};

let gagal = 0;
for (const t of TEMPLATES) {
  const html = await cetakPratinjau({ ...dasar, templateSlug: t.slug });

  const cek: [string, boolean][] = [
    ["dua kartu", (html.match(/<a class="pk"/g) ?? []).length === 2],
    ["grid ikut 2 kolom", html.includes("repeat(2,minmax(0,1fr))")],
    ["merek terpasang", html.includes(">WARUNG</span>") && html.includes(">PAK BUDI</span>")],
    ["tidak ada blok khusus router tersisa", !html.includes("$(if ") && !html.includes("$(endif)")],
    ["form tidak menembak router", !html.includes('action="$(link-login-only)"')],
    ["latar bawaan jadi data URI", t.punyaLatarBawaan
      ? html.includes("url('data:image/jpeg;base64,") || html.includes('data:image/jpeg;base64,')
      : !html.includes("data:image/jpeg;base64,")],
    ["pemeriksa lisensi ikut tercetak", html.includes("var LIS_KEY")],
  ];

  const salah = cek.filter(([, ok]) => !ok);
  gagal += salah.length ? 1 : 0;
  console.log(
    `  ${t.slug.padEnd(22)} ${String(Math.round(html.length / 1024)).padStart(4)} KB  ` +
      (salah.length ? `GAGAL: ${salah.map(([n]) => n).join(", ")}` : "lolos")
  );
}
console.log(`\n${gagal ? `${gagal} tema GAGAL` : "semua tema lolos"}`);
