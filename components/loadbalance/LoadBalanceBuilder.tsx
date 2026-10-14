"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Rotate, Split } from "@/components/icons";
import { ScriptPreview } from "@/components/loadbalance/ScriptPreview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, CheckPill, Field, Select, TextInput } from "@/components/ui";
import { VersionBadge } from "@/components/VersionBadge";
import { createDefaultLoadBalanceConfig, newIsp } from "@/lib/defaults-loadbalance";
import { generateLoadBalanceScript } from "@/lib/generator/loadbalance";
import { ROS_LABEL } from "@/lib/models";
import type { IspEntry, LbSectionId, LoadBalanceConfig, RosVersion } from "@/lib/types-loadbalance";
import { validateLoadBalanceConfig } from "@/lib/validate-loadbalance";

const MAX_ISP = 8;

/** Kolom isian ringkas pada baris ISP. */
const cell =
  "h-9 w-full min-w-0 rounded-lg border border-line bg-canvas px-2.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-faint/60 focus:border-brand disabled:opacity-40";

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "loadbalance"
  );
}

const FAILOVER_HINT: Record<LoadBalanceConfig["failoverMethod"], string> = {
  recursive: "Deteksi cepat lewat route recursive + check-gateway (disarankan).",
  netwatch: "Ping berkala lewat Netwatch yang menonaktifkan/mengaktifkan route.",
  schedule: "Script yang dijalankan Scheduler untuk memeriksa tiap ISP.",
};

