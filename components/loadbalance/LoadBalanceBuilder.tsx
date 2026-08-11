"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Lock, Rotate, Split, Terminal } from "@/components/icons";
import { ScriptPreview } from "@/components/loadbalance/ScriptPreview";
import {
  IspSection,
  LanSection,
  OptionsSection,
  RosSection,
  SECTION_META,
  type SectionProps,
} from "@/components/loadbalance/sections";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui";
import { createDefaultLoadBalanceConfig } from "@/lib/defaults-loadbalance";
import { generateLoadBalanceScript } from "@/lib/generator/loadbalance";
import type { LbSectionId, LoadBalanceConfig } from "@/lib/types-loadbalance";
import { validateLoadBalanceConfig } from "@/lib/validate-loadbalance";

const SECTION_COMPONENTS: Record<LbSectionId, (props: SectionProps) => React.ReactElement> = {
  ros: RosSection,
  lan: LanSection,
  isp: IspSection,
  options: OptionsSection,
};

function isFilled(config: LoadBalanceConfig, id: LbSectionId): boolean {
  switch (id) {
    case "ros":
      return Boolean(config.ros);
    case "lan":
      return Boolean(config.lanIface.trim());
    case "isp":
      return config.isps.filter((i) => i.iface.trim()).length >= 2;
    case "options":
      return true;
  }
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "loadbalance"
  );
}

export function LoadBalanceBuilder() {
  const [config, setConfig] = useState<LoadBalanceConfig>(createDefaultLoadBalanceConfig);
  const [activeId, setActiveId] = useState<LbSectionId>("ros");
  const railRef = useRef<HTMLUListElement>(null);
  const firstRender = useRef(true);

  const patch = useCallback((partial: Partial<LoadBalanceConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const issues = useMemo(() => validateLoadBalanceConfig(config), [config]);
  const script = useMemo(() => generateLoadBalanceScript(config), [config]);
  const locked = !config.ros;

  const steps = SECTION_META;
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

  const jumpToSection = useCallback((id: LbSectionId) => setActiveId(id), []);

  useEffect(() => {
    if (locked && activeId !== "ros") setActiveId("ros");
  }, [locked, activeId]);

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
  const canAdvance = !(step === 0 && locked);
  const filename = `loadbalance-${slug(config.lanIface || "mikrotik")}.rsc`;

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
              <Split className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">
                Load Balance PCC + Failover
              </h1>
              <span className="hidden text-xs text-faint lg:inline">by Mikrosetting.com</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              size="sm"
              variant="ghost"
              title="Kosongkan semua isian"
              onClick={() => {
                if (confirm("Kosongkan semua isian?")) {
                  setConfig(createDefaultLoadBalanceConfig());
                  setActiveId("ros");
                }
              }}
            >
              <Rotate className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </Button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-line-soft">
          <div
            className="h-full bg-gradient-to-r from-brand to-accent transition-[width] duration-500 ease-out"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-5 py-6 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_420px]">
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

        <div className="min-w-0">
          <div key={current.id} className="animate-rise space-y-5">
            {locked && step !== 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-raised">
                  <Lock className="h-5 w-5 text-faint" />
                </span>
                <p className="mt-4 text-sm text-muted">Pilih versi RouterOS terlebih dahulu.</p>
              </div>
            ) : (
              <Section config={config} patch={patch} issues={currentIssues} />
            )}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <Button onClick={() => goTo(step - 1)} disabled={step === 0} title="Langkah sebelumnya">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Kembali</span>
              </Button>

              <p className="font-mono text-[11px] text-faint">
                Langkah {step + 1} dari {total}
              </p>

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
                  title={canAdvance ? "Langkah berikutnya" : "Pilih RouterOS terlebih dahulu"}
                >
                  <span className="hidden sm:inline">Lanjut</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div id="preview" className="min-w-0 scroll-mt-24">
          <ScriptPreview script={script} issues={issues} onJump={jumpToSection} filename={filename} />
        </div>
      </div>
    </main>
  );
}
