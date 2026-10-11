import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Sesi tanpa "remember me" dianggap basi setelah durasi ini, walau cookie-nya
 * sendiri (session.maxAge di lib/auth.ts) jauh lebih panjang — supaya yang
 * tidak mencentang "remember me" memang diminta login ulang dalam waktu
 * wajar, bukan ikut tersimpan sebulan seperti yang mencentang.
 */
const SHORT_SESSION_SECONDS = 8 * 60 * 60; // 8 jam

/**
 * /admin dan /login-page-hotspot wajib login. /admin juga
 * wajib peran ADMIN — pengguna biasa yang nyasar ke sana dilempar balik ke
 * beranda, bukan ke /login, supaya tidak terlihat seperti sesi mereka hilang.
 *
 * Beranda dan menu (/setup, /loadbalance, /hotspot-login, /cek) diatur admin di
 * /admin — wajib login atau terbuka — dan dijaga di layout masing-masing.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  const expired =
    token &&
    !token.rememberMe &&
    typeof token.iat === "number" &&
    Date.now() / 1000 - token.iat > SHORT_SESSION_SECONDS;

  if (!token || expired) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login-page-hotspot/:path*"],
};
