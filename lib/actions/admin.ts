"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Pengaturan harga oleh admin.
 *
 * Tidak ada satu pun aksi di sini yang memeriksa peran sendiri. Kewenangannya
 * ditegakkan RLS: kebijakan pada tabel pengaturan dan coin_packages hanya
 * menerima tulisan dari is_admin(). Menambahkan pemeriksaan kedua di sini
 * hanya akan menjadi tempat kedua yang bisa keliru, sementara yang menentukan
 * tetap yang di database.
 */

const HALAMAN = "/login-page-hotspot/admin";

function kembali(pesan?: string): never {
  revalidatePath(HALAMAN);
  revalidatePath("/login-page-hotspot/koin");
  revalidatePath("/login-page-hotspot/new");
  redirect(pesan ? `${HALAMAN}?galat=${encodeURIComponent(pesan)}` : `${HALAMAN}?ok=1`);
}

/** Angka rupiah dari isian bebas: "25.000", "Rp 25000", "25 000" sama saja. */
function angka(nilai: FormDataEntryValue | null): number | null {
  const bersih = String(nilai ?? "").replace(/[^\d]/g, "");
  if (!bersih) return null;
  const n = Number(bersih);
  return Number.isSafeInteger(n) ? n : null;
}

export async function simpanHargaFitur(formData: FormData) {
  const kunci = String(formData.get("kunci") ?? "");
  const harga = angka(formData.get("harga"));
  const aktif = formData.get("aktif") !== null;

  if (!kunci) kembali("Fitur tidak dikenal.");
  if (harga === null || harga < 0) kembali("Harga harus angka 0 atau lebih.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("fitur")
    .update({ harga, aktif })
    .eq("kunci", kunci);

  if (error) kembali(error.message);
  kembali();
}

export async function tambahPaket(formData: FormData) {
  const nama = String(formData.get("nama") ?? "").trim();
  const rupiah = angka(formData.get("rupiah"));
  const koin = angka(formData.get("koin"));

  if (!rupiah || rupiah <= 0) kembali("Harga paket harus lebih dari nol.");
  /* Koin dikosongkan berarti mengikuti rupiahnya — rasio 1:1 adalah keadaan
     biasa, dan memaksa mengetik angka yang sama dua kali hanya mengundang
     salah ketik. */
  const jumlahKoin = koin && koin > 0 ? koin : rupiah;

  const supabase = await createClient();
  const { data: terakhir } = await supabase
    .from("coin_packages")
    .select("urutan")
    .order("urutan", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("coin_packages").insert({
    nama: nama || `Rp ${rupiah.toLocaleString("id-ID")}`,
    koin: jumlahKoin,
    rupiah,
    urutan: (terakhir?.urutan ?? 0) + 1,
  });

  if (error) kembali(error.message);
  kembali();
}

export async function simpanPaket(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const nama = String(formData.get("nama") ?? "").trim();
  const rupiah = angka(formData.get("rupiah"));
  const koin = angka(formData.get("koin"));

  if (!id) kembali("Paket tidak dikenal.");
  if (!rupiah || rupiah <= 0) kembali("Harga paket harus lebih dari nol.");
  if (!koin || koin <= 0) kembali("Jumlah koin harus lebih dari nol.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("coin_packages")
    .update({ nama: nama || `Rp ${rupiah.toLocaleString("id-ID")}`, rupiah, koin })
    .eq("id", id);

  if (error) kembali(error.message);
  kembali();
}

export async function ubahAktifPaket(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const aktif = String(formData.get("aktif") ?? "") === "1";
  if (!id) kembali("Paket tidak dikenal.");

  const supabase = await createClient();
  const { error } = await supabase.from("coin_packages").update({ aktif }).eq("id", id);
  if (error) kembali(error.message);
  kembali();
}

/**
 * Paket dinonaktifkan, bukan dihapus, bila sudah pernah dipakai.
 *
 * Baris topup menyimpan koin dan rupiahnya sendiri, jadi menghapus paket tidak
 * merusak riwayat — tetapi menyembunyikannya tetap lebih baik daripada
 * menghilangkan jejak apa yang pernah dijual dan seharga berapa.
 */
export async function hapusPaket(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) kembali("Paket tidak dikenal.");

  const supabase = await createClient();
  const { error } = await supabase.from("coin_packages").delete().eq("id", id);
  if (error) kembali(error.message);
  kembali();
}

/** Memberi atau menarik koin secara manual — untuk refund dan bonus. */
export async function sesuaikanKoin(formData: FormData) {
  const user = String(formData.get("user") ?? "");
  const jumlah = Number(String(formData.get("jumlah") ?? "").replace(/[^\d-]/g, ""));
  const jenis = String(formData.get("jenis") ?? "penyesuaian");
  const keterangan = String(formData.get("keterangan") ?? "").trim();

  if (!user) kembali("Pengguna tidak dikenal.");
  if (!Number.isSafeInteger(jumlah) || jumlah === 0) {
    kembali("Jumlah koin harus angka dan tidak boleh nol.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sesuaikan_koin", {
    p_user: user,
    p_jumlah: jumlah,
    p_jenis: jenis,
    p_keterangan: keterangan || null,
  });

  if (error) kembali(error.message);
  kembali();
}

export async function ubahAktifAkun(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const aktif = String(formData.get("aktif") ?? "") === "1";
  if (!id) kembali("Akun tidak dikenal.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ aktif }).eq("id", id);
  if (error) kembali(error.message);
  kembali();
}
