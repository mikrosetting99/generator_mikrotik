import type { Metadata } from "next";
import { JetBrains_Mono, Roboto } from "next/font/google";
import { Providers } from "@/app/providers";
import { themeBootScript } from "@/components/ThemeToggle";
import { getSiteSettings } from "@/lib/site-settings-server";
import { themeCss } from "@/lib/theme";
import "./globals.css";

/** Roboto, seperti Odoo. Nama variabelnya tetap --font-inter agar tidak mengubah pemakai lain. */
const inter = Roboto({
  variable: "--font-inter",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Judul tab dan ikon tab mengikuti nama & logo situs dari dashboard admin.
 * Dinamis (bukan statis saat build) supaya perubahan admin langsung berlaku.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const icon = settings.logoDataUrl ? `/api/site-logo?v=${settings.logoVersion}` : "/favicon.ico";

  return {
    // Halaman memberi judul pendek ("Cek Mikrotik"); nama situs ditambahkan di belakangnya.
    title: { default: settings.siteName, template: `%s — ${settings.siteName}` },
    description:
      "Buat script konfigurasi RouterOS siap copy-paste: Setup Mikrotik Baru, Load Balance & Fail Over, dan Halaman Login Hotspot. By Mikrosetting.com",
    icons: { icon, shortcut: icon, ...(settings.logoDataUrl ? { apple: icon } : {}) },
  };
}
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Menetapkan tema sebelum halaman digambar agar tidak berkedip. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        {/* Warna tema pilihan admin; bila kosong, tampilan memakai warna bawaan di globals.css. */}
        {(settings.themeBrand || settings.themeAccent) && (
          <style dangerouslySetInnerHTML={{ __html: themeCss(settings.themeBrand, settings.themeAccent) }} />
        )}
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {settings.appBgId && (
          // Latar seluruh aplikasi dari dashboard admin; lapisan warna tema menjaga keterbacaan.
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
            style={{ backgroundImage: `url(/api/background-presets/${settings.appBgId}/image)` }}
          >
            <div
              className="absolute inset-0"
              style={{ background: `color-mix(in srgb, var(--color-canvas) ${settings.appBgOverlay}%, transparent)` }}
            />
          </div>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
