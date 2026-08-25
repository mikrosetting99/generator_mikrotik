/**
 * Penyuntingan HTML berjangkar untuk template login page.
 *
 * Sengaja BUKAN parser HTML sungguhan. Sudah dicoba: parse5 menggeser seluruh
 * berkas dua baris dan menambah ~800 byte yang tidak terjelaskan, sehingga
 * diff antara template dan hasil cetak tidak bisa dibaca lagi. Untuk berkas
 * yang berakhir di router pelanggan — di mana kesalahan baru ketahuan lewat
 * telepon dari lapangan — diff yang bisa ditinjau lebih berharga daripada
 * kenyamanan selector.
 *
 * Semua fungsi di sini melempar error kalau jangkarnya tidak ketemu. Gagal
 * mencetak jauh lebih murah daripada mencetak berkas yang diam-diam salah.
 */

export class JangkarHilang extends Error {
  constructor(jangkar: string) {
    super(`Jangkar tidak ditemukan di template: ${jangkar}`);
    this.name = "JangkarHilang";
  }
}

/** Ganti satu kemunculan. Melempar kalau tidak ada. */
export function ganti(html: string, dari: string, ke: string): string {
  const i = html.indexOf(dari);
  if (i < 0) throw new JangkarHilang(dari);
  return html.slice(0, i) + ke + html.slice(i + dari.length);
}

/** Ganti semua kemunculan. Melempar kalau tidak ada satu pun. */
export function gantiSemua(html: string, dari: string, ke: string): string {
  if (!html.includes(dari)) throw new JangkarHilang(dari);
  return html.split(dari).join(ke);
}

/** Ganti semua kemunculan, tapi tidak apa-apa kalau memang tidak ada. */
export function gantiKalauAda(html: string, dari: string, ke: string): string {
  return html.includes(dari) ? html.split(dari).join(ke) : html;
}

/**
 * Akhir elemen yang dibuka pada indeks `awal`, dihitung dengan kedalaman.
 *
 * Memakai indexOf("</div>") terakhir pernah memakan penutup milik elemen
 * induk — bug yang baru ketahuan lewat hitungan tag 39/38. Penghitung
 * kedalaman tidak bisa salah begitu.
 *
 * Komentar HTML dilewati supaya `<div>` yang hanya disebut di dalam catatan
 * tidak ikut terhitung. Isi <script> dan <style> tidak perlu dilewati:
 * sudah diperiksa, tidak ada satu pun template yang menuliskan tag penutup
 * di dalamnya.
 */
export function akhirElemen(html: string, awal: number, tag: string): number {
  const buka = `<${tag}`;
  const tutup = `</${tag}`;
  let i = awal;
  let dalam = 0;

  while (i < html.length) {
    if (html.startsWith("<!--", i)) {
      const j = html.indexOf("-->", i);
      i = j < 0 ? html.length : j + 3;
      continue;
    }

    if (html.startsWith(buka, i) && /[\s/>]/.test(html[i + buka.length] ?? ">")) {
      dalam++;
      i += buka.length;
      continue;
    }

    if (html.startsWith(tutup, i)) {
      const j = html.indexOf(">", i);
      if (j < 0) break;
      dalam--;
      i = j + 1;
      if (dalam === 0) return i;
      continue;
    }

    i++;
  }

  throw new Error(`Elemen <${tag}> yang dibuka di indeks ${awal} tidak punya penutup.`);
}

/** Seluruh elemen (termasuk tag pembuka dan penutupnya) yang diawali `pembuka`. */
export function ambilElemen(html: string, pembuka: string, tag: string): { awal: number; akhir: number; isi: string } {
  const awal = html.indexOf(pembuka);
  if (awal < 0) throw new JangkarHilang(pembuka);
  const akhir = akhirElemen(html, awal, tag);
  return { awal, akhir, isi: html.slice(awal, akhir) };
}

/** Ganti isi DALAM elemen, tag pembuka dan penutupnya dibiarkan. */
export function gantiIsiElemen(html: string, pembuka: string, tag: string, isiBaru: string): string {
  const { awal, akhir } = ambilElemen(html, pembuka, tag);
  const mulaiIsi = html.indexOf(">", awal) + 1;
  const habisIsi = html.lastIndexOf(`</${tag}`, akhir);
  return html.slice(0, mulaiIsi) + isiBaru + html.slice(habisIsi);
}

/**
 * Ganti teks di antara `<tag ...class="kelas"...>` dan penutupnya.
 * Hanya untuk elemen berisi teks polos — cukup untuk .dur, .price, .meta, .wm span.
 */
export function gantiTeks(html: string, pembuka: string, isiBaru: string): string {
  const i = html.indexOf(pembuka);
  if (i < 0) throw new JangkarHilang(pembuka);
  const mulai = i + pembuka.length;
  const habis = html.indexOf("<", mulai);
  if (habis < 0) throw new JangkarHilang(`${pembuka} (penutup)`);
  return html.slice(0, mulai) + isiBaru + html.slice(habis);
}

/** Lolos untuk teks di dalam HTML. Nilai dari admin tidak pernah dipercaya mentah. */
export function amanHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lolos untuk isi atribut HTML. */
export function amanAtribut(s: string): string {
  return amanHtml(s);
}

/** #rrggbb -> "r,g,b" untuk menyusun rgba() turunan. */
export function hexKeRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
