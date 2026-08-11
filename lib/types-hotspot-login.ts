export type HotspotTemplateId = "minimal" | "voucher" | "korporat" | "gelap" | "poster";
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
  /** Warna latar bebas; warna teks & garis diturunkan dari kecerahannya. */
  bgColor: string;
  /** Nama yang tampil di halaman login. Kosong = judul disembunyikan. */
  title: string;
  subtitle: string;
  /** Logo disimpan sebagai data URI, lalu ditulis jadi berkas di dalam zip. */
  logoDataUrl: string;
  logoName: string;
  /** Tinggi tampil logo dalam piksel, 40–260. Lebarnya menyesuaikan sendiri. */
  logoHeight: number;
  /** Gambar latar, juga ikut jadi berkas di dalam zip. */
  bgImageDataUrl: string;
  bgImageName: string;
  /** Kepekatan lapisan gelap di atas gambar latar, 0–90 persen. */
  bgOverlay: number;
  /** Mode yang aktif saat halaman login pertama kali dibuka. */
  loginMode: LoginMode;
  showModeSwitch: boolean;
  /** Teks berjalan di atas form login. */
  marquee: string;
  showTrial: boolean;
  packages: VoucherPackage[];
  terms: string;
  whatsapp: string;
  whatsappLabel: string;
  footer: string;
}
