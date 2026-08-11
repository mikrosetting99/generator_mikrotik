import type { Metadata } from "next";
import { HotspotLoginBuilder } from "@/components/hotspot-login/HotspotLoginBuilder";

export const metadata: Metadata = {
  title: "Halaman Login Hotspot — Generator Script Mikrotik",
  description:
    "Kustomisasi tampilan halaman login hotspot: template, warna, logo, dan paket voucher, lalu unduh sebagai hotspot.zip siap upload.",
};

export default function HotspotLoginPage() {
  return <HotspotLoginBuilder />;
}
