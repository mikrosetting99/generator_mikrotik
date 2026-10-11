import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Cadangan logout: menghapus cookie sesi next-auth apa pun namanya.
 *
 * signOut() bawaan hanya menghapus cookie bernama sesuai NEXTAUTH_URL. Bila
 * NEXTAUTH_URL di server beda skema dengan alamat yang dipakai pengunjung
 * (http vs https di balik proxy), cookie-nya tidak ikut terhapus dan pengguna
 * tetap tampak login. Di sini kedua varian dihapus sekaligus.
 */
const NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
  "next-auth.csrf-token",
  "__Host-next-auth.csrf-token",
];

export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  for (const name of NAMES) {
    const secure = name.startsWith("__");
    res.cookies.set(name, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure });
  }
  return res;
}