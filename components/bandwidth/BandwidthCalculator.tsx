"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Plus, Trash, Users } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, EmptyState, Field, Note, Panel, Select, TextInput, Toggle } from "@/components/ui";
import {
  bandwidthWarnings,
  calculateBandwidth,
  defaultState,
  fmtMbps,
  generateBandwidthScript,
  newPlan,
  normalizeState,
  SCENARIO_LABEL,
  SERVICE_HINT,
  SERVICE_LABEL,
  USAGE_PRESETS,
  type BandwidthState,
  type Plan,
  type Scenario,
  type Service,
  type ServiceKind,
} from "@/lib/bandwidth";

const STORAGE_KEY = "bandwidth-calc-v1";

/** Warna tiap layanan di grafik batang. */
const SERVICE_COLOR: Record<ServiceKind, string> = {
  pppoe: "bg-brand",
  hotspot: "bg-accent",
  dhcp: "bg-warn",
};

const int = (n: number) => Math.round(n).toLocaleString("id-ID");

/** Isian angka: boleh dikosongkan saat mengetik, nilai kosong dibaca 0. */
function NumberInput({
  value,
  onChange,
  placeholder,
  suffix,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  suffix?: string;
  label: string;
}) {
  return (
    <div className="relative">
      <TextInput
        type="number"
        mono
        value={value === 0 ? "" : String(value)}
        onChange={(text) => {
          const n = Number(text.replace(",", "."));
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        placeholder={placeholder ?? "0"}
        className="pr-12"
        aria-label={label}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-faint">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function BandwidthCalculator() {
  const [state, setState] = useState<BandwidthState>(defaultState);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Pulihkan isian terakhir dari browser ini (tidak dikirim ke server).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState(normalizeState(JSON.parse(saved)));
    } catch {
      // penyimpanan diblokir / data rusak: pakai isian bawaan
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // abaikan
    }
  }, [state, ready]);

  const result = useMemo(() => calculateBandwidth(state), [state]);
  const warnings = useMemo(() => bandwidthWarnings(state, result), [state, result]);
  const script = useMemo(() => generateBandwidthScript(state), [state]);

  const patchService = (kind: ServiceKind, partial: Partial<Service>) =>
    setState((s) => ({ ...s, services: s.services.map((x) => (x.kind === kind ? { ...x, ...partial } : x)) }));
  const patchPlan = (kind: ServiceKind, id: string, partial: Partial<Plan>) =>
    setState((s) => ({
      ...s,
      services: s.services.map((x) =>
        x.kind === kind ? { ...x, plans: x.plans.map((p) => (p.id === id ? { ...p, ...partial } : p)) } : x,
      ),
    }));
  const addPlan = (kind: ServiceKind) =>
    setState((s) => ({
      ...s,
      services: s.services.map((x) =>
        x.kind === kind && x.plans.length < 20
          ? { ...x, plans: [...x.plans, newPlan({ name: `Paket ${x.plans.length + 1}` })] }
          : x,
      ),
    }));
  const removePlan = (kind: ServiceKind, id: string) =>
    setState((s) => ({
      ...s,
      services: s.services.map((x) => (x.kind === kind ? { ...x, plans: x.plans.filter((p) => p.id !== id) } : x)),
    }));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard diblokir: pengguna bisa menyalin manual
    }
  };

  const total = result.peakDown || 1;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 lg:px-8 py-3">
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
              <Users className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Hitung Bandwidth</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setState(defaultState())} title="Kembalikan semua isian ke contoh awal">
              Atur ulang
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="grid w-full gap-5 px-5 lg:px-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* ----------------------------------------------------- isian */}
        <div className="space-y-5">
          <Note>
            Perkiraan, bukan angka pasti: hasilnya bergantung pada berapa user yang online bersamaan dan seberapa
            berat pemakaiannya. Isi sesuai kondisi jam sibuk jaringan Anda. Semua dihitung di browser dan tidak
            dikirim ke server.
          </Note>

          {state.services.map((svc) => (
            <Panel
              key={svc.kind}
              title={SERVICE_LABEL[svc.kind]}
              description={SERVICE_HINT[svc.kind]}
              right={
                <button
                  type="button"
                  role="switch"
                  aria-checked={svc.enabled}
                  aria-label={`Hitung ${SERVICE_LABEL[svc.kind]}`}
                  onClick={() => patchService(svc.kind, { enabled: !svc.enabled })}
                  className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    svc.enabled ? "bg-brand" : "bg-line"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      svc.enabled ? "translate-x-5" : ""
                    }`}
                  />
                </button>
              }
            >
              {!svc.enabled ? (
                <p className="text-xs text-faint">Tidak dihitung. Nyalakan saklar di kanan atas untuk memasukkannya.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="User online bersamaan"
                      hint="Persen dari seluruh user yang aktif di jam sibuk."
                    >
                      <NumberInput
                        label="Persen user online"
                        value={svc.online}
                        suffix="%"
                        onChange={(v) => patchService(svc.kind, { online: Math.min(100, v) })}
                      />
                    </Field>
                    <Field
                      label="Intensitas pemakaian"
                      hint="Persen dari batas kecepatan yang benar-benar dipakai tiap user online."
                    >
                      <NumberInput
                        label="Persen intensitas"
                        value={svc.intensity}
                        suffix="%"
                        onChange={(v) => patchService(svc.kind, { intensity: Math.min(100, v) })}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                      Profil cepat
                    </span>
                    {USAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.hint}
                        onClick={() => patchService(svc.kind, { intensity: preset.intensity })}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          svc.intensity === preset.intensity
                            ? "border-brand/60 bg-brand/15 text-brand"
                            : "border-line bg-canvas text-muted hover:border-brand/40 hover:text-ink"
                        }`}
                      >
                        {preset.label} · {preset.intensity}%
                      </button>
                    ))}
                  </div>

                  {/* paket */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                        Paket pembatasan ({svc.plans.length})
                      </span>
                      <Button size="sm" onClick={() => addPlan(svc.kind)} disabled={svc.plans.length >= 20}>
                        <Plus className="h-3.5 w-3.5" /> Tambah paket
                      </Button>
                    </div>
                    {svc.plans.length === 0 ? (
                      <EmptyState>Belum ada paket. Tambahkan minimal satu paket.</EmptyState>
                    ) : (
                      <div className="space-y-2.5">
                        {svc.plans.map((plan) => (
                          <div key={plan.id} className="rounded-xl border border-line-soft bg-raised/40 p-3">
                            <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end">
                              <Field label="Nama paket">
                                <TextInput
                                  value={plan.name}
                                  onChange={(name) => patchPlan(svc.kind, plan.id, { name })}
                                  placeholder="Paket 10 Mbps"
                                />
                              </Field>
                              <Field label="Download">
                                <NumberInput
                                  label="Batas download"
                                  value={plan.down}
                                  suffix="Mbps"
                                  onChange={(down) => patchPlan(svc.kind, plan.id, { down })}
                                />
                              </Field>
                              <Field label="Upload">
                                <NumberInput
                                  label="Batas upload"
                                  value={plan.up}
                                  suffix="Mbps"
                                  onChange={(up) => patchPlan(svc.kind, plan.id, { up })}
                                />
                              </Field>
                              <Field label="Jumlah user">
                                <NumberInput
                                  label="Jumlah user"
                                  value={plan.users}
                                  onChange={(users) => patchPlan(svc.kind, plan.id, { users: Math.round(users) })}
                                />
                              </Field>
                              <Button
                                size="sm"
                                variant="danger"
                                className="px-2.5"
                                ariaLabel={`Hapus ${plan.name || "paket"}`}
                                title="Hapus paket"
                                onClick={() => removePlan(svc.kind, plan.id)}
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {svc.kind === "dhcp" && (
                              <div className="mt-2.5 max-w-xs">
                                <Field label="Subnet tujuan" hint="Untuk perintah simple queue, mis. 192.168.10.0/24.">
                                  <TextInput
                                    mono
                                    value={plan.target}
                                    onChange={(target) => patchPlan(svc.kind, plan.id, { target })}
                                    placeholder="192.168.10.0/24"
                                  />
                                </Field>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          ))}

          <Panel title="Asumsi" description="Pengaruhi seluruh hasil perhitungan.">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cadangan (headroom)" hint="Ruang kosong di atas kebutuhan puncak.">
                <NumberInput
                  label="Cadangan persen"
                  value={state.assumptions.headroom}
                  suffix="%"
                  onChange={(headroom) => setState((s) => ({ ...s, assumptions: { ...s.assumptions, headroom: Math.min(200, headroom) } }))}
                />
              </Field>
              <Field label="Skenario jam sibuk">
                <Select
                  value={state.assumptions.scenario}
                  placeholder=""
                  onChange={(scenario) =>
                    setState((s) => ({ ...s, assumptions: { ...s.assumptions, scenario: scenario as Scenario } }))
                  }
                  options={(Object.keys(SCENARIO_LABEL) as Scenario[]).map((k) => ({ value: k, label: SCENARIO_LABEL[k] }))}
                />
              </Field>
              <Field label="Jumlah ISP" hint="Bila memakai Load Balance.">
                <Select
                  value={String(state.assumptions.isps)}
                  placeholder=""
                  onChange={(v) =>
                    setState((s) => ({ ...s, assumptions: { ...s.assumptions, isps: Math.max(1, Math.min(8, Number(v) || 1)) } }))
                  }
                  options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: String(n), label: n === 1 ? "1 ISP" : `${n} ISP` }))}
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Perintah RouterOS"
            description="Pembatasan kecepatan tiap paket. Format rate-limit upload/download. Siap tempel di New Terminal."
            right={
              <Button size="sm" onClick={copy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Tersalin" : "Salin"}
              </Button>
            }
          >
            <pre className="max-h-96 overflow-auto rounded-xl border border-line-soft bg-code px-4 py-3 font-mono text-[12px] leading-relaxed text-ink">
              {script}
            </pre>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              PPPoE memakai <span className="font-mono">/ppp profile</span>, Hotspot memakai{" "}
              <span className="font-mono">/ip hotspot user profile</span>, dan DHCP memakai PCQ + simple queue per
              subnet (batas dibagi per perangkat). Pasang profil itu pada secret PPPoE atau user hotspot Anda.
            </p>
          </Panel>
        </div>

        {/* ----------------------------------------------------- hasil */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-brand/40 bg-surface p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
              Kebutuhan bandwidth (puncak + cadangan)
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight text-brand">
              {result.needDown > 0 ? fmtMbps(result.needDown) : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">
              download · kebutuhan puncak <b className="font-semibold text-ink">{fmtMbps(result.peakDown)}</b> + cadangan{" "}
              {state.assumptions.headroom}%
            </p>
            <p className="mt-3 rounded-lg border border-line-soft bg-raised/50 px-3 py-2 text-xs text-muted">
              Paket ISP terdekat yang cukup:{" "}
              <b className="font-semibold text-ink">{result.tierDown > 0 ? fmtMbps(result.tierDown) : "—"}</b>
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-sm">
              <div>
                <dt className="text-[11px] text-faint">Upload dibutuhkan</dt>
                <dd className="font-mono text-ink">{fmtMbps(result.needUp)}</dd>
                <dd className="text-[11px] text-faint">paket ≥ {fmtMbps(result.tierUp)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Rasio overbooking</dt>
                <dd className="font-mono text-ink">{result.overbooking > 0 ? `${result.overbooking.toFixed(1)} : 1` : "—"}</dd>
                <dd className="text-[11px] text-faint">total batas ÷ paket ISP</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Total user</dt>
                <dd className="font-mono text-ink">{int(result.users)}</dd>
                <dd className="text-[11px] text-faint">~{int(result.onlineUsers)} online saat sibuk</dd>
              </div>
              <div>
                <dt className="text-[11px] text-faint">Semua user penuh</dt>
                <dd className="font-mono text-ink">{fmtMbps(result.worstDown)}</dd>
                <dd className="text-[11px] text-faint">kasus terburuk (jarang terjadi)</dd>
              </div>
            </dl>

            {result.perIsp.isps > 1 && (
              <div className="mt-4 rounded-xl border border-line-soft bg-raised/50 p-3 text-xs leading-relaxed text-muted">
                <b className="font-medium text-ink">{result.perIsp.isps} ISP (Load Balance)</b>
                <br />
                Tiap ISP ≈ {fmtMbps(result.perIsp.normal)} saat semua hidup
                {result.perIsp.failover ? <>; ≥ {fmtMbps(result.perIsp.failover)} agar satu ISP mati tetap cukup.</> : "."}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Porsi kebutuhan per layanan</h2>
            {result.services.length === 0 || result.peakDown === 0 ? (
              <p className="mt-3 text-xs text-faint">Isi jumlah user dan batas kecepatan untuk melihat porsinya.</p>
            ) : (
              <>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label="Porsi kebutuhan per layanan">
                  {result.services.map((s) => (
                    <span
                      key={s.kind}
                      className={SERVICE_COLOR[s.kind]}
                      style={{ width: `${(s.peakDown / total) * 100}%` }}
                      title={`${SERVICE_LABEL[s.kind]} ${fmtMbps(s.peakDown)}`}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {result.services.map((s) => (
                    <li key={s.kind} className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-2 text-muted">
                        <span className={`h-2.5 w-2.5 rounded-sm ${SERVICE_COLOR[s.kind]}`} />
                        {SERVICE_LABEL[s.kind]}
                        <span className="text-faint">· {int(s.users)} user</span>
                      </span>
                      <span className="font-mono text-ink">
                        {fmtMbps(s.peakDown)} <span className="text-faint">({Math.round((s.peakDown / total) * 100)}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Rincian per paket</h2>
            {result.services.every((s) => s.plans.length === 0) ? (
              <p className="mt-3 text-xs text-faint">Belum ada paket.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-[0.09em] text-faint">
                    <tr>
                      <th className="pb-2 pr-2">Paket</th>
                      <th className="pb-2 pr-2 text-right">User</th>
                      <th className="pb-2 text-right">Puncak ↓</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.services.flatMap((s) =>
                      s.plans.map((p) => (
                        <tr key={p.plan.id} className="border-t border-line-soft">
                          <td className="py-2 pr-2 text-muted">
                            <span className={`mr-1.5 inline-block h-2 w-2 rounded-sm ${SERVICE_COLOR[s.kind]}`} />
                            {p.plan.name || "Paket"}
                            <span className="ml-1 text-faint">
                              {p.plan.down}/{p.plan.up}
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-right font-mono text-ink">{int(p.plan.users)}</td>
                          <td className="py-2 text-right font-mono text-ink">{fmtMbps(p.peakDown)}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <Note key={i} tone="warn">
                  {w}
                </Note>
              ))}
            </div>
          )}

          <Toggle
            checked={state.assumptions.scenario === "aman"}
            onChange={(on) =>
              setState((s) => ({ ...s, assumptions: { ...s.assumptions, scenario: on ? "aman" : "normal" } }))
            }
            label="Mode aman"
            hint="Anggap jam sibuk 1,4× lebih padat — berguna bila jaringan sering terasa penuh."
          />
        </aside>
      </div>
    </main>
  );
}
