import type { Metadata } from "next";
import { IpCalculator } from "@/components/ip-calc/IpCalculator";

export const metadata: Metadata = {
  title: "Kalkulator IP — Generator Script Mikrotik",
  description:
    "Hitung subnet IPv4: network, broadcast, rentang host, netmask, wildcard, dan bagi jaringan menjadi beberapa subnet. Lengkap dengan perintah RouterOS siap salin.",
};

export default function IpCalcPage() {
  return <IpCalculator />;
}