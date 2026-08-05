"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Cpu, Lock, Rotate, Wand } from "@/components/icons";
import { ScriptPreview } from "@/components/setup/ScriptPreview";
import {
  AddressSection,
  BridgeSection,
  DeviceSection,
  DhcpSection,
  DnsSection,
  FirewallSection,
  HotspotSection,
  NatSection,
  PoolSection,
  PppoeSection,
  SECTION_META,
  VlanSection,
  WanSection,
  type SectionProps,
} from "@/components/setup/sections";
import { Button } from "@/components/ui";
import {
  createDefaultConfig,
  newAddress,
  newBridge,
  newDhcpServer,
  newPool,
  newWan,
} from "@/lib/defaults";
import { generateSetupScript } from "@/lib/generator/setup";
import type { SectionId, SetupConfig } from "@/lib/types";
import { validateConfig } from "@/lib/validate";

/** Contoh konfigurasi umum: hEX dengan 1 WAN DHCP dan satu segmen LAN. */
function exampleConfig(): SetupConfig {
  const base = createDefaultConfig();
  const bridge = { ...newBridge("bridge-lan"), ports: ["ether2", "ether3", "ether4", "ether5"] };
  const address = { ...newAddress("bridge-lan"), address: "192.168.10.1/24", comment: "LAN utama" };
  const pool = {
    ...newPool(),
    name: "pool-lan",
    rangeStart: "192.168.10.10",
    rangeEnd: "192.168.10.254",
  };
  const dhcp = { ...newDhcpServer(), name: "dhcp-lan", iface: "bridge-lan", pool: "pool-lan" };

  return {
    ...base,
    modelId: "rb750gr3",
    ros: "v7",
    system: { ...base.system, identity: "MikroTik-Kantor" },
    wans: [{ ...newWan("ether1"), comment: "ISP utama" }],
    bridges: [bridge],
    addresses: [address],
    pools: [pool],
    dhcpServers: [dhcp],
    firewall: { ...base.firewall, mgmtSubnet: "192.168.10.0/24" },
  };
}

const SECTION_COMPONENTS: Record<SectionId, (props: SectionProps) => React.ReactElement> = {
  device: DeviceSection,
  wan: WanSection,
  dns: DnsSection,
  nat: NatSection,
  bridge: BridgeSection,
  vlan: VlanSection,
  address: AddressSection,
  pool: PoolSection,
  dhcp: DhcpSection,
  hotspot: HotspotSection,
  pppoe: PppoeSection,
  firewall: FirewallSection,
};

/** Apakah sebuah section sudah diisi sesuatu oleh pengguna. */
function isFilled(config: SetupConfig, id: SectionId): boolean {
  switch (id) {
    case "device":
      return Boolean(config.modelId && config.ros);
    case "wan":
      return config.wans.some((w) => w.iface);
    case "dns":
      return config.dns.servers.some((s) => s.trim()) || config.dns.allowRemoteRequests;
    case "nat":
      return config.nat.enabled;
    case "bridge":
      return config.bridges.length > 0;
    case "vlan":
      return config.vlans.length > 0;
    case "address":
      return config.addresses.length > 0;
    case "pool":
      return config.pools.length > 0;
    case "dhcp":
      return config.dhcpServers.length > 0;
    case "hotspot":
      return config.hotspots.length > 0;
    case "pppoe":
      return config.pppoe.enabled;
    case "firewall":
      return config.firewall.enabled;
  }
}

export function SetupBuilder() {
  const [config, setConfig] = useState<SetupConfig>(createDefaultConfig);
  const [active, setActive] = useState<SectionId>("device");

  const patch = useCallback((partial: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const issues = useMemo(() => validateConfig(config), [config]);
  const script = useMemo(() => generateSetupScript(config), [config]);
  const locked = !config.modelId || !config.ros;
  const filledCount = SECTION_META.filter((m) => isFilled(config, m.id)).length;

  const jump = useCallback((id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Sorot section yang sedang terlihat di layar pada rail navigasi.
  useEffect(() => {
    const elements = SECTION_META.map((meta) => document.getElementById(meta.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id as SectionId);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [locked]);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>
            <span className="h-5 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2">
              <Cpu className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Setup Mikrotik Baru</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setConfig(exampleConfig())} title="Isi dengan contoh konfigurasi">
              <Wand className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Isi contoh</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Kosongkan semua isian"
              onClick={() => {
                if (confirm("Kosongkan semua isian?")) setConfig(createDefaultConfig());
              }}
            >
              <Rotate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-5 py-6 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_420px]">
        {/* Rail navigasi section */}
        <nav aria-label="Daftar section" className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="mb-3 hidden items-center justify-between px-2.5 lg:flex">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
              Section
            </span>
            <span className="font-mono text-[10px] text-faint">
              {filledCount}/{SECTION_META.length}
            </span>
          </div>
          <ul className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {SECTION_META.map((meta) => {
              const sectionIssues = issues.filter((i) => i.section === meta.id);
              const hasError = sectionIssues.some((i) => i.level === "error");
              const hasWarn = sectionIssues.some((i) => i.level === "warn");
              const filled = isFilled(config, meta.id);
              const disabled = locked && meta.id !== "device";
              const isActive = active === meta.id && !disabled;
              const dot = hasError
                ? "bg-bad"
                : hasWarn
                  ? "bg-warn"
                  : filled
                    ? "bg-accent"
                    : "bg-line";
              return (
                <li key={meta.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => jump(meta.id)}
                    disabled={disabled}
                    aria-current={isActive ? "true" : undefined}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-lg border-l-2 px-2.5 text-left text-xs transition-all duration-200 disabled:opacity-30 ${
                      isActive
                        ? "border-brand bg-brand/[0.08] text-ink"
                        : "border-transparent text-muted hover:bg-raised hover:text-ink"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                    <span className="font-mono text-[10px] text-faint">{meta.step}</span>
                    <span className="truncate">{meta.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Form builder */}
        <div className="min-w-0 space-y-5">
          <DeviceSection
            config={config}
            patch={patch}
            issues={issues.filter((i) => i.section === "device")}
          />

          {locked ? (
            <div className="animate-rise rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-raised">
                <Lock className="h-5 w-5 text-faint" />
              </span>
              <p className="mt-4 text-sm text-muted">
                Pilih <span className="text-ink">Type Mikrotik</span> dan{" "}
                <span className="text-ink">versi RouterOS</span> terlebih dahulu.
              </p>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-faint">
                Kedua pilihan itu menentukan daftar interface yang tersedia dan sintaks perintah yang
                dipakai di seluruh script.
              </p>
            </div>
          ) : (
            SECTION_META.filter((meta) => meta.id !== "device").map((meta) => {
              const Section = SECTION_COMPONENTS[meta.id];
              return (
                <Section
                  key={meta.id}
                  config={config}
                  patch={patch}
                  issues={issues.filter((i) => i.section === meta.id)}
                />
              );
            })
          )}
        </div>

        {/* Preview script */}
        <div className="min-w-0">
          <ScriptPreview script={script} config={config} issues={issues} onJump={jump} />
        </div>
      </div>
    </main>
  );
}
