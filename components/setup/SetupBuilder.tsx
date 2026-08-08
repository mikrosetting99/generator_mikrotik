"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Cpu,
  FolderOpen,
  Lock,
  Rotate,
  Save,
  Terminal,
  Wand,
} from "@/components/icons";
import { PresetDialog } from "@/components/setup/PresetDialog";
import { SaveLoadDialog } from "@/components/setup/SaveLoadDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScriptPreview } from "@/components/setup/ScriptPreview";
import {
  AddressSection,
  BridgeSection,
  DeviceSection,
  DhcpSection,
  DnsSection,
  FirewallSection,
  HotspotSection,
  LoginPageSection,
  NatSection,
  PoolSection,
  PppoeSection,
  SECTION_META,
  UserSection,
  VlanSection,
  WanSection,
  type SectionProps,
} from "@/components/setup/sections";
import { Button, Modal } from "@/components/ui";
import { createDefaultConfig } from "@/lib/defaults";
import { generateSetupScript } from "@/lib/generator/setup";
import type { SectionId, SetupConfig } from "@/lib/types";
import { validateConfig } from "@/lib/validate";

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
  loginpage: LoginPageSection,
  pppoe: PppoeSection,
  firewall: FirewallSection,
  user: UserSection,
};

/** Section yang boleh dilewati tanpa mengisi apa pun. */
const OPTIONAL_SECTIONS = new Set<SectionId>([
  "bridge",
  "vlan",
  "hotspot",
  "loginpage",
  "pppoe",
  "user",
]);

/**
 * Halaman login tidak ada gunanya tanpa hotspot, jadi langkahnya baru muncul
 * setelah hotspot ditambahkan.
 */
function visibleSections(config: SetupConfig) {
  return SECTION_META.filter((meta) => meta.id !== "loginpage" || config.hotspots.length > 0);
}

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
    case "loginpage":
      return Boolean(
        config.hotspotPage.title.trim() ||
          config.hotspotPage.logoDataUrl ||
          config.hotspotPage.packages.length > 0,
      );
    case "pppoe":
      return config.pppoe.enabled;
    case "firewall":
      return config.firewall.enabled;
    case "user":
      return Boolean(config.system.adminPassword) || config.users.length > 0;
  }
}

