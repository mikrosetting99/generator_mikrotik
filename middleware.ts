import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * /setup, /admin, dan /login-page-hotspot wajib login. /admin juga wajib
 * peran ADMIN — pengguna biasa yang nyasar ke sana dilempar balik ke /setup,
 * bukan ke /login, supaya tidak terlihat seperti sesi mereka hilang.
 *
 * /loadbalance dan /hotspot-login tetap terbuka untuk umum.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (req.nextUrl.pathname.startsWith("/admin") && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/setup/:path*", "/admin/:path*", "/login-page-hotspot/:path*"],
};
