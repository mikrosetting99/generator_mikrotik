"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buatKunci, bacaSalt, rapikanIdentity } from "@/lib/license/key";
import { pecahNomor } from "@/lib/license/nomor";
import { bacaForm, bacaPaket, periksaForm } from "@/lib/license/form";
import type { PesananLengkap } from "@/lib/license/pesanan";

/* ------------------------------------------------------------------ *
 * Membaca
 * ------------------------------------------------------------------ */

export async function daftarPesanan(): Promise<PesananLengkap[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("license_orders")
    .select("*, license_packages(*)")
    .order("created_at", { ascending: false });
  return (data ?? []) as PesananLengkap[];
}

export async function ambilPesanan(id: string): Promise<PesananLengkap | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("license_orders")
    .select("*, license_packages(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const pesanan = data as PesananLengkap;
  pesanan.license_packages.sort((a, b) => a.posisi - b.posisi);
  return pesanan;
}

/* ------------------------------------------------------------------ *
 * Menulis
 * ------------------------------------------------------------------ */

export async function createLicenseOrder(_prev: string | undefined, formData: FormData) {
  const isi = bacaForm(formData);
  const paket = bacaPaket(formData);
  const nomorMentah = String(formData.get("wa") ?? "");

  const salah = periksaForm(isi, paket, nomorMentah);
  if (salah) return salah;

  let nomor;
  try {
    nomor = pecahNomor(nomorMentah);
  } catch (e) {
    return (e as Error).message;
  }

  /* Pesanan dan pemotongan koin dikerjakan satu fungsi database, jadi satu
     transaksi. Biayanya ditentukan di dalam fungsi itu, bukan dikirim dari
     sini: parameter biaya berarti siapa pun bisa memanggil RPC-nya langsung
     dengan nilai nol dan membuat pesanan gratis. Dipisah — insert di sini lalu potong koin sesudahnya — cepat
     atau lambat menghasilkan pesanan tanpa koin terpotong, atau koin terpotong
     tanpa pesanan. Fungsi itu juga yang menolak bila saldonya kurang, karena
     hanya di dalam transaksi itulah saldo bisa dipastikan tidak berubah di
     tengah jalan. */
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_pesanan_berbayar", {
    p_pesanan: { ...isi, wa_nomor: nomor.wa, wa_tampil: nomor.tampil },
    p_paket: paket,
  });

  if (error) {
    /* Saldo kurang bukan kerusakan, melainkan keadaan yang wajar — jadi
       dijawab dengan kalimat yang bisa ditindaklanjuti, bukan pesan Postgres. */
    if (/Koin tidak cukup/i.test(error.message)) {
      return `${error.message}. Isi saldo dulu di menu Koin.`;
    }
    if (/Akun tidak aktif/i.test(error.message)) {
      return "Akun Anda sedang dinonaktifkan. Hubungi admin.";
    }
    return error.message;
  }

  const id = typeof data === "string" ? data : "";
  if (!id) return "Pesanan gagal dibuat.";

  revalidatePath("/login-page-hotspot");
  revalidatePath("/login-page-hotspot/koin");
  redirect(`/login-page-hotspot/${id}/edit`);
}

export async function updateLicenseOrder(id: string, _prev: string | undefined, formData: FormData) {
  const isi = bacaForm(formData);
  const paket = bacaPaket(formData);
  const nomorMentah = String(formData.get("wa") ?? "");

  const salah = periksaForm(isi, paket, nomorMentah);
  if (salah) return salah;

  let nomor;
  try {
    nomor = pecahNomor(nomorMentah);
  } catch (e) {
    return (e as Error).message;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("license_orders")
    .update({ ...isi, wa_nomor: nomor.wa, wa_tampil: nomor.tampil })
    .eq("id", id);
  if (error) return error.message;

  /* Paket ditulis ulang seluruhnya. Baris paket tidak punya makna sendiri di
     luar pesanannya, jadi mencocokkan satu per satu hanya menambah kerumitan. */
  await supabase.from("license_packages").delete().eq("order_id", id);
  const { error: errPaket } = await supabase
    .from("license_packages")
    .insert(paket.map((p) => ({ ...p, order_id: id })));
  if (errPaket) return errPaket.message;

  revalidatePath("/login-page-hotspot");
  revalidatePath(`/login-page-hotspot/${id}/edit`);
  return "Tersimpan.";
}

/**
 * Menerbitkan kunci dari ID ROUTER yang dilaporkan pembeli.
 *
 * Sengaja terpisah dari penyimpanan pesanan: ID ROUTER baru diketahui setelah
 * pembeli memasang berkasnya, jadi ini selalu langkah kedua. Menerbitkan ulang
 * dengan ID berbeda diperbolehkan — pembeli yang mengganti nama routernya
 * butuh kunci baru, dan itu bukan pelanggaran.
 */
export async function terbitkanLisensi(id: string, _prev: string | undefined, formData: FormData) {
  const identity = rapikanIdentity(String(formData.get("router_identity") ?? ""));
  if (!identity) return "ID ROUTER belum diisi.";
  if (identity.startsWith("$(")) {
    return "Itu bukan ID ROUTER, melainkan tulisan mentah dari template. Pembeli harus menyalin yang tampil di layar HP.";
  }

  let kunci: string;
  try {
    kunci = buatKunci(identity, bacaSalt());
  } catch (e) {
    return (e as Error).message;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("license_orders")
    .update({
      router_identity: identity,
      lisensi_kunci: kunci,
      lisensi_terbit_pada: new Date().toISOString(),
      status: "aktif",
    })
    .eq("id", id);
  if (error) return error.message;

  revalidatePath("/login-page-hotspot");
  revalidatePath(`/login-page-hotspot/${id}/edit`);
  return `Kunci terbit: ${kunci}`;
}

export async function deleteLicenseOrder(id: string) {
  const supabase = await createClient();
  await supabase.from("license_orders").delete().eq("id", id);
  revalidatePath("/login-page-hotspot");
}
