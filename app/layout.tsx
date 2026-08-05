import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generator Script Mikrotik",
  description:
    "Buat script konfigurasi RouterOS siap copy-paste: Setup Mikrotik Baru, Load Balance PCC, dan Fail Over.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
