import type { Metadata } from "next";
import { LoadBalanceBuilder } from "@/components/loadbalance/LoadBalanceBuilder";
import { petaHarga } from "@/lib/koin/fitur";

export const metadata: Metadata = {
  title: "Load Balance PCC + Failover — Generator Script Mikrotik",
  description:
    "Builder untuk load balance multi-ISP dengan Per Connection Classifier, sekaligus failover otomatis lewat recursive gateway.",
};

export const dynamic = "force-dynamic";

export default async function LoadBalancePage() {
  const harga = await petaHarga();
  return (
    <LoadBalanceBuilder
      hargaPcc={harga.loadbalance ?? 0}
      hargaFailover={harga.failover ?? 0}
    />
  );
}
