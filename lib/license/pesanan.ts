/** Bentuk baris di Supabase untuk pesanan lisensi. */

export type LicenseOrder = {
  id: string;
  nomor: number;
  nama_usaha: string;
  kontak_nama: string | null;
  catatan: string | null;
  template_slug: string;
  merek_a: string;
  merek_b: string;
  merek_spasi: boolean;
  tagline: string;
  footer_tagline: string;
  wa_nomor: string;
  wa_tampil: string;
  warna: Record<string, string>;
  bank_nama: string | null;
  bank_nomor: string | null;
  bank_atas_nama: string | null;
  logo_data_url: string | null;
  bg_data_url: string | null;
  router_identity: string | null;
  lisensi_kunci: string | null;
  lisensi_terbit_pada: string | null;
  status: StatusPesanan;
  created_at: string;
  updated_at: string;
};

export type StatusPesanan = "draft" | "terkirim" | "aktif" | "batal";

export type LicensePackage = {
  id: string;
  order_id: string;
  posisi: number;
  nama: string;
  harga: string;
  meta_atas: string;
  meta_bawah: string;
  warna: string;
  rank: string | null;
};

export type PesananLengkap = LicenseOrder & {
  license_packages: LicensePackage[];
};

/**
 * Batas ukuran gambar.
 *
 * Latar 1080x1920 karena layar HP berkisar pada rasio 0,45-0,56 dan 9:16 ada
 * di ujung atas rentang itu, jadi pemotongan kiri-kanannya paling kecil.
 * Batas byte-nya ketat karena latar diunduh pelanggan SEBELUM mereka punya
 * internet — setiap KB terasa di sinyal yang jelek.
 */
export const BATAS_GAMBAR = {
  logo: { idealWidth: 500, idealHeight: 500, maxBytes: 120 * 1024, label: "500 × 500 px, PNG transparan" },
  latar: { idealWidth: 1080, idealHeight: 1920, maxBytes: 300 * 1024, label: "1080 × 1920 px, JPG" },
} as const;
