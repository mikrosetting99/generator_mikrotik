import type { Metadata } from "next";
import { CustomerScriptView } from "@/components/vpn/CustomerScriptView";
import { getSiteSettings } from "@/lib/site-settings-server";

export const dynamic = "force-dynamic";

// Halaman pribadi pelanggan: jangan diindeks mesin pencari dan jangan menyimpan referer.
export const metadata: Metadata = {
  title: "Script Anda",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CustomerScriptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSiteSettings();
  return <CustomerScriptView token={token} siteName={settings.siteName} />;
}