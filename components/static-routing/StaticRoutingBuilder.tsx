"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Check, Copy, Download, Plus, Route, Terminal, Trash } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, CheckPill, Field, Note, Panel, Select, TextInput, Toggle } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { highlightScriptLine } from "@/lib/script-highlight";
import {
  APPS,
  defaultStaticRouting,
  generateStaticRouting,
  generateStaticRoutingRemove,
  newIspRow,
  TIMEOUT_LABEL,
  validateStaticRouting,
  type AppId,
  type AppSelection,
  type IspRow,
  type ListTimeout,
  type LocalMode,
  type StaticRoutingConfig,
} from "@/lib/static-routing";

const STORAGE_KEY = "static-routing-v1";
const MAX_ISPS = 8;

/** Pulihkan isian tersimpan; bentuk yang rusak atau lama kembali ke bawaan. */
function restore(raw: unknown): StaticRoutingConfig {
  const base = defaultStaticRouting();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<StaticRoutingConfig>;
  if (!Array.isArray(r.isps) || r.isps.length === 0 || !Array.isArray(r.apps)) return base;
  const isps: IspRow[] = r.isps.slice(0, MAX_ISPS).map((i, n) => ({
    id: typeof i.id === "string" && i.id ? i.id : newIspRow(n).id,
    // Data lama memakai "name"; kini kolomnya adalah routing mark itu sendiri.
    mark:
      typeof i.mark === "string"
        ? i.mark.slice(0, 30)
        : typeof (i as { name?: unknown }).name === "string"
          ? `sr-${String((i as { name?: string }).name).replace(/[^A-Za-z0-9]+/g, "")}`.slice(0, 30)
          : `sr-ISP${n + 1}`,
    iface: typeof i.iface === "string" ? i.iface.slice(0, 30) : "",
    gateway: typeof i.gateway === "string" ? i.gateway.slice(0, 20) : "",
  }));
  const apps: AppSelection[] = base.apps.map((def) => {
    const saved = r.apps!.find((a) => a && a.id === def.id);
    if (!saved) return def;
    return {
      id: def.id,
      enabled: Boolean(saved.enabled),
      isp: isps.some((i) => i.id === saved.isp) ? saved.isp : isps[0].id,
      customName: typeof saved.customName === "string" ? saved.customName.slice(0, 30) : "",
      customDomains: typeof saved.customDomains === "string" ? saved.customDomains.slice(0, 600) : "",
    };
  });
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(v as T) ? (v as T) : fallback;
  return {
    ros: r.ros === "v6" || r.ros === "v7" ? r.ros : "",
    isps,
    apps,
    localMode: pick<LocalMode>(r.localMode, ["addresslist", "interfacelist", "interface"], "addresslist"),
    lanList: typeof r.lanList === "string" ? r.lanList.slice(0, 30) : base.lanList,
    lanIface: typeof r.lanIface === "string" ? r.lanIface.slice(0, 30) : base.lanIface,
    timeout: pick<ListTimeout>(r.timeout, ["6h", "1d", "3d", "7d"], "1d"),
    nat: typeof r.nat === "boolean" ? r.nat : base.nat,
    fasttrack: typeof r.fasttrack === "boolean" ? r.fasttrack : base.fasttrack,
    seed: typeof r.seed === "boolean" ? r.seed : base.seed,
    blockQuic: typeof r.blockQuic === "boolean" ? r.blockQuic : base.blockQuic,
    fallback: typeof r.fallback === "boolean" ? r.fallback : base.fallback,
    top: typeof r.top === "boolean" ? r.top : base.top,
  };
}

