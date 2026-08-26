import { createClient } from "@supabase/supabase-js";

/**
 * Klien Supabase dengan service role — melewati seluruh RLS.
 *
 * Dipakai HANYA oleh callback Duitku, yang datang dari server Duitku dan tidak
 * membawa sesi pengguna sama sekali. Tidak boleh dipanggil dari server action
 * biasa: di sana sesi penggunanya ada, dan memakai kunci ini berarti membuang
 * seluruh penjagaan RLS tanpa alasan.
 *
 * Kuncinya tidak pernah boleh berawalan NEXT_PUBLIC_ dan tidak pernah ikut ke
 * browser. Siapa pun yang memegangnya bisa membaca dan mengubah seluruh isi
 * database, termasuk buku besar koin.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY atau NEXT_PUBLIC_SUPABASE_URL belum diisi — callback pembayaran tidak bisa mengkredit koin.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminSiap(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
