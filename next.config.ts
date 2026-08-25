import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
