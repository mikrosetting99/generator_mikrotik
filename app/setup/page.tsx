import type { Metadata } from "next";
import { SetupBuilder } from "@/components/setup/SetupBuilder";
import { hargaFitur } from "@/lib/koin/fitur";

export const metadata: Metadata = {
  title: "Setup Mikrotik Baru — Generator Script Mikrotik",
  description:
    "Builder modular untuk konfigurasi Mikrotik dari kondisi default: WAN, DNS, NAT, bridge, VLAN, IP address, pool, DHCP server, hotspot, PPPoE, dan firewall dasar.",
};

/* Harga bisa diubah admin kapan saja, jadi halaman ini tidak boleh disajikan
   dari cache — angka yang basi di sini berarti pelanggan dipotong dengan
   tarif yang bukan tarif berlaku. */
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  return <SetupBuilder harga={await hargaFitur("setup")} />;
}
