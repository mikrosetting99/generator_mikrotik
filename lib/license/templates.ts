/**
 * Daftar template login page yang bisa dicetak generator.
 *
 * Berkasnya ada di templates/<slug>/ dan ikut dikomit, jadi versi template
 * terikat pada versi aplikasi — pesanan yang dicetak ulang enam bulan lagi
 * menghasilkan berkas yang sama, bukan hasil template yang sudah bergeser.
 *
 * Slot warna berbeda tiap tema karena temanya memang tidak memakai nama
 * variabel yang sama. Yang seragam hanya struktur HTML-nya; itu sudah
 * cukup untuk generator, dan menyeragamkan warna berarti membuang identitas
 * tiap tema.
 */

/** Satu warna yang boleh diubah admin, beserta variabel turunannya. */
export type SlotWarna = {
  kunci: string;
  label: string;
  /** Variabel CSS di :root, ditulis penuh seperti "--acc:#f0c04a;" */
  variabel: string;
  bawaan: string;
  /**
   * Variabel lain yang mengulang warna yang sama dalam bentuk rgba().
   * Tanpa ini, mengubah warna utama meninggalkan garis dan bayangan
   * dengan warna lama — cacat yang paling kelihatan justru di MSLP-UMUM.
   */
  turunan?: { variabel: string; sebelum: string; alpha: string }[];
};

export type Template = {
  slug: string;
  nama: string;
  ringkas: string;
  /** Latar bawaan gelap atau terang — dipakai untuk pratinjau di admin. */
  gelap: boolean;
  maksKartu: number;
  /** Kartu paket punya pita nama tingkatan (KAGE, MYTHIC, ...). */
  punyaRank: boolean;
  /** Kartu paket punya deretan bintang. */
  punyaPips: boolean;
  /**
   * Tema ini membawa templates/<slug>/img/bg.jpg sendiri, yang ikut tercetak
   * kalau pesanan tidak mengunggah latar. Yang tidak punya jatuh ke hiasan
   * SVG bawaan halamannya.
   */
  punyaLatarBawaan: boolean;
  /** Nomor WhatsApp bawaan di dalam template, dipakai sebagai jangkar. */
  waAsli: string;
  nomorTampilAsli: string;
  merekAsli: string;
  taglineAsli: string;
  warna: SlotWarna[];
};

const NYALA_GELAP: SlotWarna["turunan"] = undefined;

