import type { Metadata } from "next";
import { DnsFlushBuilder } from "@/components/dns-flush/DnsFlushBuilder";

export const metadata: Metadata = {
  title: "Autoflush DNS",
  description:
    "Buat scheduler Mikrotik yang membersihkan cache DNS otomatis secara berkala — script siap tempel untuk RouterOS v6 dan v7.",
};

export default function DnsFlushPage() {
  return <DnsFlushBuilder />;
}