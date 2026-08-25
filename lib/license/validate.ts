/**
 * Pemeriksaan hasil cetak sebelum berkasnya diserahkan.
 *
 * Alasannya bukan kerapian: begitu login.html sampai di router pelanggan,
 * kesalahan sekecil apa pun baru ketahuan lewat telepon dari lapangan, dan
 * memperbaikinya berarti menuntun orang lain lewat Winbox. Jadi generator
 * menolak mencetak berkas yang tidak lolos, bukan mencetaknya dengan
 * peringatan.
 *
 * Daftar periksanya diturunkan dari periksa-semua.js yang dipakai manual
 * pada template, ditambah hal-hal yang hanya bisa salah karena generator:
 * jumlah kolom yang tidak ikut jumlah kartu, dan nomor penerbit lisensi
 * yang ikut tertimpa nomor pembeli.
 */

const TAG_BERPASANGAN = ["div", "span", "a", "form", "svg", "button", "script", "style"];

const VARIABEL_MIKROTIK = [
  "$(link-login-only)",
  "$(link-orig)",
  "$(username)",
  "$(error)",
  "$(chap-id)",
  "$(chap-challenge)",
];

export type Temuan = { berat: boolean; pesan: string };

function hitung(html: string, pola: RegExp): number {
  return (html.match(pola) ?? []).length;
}

export function periksaLoginHtml(
  html: string,
  harap: { jumlahKartu: number; waPembeli: string; waPenerbit: string }
): Temuan[] {
  const temuan: Temuan[] = [];
  const berat = (pesan: string) => temuan.push({ berat: true, pesan });
  const ringan = (pesan: string) => temuan.push({ berat: false, pesan });

  /* Komentar dan isi <style> dibuang dulu untuk hitungan tag. Panduan di
     dalam template menyebut kata <style> dan <script> sebagai teks biasa —
     sebagian di komentar HTML, sebagian di komentar CSS di dalam <style> —
     dan tanpa ini kata-kata itu terhitung sebagai tag pembuka tanpa penutup. */
  const kode = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<style[^>]*>)[\s\S]*?(<\/style>)/gi, "$1$2");

  /* ---- keseimbangan tag ---- */
  for (const tag of TAG_BERPASANGAN) {
    const buka = hitung(kode, new RegExp(`<${tag}(?=[\\s/>])`, "gi"));
    const tutup = hitung(kode, new RegExp(`</${tag}\\s*>`, "gi"));
    // <a> dan <svg> boleh menutup sendiri di beberapa tempat; sisanya harus pas.
    if (buka !== tutup) berat(`Tag <${tag}> tidak seimbang: ${buka} pembuka, ${tutup} penutup.`);
  }

  /* ---- kurung kurawal CSS ---- */
  const gaya = html.replace(/<!--[\s\S]*?-->/g, "").match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!gaya) {
    berat("Blok <style> hilang.");
  } else {
    const buka = hitung(gaya[1], /\{/g);
    const tutup = hitung(gaya[1], /\}/g);
    if (buka !== tutup) berat(`Kurung kurawal CSS tidak seimbang: ${buka} buka, ${tutup} tutup.`);
  }

  /* ---- percabangan MikroTik ----
     Jumlahnya harus persis 2 pasang: satu untuk chap-id, satu untuk error.
     Router tidak mengeluh kalau ganjil, halamannya saja yang kosong.       */
  const jumlahIf = hitung(html, /\$\(if /g);
  const jumlahEndif = hitung(html, /\$\(endif\)/g);
  if (jumlahIf !== 2 || jumlahEndif !== 2) {
    berat(`$(if ...) / $(endif) harus 2 dan 2, ditemukan ${jumlahIf} dan ${jumlahEndif}.`);
  }

  /* ---- variabel wajib ---- */
  for (const v of VARIABEL_MIKROTIK) {
    if (!html.includes(v)) berat(`Variabel MikroTik ${v} hilang.`);
  }
  if (!html.includes("$(identity)") && !html.includes("$(server-address)")) {
    berat("Tidak ada $(identity) maupun $(server-address); lisensi tidak punya pengikat.");
  }

  /* ---- form login ---- */
  if (!/name="username"/.test(html)) berat('Kolom name="username" hilang.');
  if (!/name="password"/.test(html)) berat('Kolom name="password" hilang.');
  if (!/src="md5\.js"/.test(html)) berat("md5.js tidak dipanggil; login CHAP akan gagal.");

  /* ---- kartu vs kolom ---- */
  const kartu = hitung(html, /<a class="pk"/g);
  if (kartu !== harap.jumlahKartu) {
    berat(`Jumlah kartu tercetak ${kartu}, seharusnya ${harap.jumlahKartu}.`);
  }
  const kolom = html.match(/\.paket\{display:grid;grid-template-columns:repeat\((\d+),minmax\(0,1fr\)\)/);
  if (!kolom) {
    berat("Aturan grid .paket tidak ketemu.");
  } else if (Number(kolom[1]) !== kartu) {
    berat(`Grid ${kolom[1]} kolom tapi kartunya ${kartu}; kartu akan menumpuk turun.`);
  }

  /* ---- lisensi ---- */
  const salt = html.match(/var LIS_SALT = "([^"]*)";/);
  if (!salt) berat("Baris var LIS_SALT hilang.");
  else if (!salt[1]) berat("LIS_SALT kosong; semua kunci akan cocok dengan apa pun.");

  const kunci = html.match(/var LIS_KEY {2}= "([^"]*)";/);
  if (!kunci) berat("Baris var LIS_KEY hilang.");
  else if (kunci[1] && !/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kunci[1])) {
    berat(`LIS_KEY tidak berbentuk XXXX-XXXX-XXXX: "${kunci[1]}".`);
  }
  if (salt && kunci && salt[1] && salt[1] === kunci[1]) {
    berat("LIS_SALT dan LIS_KEY sama; halaman akan terkunci selamanya.");
  }

  /* ---- nomor penerbit tidak boleh ikut tertimpa ---- */
  const lisWa = html.match(/id="lisWa" href="https:\/\/wa\.me\/([0-9]+)"/);
  if (!lisWa) {
    ringan("Tombol permintaan lisensi tidak ketemu.");
  } else if (lisWa[1] !== harap.waPenerbit) {
    berat(
      `Tombol permintaan lisensi menuju ${lisWa[1]}, seharusnya nomor penerbit ${harap.waPenerbit}.`
    );
  }

  /* ---- sisa identitas template ---- */
  if (html.includes("preview.html")) ringan("Ada rujukan ke preview.html.");

  return temuan;
}

/** Melempar kalau ada temuan berat. Dipakai generator sebelum menyerahkan berkas. */
export function pastikanLolos(temuan: Temuan[]): void {
  const parah = temuan.filter((t) => t.berat);
  if (parah.length) {
    throw new Error(
      `Hasil cetak ditolak oleh pemeriksaan:\n- ${parah.map((t) => t.pesan).join("\n- ")}`
    );
  }
}
