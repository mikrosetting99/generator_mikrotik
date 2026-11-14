"use client";

import { useState } from "react";
import { Button, Field, Note, Select, TextInput, Toggle } from "@/components/ui";
import { DEFAULT_INTERVAL, DEFAULT_RULES, DEVICE_KINDS, VENDORS, isCollected, type DeviceConfigView, type DeviceView, type RuleConfig } from "@/lib/nm/types";

export interface SavedRouterOption {
  id: string;
  name: string;
  host: string;
}

interface FormState {
  name: string;
  site: string;
  kind: string;
  vendor: string;
  source: "manual" | "router";
  fromRouterId: string;
  host: string;
  apiPort: string;
  tls: boolean;
  tlsFingerprint: string;
  username: string;
  password: string;
  enabled: boolean;
  intervalSec: string;
  wan: string[];
  wanDraft: string;
  rules: Record<keyof RuleConfig, string>;
}

const rulesToForm = (r: RuleConfig) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])) as Record<keyof RuleConfig, string>;

export const READONLY_SCRIPT = `/user group add name=nm-read policy=read,api comment="Network Monitoring (read-only)"
/user add name=nm-read group=nm-read password=GANTI-PASSWORD address=IP-COLLECTOR/32`;

const INTERVALS = [
  { value: "30", label: "30 detik" },
  { value: "60", label: "60 detik (disarankan)" },
  { value: "120", label: "2 menit" },
  { value: "300", label: "5 menit" },
];

