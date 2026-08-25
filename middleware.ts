import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Bagian penerbit yang dijaga: penerbitan lisensi dan generator halaman login
 * yang menjadi produknya. Menu /setup, /loadbalance, dan sisanya memang untuk
 * umum dan tidak boleh ikut terkunci.
 */
export const config = {
  matcher: ["/login-page-hotspot/:path*", "/hotspot-login/:path*"],
};
