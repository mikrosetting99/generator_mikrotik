import { signOut } from "next-auth/react";

/**
 * Keluar dengan dua lapis: signOut bawaan next-auth, lalu penghapusan cookie
 * lewat /api/logout sebagai cadangan, dan terakhir muat ulang penuh ke beranda
 * supaya tidak ada halaman lama dari cache yang masih menampilkan akun.
 */
export async function fullSignOut(): Promise<void> {
  try {
    await signOut({ redirect: false });
  } catch {
    // dilanjutkan ke cadangan
  }
  try {
    await fetch("/api/logout", { method: "POST", cache: "no-store" });
  } catch {
    // tetap lanjut
  }
  window.location.assign("/");
}