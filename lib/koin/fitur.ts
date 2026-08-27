import { createClient } from "@/lib/supabase/server";

/**
 * Harga per fitur generator.
 *
 * Satu tabel untuk semua fitur, dan harga 0 berarti gratis. Dengan begitu
 * membuka atau menutup sebuah fitur ke umum cukup mengubah angkanya — tidak
 * perlu menyentuh kode, apalagi deploy ulang.
 */

export type KunciFitur = "setup" | "loadbalance" | "failover" | "login-page";

export type Fitur = {
  kunci: string;
  nama: string;
  keterangan: string | null;
  harga: number;
  aktif: boolean;
  urutan: number;
};

export async function semuaFitur(): Promise<Fitur[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fitur")
    .select("kunci, nama, keterangan, harga, aktif, urutan")
    .order("urutan", { ascending: true });
  return (data ?? []) as Fitur[];
}

export async function hargaFitur(kunci: KunciFitur): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("harga_fitur", { p_kunci: kunci });
  return typeof data === "number" ? data : 0;
}

/** Harga seluruh fitur sekaligus — untuk halaman yang menyebut beberapa. */
export async function petaHarga(): Promise<Record<string, number>> {
  const daftar = await semuaFitur();
  const peta: Record<string, number> = {};
  for (const f of daftar) peta[f.kunci] = f.aktif ? f.harga : 0;
  return peta;
}