export function SetupBuilder() {
  const [config, setConfig] = useState<SetupConfig>(createDefaultConfig);
  // Langkah dilacak lewat id, bukan indeks: daftar langkahnya berubah panjang
  // saat hotspot ditambah atau dihapus, dan indeks akan meleset karenanya.
  const [activeId, setActiveId] = useState<SectionId>("device");
  const [storeOpen, setStoreOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const railRef = useRef<HTMLUListElement>(null);
  const firstRender = useRef(true);

  const patch = useCallback((partial: Partial<SetupConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const issues = useMemo(() => validateConfig(config), [config]);
  const script = useMemo(() => generateSetupScript(config), [config]);
  const locked = !config.modelId || !config.ros;

  const steps = useMemo(() => visibleSections(config), [config]);
  const total = steps.length;
  const step = Math.max(
    0,
    steps.findIndex((meta) => meta.id === activeId),
  );
  const current = steps[step];
  const Section = SECTION_COMPONENTS[current.id];
  const isLast = step === total - 1;

  const goTo = useCallback(
    (index: number) => {
      const target = steps[Math.min(Math.max(index, 0), steps.length - 1)];
      if (target) setActiveId(target.id);
    },
    [steps],
  );

  const jumpToSection = useCallback(
    (id: SectionId) => {
      if (steps.some((meta) => meta.id === id)) setActiveId(id);
    },
    [steps],
  );

  // Perangkat & RouterOS wajib dipilih — kunci langkah lain sampai terisi.
  useEffect(() => {
    if (locked && activeId !== "device") setActiveId("device");
  }, [locked, activeId]);

  // Langkah yang sedang dibuka bisa hilang dari daftar — misalnya hotspot
  // terakhir dihapus saat berada di langkah Halaman Login.
  useEffect(() => {
    if (!steps.some((meta) => meta.id === activeId)) setActiveId("hotspot");
  }, [steps, activeId]);

  // Pindah langkah: kembali ke atas dan tarik chip aktif ke tengah rail.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    railRef.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  const currentIssues = issues.filter((i) => i.section === current.id);
  const currentErrors = currentIssues.filter((i) => i.level === "error");
  const canAdvance = !(step === 0 && locked);

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
              <span className="hidden text-xs text-faint lg:inline">by Mikrosetting.com</span>
              {loadedName && (
                <span className="hidden max-w-[200px] items-center gap-1.5 truncate rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] text-brand md:inline-flex">
                  <FolderOpen className="h-3 w-3" />
                  {loadedName}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" onClick={() => setStoreOpen(true)} title="Simpan atau muat konfigurasi">
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Simpan / Muat</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setPresetOpen(true)}
              title="Muat konfigurasi siap pakai"
            >
              <Wand className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Siap pakai</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              title="Kosongkan semua isian"
              onClick={() => {
                if (confirm("Kosongkan semua isian?")) {
                  setConfig(createDefaultConfig());
                  setLoadedName(null);
                  setActiveId("device");
                }
              }}
            >
              <Rotate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
        {/* Bar progres wizard */}
        <div className="h-0.5 w-full bg-line-soft">
          <div
            className="h-full bg-gradient-to-r from-brand to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-5 py-6 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_420px]">
        {/* Stepper */}
        <nav aria-label="Langkah konfigurasi" className="lg:sticky lg:top-[88px] lg:self-start">
          <div className="mb-3 hidden items-center justify-between px-2.5 lg:flex">
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
              Langkah
            </span>
            <span className="font-mono text-[10px] text-faint">
              {step + 1}/{total}
            </span>
          </div>
          <ul
            ref={railRef}
            className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
          >
            {steps.map((meta, index) => {
              const sectionIssues = issues.filter((i) => i.section === meta.id);
              const hasError = sectionIssues.some((i) => i.level === "error");
              const filled = isFilled(config, meta.id);
              const disabled = locked && index !== 0;
              const isActive = index === step;
              const done = index < step;

              return (
                <li key={meta.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    disabled={disabled}
                    aria-current={isActive ? "step" : undefined}
                    className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg border-l-2 px-2.5 text-left text-xs transition-all duration-200 disabled:opacity-30 ${
                      isActive
                        ? "border-brand bg-brand/[0.09] text-ink"
                        : "border-transparent text-muted hover:bg-raised hover:text-ink"
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border font-mono text-[10px] transition-colors ${
                        hasError
                          ? "border-bad/50 bg-bad/10 text-bad"
                          : isActive
                            ? "border-brand/50 bg-brand/15 text-brand"
                            : done || filled
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-line bg-canvas text-faint"
                      }`}
                    >
                      {hasError ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : done && filled ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="truncate">{meta.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Satu section per layar */}
        <div className="min-w-0">
          <div key={current.id} className="animate-rise space-y-5">
            {locked && step !== 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-raised">
                  <Lock className="h-5 w-5 text-faint" />
                </span>
                <p className="mt-4 text-sm text-muted">
                  Pilih Type Mikrotik dan versi RouterOS terlebih dahulu.
                </p>
              </div>
            ) : (
              <Section config={config} patch={patch} issues={currentIssues} />
            )}

            {/* Navigasi wizard */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <Button onClick={() => goTo(step - 1)} disabled={step === 0} title="Langkah sebelumnya">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Kembali</span>
              </Button>

              <div className="min-w-0 text-center">
                <p className="font-mono text-[11px] text-faint">
                  Langkah {step + 1} dari {total}
                </p>
                <p className="truncate text-xs text-muted">
                  {isLast ? "Section terakhir" : `Berikutnya: title`}
                </p>
              </div>

              {isLast ? (
                <Button
                  variant="primary"
                  title="Lihat script hasil generate"
                  onClick={() =>
                    document
                      .getElementById("preview")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                >
                  <Terminal className="h-4 w-4" />
                  <span className="hidden sm:inline">Lihat script</span>
                </Button>
              ) : (
                <Button
                  variant="brand"
                  onClick={() => goTo(step + 1)}
                  disabled={!canAdvance}
                  title={
                    canAdvance
                      ? "Langkah berikutnya"
                      : "Pilih Type Mikrotik dan RouterOS terlebih dahulu"
                  }
                >
                  <span className="hidden sm:inline">Lanjut</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>

            {currentErrors.length > 0 && !OPTIONAL_SECTIONS.has(current.id) && (
              <p className="px-1 text-xs text-faint">
                Anda tetap bisa lanjut — error di atas hanya menahan tombol salin script.
              </p>
            )}
          </div>
        </div>

        {/* Preview script */}
        <div id="preview" className="min-w-0 scroll-mt-24">
          <ScriptPreview script={script} config={config} issues={issues} onJump={jumpToSection} />
        </div>
      </div>

      <Modal
        open={presetOpen}
        onClose={() => setPresetOpen(false)}
        title="Konfigurasi Siap Pakai"
        description="Pilih satu, seluruh isian langsung terisi dan tinggal disesuaikan."
      >
        <PresetDialog
          onClose={() => setPresetOpen(false)}
          onPick={(loaded, name) => {
            setConfig(loaded);
            setLoadedName(name);
            setActiveId("device");
          }}
        />
      </Modal>

      <Modal
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        title="Simpan / Muat Konfigurasi"
        description="Simpan isian saat ini agar bisa dipakai lagi, atau muat konfigurasi yang pernah dibuat."
      >
        <SaveLoadDialog
          config={config}
          onClose={() => setStoreOpen(false)}
          onLoad={(loaded, name) => {
            setConfig(loaded);
            setLoadedName(name);
            setActiveId("device");
          }}
        />
      </Modal>
    </main>
  );
}
