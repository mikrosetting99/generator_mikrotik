"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bacaKonfigurasi, buatTransaksi, nomorTopup } from "@/lib/koin/duitku";

/**
 * Topup koin.
 *
 * Jumlah koin dan harganya tidak pernah dikirim dari browser. Server action ini
 * hanya meneruskan id paket; fungsi database buat_topup() yang membaca koin dan
 * rupiahnya dari tabel paket. Kalau nilainya boleh datang dari form, siapa pun
 * bisa mengubahnya di browser dan membeli 1000 koin seharga seribu rupiah.
 */

export type HasilTopup = { ok: true; url: string } | { ok: false; pesan: string };

export async function mulaiTopup(paketId: string): Promise<HasilTopup> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, pesan: "Silakan masuk terlebih dahulu." };

  let cfg;
  try {
    cfg = bacaKonfigurasi();
  } catch {
    return { ok: false, pesan: "Pembayaran belum dikonfigurasi. Hubungi admin." };
  }

  const merchantOrderId = nomorTopup();

  /* Baris topup dibuat SEBELUM memanggil Duitku. Kalau urutannya dibalik dan
     penulisan baris gagal, pelanggan sudah terlanjur dibawa ke halaman bayar
     untuk nomor yang tidak dikenali callback — uang masuk, koin tidak. */
  const { data, error } = await supabase.rpc("buat_topup", {
    p_merchant_order_id: merchantOrderId,
    p_paket_id: paketId,
  });

  if (error) {
    console.error("[topup] gagal membuat baris topup", error);
    return { ok: false, pesan: error.message || "Gagal memulai topup." };
  }

  const paket = Array.isArray(data) ? data[0] : data;
  if (!paket) return { ok: false, pesan: "Paket topup tidak tersedia." };

  try {
    const hasil = await buatTransaksi(cfg, {
      merchantOrderId,
      jumlah: paket.rupiah,
      keterangan: `Topup ${paket.koin} koin - ${paket.nama}`,
      email: user.email ?? "pelanggan@mikrosetting.com",
      namaPembeli: (user.user_metadata?.nama as string) || user.email || "Pelanggan",
    });

    await supabase.rpc("set_pembayaran_topup", {
      p_merchant_order_id: merchantOrderId,
      p_reference: hasil.reference || null,
      p_payment_url: hasil.paymentUrl,
    });

    revalidatePath("/login-page-hotspot/koin");
    return { ok: true, url: hasil.paymentUrl };
  } catch (e) {
    /* Tandai gagal supaya barisnya tidak menggantung sebagai "menunggu"
       selamanya di riwayat pelanggan. */
    await supabase.rpc("batalkan_topup_sendiri", { p_merchant_order_id: merchantOrderId });

    console.error("[topup] Duitku menolak", e);
    return { ok: false, pesan: e instanceof Error ? e.message : "Gagal menghubungi pembayaran." };
  }
}
