export type HotspotTemplateId = "minimal" | "poster";
export type BgFit = "blur" | "cover" | "contain" | "stretch";

/** Cara gambar latar menyesuaikan layar. */
export const BG_FITS: { value: BgFit; label: string; hint: string; css: string }[] = [
  {
    value: "blur",
    label: "Utuh + kabur",
    hint: "Seluruh gambar terlihat di tengah; sisi layar yang kosong diisi gambar yang sama dalam keadaan kabur. Cocok untuk layar laptop.",
    css: "contain",
  },
  { value: "cover", label: "Penuh", hint: "Menutupi seluruh layar, tepi gambar bisa terpotong.", css: "cover" },
  { value: "contain", label: "Utuh", hint: "Seluruh gambar terlihat; sisa layar berwarna latar.", css: "contain" },
  { value: "stretch", label: "Tarik", hint: "Gambar ditarik memenuhi layar (bisa melar).", css: "100% 100%" },
];

export type BgPosition = "center" | "top" | "bottom" | "left" | "right";

/** Pilihan titik fokus gambar latar, lengkap dengan nilai CSS-nya. */
export const BG_POSITIONS: { value: BgPosition; label: string; css: string }[] = [
  { value: "center", label: "Tengah", css: "center" },
  { value: "top", label: "Atas", css: "center top" },
  { value: "bottom", label: "Bawah", css: "center bottom" },
  { value: "left", label: "Kiri", css: "left center" },
  { value: "right", label: "Kanan", css: "right center" },
];
export type LoginMode = "voucher" | "member";

/** Satu baris pada tabel harga paket di halaman login. */
export interface VoucherPackage {
  id: string;
  name: string;
  /** Lama pemakaian setelah voucher dipakai. */
  duration: string;
  /**
   * Batas waktu voucher masih boleh dipakai, terhitung sejak pertama login.
   * Berbeda dari durasi, dan lazim dicantumkan terpisah pada voucher.
   */
  validity: string;
  price: string;
}

/**
 * Kustomisasi halaman login hotspot. Satu router hanya punya satu folder
 * `hotspot` di File List, jadi pengaturan ini berlaku untuk seluruh hotspot.
 */
export interface HotspotPageConfig {
  template: HotspotTemplateId;
  primaryColor: string;
  /** Kecerahan warna tema dalam persen, 50–150. 100 = warna apa adanya. */
  primaryBrightness: number;
  /** Warna tulisan nama hotspot. Kosong = otomatis (warna tema yang aman dibaca). */
  titleColor: string;
  /** Warna teks sambutan (di bawah nama hotspot). Kosong = otomatis (warna teks redup). */
  subtitleColor: string;
  /** Warna font umum di halaman login — kecuali nama dan sambutan, yang punya pengaturan sendiri. Kosong = otomatis. */
  textColor: string;
  /** Warna tombol Login. Kosong = ikut warna tema. */
  buttonColor: string;
  /** Warna font di dalam tombol berwarna (Login dan Voucher/Member aktif). Kosong = otomatis. */
  buttonTextColor: string;
  /** Warna latar bebas; warna teks & garis diturunkan dari kecerahannya. */
  bgColor: string;
  /** Warna latar kartu form. Kosong = diturunkan otomatis dari warna latar. */
  formBgColor: string;
  /** Kepekatan kartu form, 10–100 persen. Di bawah 100 kartunya tembus pandang. */
  formBgOpacity: number;
  /** Lebar maksimal kartu form dalam piksel, 300–720. Di layar sempit tetap mengecil sendiri. */
  formWidth: number;
  /** Tebal garis tepi kartu form dalam piksel, 0–8. 0 = tanpa garis. */
  formBorderWidth: number;
  /** Kelengkungan sudut kartu form dalam piksel, 0–40. 0 = siku-siku. */
  formRadius: number;
  /** Warna garis tepi kartu form. Kosong = otomatis (semburat warna tema). */
  formBorderColor: string;
  /** Gambar di dalam kartu form, juga ikut jadi berkas di dalam zip. */
  formImageDataUrl: string;
  formImageName: string;
  /** Nama yang tampil di halaman login. Kosong = judul disembunyikan. */
  title: string;
  subtitle: string;
  /** Logo disimpan sebagai data URI, lalu ditulis jadi berkas di dalam zip. */
  logoDataUrl: string;
  logoName: string;
  /** Tinggi tampil logo dalam piksel, 40–260. Lebarnya menyesuaikan sendiri. */
  logoHeight: number;
  /** Letak logo: di dalam kartu form (bawaan) atau di atas kartu, di luar form. */
  logoPosition: "inside" | "above";
  /** Gambar latar, juga ikut jadi berkas di dalam zip. */
  bgImageDataUrl: string;
  bgImageName: string;
  /** Kepekatan lapisan gelap di atas gambar latar, 0–90 persen. */
  bgOverlay: number;
  /** Bagian gambar latar yang dipertahankan saat dipotong menyesuaikan layar. */
  bgPosition: BgPosition;
  bgFit: BgFit;
  /** Mode yang aktif saat halaman login pertama kali dibuka. */
  loginMode: LoginMode;
  showModeSwitch: boolean;
  /** Teks berjalan di atas form login. */
  /** Placeholder kolom login. Kosong = bawaan desain. */
  placeholderVoucher: string;
  placeholderUsername: string;
  placeholderPassword: string;
  /** Kalimat petunjuk di atas kolom login, per mode. Kosong = bawaan desain. */
  hintVoucher: string;
  hintMember: string;
  /** Warna kalimat petunjuk. Kosong = otomatis. */
  hintColor: string;
  marquee: string;
  /** Teks berjalan tampil atau disembunyikan, tanpa menghapus teksnya. */
  marqueeEnabled: boolean;
  /** Letak teks berjalan: di atas form (bawaan) atau di bawah form. */
  marqueePosition: "top" | "bottom";
  /** Warna latar bar teks berjalan — sendiri, tidak ikut warna tombol Voucher. */
  marqueeBgColor: string;
  /** Teks berjalan tanpa warna latar (hanya tulisan di atas kartu). */
  marqueeNoBg: boolean;
  /** Warna tulisan teks berjalan. Kosong = otomatis (hitam/putih sesuai latar bar). */
  marqueeTextColor: string;
  showTrial: boolean;
  packages: VoucherPackage[];
  /** Warna tabel harga (kepala tabel / kartu harga). Kosong = ikut warna tombol Voucher. */
  tableColor: string;
  /** Bentuk daftar paket (desain Minimal): tabel, kartu, atau daftar. Poster selalu kartu. */
  packageStyle: "table" | "cards" | "list";
  terms: string;
  whatsapp: string;
  whatsappLabel: string;
  /** Tombol WhatsApp tampil atau disembunyikan, tanpa menghapus nomornya. */
  whatsappEnabled: boolean;
  footer: string;
  /** Letak teks footer: di dalam kartu form (bawaan) atau di bawah kartu, di luar form. */
  footerPosition: "inside" | "outside";
  /** Widget jam di sudut halaman login. */
  clockEnabled: boolean;
  clockPosition: "top-left" | "top-center" | "top-right";
  /** Tampilkan detik. */
  clockSeconds: boolean;
  /** Tampilkan tanggal di bawah jam. */
  clockDate: boolean;
}