export function LoadBalanceBuilder() {
  const [config, setConfig] = useState<LoadBalanceConfig>(createDefaultLoadBalanceConfig);

  const patch = useCallback((partial: Partial<LoadBalanceConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const patchIsp = (id: string, partial: Partial<IspEntry>) =>
    setConfig((prev) => ({ ...prev, isps: prev.isps.map((i) => (i.id === id ? { ...i, ...partial } : i)) }));

  /** Ubah jumlah jalur: ISP yang sudah diisi dipertahankan, kelebihannya dipotong dari belakang. */
  const setWanCount = (count: number) =>
    setConfig((prev) => {
      const isps = prev.isps.slice(0, count);
      for (let i = isps.length; i < count; i += 1) isps.push(newIsp(i));
      return { ...prev, isps };
    });

  const issues = useMemo(() => validateLoadBalanceConfig(config), [config]);
  const script = useMemo(() => generateLoadBalanceScript(config), [config]);

  const jump = useCallback((section: LbSectionId) => {
    document
      .getElementById(section === "isp" ? "lb-isp" : "lb-settings")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const filename = `loadbalance-${slug((config.localMode === "interfacelist" ? config.lanList : config.lanIface) || "mikrotik")}.rsc`;
  const addressList = config.localMode === "addresslist";
  const showSpeed = config.ratioEnabled && config.pccEnabled;
  // Nomor | WAN | Gateway | [Mbps] | [IP cek] — kolom opsional hanya muncul bila fiturnya aktif.
  const ispColumns = `1.75rem repeat(${2 + (showSpeed ? 1 : 0) + (config.failoverEnabled ? 1 : 0)}, minmax(0, 1fr))`;

  /** Kosongkan isian tiap ISP (Reset semua mengembalikannya ke isian berurutan). */
  const clearIsps = () => {
    if (!confirm("Kosongkan semua isian ISP?")) return;
    setConfig((prev) => ({
      ...prev,
      isps: prev.isps.map((isp) => ({ ...isp, iface: "", gateway: "", speed: "", checkTarget: "" })),
    }));
  };

  const resetAll = () => {
    if (confirm("Kembalikan semua pengaturan ke awal?")) setConfig(createDefaultLoadBalanceConfig());
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3">
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
              <Split className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Load Balance PCC + Failover</h1>
              <span className="hidden text-xs text-faint lg:inline">by Mikrosetting.com</span>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 py-6 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------------- formulir */}
        <div className="space-y-4">
          <section id="lb-settings" className="edge-light scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-3.5">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Pengaturan</h2>
            </header>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jumlah jalur WAN">
                  <Select
                    value={String(config.isps.length)}
                    placeholder=""
                    onChange={(v) => setWanCount(Number(v))}
                    options={Array.from({ length: MAX_ISP - 1 }, (_, i) => ({
                      value: String(i + 2),
                      label: `${i + 2} ISP`,
                    }))}
                  />
                </Field>
                <Field label="Versi RouterOS" required>
                  <Select
                    value={config.ros}
                    placeholder="— pilih versi —"
                    onChange={(ros) => patch({ ros: ros as RosVersion | "" })}
                    options={(Object.keys(ROS_LABEL) as RosVersion[]).map((v) => ({ value: v, label: ROS_LABEL[v] }))}
                  />
                </Field>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Trafik lokal</span>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <div className="flex shrink-0 gap-1 rounded-lg border border-line bg-canvas p-1">
                    {(
                      [
                        { value: "interface", label: "Interface" },
                        { value: "interfacelist", label: "Interface List" },
                        { value: "addresslist", label: "Address List" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={config.localMode === o.value}
                        title={o.value === "addresslist" ? "Alamat privat RFC1918 (192.168/16, 172.16/12, 10/8)" : undefined}
                        onClick={() => patch({ localMode: o.value })}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          config.localMode === o.value
                            ? "bg-brand text-[color:var(--color-brand-ink)]"
                            : "text-muted hover:text-ink"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {config.localMode === "interface" && (
                    <div className="min-w-32 flex-1">
                      <TextInput mono value={config.lanIface} onChange={(lanIface) => patch({ lanIface })} placeholder="bridge-lan" />
                    </div>
                  )}
                  {config.localMode === "interfacelist" && (
                    <div className="min-w-32 flex-1">
                      <TextInput mono value={config.lanList} onChange={(lanList) => patch({ lanList })} placeholder="LAN" />
                    </div>
                  )}
                  {addressList && (
                    <span className="text-xs text-faint">Semua alamat privat (RFC1918) dianggap lokal.</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Fitur</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <CheckPill active={config.pccEnabled} onClick={() => patch({ pccEnabled: !config.pccEnabled })}>
                    Load balance
                  </CheckPill>
                  <CheckPill active={config.failoverEnabled} onClick={() => patch({ failoverEnabled: !config.failoverEnabled })}>
                    Failover
                  </CheckPill>
                  <CheckPill
                    active={config.ratioEnabled}
                    disabled={!config.pccEnabled}
                    onClick={() => patch({ ratioEnabled: !config.ratioEnabled })}
                  >
                    Rasio bandwidth
                  </CheckPill>
                  <CheckPill active={config.natEnabled} onClick={() => patch({ natEnabled: !config.natEnabled })}>
                    NAT
                  </CheckPill>
                </div>
              </div>

              <details className="group rounded-xl border border-line-soft bg-canvas/40">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                  Pengaturan lanjutan
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-3 border-t border-line-soft px-3.5 py-3.5 sm:grid-cols-2">
                  <Field label="Metode PCC">
                    <Select
                      value={config.classifier}
                      placeholder=""
                      disabled={!config.pccEnabled}
                      onChange={(classifier) => patch({ classifier: classifier as LoadBalanceConfig["classifier"] })}
                      options={[
                        { value: "both-addresses-and-ports", label: "both-addresses-and-ports (disarankan)" },
                        { value: "both-addresses", label: "both-addresses" },
                        { value: "src-address", label: "src-address" },
                      ]}
                    />
                  </Field>
                  <Field label="Metode failover" hint={FAILOVER_HINT[config.failoverMethod]}>
                    <Select
                      value={config.failoverMethod}
                      placeholder=""
                      disabled={!config.failoverEnabled}
                      onChange={(failoverMethod) =>
                        patch({ failoverMethod: failoverMethod as LoadBalanceConfig["failoverMethod"] })
                      }
                      options={[
                        { value: "recursive", label: "Recursive Gateway" },
                        { value: "netwatch", label: "Netwatch Ping" },
                        { value: "schedule", label: "Scheduler Check" },
                      ]}
                    />
                  </Field>
                  {config.failoverEnabled && config.failoverMethod !== "recursive" && (
                    <Field label="Interval cek" hint="Mis. 10s atau 1m.">
                      <TextInput mono value={config.checkInterval} onChange={(checkInterval) => patch({ checkInterval })} placeholder="10s" />
                    </Field>
                  )}
                  {config.failoverEnabled && (
                    <div className="sm:col-span-2">
                      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                        Prioritas cadangan (angka kecil = diutamakan)
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {config.isps.map((isp, index) => (
                          <label key={isp.id} className="flex items-center gap-1.5 text-xs text-faint">
                            ISP-{index + 1}
                            <input
                              value={isp.distance}
                              onChange={(e) => patchIsp(isp.id, { distance: e.target.value.replace(/\D/g, "") })}
                              inputMode="numeric"
                              aria-label={`Prioritas cadangan ISP ${index + 1}`}
                              className="h-8 w-12 rounded-md border border-line bg-canvas px-1.5 text-center font-mono text-xs text-ink outline-none focus:border-brand"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </section>

          {/* ---------------------------------------------------- jalur ISP */}
          <section id="lb-isp" className="edge-light scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3.5">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Jalur ISP</h2>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={clearIsps} title="Kosongkan isian semua ISP">
                  Kosongkan
                </Button>
                <Button size="sm" variant="ghost" onClick={resetAll} title="Kembalikan semua pengaturan ke awal">
                  <Rotate className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>
            </header>

            <div className="overflow-x-auto px-5 py-4">
              <div className="min-w-[440px] space-y-2">
                <div
                  className="grid items-end gap-2 px-0.5 text-[10px] font-medium uppercase tracking-[0.09em] text-faint"
                  style={{ gridTemplateColumns: ispColumns }}
                >
                  <span />
                  <span>WAN</span>
                  <span>Gateway</span>
                  {showSpeed && <span>Mbps</span>}
                  {config.failoverEnabled && <span>IP cek</span>}
                </div>

                {config.isps.map((isp, index) => (
                  <div key={isp.id} className="grid items-center gap-2" style={{ gridTemplateColumns: ispColumns }}>
                    <span className="grid h-9 w-7 place-items-center rounded-md bg-brand/10 font-mono text-[11px] font-medium text-brand">
                      {index + 1}
                    </span>
                    <input
                      className={cell}
                      value={isp.iface}
                      onChange={(e) => patchIsp(isp.id, { iface: e.target.value })}
                      placeholder="ether1"
                      aria-label={`WAN ISP-${index + 1}`}
                    />
                    <input
                      className={cell}
                      value={isp.gateway}
                      onChange={(e) => patchIsp(isp.id, { gateway: e.target.value })}
                      placeholder="192.168.1.1"
                      aria-label={`Gateway ISP-${index + 1}`}
                    />
                    {showSpeed && (
                      <input
                        className={cell}
                        value={isp.speed}
                        onChange={(e) => patchIsp(isp.id, { speed: e.target.value.replace(/[^\d.]/g, "") })}
                        placeholder="50"
                        inputMode="decimal"
                        aria-label={`Kecepatan ISP-${index + 1} (Mbps)`}
                      />
                    )}
                    {config.failoverEnabled && (
                      <input
                        className={cell}
                        value={isp.checkTarget}
                        onChange={(e) => patchIsp(isp.id, { checkTarget: e.target.value })}
                        placeholder="8.8.8.8"
                        aria-label={`IP cek ISP-${index + 1}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="border-t border-line-soft px-5 py-3 text-xs leading-relaxed text-faint">
              Interface tiap ISP harus sudah punya IP address; belum? Pakai menu Setup Mikrotik Baru dulu.
            </p>
          </section>
        </div>
        {/* --------------------------------------------------------- script */}
        <div className="min-w-0 lg:sticky lg:top-[76px]">
          <ScriptPreview script={script} issues={issues} onJump={jump} filename={filename} />
        </div>
      </div>
    </main>
  );
}
