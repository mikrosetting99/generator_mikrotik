import { readFile } from "node:fs/promises";
import path from "node:path";
import { buatKunci, bacaSalt } from "./key";
import { cariTemplate, type Template } from "./templates";
import {
  ganti,
  gantiKalauAda,
  gantiSemua,
  gantiTeks,
  ambilElemen,
  amanAtribut,
  amanHtml,
  hexKeRgb,
} from "./html";

export type Paket = {
  nama: string;
  harga: string;
  metaAtas: string;
  metaBawah: string;
  warna: string;
  /** Pita tingkatan; null berarti pakai bawaan tema pada posisi itu. */
  rank: string | null;
};

export type Pesanan = {
  templateSlug: string;
  namaUsaha: string;
  /** Logo teks: bagian putih dan bagian berwarna, plus spasi di antaranya. */
  merekA: string;
  merekB: string;
  merekSpasi: boolean;
  tagline: string;
  footerTagline: string;
  /** 62xxxxxxxxxx, tanpa tanda plus. */
  waNomor: string;
  /** Yang terbaca di layar, misal 0821-9304-7243. */
  waTampil: string;
  paket: Paket[];
  /** kunci slot warna -> #rrggbb */
  warna: Record<string, string>;
  /**
   * Kotak nomor rekening di samping tombol WhatsApp. Hanya sebagian template
   * punya tempatnya; kalau kosong, kotaknya dibuang. Membiarkannya berisi
   * bawaan template berarti rekening satu pembeli ikut tercetak di halaman
   * pembeli lain — sudah pernah lolos sekali di pratinjau.
   */
  bank: { nama: string; nomor: string; atasNama: string } | null;
  /**
   * Logo dan latar sebagai data URI. Proyek ini memang menyimpan gambar
   * begitu (lihat lib/storage.ts), dan halaman login harus menyajikannya
   * dari berkas lokal — pelanggan belum punya internet saat membukanya.
   */
  logoDataUrl: string;
  bgDataUrl: string;
  routerIdentity: string | null;
};

const AKAR_TEMPLATE = path.join(process.cwd(), "templates");

/** Nomor WhatsApp penerbit lisensi — tujuan tombol di layar "LISENSI TIDAK AKTIF". */
function waPenerbit(): string {
  return process.env.MSLP_LICENSOR_WA || "6281112001036";
}

export function bacaTemplateHtml(slug: string): Promise<string> {
  cariTemplate(slug);
  return readFile(path.join(AKAR_TEMPLATE, slug, "login.html"), "utf8");
}

/* ------------------------------------------------------------------ *
 * Kartu paket
 * ------------------------------------------------------------------ */

/** Ganti isi <span class="KELAS..."> pertama di dalam satu kartu. */
function gantiSpan(kartu: string, kelas: string, isiBaru: string): string {
  const jangkar = `<span class="${kelas}`;
  const i = kartu.indexOf(jangkar);
  if (i < 0) return kartu;
  const buka = kartu.indexOf(">", i);
  const tutup = kartu.indexOf("</span>", buka);
  if (buka < 0 || tutup < 0) return kartu;
  return kartu.slice(0, buka + 1) + isiBaru + kartu.slice(tutup);
}

/**
 * Kartu-kartu baru, dicetak dari bentuk kartu yang sudah ada di template.
 *
 * Sengaja memakai ulang kartu aslinya alih-alih menyusun HTML dari nol:
 * ikon tiap tema digambar tangan (shuriken, lencana bersayap, parabola) dan
 * menyusunnya ulang di sini berarti menyalin enam set SVG ke dalam kode
 * generator, lalu menjaganya tetap sinkron selamanya. Bentuk kartu ke-i
 * dipakai ulang secara berputar kalau paketnya lebih banyak dari bawaan.
 */
