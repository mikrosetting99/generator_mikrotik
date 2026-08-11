import type { Metadata } from "next";
import { LoadBalanceBuilder } from "@/components/loadbalance/LoadBalanceBuilder";

export const metadata: Metadata = {
  title: "Load Balance PCC + Failover — Generator Script Mikrotik",
  description:
    "Builder untuk load balance multi-ISP dengan Per Connection Classifier, sekaligus failover otomatis lewat recursive gateway.",
};

export default function LoadBalancePage() {
  return <LoadBalanceBuilder />;
}