export const TEMPLATES: Template[] = [
  {
    slug: "MSLP-NARUTO",
    nama: "Naruto",
    ringkas: "Gulungan kertas, oranye chakra, stempel merah.",
    gelap: true,
    maksKartu: 6,
    punyaRank: true,
    punyaPips: false,
    punyaLatarBawaan: true,
    waAsli: "6281112001036",
    nomorTampilAsli: "0811-1200-1036",
    merekAsli: "MIKROSETTING",
    taglineAsli: "INTERNET HOTSPOT VOUCHER",
    warna: [
      {
        kunci: "utama",
        label: "Oranye chakra (warna utama)",
        variabel: "--org:#ff8a2d;",
        bawaan: "#ff8a2d",
        turunan: [{ variabel: "--glow:rgba(255,138,45,.55);", sebelum: "--glow:rgba(", alpha: ".55" }],
      },
      { kunci: "utama2", label: "Oranye tua (gradasi tombol)", variabel: "--org2:#d94a10;", bawaan: "#d94a10", turunan: NYALA_GELAP },
      { kunci: "aksen", label: "Emas (garis dan sorotan)", variabel: "--gold:#e9b23c;", bawaan: "#e9b23c" },
    ],
  },
  {
    slug: "MSLP-ML",
    nama: "MOBA",
    ringkas: "Peta Land of Dawn, bingkai HUD emas, kotak login tembus pandang.",
    gelap: true,
    maksKartu: 6,
    punyaRank: true,
    punyaPips: true,
    punyaLatarBawaan: true,
    waAsli: "6281112001036",
    nomorTampilAsli: "0811-1200-1036",
    merekAsli: "MIKROSETTING",
    taglineAsli: "INTERNET HOTSPOT VOUCHER",
    warna: [
      {
        kunci: "utama",
        label: "Emas (warna utama)",
        variabel: "--acc:#f0c04a;",
        bawaan: "#f0c04a",
        turunan: [
          { variabel: "--glow:rgba(240,192,74,.55);", sebelum: "--glow:rgba(", alpha: ".55" },
          { variabel: "--panelLine:rgba(240,192,74,.45);", sebelum: "--panelLine:rgba(", alpha: ".45" },
        ],
      },
      { kunci: "utama2", label: "Emas tua (gradasi tombol)", variabel: "--acc2:#a9761b;", bawaan: "#a9761b" },
      { kunci: "aksen", label: "Biru terang (aksen)", variabel: "--acc3:#33d6ff;", bawaan: "#33d6ff" },
    ],
  },
  {
    slug: "MSLP-PUBG",
    nama: "PUBG",
    ringkas: "Kuning taktis, latar pasir dan zaitun.",
    gelap: true,
    maksKartu: 6,
    punyaRank: true,
    punyaPips: false,
    punyaLatarBawaan: false,
    waAsli: "6281112001036",
    nomorTampilAsli: "0811-1200-1036",
    merekAsli: "MIKROSETTING",
    taglineAsli: "INTERNET HOTSPOT VOUCHER",
    warna: [
      {
        kunci: "utama",
        label: "Kuning taktis (warna utama)",
        variabel: "--acc:#f2a71b;",
        bawaan: "#f2a71b",
        turunan: [
          { variabel: "--glow:rgba(242,167,27,.5);", sebelum: "--glow:rgba(", alpha: ".5" },
          { variabel: "--panelLine:rgba(242,167,27,.40);", sebelum: "--panelLine:rgba(", alpha: ".40" },
        ],
      },
      { kunci: "utama2", label: "Kuning tua (gradasi tombol)", variabel: "--acc2:#b3760c;", bawaan: "#b3760c" },
      { kunci: "aksen", label: "Zaitun (aksen)", variabel: "--acc3:#8fa04a;", bawaan: "#8fa04a" },
    ],
  },
  {
    slug: "MSLP-FF",
    nama: "Free Fire",
    ringkas: "Oranye api, latar merah bata.",
    gelap: true,
    maksKartu: 6,
    punyaRank: true,
    punyaPips: false,
    punyaLatarBawaan: false,
    waAsli: "6281112001036",
    nomorTampilAsli: "0811-1200-1036",
    merekAsli: "MIKROSETTING",
    taglineAsli: "INTERNET HOTSPOT VOUCHER",
    warna: [
      {
        kunci: "utama",
        label: "Oranye api (warna utama)",
        variabel: "--acc:#ff5a1f;",
        bawaan: "#ff5a1f",
        turunan: [
          { variabel: "--glow:rgba(255,90,31,.6);", sebelum: "--glow:rgba(", alpha: ".6" },
          { variabel: "--panelLine:rgba(255,90,31,.45);", sebelum: "--panelLine:rgba(", alpha: ".45" },
        ],
      },
      { kunci: "utama2", label: "Merah bata (gradasi tombol)", variabel: "--acc2:#c22a06;", bawaan: "#c22a06" },
      { kunci: "aksen", label: "Kuning (aksen)", variabel: "--acc3:#ffcc00;", bawaan: "#ffcc00" },
    ],
  },
  {
    slug: "MSLP-UMUM",
    nama: "Umum",
    ringkas: "Tanpa tema, latar terang, cocok untuk semua jenis usaha.",
    gelap: false,
    maksKartu: 6,
    punyaRank: false,
    punyaPips: false,
    punyaLatarBawaan: false,
    waAsli: "6281112001036",
    nomorTampilAsli: "0811-1200-1036",
    merekAsli: "MIKROSETTING",
    taglineAsli: "Internet Hotspot Voucher",
    warna: [
      {
        kunci: "utama",
        label: "Warna utama",
        variabel: "--acc:#4b56d6;",
        bawaan: "#4b56d6",
        turunan: [
          { variabel: "--acc-lembut:rgba(75,86,214,.10);", sebelum: "--acc-lembut:rgba(", alpha: ".10" },
          { variabel: "--acc-tepi:rgba(75,86,214,.28);", sebelum: "--acc-tepi:rgba(", alpha: ".28" },
          {
            variabel: "--bayang-aksen:0 6px 18px rgba(75,86,214,.28);",
            sebelum: "--bayang-aksen:0 6px 18px rgba(",
            alpha: ".28",
          },
        ],
      },
    ],
  },
  {
    slug: "MSLP-SPSI-STARLINK",
    nama: "Satelit",
    ringkas: "Bintang, cincin orbit, parabola. Dasar dari pesanan PT.SPSI STARLINK.",
    gelap: true,
    maksKartu: 6,
    punyaRank: false,
    punyaPips: false,
    punyaLatarBawaan: false,
    waAsli: "6282193047243",
    nomorTampilAsli: "0821-9304-7243",
    merekAsli: "PT.SPSI STARLINK",
    taglineAsli: "INTERNET SATELIT CEPAT &amp; STABIL",
    warna: [
      {
        kunci: "utama",
        label: "Biru langit (warna utama)",
        variabel: "--acc:#3ea6ff;",
        bawaan: "#3ea6ff",
        turunan: [
          { variabel: "--glow:rgba(62,166,255,.5);", sebelum: "--glow:rgba(", alpha: ".5" },
          { variabel: "--panelLine:rgba(110,178,255,.42);", sebelum: "--panelLine:rgba(", alpha: ".42" },
        ],
      },
      { kunci: "utama2", label: "Biru tua (gradasi tombol)", variabel: "--acc2:#1a5fb4;", bawaan: "#1a5fb4" },
      { kunci: "aksen", label: "Biru muda (aksen)", variabel: "--acc3:#8fd3ff;", bawaan: "#8fd3ff" },
    ],
  },
];

export function cariTemplate(slug: string): Template {
  const t = TEMPLATES.find((x) => x.slug === slug);
  if (!t) throw new Error(`Template tidak dikenal: ${slug}`);
  return t;
}
