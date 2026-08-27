import { createClient } from "@/lib/supabase/server";

/**
 * Pembacaan khusus admin.
 *
 * Kewenangannya ditentukan database lewat is_admin(), bukan oleh kode ini.
 * Halaman tetap memeriksanya supaya pengunjung yang bukan admin mendapat
 * jawaban yang jelas alih-alih layar penuh kesalahan izin — tetapi penjagaan
 * yang sebenarnya ada di RLS, dan itu tidak bisa dilewati dari browser.
 */

export type PaketAdmin = {
  id: string;
  nama: string;
  koin: number;
  rupiah: number;
  urutan: number;
  aktif: boolean;
};

export async function apakahAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) return false;
  return data === true;
}

/** Termasuk paket nonaktif — admin perlu melihat yang disembunyikan juga. */
export async function semuaPaket(): Promise<PaketAdmin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coin_packages")
    .select("id, nama, koin, rupiah, urutan, aktif")
    .order("urutan", { ascending: true });
  return (data ?? []) as PaketAdmin[];
}

export type RingkasanPelanggan = {
  id: string;
  nama: string | null;
  wa: string | null;
  peran: string;
  aktif: boolean;
  created_at: string;
};

export async function daftarPelanggan(): Promise<RingkasanPelanggan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nama, wa, peran, aktif, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as RingkasanPelanggan[];
}
