import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * /setup dan /admin wajib login. /admin juga wajib peran ADMIN — pengguna
 * biasa yang nyasar ke sana dilempar balik ke /setup, bukan ke /login,
 * supaya tidak terlihat seperti sesi mereka hilang.
 */
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    if (req.nextUrl.pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/setup", req.url));
    }
  },
  {
    pages: { signIn: "/login" },
  },
);

export const config = {
  matcher: ["/setup/:path*", "/admin/:path*"],
};