function cetakKartu(html: string, t: Template, p: Pesanan): string {
  const bentuk: string[] = [];
  let dari = 0;
  for (;;) {
    const i = html.indexOf('<a class="pk"', dari);
    if (i < 0) break;
    const { akhir } = ambilElemen(html.slice(i), '<a class="pk"', "a");
    bentuk.push(html.slice(i, i + akhir));
    dari = i + akhir;
  }
  if (!bentuk.length) throw new Error(`Template ${t.slug} tidak punya kartu paket untuk dicontoh.`);

  return p.paket
    .map((pk, i) => {
      let kartu = bentuk[i % bentuk.length];

      /* Warna kartu. */
      kartu = kartu.replace(/--pc:#[0-9a-fA-F]{3,6}/, `--pc:${pk.warna}`);

      /* Tautan pemesanan. */
      const pesan = encodeURIComponent(
        `Halo ${p.namaUsaha}, saya mau beli voucher ${pk.nama} - Rp${pk.harga}`
      );
      kartu = kartu.replace(
        /href="https:\/\/wa\.me\/[^"]*"/,
        `href="https://wa.me/${p.waNomor}?text=${pesan}"`
      );

      /* Isi kartu. */
      if (t.punyaRank) {
        // Tanpa isian admin, pita tingkatan bawaan tema dibiarkan — itu yang
        // memberi tema rasanya, dan nama paket sudah tampil di baris bawahnya.
        if (pk.rank) kartu = gantiSpan(kartu, "rank", amanHtml(pk.rank));
      }
      if (t.punyaPips) {
        // Bintang terbanyak untuk paket teratas, menurun satu tiap baris.
        const bintang = Math.max(1, p.paket.length - i);
        const satu = kartu.match(/<span class="pips[^"]*">([\s\S]*?)<\/span>/);
        if (satu) {
          const svg = satu[1].trim().split("</svg>")[0] + "</svg>";
          kartu = gantiSpan(kartu, "pips", Array(bintang).fill(svg).join(""));
        }
      }
      kartu = gantiSpan(kartu, "dur", amanHtml(pk.nama));
      kartu = gantiSpan(kartu, "price", `<i>Rp</i>${amanHtml(pk.harga)}`);
      kartu = gantiSpan(
        kartu,
        "meta",
        pk.metaBawah
          ? `${amanHtml(pk.metaAtas)}<br>${amanHtml(pk.metaBawah)}`
          : amanHtml(pk.metaAtas)
      );

      return kartu;
    })
    .join("\n\n\t\t\t");
}

/* ------------------------------------------------------------------ *
 * Pencetak utama
 * ------------------------------------------------------------------ */

