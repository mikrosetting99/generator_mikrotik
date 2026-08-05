import type { Metadata } from "next";
import { SetupBuilder } from "@/components/setup/SetupBuilder";

export const metadata: Metadata = {
  title: "Setup Mikrotik Baru — Generator Script Mikrotik",
  description:
    "Builder modular untuk konfigurasi Mikrotik dari kondisi default: WAN, DNS, NAT, bridge, VLAN, IP address, pool, DHCP server, hotspot, PPPoE, dan firewall dasar.",
};

export default function SetupPage() {
  return <SetupBuilder />;
}
