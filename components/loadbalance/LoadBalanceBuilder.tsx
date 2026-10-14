"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Rotate, Split } from "@/components/icons";
import { ScriptPreview } from "@/components/loadbalance/ScriptPreview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Field, Note, Select, TextInput } from "@/components/ui";
import { VersionBadge } from "@/components/VersionBadge";
import { createDefaultLoadBalanceConfig, newIsp } from "@/lib/defaults-loadbalance";
import { generateLoadBalanceScript } from "@/lib/generator/loadbalance";
import { ROS_LABEL } from "@/lib/models";
import type { IspEntry, LbSectionId, LoadBalanceConfig, RosVersion } from "@/lib/types-loadbalance";
import { validateLoadBalanceConfig } from "@/lib/validate-loadbalance";

const MAX_ISP = 8;

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "loadbalance"
  );
}

/** Saklar kecil bergaya kartu, untuk opsi ya/tidak yang sering dipakai. */
function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        checked ? "border-brand/40 bg-brand/[0.07]" : "border-line-soft bg-canvas/50 hover:border-line"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-brand" : "bg-line"
        }`}
      >
        <span className={`h-3 w-3 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-3" : ""}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-faint">{hint}</span>
      </span>
    </button>
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

  const filename = `loadbalance-${slug(config.lanIface || "mikrotik")}.rsc`;
  const addressList = config.localMode === "addresslist";

  const clearIsps = () => {
    if (!confirm("Kosongkan semua isian ISP?")) return;
    setConfig((prev) => ({ ...prev, isps: prev.isps.map((_, i) => newIsp(i)) }));
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

      <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 py-6 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------------- formulir */}
        <div className="space-y-4">
          <section id="lb-settings" className="edge-light scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-3.5">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">Pengaturan</h2>
              <p className="mt-0.5 text-xs text-muted">Hasil script di sebelah kanan ikut berubah saat Anda mengisi.</p>
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

              <div className="grid grid-cols-2 gap-3">
                <Field label="Target lokal">
                  <Select
                    value={config.localMode}
                    placeholder=""
                    onChange={(localMode) => patch({ localMode: localMode as LoadBalanceConfig["localMode"] })}
                    options={[
                      { value: "interface", label: "Interface LAN" },
                      { value: "addresslist", label: "IP Address List (RFC1918)" },
                    ]}
                  />
                </Field>
                <Field label="Interface LAN" hint={addressList ? "Tidak dipakai pada mode address list." : "Mis. bridge-lan"}>
                  <TextInput
                    mono
                    value={config.lanIface}
                    disabled={addressList}
                    onChange={(lanIface) => patch({ lanIface })}
                    placeholder="bridge-lan"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Switch
                  checked={config.pccEnabled}
                  onChange={(pccEnabled) => patch({ pccEnabled })}
                  label="Load balance (PCC)"
                  hint="Bagi koneksi ke semua ISP."
                />
                <Switch
                  checked={config.failoverEnabled}
                  onChange={(failoverEnabled) => patch({ failoverEnabled })}
                  label="Failover"
                  hint="Pindah ISP bila satu jalur putus."
                />
                <Switch
                  checked={config.ratioEnabled}
                  onChange={(ratioEnabled) => patch({ ratioEnabled })}
                  label="Rasio bandwidth"
                  hint="Bagi sesuai kecepatan tiap ISP."
                />
                <Switch
                  checked={config.natEnabled}
                  onChange={(natEnabled) => patch({ natEnabled })}
                  label="NAT masquerade"
                  hint="Satu rule NAT per ISP."
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Metode PCC (classifier)">
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
              </div>

              {config.failoverEnabled && config.failoverMethod !== "recursive" && (
                <Field label="Interval cek" hint="Format durasi RouterOS, mis. 10s atau 1m.">
                  <TextInput mono value={config.checkInterval} onChange={(checkInterval) => patch({ checkInterval })} placeholder="10s" />
                </Field>
              )}

              <Note>
                Interface tiap ISP harus sudah punya IP address dan gateway-nya berupa alamat IPv4 biasa (mis.{" "}
                <span className="font-mono text-ink">192.168.1.1</span>). Belum dikonfigurasi? Gunakan menu Setup
                Mikrotik Baru lebih dulu.
              </Note>
            </div>
          </section>

          {/* ---------------------------------------------------- jalur ISP */}
          <section id="lb-isp" className="scroll-mt-24 space-y-3">
            {config.isps.map((isp, index) => (
              <div
                key={isp.id}
                className="edge-light overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <div className="flex items-center justify-between border-b border-line-soft bg-canvas/50 px-5 py-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
                    WAN ISP-{index + 1}
                  </span>
                  {config.failoverEnabled && (
                    <label className="flex items-center gap-1.5 text-[11px] text-faint">
                      Prioritas cadangan
                      <input
                        value={isp.distance}
                        onChange={(e) => patchIsp(isp.id, { distance: e.target.value.replace(/\D/g, "") })}
                        inputMode="numeric"
                        aria-label={`Prioritas cadangan ISP ${index + 1}`}
                        className="h-7 w-12 rounded-md border border-line bg-canvas px-1.5 text-center font-mono text-xs text-ink outline-none focus:border-brand"
                      />
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 px-5 py-4">
                  <Field label={`WAN ISP-${index + 1}`} required>
                    <TextInput mono value={isp.iface} onChange={(iface) => patchIsp(isp.id, { iface })} placeholder="ether1" />
                  </Field>
                  <Field label={`Kecepatan ISP-${index + 1} (Mbps)`}>
                    <TextInput
                      mono
                      value={isp.speed}
                      disabled={!config.ratioEnabled || !config.pccEnabled}
                      onChange={(speed) => patchIsp(isp.id, { speed: speed.replace(/[^\d.]/g, "") })}
                      placeholder={config.ratioEnabled ? "mis. 50" : "aktifkan rasio"}
                    />
                  </Field>
                  <Field label={`Gateway ISP-${index + 1}`} required>
                    <TextInput mono value={isp.gateway} onChange={(gateway) => patchIsp(isp.id, { gateway })} placeholder="192.168.1.1" />
                  </Field>
                  <Field label={`IP / DNS cek ISP-${index + 1}`}>
                    <TextInput
                      mono
                      value={isp.checkTarget}
                      disabled={!config.failoverEnabled}
                      onChange={(checkTarget) => patchIsp(isp.id, { checkTarget })}
                      placeholder="8.8.8.8"
                    />
                  </Field>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" onClick={clearIsps}>
                Kosongkan ISP
              </Button>
              <Button className="flex-1" onClick={resetAll}>
                <Rotate className="h-4 w-4" />
                Reset semua
              </Button>
            </div>
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
