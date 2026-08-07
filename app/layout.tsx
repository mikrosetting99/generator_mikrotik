import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { themeBootScript } from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-code",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Generator Script Mikrotik — Mikrosetting.com",
  description:
    "Buat script konfigurasi RouterOS siap copy-paste: Setup Mikrotik Baru, Load Balance PCC, dan Fail Over. By Mikrosetting.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Menetapkan tema sebelum halaman digambar agar tidak berkedip. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
