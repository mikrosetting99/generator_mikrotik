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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/lisensi/login");
}
