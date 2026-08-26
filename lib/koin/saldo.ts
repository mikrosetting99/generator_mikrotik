import { createClient } from "@/lib/supabase/server";

/**
 * Pembacaan koin di sisi server.
 *
 * Saldo selalu diambil lewat fungsi database saldo_koin(), tidak pernah
 * dijumlahkan di sini — supaya hanya ada satu tempat yang menentukan berapa
 * saldo seseorang, dan tempat itu berada di dalam database bersama datanya.
 */

export type PaketKoin = {
  id: string;
  nama: string;
  koin: number;
  rupiah: number;
};

export type BarisTopup = {
  id: string;
  merchant_order_id: string;
  koin: number;
  rupiah: number;
  status: "menunggu" | "lunas" | "gagal" | "kedaluwarsa";
  metode: string | null;
  payment_url: string | null;
  dibayar_pada: string | null;
  created_at: string;
};

export type BarisKoin = {
  id: string;
  jumlah: number;
  jenis: "topup" | "pemakaian" | "refund" | "penyesuaian" | "bonus";
  keterangan: string | null;
  created_at: string;
};

export async function saldoKoin(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("saldo_koin");
  if (error) {
    console.error("[koin] gagal membaca saldo", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export async function paketKoin(): Promise<PaketKoin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coin_packages")
    .select("id, nama, koin, rupiah")
    .eq("aktif", true)
    .order("urutan", { ascending: true });
  return (data ?? []) as PaketKoin[];
}

export async function riwayatTopup(batas = 10): Promise<BarisTopup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coin_topups")
    .select("id, merchant_order_id, koin, rupiah, status, metode, payment_url, dibayar_pada, created_at")
    .order("created_at", { ascending: false })
    .limit(batas);
  return (data ?? []) as BarisTopup[];
}

export async function riwayatKoin(batas = 20): Promise<BarisKoin[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("coin_transactions")
    .select("id, jumlah, jenis, keterangan, created_at")
    .order("created_at", { ascending: false })
    .limit(batas);
  return (data ?? []) as BarisKoin[];
}

/** Biaya satu pesanan, dalam koin. Dibaca server, tidak pernah dari browser. */
export function biayaPesanan(): number {
  const nilai = Number(process.env.MSLP_BIAYA_PESANAN ?? "25");
  return Number.isFinite(nilai) && nilai >= 0 ? Math.round(nilai) : 25;
}

export function rupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`;
}

export function waktuSingkat(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
