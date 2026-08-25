import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Hanya bagian lisensi yang dijaga. Generator setup MikroTik di /setup
 * memang untuk umum dan tidak boleh ikut terkunci.
 */
export const config = {
  matcher: ["/lisensi/:path*"],
};
