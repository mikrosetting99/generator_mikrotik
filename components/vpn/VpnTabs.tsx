"use client";

import { useEffect, useState } from "react";
import { VpnAdmin } from "@/components/vpn/VpnAdmin";
import { VpnRadiusAdmin } from "@/components/vpn/VpnRadiusAdmin";

const TABS = [
  { id: "scripts", label: "Link script" },
  { id: "accounts", label: "Akun VPN" },
  { id: "servers", label: "Server VPN" },
  { id: "packages", label: "Paket" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const isTab = (v: string): v is Tab => TABS.some((t) => t.id === v);

/** Tab admin di /vpn: link script lama tetap di tab pertama, VPN RADIUS di tab lainnya. Tab terpilih diingat di #hash. */
export function VpnTabs() {
  const [tab, setTab] = useState<Tab>("scripts");

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (isTab(fromHash)) setTab(fromHash);
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "scripts" ? window.location.pathname : `#${t}`);
  };

  return (
    <div>
      <nav aria-label="Bagian VPN" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "scripts" ? <VpnAdmin /> : <VpnRadiusAdmin view={tab} />}
    </div>
  );
}
