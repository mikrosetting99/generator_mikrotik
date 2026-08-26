"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tujuanAman } from "@/lib/license/tujuan";

export async function signIn(_prevState: string | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return "Email atau password salah.";
  }

  // Tujuan semula dititipkan middleware lewat kolom tersembunyi; nilainya
  // tetap diperiksa ulang di sini, bukan dipercaya begitu saja dari form.
  redirect(tujuanAman(formData.get("lanjut")));
}

/**
 * Pendaftaran pelanggan sendiri.
 *
 * Peran TIDAK pernah dikirim dari form. Setiap akun baru lahir sebagai
 * 'pelanggan' lewat nilai bawaan kolomnya; kalau peran boleh datang dari
 * pendaftaran, siapa pun bisa mendaftar sebagai admin.
 */
export async function daftar(_prevState: string | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nama = String(formData.get("nama") ?? "").trim();
  const wa = String(formData.get("wa") ?? "").trim();

  if (!email || !password) return "Email dan password wajib diisi.";
  if (password.length < 8) return "Password minimal 8 karakter.";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nama, wa } },
  });

  if (error) {
    // Pesan Supabase berbahasa Inggris; yang paling sering muncul diterjemahkan.
    if (/already registered/i.test(error.message)) {
      return "Email itu sudah terdaftar. Silakan masuk.";
    }
    return error.message;
  }

  /* Bila verifikasi email dinyalakan di Supabase, sesi belum terbentuk dan
     pengguna harus membuka tautan di emailnya lebih dulu. Membiarkannya
     terlempar ke halaman koin dalam keadaan itu hanya membingungkan. */
  if (!data.session) {
    return "TERKIRIM";
  }

  redirect("/login-page-hotspot/koin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login-page-hotspot/login");
}
