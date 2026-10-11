import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * nginx di server menyimpan cache jawaban halaman dan mengabaikan
   * Cache-Control — halaman beranda yang berisi nama pengguna sampai ikut
   * tersimpan, jadi logout tampak tidak berfungsi. X-Accel-Expires: 0 adalah
   * perintah khusus nginx agar sebuah jawaban tidak di-cache. Berkas statis
   * (_next/static, gambar template) sengaja dikecualikan.
   */
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|hotspot-templates|favicon\\.ico).*)",
        headers: [{ key: "X-Accel-Expires", value: "0" }],
      },
    ];
  },
  async redirects() {
    return [
      /**
       * Bagian ini dulu bernama /lisensi. Tautan lama — bookmark, riwayat
       * browser, pesan WhatsApp ke pembeli — tetap diantar ke alamat baru.
       *
       * Sengaja bukan permanent: pengalihan permanen disimpan browser nyaris
       * selamanya dan sulit ditarik kembali kalau penamaannya berubah lagi.
       */
      {
        source: "/lisensi",
        destination: "/login-page-hotspot",
        permanent: false,
      },
      {
        source: "/lisensi/:path*",
        destination: "/login-page-hotspot/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
