import { createAdminClient } from "@/lib/supabase/admin";
import {
  bacaHasil,
  bacaKonfigurasi,
  periksaCallback,
  type IsiCallback,
} from "@/lib/koin/duitku";

/**
 * Callback pembayaran Duitku.
 *
 * Dipanggil server Duitku, bukan browser pelanggan — jadi tidak ada sesi, dan
 * satu-satunya bukti keaslian adalah tanda tangan. Alurnya sengaja pendek:
 * periksa tanda tangan, lalu serahkan seluruh keputusan ke fungsi database yang
 * mengunci barisnya. Tidak ada pemeriksaan "sudah lunas belum" di sini, karena
 * pemeriksaan semacam itu di kode aplikasi selalu bisa dilewati dua callback
 * yang datang bersamaan.
 *
 * Selalu membalas 200 untuk callback yang sah, termasuk yang berulang. Duitku
 * mengirim ulang callback yang tidak dibalas 200, dan membalas error hanya
 * membuat antrean pengiriman ulang tanpa memperbaiki apa pun.
 */

export const dynamic = "force-dynamic";

/** Duitku mengirim form-urlencoded; sebagian akun dikonfigurasi JSON. */
async function bacaIsi(req: Request): Promise<Record<string, string>> {
  const tipe = req.headers.get("content-type") ?? "";

  if (tipe.includes("application/json")) {
    const data = (await req.json()) as Record<string, unknown>;
    const hasil: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== null && v !== undefined) hasil[k] = String(v);
    }
    return hasil;
  }

  const form = await req.formData();
  const hasil: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") hasil[k] = v;
  }
  return hasil;
}

export async function POST(req: Request) {
  let mentah: Record<string, string>;
  try {
    mentah = await bacaIsi(req);
  } catch {
    return new Response("isi tidak terbaca", { status: 400 });
  }

  const isi: IsiCallback = {
    merchantCode: mentah.merchantCode ?? "",
    amount: mentah.amount ?? "",
    merchantOrderId: mentah.merchantOrderId ?? "",
    signature: mentah.signature ?? "",
    resultCode: mentah.resultCode ?? "",
    reference: mentah.reference,
    paymentCode: mentah.paymentCode,
  };

  let cfg;
  try {
    cfg = bacaKonfigurasi();
  } catch (e) {
    // Konfigurasi hilang di server: jangan pura-pura berhasil. 500 membuat
    // Duitku mengirim ulang nanti, jadi pembayarannya tidak hilang.
    console.error("[duitku] konfigurasi belum lengkap", e);
    return new Response("belum dikonfigurasi", { status: 500 });
  }

  const periksa = periksaCallback(cfg, isi);
  if (!periksa.sah) {
    // Jangan sebutkan alasannya di balasan — itu menuntun penyerang menebak
    // bentuk tanda tangan yang benar. Cukup dicatat di log server.
    console.warn(`[duitku] callback ditolak (${periksa.alasan})`, {
      merchantOrderId: isi.merchantOrderId,
    });
    return new Response("ditolak", { status: 403 });
  }

  const hasil = bacaHasil(isi.resultCode);
  if (hasil === "menunggu") {
    return new Response("OK", { status: 200 });
  }

  let db;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error("[duitku] service role belum diisi", e);
    return new Response("belum dikonfigurasi", { status: 500 });
  }

  if (hasil === "gagal") {
    const { error } = await db.rpc("gagalkan_topup", {
      p_merchant_order_id: isi.merchantOrderId,
      p_status: "gagal",
      p_raw: mentah,
    });
    if (error) {
      console.error("[duitku] gagal menandai topup gagal", error);
      return new Response("gagal", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  }

  const { data, error } = await db.rpc("kredit_topup", {
    p_merchant_order_id: isi.merchantOrderId,
    p_reference: isi.reference ?? null,
    p_metode: mentah.paymentMethod ?? mentah.paymentCode ?? null,
    p_raw: mentah,
  });

  if (error) {
    // 500 supaya Duitku mengirim ulang: uangnya sudah masuk, koinnya belum.
    console.error("[duitku] gagal mengkredit koin", { id: isi.merchantOrderId, error });
    return new Response("gagal", { status: 500 });
  }

  const baris = Array.isArray(data) ? data[0] : data;
  if (baris?.sudah_pernah) {
    console.info(`[duitku] callback berulang diabaikan: ${isi.merchantOrderId}`);
  } else {
    console.info(`[duitku] topup lunas: ${isi.merchantOrderId} (+${baris?.koin} koin)`);
  }

  return new Response("OK", { status: 200 });
}

/** Duitku kadang memeriksa alamat callback dengan GET sebelum mengaktifkannya. */
export async function GET() {
  return new Response("OK", { status: 200 });
}
