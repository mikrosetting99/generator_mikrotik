import type { Metadata } from "next";
import { RackDesigner } from "@/components/rack/RackDesigner";

export const metadata: Metadata = {
  title: "Simulasi Rack Server",
  description:
    "Susun perangkat di rack server per U, lalu lihat ruang terpakai, daya, arus, panas (BTU), berat, dan kapasitas UPS sebelum membeli atau memasang.",
};

export default function RackServerPage() {
  return <RackDesigner />;
}
