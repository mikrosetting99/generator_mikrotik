import type { Metadata } from "next";
import { CustomerForm } from "@/components/setting-form/CustomerForm";
import { getSiteSettings } from "@/lib/site-settings-server";

export const dynamic = "force-dynamic";

// Link pribadi pelanggan: jangan diindeks mesin pencari dan jangan bocorkan token lewat referer.
export const metadata: Metadata = {
  title: "Form Setting MikroTik",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SettingFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSiteSettings();
  return <CustomerForm token={token} siteName={settings.siteName} />;
}