export function DeviceForm({
  mode,
  device,
  config,
  sites,
  routers,
  demo,
  onSaved,
  onCancel,
  onDelete,
}: {
  mode: "add" | "edit";
  device?: DeviceView;
  config?: DeviceConfigView;
  sites: string[];
  routers: SavedRouterOption[];
  demo: boolean;
  onSaved: (id: string) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [f, setF] = useState<FormState>(() => ({
    name: device?.name ?? "",
    site: device?.site ?? "",
    kind: device?.kind ?? "router",
    vendor: device?.vendor ?? "mikrotik",
    source: "manual",
    fromRouterId: "",
    host: device?.host ?? "",
    apiPort: String(config?.apiPort ?? 8728),
    tls: config?.tls ?? false,
    tlsFingerprint: config?.tlsFingerprint ?? "",
    username: config?.username ?? "",
    password: "",
    enabled: device?.enabled ?? true,
    intervalSec: String(device?.intervalSec ?? DEFAULT_INTERVAL),
    wan: config?.wanInterfaces ?? [],
    wanDraft: "",
    rules: rulesToForm(config?.rules ?? DEFAULT_RULES),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const collected = isCollected(f.kind, f.vendor);
  const useRouter = mode === "add" && f.source === "router";
  const known = [...new Set([...(config?.interfaces ?? []), ...f.wan])];

  const addWan = () => {
    const v = f.wanDraft.trim();
    if (v && !f.wan.includes(v)) set("wan", [...f.wan, v]);
    set("wanDraft", "");
  };

  const save = async () => {
    setError("");
    if (demo) return setError("Mode demo: perubahan tidak disimpan. Matikan mode demo di Konfigurasi untuk mengelola perangkat sungguhan.");
    setBusy(true);
    try {
      const body = {
        name: f.name,
        site: f.site,
        kind: f.kind,
        vendor: f.vendor,
        host: f.host,
        apiPort: Number(f.apiPort),
        tls: f.tls,
        tlsFingerprint: f.tlsFingerprint,
        username: f.username,
        password: f.password,
        enabled: f.enabled,
        intervalSec: Number(f.intervalSec),
        wanInterfaces: f.wan,
        rules: Object.fromEntries(Object.entries(f.rules).map(([k, v]) => [k, Number(v)])),
        ...(useRouter ? { fromRouterId: f.fromRouterId } : {}),
      };
      const res = await fetch(mode === "add" ? "/api/nm/devices" : `/api/nm/devices/${device!.id}`, {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan.");
      set("password", "");
      onSaved(data.id ?? device!.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  };

  const ruleField = (k: keyof RuleConfig, label: string, suffix: string) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          value={f.rules[k]}
          onChange={(e) => set("rules", { ...f.rules, [k]: e.target.value })}
          className="min-h-9 w-24 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand"
        />
        <span className="text-xs text-faint">{suffix}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nama perangkat">
          <TextInput value={f.name} onChange={(v) => set("name", v)} placeholder="mis. RB-Pusat-Core" />
        </Field>
        <Field label="Site" hint="Lokasi atau POP; dipakai untuk filter.">
          <input
            list="nm-sites"
            value={f.site}
            onChange={(e) => set("site", e.target.value)}
            placeholder="mis. Kantor Pusat"
            className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand sm:min-h-10"
          />
          <datalist id="nm-sites">
            {sites.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Jenis">
          <Select value={f.kind} placeholder="" onChange={(v) => set("kind", v)} options={DEVICE_KINDS.map((k) => ({ value: k.id, label: k.label }))} />
        </Field>
        <Field label="Vendor">
          <Select value={f.vendor} placeholder="" onChange={(v) => set("vendor", v)} options={VENDORS.map((v) => ({ value: v.id, label: v.label }))} />
        </Field>
      </div>

      {!collected && (
        <Note>
          Collector tahap ini memantau Router dan Access Point MikroTik. Perangkat ini tetap tercatat di daftar, dengan status <b>Data Tidak Tersedia</b> sampai
          dukungan vendornya ditambahkan.
        </Note>
      )}

      {collected && (
        <section className="space-y-4 rounded-md border border-line p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">Koneksi RouterOS API (read-only)</h3>
            {mode === "add" && routers.length > 0 && (
              <div role="radiogroup" aria-label="Sumber kredensial" className="inline-flex overflow-hidden rounded-md border border-line text-xs font-medium">
                {(
                  [
                    ["manual", "Isi manual"],
                    ["router", "Dari Mikrotik tersimpan"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={f.source === id}
                    onClick={() => set("source", id)}
                    className={`min-h-8 px-3 ${f.source === id ? "bg-brand text-brand-ink" : "bg-surface text-muted hover:bg-raised"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {useRouter ? (
            <>
              <Field label="Mikrotik tersimpan" hint="Alamat, port, dan login disalin di server; password tidak dikirim ke browser.">
                <Select value={f.fromRouterId} onChange={(v) => set("fromRouterId", v)} placeholder="Pilih Mikrotik" options={routers.map((r) => ({ value: r.id, label: `${r.name} · ${r.host}` }))} />
              </Field>
              <Note tone="warn">User Mikrotik tersimpan biasanya punya hak tulis. Untuk monitoring, lebih aman memakai user read-only (isi manual).</Note>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Field label="Alamat (IP publik, domain, atau IP VPN yang diizinkan)">
                  <TextInput value={f.host} onChange={(v) => set("host", v)} placeholder="mis. 203.0.113.10 atau 10.88.0.12" />
                </Field>
                <Field label="Port API">
                  <TextInput value={f.apiPort} onChange={(v) => set("apiPort", v.replace(/\D/g, ""))} placeholder="8728" />
                </Field>
              </div>
              <Toggle
                checked={f.tls}
                onChange={(v) => setF((p) => ({ ...p, tls: v, apiPort: v && p.apiPort === "8728" ? "8729" : !v && p.apiPort === "8729" ? "8728" : p.apiPort }))}
                label="API-SSL (TLS)"
                hint="Sertifikat divalidasi. Untuk sertifikat self-signed, isi fingerprint SHA-256-nya."
              />
              {f.tls && (
                <Field label="Fingerprint SHA-256 sertifikat (opsional)" hint="Kosong = sertifikat wajib dari CA tepercaya dan cocok dengan alamat.">
                  <TextInput value={f.tlsFingerprint} onChange={(v) => set("tlsFingerprint", v)} placeholder="AB:CD:EF:…" />
                </Field>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Username monitoring">
                  <TextInput value={f.username} onChange={(v) => set("username", v)} placeholder="nm-read" />
                </Field>
                <Field label="Password" hint={mode === "edit" && config?.hasPassword ? "Kosongkan untuk mempertahankan password tersimpan." : undefined}>
                  <TextInput type="password" value={f.password} onChange={(v) => set("password", v)} placeholder={mode === "edit" && config?.hasPassword ? "••••••••" : ""} />
                </Field>
              </div>
              <details className="text-xs text-muted">
                <summary className="cursor-pointer font-medium text-brand">Buat user read-only di MikroTik</summary>
                <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-code p-3 font-mono text-[11px] leading-relaxed text-ink">{READONLY_SCRIPT}</pre>
                <p className="mt-1.5">Grup ini hanya punya policy read dan api. Ganti IP-COLLECTOR dengan IP server collector.</p>
              </details>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Interval cek">
              <Select value={f.intervalSec} placeholder="" onChange={(v) => set("intervalSec", v)} options={INTERVALS} />
            </Field>
            <div className="pt-6">
              <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Pantau perangkat ini" />
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-muted">Interface WAN yang dipantau</p>
            {known.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {known.map((name) => {
                  const on = f.wan.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("wan", on ? f.wan.filter((x) => x !== name) : [...f.wan, name])}
                      className={`min-h-8 rounded-full border px-3 font-mono text-xs ${on ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/50"}`}
                    >
                      {on ? "✓ " : ""}
                      {name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-faint">Daftar interface muncul setelah pemeriksaan pertama. Sementara itu, ketik nama interface WAN.</p>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={f.wanDraft}
                onChange={(e) => set("wanDraft", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addWan();
                  }
                }}
                placeholder="mis. ether1 atau pppoe-out1"
                aria-label="Tambah interface WAN"
                className="min-h-9 w-56 max-w-full rounded-md border border-line bg-surface px-2.5 font-mono text-xs text-ink outline-none focus:border-brand"
              />
              <Button size="sm" onClick={addWan} disabled={!f.wanDraft.trim()}>
                Tambah
              </Button>
            </div>
          </div>
        </section>
      )}

      {collected && (
        <details open={mode === "edit"} className="rounded-md border border-line p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Ambang aturan Analisa</summary>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">CPU tinggi</legend>
              {ruleField("cpuThreshold", "Di atas", "%")}
              {ruleField("cpuMinutes", "Selama", "menit")}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">WAN & keterjangkauan</legend>
              {ruleField("wanChecks", "WAN down berturut-turut", "cek")}
              {ruleField("unreachableChecks", "Tidak terjangkau berturut-turut", "cek")}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Sesi PPPoE turun</legend>
              {ruleField("pppDropPct", "Turun lebih dari", "%")}
              {ruleField("pppMinutes", "Dalam", "menit")}
              {ruleField("pppMinBase", "Minimal sesi awal", "sesi")}
            </fieldset>
          </div>
        </details>
      )}

      {error && <Note tone="bad">{error}</Note>}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save()} disabled={busy || !f.name.trim()}>
          {busy ? "Menyimpan…" : mode === "add" ? "Simpan perangkat" : "Simpan perubahan"}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Batal
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" onClick={onDelete} className="ml-auto">
            Hapus perangkat
          </Button>
        )}
      </div>
    </div>
  );
}
