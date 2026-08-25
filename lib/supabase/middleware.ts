import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { tujuanAman } from "@/lib/license/tujuan";

/**
 * Bagian yang hanya boleh dibuka penerbit, bukan pengunjung umum:
 * penerbitan lisensi, dan generator halaman login yang menjadi produknya.
 */
const RUTE_TERKUNCI = ["/lisensi", "/hotspot-login"];

const RUTE_MASUK = "/lisensi/login";

function terkunci(pathname: string): boolean {
  return RUTE_TERKUNCI.some(
    (awalan) => pathname === awalan || pathname.startsWith(`${awalan}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured()) {
    /* Tanpa konfigurasi Supabase tidak ada cara memeriksa sesi. Meneruskan
       permintaan berarti kuncinya terbuka diam-diam — dan justru generator
       halaman login tetap berfungsi penuh tanpa server, jadi seluruh isinya
       bocor. Karena itu ditutup, bukan diloloskan. */
    return terkunci(pathname) ? new NextResponse(null, { status: 404 }) : response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = pathname === RUTE_MASUK;

  if (terkunci(pathname) && !isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = RUTE_MASUK;
    /* Tujuan semula dibawa serta supaya setelah masuk pengguna kembali ke
       halaman yang tadi dituju, bukan selalu ke daftar pesanan. */
    url.search = `?lanjut=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    const lanjut = request.nextUrl.searchParams.get("lanjut");
    url.pathname = tujuanAman(lanjut);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
