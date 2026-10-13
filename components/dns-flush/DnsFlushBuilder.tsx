"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download, Terminal } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, Field, Note, Panel, Select, TextInput, Toggle } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  DEFAULT_DNS_FLUSH,
  FLUSH_UNIT_LABEL,
  generateDnsFlushScript,
  intervalText,
  validateDnsFlush,
  type DnsFlushConfig,
  type FlushUnit,
} from "@/lib/generator/dns-flush";

/** Pilihan cepat yang paling sering dipakai. */
const PRESETS: { label: string; patch: Partial<DnsFlushConfig> }[] = [
  { label: "Tiap 6 jam", patch: { everyValue: 6, everyUnit: "h", startTime: "" } },
  { label: "Tiap 12 jam", patch: { everyValue: 12, everyUnit: "h", startTime: "" } },
  { label: "Harian 03:00", patch: { everyValue: 1, everyUnit: "d", startTime: "03:00:00" } },
  { label: "Mingguan", patch: { everyValue: 1, everyUnit: "w", startTime: "03:00:00" } },
];

export function DnsFlushBuilder() {
  const [config, setConfig] = useState<DnsFlushConfig>(DEFAULT_DNS_FLUSH);
  const [copied, setCopied] = useState(false);

  const patch = (partial: Partial<DnsFlushConfig>) => setConfig((c) => ({ ...c, ...partial }));
  const issues = useMemo(() => validateDnsFlush(config), [config]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warn");
  const script = useMemo(() => (errors.length === 0 ? generateDnsFlushScript(config) : ""), [config, errors.length]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard diblokir: pengguna bisa menyalin manual dari kotak script
    }
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-3">
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
              <Terminal className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Autoflush DNS</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-5">
          <Panel
            title="Jadwal flush"
            description="Router membersihkan cache DNS-nya sendiri sesuai jadwal — berguna bila cache menyimpan alamat lama atau keliru."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => patch(p.patch)}
                    className="rounded-md border border-line-soft bg-canvas px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand/50 hover:text-ink"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-3">
                <Field label="Setiap">
                  <TextInput
                    mono
                    value={String(config.everyValue)}
                    onChange={(v) => patch({ everyValue: Number(v.replace(/\D/g, "")) || 0 })}
                    placeholder="1"
                  />
                </Field>
                <Field label="Satuan">
                  <Select
                    value={config.everyUnit}
                    placeholder=""
                    onChange={(everyUnit) => patch({ everyUnit: everyUnit as FlushUnit })}
                    options={(Object.keys(FLUSH_UNIT_LABEL) as FlushUnit[]).map((u) => ({
                      value: u,
                      label: FLUSH_UNIT_LABEL[u],
                    }))}
                  />
                </Field>
              </div>

              <Field
                label="Jam mulai"
                hint="Jam pertama scheduler berjalan; berikutnya mengikuti interval. Kosongkan untuk mulai segera."
              >
                <TextInput mono value={config.startTime} onChange={(startTime) => patch({ startTime })} placeholder="03:00:00" />
              </Field>

              <Field label="Nama scheduler" hint="Nama di System → Scheduler pada router.">
                <TextInput mono value={config.name} onChange={(name) => patch({ name })} placeholder="autoflush-dns" />
              </Field>

              <Toggle
                checked={config.replaceExisting}
                onChange={(replaceExisting) => patch({ replaceExisting })}
                label="Timpa scheduler lama"
                hint="Aktif: scheduler bernama sama dihapus lalu dibuat ulang (jadwal selalu sesuai form). Mati: dilewati bila sudah ada."
              />
              <Toggle
                checked={config.logFlush}
                onChange={(logFlush) => patch({ logFlush })}
                label="Catat ke log router"
                hint="Setiap flush ditulis ke System → Log, supaya mudah dipastikan scheduler berjalan."
              />

              {errors.map((i) => (
                <Note key={i.text} tone="bad">
                  {i.text}
                </Note>
              ))}
              {warnings.map((i) => (
                <Note key={i.text} tone="warn">
                  {i.text}
                </Note>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            title="Script"
            description={
              errors.length === 0
                ? `Scheduler “${config.name.trim()}” menjalankan flush setiap ${config.everyValue} ${FLUSH_UNIT_LABEL[config.everyUnit]} (${intervalText(config)}).`
                : "Perbaiki isian di kiri dulu."
            }
          >
            <div className="space-y-3">
              <pre className="max-h-[420px] overflow-auto rounded-xl border border-line-soft bg-code px-4 py-3 font-mono text-[11.5px] leading-relaxed text-muted">
                {script || "# (belum ada script)"}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" className="flex-1" onClick={copy} disabled={!script}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Tersalin" : "Copy to Clipboard"}
                </Button>
                <Button
                  disabled={!script}
                  title="Unduh sebagai file .rsc untuk di-upload lalu /import"
                  onClick={() =>
                    downloadBlob(new Blob([script], { type: "text/plain;charset=utf-8" }), `autoflush-dns-${config.name.trim() || "scheduler"}.rsc`)
                  }
                >
                  <Download className="h-4 w-4" />
                  .rsc
                </Button>
              </div>
            </div>
          </Panel>

          <Panel title="Cara pakai">
            <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
              <li>Salin script di atas.</li>
              <li>Buka Winbox atau WebFig → <b className="font-medium text-ink">New Terminal</b>, tempel, lalu Enter.</li>
              <li>
                Periksa di <b className="font-medium text-ink">System → Scheduler</b>: scheduler baru muncul dengan interval
                yang Anda pilih.
              </li>
              <li>
                Untuk mencoba tanpa menunggu jadwal, jalankan{" "}
                <span className="font-mono text-ink">/ip dns cache flush</span> di terminal.
              </li>
            </ol>
          </Panel>
        </div>
      </div>
    </main>
  );
}