export async function cetakLoginHtml(p: Pesanan): Promise<string> {
  const t = cariTemplate(p.templateSlug);
  let html = await bacaTemplateHtml(p.templateSlug);

  const salt = bacaSalt();
  const identity = p.routerIdentity?.trim() || "";
  const kunci = identity ? buatKunci(identity, salt) : "";

  /* ---- 1. Nomor WhatsApp -------------------------------------------
     Diganti menyeluruh dulu, termasuk tombol permintaan lisensi, lalu
     tombol itu dikembalikan ke nomor penerbit. Urutan ini dipilih karena
     kebalikannya pernah lolos tanpa disadari: permintaan lisensi terkirim
     ke nomor pembeli sendiri.                                          */
  html = gantiSemua(html, t.waAsli, p.waNomor);
  html = gantiSemua(html, t.nomorTampilAsli, p.waTampil);
  html = html.replace(
    /(<a class="tombol" id="lisWa" href="https:\/\/wa\.me\/)[0-9]+(")/,
    `$1${waPenerbit()}$2`
  );

  /* ---- 2. Merek ---------------------------------------------------- */
  html = ganti(html, `<title id="title">${t.merekAsli} - Login Hotspot</title>`,
    `<title id="title">${amanHtml(p.namaUsaha)} - Login Hotspot</title>`);

  const pemisah = p.merekSpasi ? " " : "";
  html = html.replace(
    /<div class="wm"><span class="a">[^<]*<\/span>\s*<span class="b">[^<]*<\/span><\/div>/,
    `<div class="wm"><span class="a">${amanHtml(p.merekA)}</span>${pemisah}<span class="b">${amanHtml(p.merekB)}</span></div>`
  );

  html = html.replace(
    /<div class="wmsub">[^<]*<\/div>/,
    `<div class="wmsub">${amanHtml(p.tagline)}</div>`
  );

  html = gantiSemua(html, `alt="${t.merekAsli}"`, `alt="${amanAtribut(p.namaUsaha)}"`);

  /* ---- 3. Kaki halaman --------------------------------------------- */
  html = html.replace(
    /<div class="footMini">&copy; \d{4} <b>[^<]*<\/b> &middot; [^<]*<\/div>/,
    `<div class="footMini">&copy; ${new Date().getFullYear()} <b>${amanHtml(p.namaUsaha)}</b> &middot; ${amanHtml(p.footerTagline)}</div>`
  );
  html = html.replace(
    /<div class="n">[^<]*<\/div>/,
    `<div class="n">${amanHtml(p.namaUsaha)}</div>`
  );
  html = html.replace(
    /<div class="c">&copy; \d{4} [^<]*<br>All rights reserved\.<\/div>/,
    `<div class="c">&copy; ${new Date().getFullYear()} ${amanHtml(p.namaUsaha)}<br>All rights reserved.</div>`
  );

  /* ---- 4. Pesan bantuan pada tombol WhatsApp ------------------------ */
  html = gantiKalauAda(
    html,
    encodeURIComponent(`Halo ${t.merekAsli}, saya butuh bantuan internet`),
    encodeURIComponent(`Halo ${p.namaUsaha}, saya butuh bantuan internet`)
  );
  html = gantiKalauAda(
    html,
    encodeURIComponent("Halo, saya butuh bantuan internet"),
    encodeURIComponent(`Halo ${p.namaUsaha}, saya butuh bantuan internet`)
  );

  /* ---- 5. Kotak nomor rekening -------------------------------------- */
  if (html.includes('<span class="rek">')) {
    const kotak = ambilElemen(html, '<span class="rek">', "span");
    if (p.bank) {
      let isi = kotak.isi;
      isi = gantiTeks(isi, '<span class="bank">', amanHtml(p.bank.nama));
      isi = gantiTeks(isi, '<span class="norek">', amanHtml(p.bank.nomor));
      isi = gantiTeks(isi, '<span class="atas">', `a.n. ${amanHtml(p.bank.atasNama)}`);
      html = html.slice(0, kotak.awal) + isi + html.slice(kotak.akhir);
    } else {
      /* Buang sekalian komentar penanda dan baris kosongnya. */
      let awal = kotak.awal;
      const penanda = html.lastIndexOf("<!-- INFORMASI REKENING", awal);
      if (penanda >= 0 && awal - penanda < 200) awal = penanda;
      let akhir = kotak.akhir;
      while (akhir < html.length && (html[akhir] === "\n" || html[akhir] === "\t")) akhir++;
      html = html.slice(0, awal) + html.slice(akhir);
    }
  }

  /* ---- 6. Kartu paket ---------------------------------------------- */
  const kartuBaru = cetakKartu(html, t, p);
  const wilayah = ambilElemen(html, '<div class="paket">', "div");
  const mulaiIsi = html.indexOf(">", wilayah.awal) + 1;
  const habisIsi = html.lastIndexOf("</div>", wilayah.akhir);
  html = html.slice(0, mulaiIsi) + `\n\t\t\t${kartuBaru}\n\t\t` + html.slice(habisIsi);

  /* Jumlah kolom harus ikut jumlah kartu, kalau tidak kartunya menumpuk
     turun dan halaman butuh scroll — hal yang paling sering dikeluhkan. */
  const n = p.paket.length;
  html = html.replace(
    /\.paket\{display:grid;grid-template-columns:repeat\(\d+,minmax\(0,1fr\)\)/,
    `.paket{display:grid;grid-template-columns:repeat(${n},minmax(0,1fr))`
  );
  html = html.replace(
    /\.paket\{grid-template-columns:repeat\(\d+,minmax\(0,1fr\)\)/,
    `.paket{grid-template-columns:repeat(${n},minmax(0,1fr))`
  );

  /* ---- 7. Warna tema ------------------------------------------------ */
  for (const slot of t.warna) {
    const baru = p.warna[slot.kunci];
    if (!baru || baru.toLowerCase() === slot.bawaan.toLowerCase()) continue;

    html = ganti(html, slot.variabel, slot.variabel.replace(slot.bawaan, baru));

    for (const turunan of slot.turunan ?? []) {
      html = ganti(
        html,
        turunan.variabel,
        `${turunan.sebelum}${hexKeRgb(baru)},${turunan.alpha});`
      );
    }
  }

  /* ---- 8. Lisensi --------------------------------------------------- */
  html = html.replace(/var LIS_KEY {2}= "[^"]*";/, `var LIS_KEY  = "${kunci}";`);
  html = html.replace(/var LIS_SALT = "[^"]*";/, `var LIS_SALT = "${salt}";`);

  return html;
}
