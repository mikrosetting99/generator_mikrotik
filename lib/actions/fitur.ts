"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Membuka satu fitur berbayar.
 *
 * Harganya tidak ikut dikirim dari sini — fungsi database yang membacanya,
 * karena harga yang boleh dikirim adalah harga yang bisa dikirim nol.
 */

export type HasilBuka =
  | { ok: true; saldo: number }
  | { ok: false; alasan: "masuk" | "kurang" | "lain"; pesan: string };

export async function bukaFitur(kunci: string, keterangan?: string): Promise<HasilBuka> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("pakai_fitur", {
    p_kunci: kunci,
    p_keterangan: keterangan ?? null,
  });

  if (error) {
    /* Tiga keadaan ini bukan kerusakan, melainkan jawaban yang perlu
       ditindaklanjuti pengguna dengan cara berbeda — jadi dibedakan di sini
       supaya layar bisa menawarkan tombol yang tepat. */
    if (/Belum masuk/i.test(error.message)) {
      return { ok: false, alasan: "masuk", pesan: "Masuk dulu untuk memakai fitur ini." };
    }
    if (/Koin tidak cukup/i.test(error.message)) {
      return { ok: false, alasan: "kurang", pesan: error.message };
    }
    return { ok: false, alasan: "lain", pesan: error.message };
  }

  revalidatePath("/login-page-hotspot/koin");
  return { ok: true, saldo: typeof data === "number" ? data : 0 };
}
