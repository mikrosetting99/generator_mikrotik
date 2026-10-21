import type { Metadata } from "next";
import { BandwidthCalculator } from "@/components/bandwidth/BandwidthCalculator";

export const metadata: Metadata = {
  title: "Hitung Bandwidth",
  description:
    "Hitung kebutuhan bandwidth ISP dari perkiraan jumlah user PPPoE, Hotspot, dan IP DHCP dengan beberapa paket pembatasan kecepatan, lengkap dengan perintah RouterOS.",
};

export default function BandwidthPage() {
  return <BandwidthCalculator />;
}