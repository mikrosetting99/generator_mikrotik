/**
 * Perhitungan kunci lisensi login page hotspot.
 *
 * HARUS menghasilkan string yang sama persis dengan blok pemeriksa lisensi di
 * dalam setiap login.html dan dengan _LISENSI-MIKROSETTING/generator-lisensi.html.
 * Ketiganya memakai cyrb53 dengan konstanta yang sama. Mengubah salah satu
 * angka di sini mematikan SEMUA kunci yang pernah diterbitkan, bukan hanya
 * kunci berikutnya — kunci lama tersimpan di file yang sudah ada di router
 * pembeli dan tidak bisa ditarik kembali.
 *
 * Kesamaannya dijaga oleh scripts/verify-license-key.mjs, yang menjalankan
 * implementasi JavaScript asli dan implementasi ini atas ratusan masukan.
 */

/** cyrb53 — hash 53-bit, dipilih karena muat di satu blok <script> tanpa pustaka. */
function hsh(s: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Kunci untuk satu identity router, berbentuk XXXX-XXXX-XXXX.
 *
 * Dua hash dengan urutan berbeda digabung supaya panjangnya cukup; base36
 * kadang menghasilkan kurang dari 12 karakter, jadi sisanya diganjal "0".
 */
export function buatKunci(identity: string, salt: string): string {
  const a = hsh(`${identity}|${salt}`).toString(36).toUpperCase();
  const b = hsh(`${salt}#${identity}`).toString(36).toUpperCase();

  let g = (a + b).replace(/[^A-Z0-9]/g, "");
  while (g.length < 12) g += "0";
  g = g.slice(0, 12);

  return `${g.slice(0, 4)}-${g.slice(4, 8)}-${g.slice(8, 12)}`;
}

/**
 * Salt dibaca dari environment, tidak pernah masuk git.
 *
 * Sengaja melempar error alih-alih memakai nilai cadangan: salt yang salah
 * tetap menghasilkan kunci berbentuk benar, jadi kesalahannya baru ketahuan
 * setelah pembeli mengeluh halamannya terkunci.
 */
export function bacaSalt(): string {
  const salt = process.env.MSLP_LICENSE_SALT;
  if (!salt) {
    throw new Error(
      "MSLP_LICENSE_SALT belum diisi di environment. Tanpa itu kunci yang terbit tidak akan cocok dengan login page yang sudah beredar."
    );
  }
  return salt;
}

/**
 * Identity router, dirapikan seperti yang dilakukan halaman login.
 *
 * Halaman membandingkan kunci dengan nilai $(identity) apa adanya, sedangkan
 * admin menyalinnya dari layar HP pembeli — spasi di ujung ikut tersalin lebih
 * sering daripada yang dikira. Huruf besar-kecil TIDAK diseragamkan, karena
 * router pun membedakannya.
 */
export function rapikanIdentity(raw: string): string {
  return raw.replace(/^\s+|\s+$/g, "");
}