export function StaticRoutingBuilder() {
  const [config, setConfig] = useState<StaticRoutingConfig>(defaultStaticRouting);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"setup" | "remove">("setup");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setConfig(restore(JSON.parse(saved)));
    } catch {
      // penyimpanan diblokir / data rusak: pakai isian bawaan
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // abaikan
    }
  }, [config, ready]);

  const patch = (partial: Partial<StaticRoutingConfig>) => setConfig((c) => ({ ...c, ...partial }));
  const patchIsp = (id: string, partial: Partial<IspRow>) =>
    setConfig((c) => ({ ...c, isps: c.isps.map((i) => (i.id === id ? { ...i, ...partial } : i)) }));
  const patchApp = (id: AppId, partial: Partial<AppSelection>) =>
    setConfig((c) => ({ ...c, apps: c.apps.map((a) => (a.id === id ? { ...a, ...partial } : a)) }));
  const addIsp = () =>
    setConfig((c) => (c.isps.length >= MAX_ISPS ? c : { ...c, isps: [...c.isps, newIspRow(c.isps.length, true)] }));
  const removeIsp = (id: string) =>
    setConfig((c) => {
      if (c.isps.length <= 1) return c;
      const isps = c.isps.filter((i) => i.id !== id);
      // Aplikasi yang memakai ISP terhapus dialihkan ke ISP pertama.
      return { ...c, isps, apps: c.apps.map((a) => (a.isp === id ? { ...a, isp: isps[0].id } : a)) };
    });

  const issues = useMemo(() => validateStaticRouting(config), [config]);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warn");
  const setupScript = useMemo(() => generateStaticRouting(config), [config]);
  const removeScript = useMemo(() => generateStaticRoutingRemove(config), [config]);

  const removing = tab === "remove";
  const script = removing ? removeScript : setupScript;
  const blocked = !removing && errors.length > 0;
  const filename = `static-routing${removing ? "-hapus" : ""}.rsc`;
  // Script memuat tanggal-jam; ditampilkan setelah halaman siap di browser agar sama dengan hasil server.
  const lines = ready ? script.split("\n") : [];
  const commandCount = lines.filter((l) => l.trim() && !l.trim().startsWith("#")).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const ispOptions = config.isps.map((i, n) => ({ value: i.id, label: `${i.mark || `ISP ${n + 1}`} — ${i.iface || "?"}` }));

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
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
              <Route className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Static Routing Aplikasi</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setConfig(defaultStaticRouting())} title="Kembalikan semua isian ke contoh awal">
              Atur ulang
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="grid w-full gap-5 px-5 py-6 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:px-8">
        {/* ------------------------------------------------------ isian */}
        <div className="space-y-5">
          <Note>
            Arahkan aplikasi tertentu ke ISP tertentu. RAW membaca nama domain (SNI) pada paket TLS lalu mengisi
            address-list IP aplikasi secara otomatis; mangle mengarahkan IP itu ke ISP pilihan Anda. Berlaku untuk
            RouterOS 6 dan 7.
          </Note>

          <Panel title="Versi RouterOS" description="Menentukan sintaks tabel routing (v7 memakai /routing table).">
            <div className="flex flex-wrap gap-2">
              {(["v6", "v7"] as const).map((v) => (
                <CheckPill key={v} active={config.ros === v} onClick={() => patch({ ros: v })}>
                  RouterOS {v === "v6" ? "6.x" : "7.x"}
                </CheckPill>
              ))}
            </div>
          </Panel>

          <Panel
            title="Jalur ISP"
            description="Interface dan gateway tiap ISP tujuan. Kolom pertama adalah nama routing mark (v7: nama tabel routing), dipakai apa adanya — boleh disamakan dengan routing mark Load Balance, mis. to-ISP1."
            right={
              <Button size="sm" onClick={addIsp} disabled={config.isps.length >= MAX_ISPS}>
                <Plus className="h-3.5 w-3.5" /> Tambah ISP
              </Button>
            }
          >
            <div className="space-y-2.5">
              {config.isps.map((isp, index) => (
                <div key={isp.id} className="grid gap-2.5 rounded-xl border border-line-soft bg-raised/40 p-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
                  <Field label={index === 0 ? "Routing mark" : undefined}>
                    <TextInput mono value={isp.mark} onChange={(mark) => patchIsp(isp.id, { mark: mark.replace(/\s+/g, "-") })} placeholder="to-ISP1" />
                  </Field>
                  <Field label={index === 0 ? "Interface WAN" : undefined}>
                    <TextInput mono value={isp.iface} onChange={(iface) => patchIsp(isp.id, { iface })} placeholder="ether1" />
                  </Field>
                  <Field label={index === 0 ? "Gateway" : undefined}>
                    <TextInput mono value={isp.gateway} onChange={(gateway) => patchIsp(isp.id, { gateway })} placeholder="192.168.1.1" />
                  </Field>
                  <Button
                    size="sm"
                    variant="danger"
                    className="px-2.5"
                    ariaLabel={`Hapus ${isp.mark || "ISP"}`}
                    title="Hapus ISP"
                    onClick={() => removeIsp(isp.id)}
                    disabled={config.isps.length <= 1}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Aplikasi" description="Aktifkan aplikasi lalu pilih lewat ISP mana trafiknya dikirim.">
            <div className="space-y-2.5">
              {config.apps.map((sel) => {
                const def = APPS.find((a) => a.id === sel.id);
                const isCustom = sel.id === "custom";
                return (
                  <div
                    key={sel.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      sel.enabled ? "border-brand/40 bg-brand/[0.05]" : "border-line-soft bg-raised/40"
                    }`}
                  >
                    <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,260px)] sm:items-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sel.enabled}
                        onClick={() => patchApp(sel.id, { enabled: !sel.enabled })}
                        className="flex items-center gap-3 text-left"
                      >
                        <span
                          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${sel.enabled ? "bg-brand" : "bg-line"}`}
                        >
                          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${sel.enabled ? "translate-x-5" : ""}`} />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: def?.color ?? "#714b67" }} />
                            {isCustom ? "Aplikasi / domain kustom" : def?.label}
                          </span>
                          <span className="block text-xs leading-snug text-muted">
                            {isCustom ? "Isi domain sendiri, mis. netflix.com atau spotify.com." : def?.note}
                          </span>
                        </span>
                      </button>
                      <Select
                        value={sel.isp}
                        placeholder=""
                        disabled={!sel.enabled}
                        onChange={(isp) => patchApp(sel.id, { isp })}
                        options={ispOptions}
                      />
                    </div>
                    {isCustom && sel.enabled && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,200px)_1fr]">
                        <Field label="Nama aplikasi">
                          <TextInput value={sel.customName} onChange={(customName) => patchApp("custom", { customName })} placeholder="Netflix" />
                        </Field>
                        <Field label="Domain" hint="Satu per baris atau pisahkan koma. Subdomain ikut terbaca.">
                          <textarea
                            value={sel.customDomains}
                            onChange={(e) => patchApp("custom", { customDomains: e.target.value })}
                            rows={3}
                            placeholder={"netflix.com\nnflxvideo.net"}
                            className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12.5px] text-ink outline-none focus:border-brand"
                          />
                        </Field>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Sumber trafik LAN" description="Lalu lintas dari mana saja yang diarahkan.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cara menandai trafik LAN">
                <Select
                  value={config.localMode}
                  placeholder=""
                  onChange={(localMode) => patch({ localMode: localMode as LocalMode })}
                  options={[
                    { value: "addresslist", label: "IP Address List (RFC1918) — disarankan" },
                    { value: "interfacelist", label: "Interface List" },
                    { value: "interface", label: "Interface" },
                  ]}
                />
              </Field>
              {config.localMode === "interfacelist" && (
                <Field label="Nama interface-list LAN" hint="Harus sudah ada dan berisi interface LAN.">
                  <TextInput mono value={config.lanList} onChange={(lanList) => patch({ lanList })} placeholder="LAN" />
                </Field>
              )}
              {config.localMode === "interface" && (
                <Field label="Interface LAN" hint="Nama bridge/interface sisi LAN.">
                  <TextInput mono value={config.lanIface} onChange={(lanIface) => patch({ lanIface })} placeholder="bridge-lan" />
                </Field>
              )}
            </div>
          </Panel>

          <Panel title="Opsi" description="Bawaan sudah cocok untuk kebanyakan jaringan.">
            <div className="space-y-2.5">
              <Field label="Masa simpan IP di address-list" hint="IP yang tidak muncul lagi akan dihapus otomatis setelah waktu ini.">
                <Select
                  value={config.timeout}
                  placeholder=""
                  onChange={(timeout) => patch({ timeout: timeout as ListTimeout })}
                  options={(Object.keys(TIMEOUT_LABEL) as ListTimeout[]).map((k) => ({ value: k, label: TIMEOUT_LABEL[k] }))}
                />
              </Field>
              <Toggle checked={config.seed} onChange={(seed) => patch({ seed })} label="Isi address-list dari domain utama (FQDN)" hint="Domain utama aplikasi di-resolve router lebih dulu, jadi koneksi pertama pun sudah lewat ISP yang benar." />
              <Toggle checked={config.blockQuic} onChange={(blockQuic) => patch({ blockQuic })} label="Blokir QUIC (UDP 443) ke IP aplikasi" hint="QUIC tidak bisa dibaca SNI-nya. Dengan memblokirnya, klien beralih ke TCP/TLS sehingga IP aplikasi terus terdeteksi." />
              <Toggle checked={config.nat} onChange={(nat) => patch({ nat })} label="Buat NAT masquerade per interface ISP" hint="Dilewati bila rule yang sama sudah ada (mis. dari Setup atau Load Balance)." />
              <Toggle checked={config.fasttrack} onChange={(fasttrack) => patch({ fasttrack })} label="Batasi FastTrack ke koneksi tanpa mark" hint="FastTrack melewati mangle; tanpa ini routing per aplikasi bisa tidak berlaku." />
              <Toggle checked={config.top} onChange={(top) => patch({ top })} label="Letakkan rule mangle di paling atas" hint="Agar mendahului aturan lain seperti PCC Load Balance (place-before=0)." />
              <Toggle checked={config.fallback} onChange={(fallback) => patch({ fallback })} label="Rute cadangan lewat ISP lain" hint="Bila ISP tujuan mati, trafik aplikasi pindah ke ISP lain. Butuh minimal dua ISP." />
            </div>
          </Panel>
        </div>

        {/* ---------------------------------------------------- script */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div role="tablist" className="flex gap-1 border-b border-line-soft bg-raised/50 p-1.5">
              {(
                [
                  ["setup", "Script setup"],
                  ["remove", "Hapus semua"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    tab === id
                      ? id === "remove"
                        ? "bg-warn/15 text-warn ring-1 ring-warn/40"
                        : "bg-brand/15 text-brand ring-1 ring-brand/40"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 border-b border-line-soft bg-canvas/60 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted">
                <Terminal className="h-3.5 w-3.5 text-faint" />
                <span className="truncate">{filename}</span>
              </span>
              <span
                className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  removing
                    ? "border-warn/40 bg-warn/10 text-warn"
                    : blocked
                      ? "border-bad/40 bg-bad/10 text-bad"
                      : warnings.length > 0
                        ? "border-warn/40 bg-warn/10 text-warn"
                        : "border-accent/40 bg-accent/10 text-accent"
                }`}
              >
                {removing ? "hapus semua" : blocked ? `${errors.length} error` : warnings.length > 0 ? `${warnings.length} catatan` : "siap pakai"}
              </span>
            </div>
            <pre className="max-h-[52vh] overflow-auto bg-code px-3 py-3 font-mono text-[11.5px] leading-[1.7] lg:max-h-[calc(100vh-24rem)] lg:min-h-[260px]">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-3 px-1 hover:bg-white/[0.03]">
                  <span className="w-7 shrink-0 select-none text-right text-faint/40">{i + 1}</span>
                  <span className="whitespace-pre-wrap break-all">{highlightScriptLine(line)}</span>
                </div>
              ))}
            </pre>
            <div className="border-t border-line-soft px-4 py-2 font-mono text-[11px] text-faint">
              {commandCount} perintah · {lines.length} baris
            </div>
            {removing && (
              <p className="border-t border-line-soft bg-warn/[0.06] px-4 py-2.5 text-xs leading-relaxed text-muted">
                <b className="font-medium text-warn">Hati-hati:</b> hanya menghapus rule berkomentar &ldquo;sr … - by mikrosetting&rdquo;
                (RAW, mangle, rute, NAT, dan address-list SR-*). Aplikasi akan kembali lewat jalur utama.
              </p>
            )}
            <div className="flex flex-wrap gap-2 border-t border-line-soft bg-canvas/40 px-4 py-3.5">
              <Button variant="primary" onClick={copy} disabled={blocked} className="flex-1" title={blocked ? "Perbaiki error terlebih dahulu" : "Salin seluruh script"}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Tersalin" : "Copy to Clipboard"}
              </Button>
              <Button
                onClick={() => downloadBlob(new Blob([script], { type: "text/plain;charset=utf-8" }), filename)}
                disabled={blocked}
                title="Unduh sebagai file .rsc"
              >
                <Download className="h-4 w-4" />
                .rsc
              </Button>
            </div>
          </div>

          {errors.length > 0 && !removing && (
            <div className="rounded-2xl border border-bad/30 bg-bad/[0.06] p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-bad">
                <AlertCircle className="h-4 w-4" />
                Perbaiki dulu sebelum menyalin
              </h3>
              <ul className="mt-2.5 space-y-1">
                {errors.slice(0, 8).map((issue, i) => (
                  <li key={i} className="text-xs leading-relaxed text-bad/90">
                    • {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && !removing && (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <Note key={i} tone="warn">
                  {w.message}
                </Note>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface p-4">
            <h3 className="text-sm font-semibold text-ink">Perlu diketahui</h3>
            <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-muted">
              <li>• SNI hanya terbaca pada TLS/TCP. Trafik QUIC (HTTP/3) tidak bisa dibaca, karena itu ada opsi memblokir QUIC ke IP aplikasi.</li>
              <li>• Koneksi pertama ke IP yang belum dikenal bisa putus sekali sebelum IP itu masuk daftar; mengisi address-list dari domain utama (FQDN) mengurangi hal ini.</li>
              <li>• Rule RAW dengan <span className="font-mono">content=</span> memeriksa isi paket port 443 dari LAN. Pada router kecil dengan trafik besar, pilih aplikasi seperlunya.</li>
              <li>• Facebook dan WhatsApp sama-sama milik Meta dan berbagi banyak IP; sebaiknya pakai ISP yang sama untuk keduanya.</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
