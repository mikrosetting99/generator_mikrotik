import type { ReactNode } from "react";
import { MenuGate } from "@/components/MenuGate";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: ReactNode }) {
  return <MenuGate id="bandwidth">{children}</MenuGate>;
}