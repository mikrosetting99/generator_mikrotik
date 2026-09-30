import type { Metadata } from "next";
import { CekBuilder } from "@/components/cek/CekBuilder";

export const metadata: Metadata = {
  title: "Cek Mikrotik — Generator Script Mikrotik",
  description:
    "Pemeriksaan router Mikrotik: koneksi internet, IP, DHCP, hotspot, PPPoE, firewall, dan resource — lengkap dengan rekomendasi perbaikan.",
};

export default function CekPage() {
  return <CekBuilder />;
}
