import type { Metadata } from "next";
import { StaticRoutingBuilder } from "@/components/static-routing/StaticRoutingBuilder";

export const metadata: Metadata = {
  title: "Static Routing Aplikasi",
  description:
    "Arahkan YouTube, TikTok, Facebook, WhatsApp, atau domain lain lewat ISP tertentu dengan RAW + mangle untuk RouterOS 6 dan 7.",
};

export default function StaticRoutingPage() {
  return <StaticRoutingBuilder />;
}