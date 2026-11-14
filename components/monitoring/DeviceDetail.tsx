"use client";

import { useState } from "react";
import { Note, Select } from "@/components/ui";
import { DeviceForm, type SavedRouterOption } from "@/components/monitoring/DeviceForm";
import { fmtAgo, fmtBps, fmtDuration, fmtTime, fmtUptime, LineChart, NA, Skeleton, StatusBadge, Tabs } from "@/components/monitoring/parts";
import { CHECK_STEPS } from "@/lib/nm/checks";
import { KIND_LABEL, RULE_LABEL, type DeviceDetailView, type FindingView, type Sample, type WanView } from "@/lib/nm/types";

export type DetailTab = "ringkasan" | "analisa" | "pengaturan";

const WAN_LABEL: Record<WanView["state"], { text: string; cls: string }> = {
  up: { text: "Up", cls: "text-ok" },
  down: { text: "Down", cls: "text-bad" },
  missing: { text: "Interface tidak ditemukan di router", cls: "text-warn" },
  unverified: { text: "Belum terverifikasi", cls: "text-muted" },
  unknown: { text: "Tidak tersedia (API gagal)", cls: "text-warn" },
};

function Metric({ label, value, sub, na }: { label: string; value: string; sub?: string; na?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-surface px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className={`mt-1 font-semibold leading-tight ${na ? "text-sm text-faint" : "text-xl text-ink"}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-faint" title={sub}>{sub}</p>}
    </div>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-2.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DeviceDetail({
  detail,
  loading,
  error,
  tab,
  setTab,
  now,
  sites,
  routers,
  demo,
  onBack,
  onSaved,
  onDeleted,
  onRetry,
}: {
  detail: DeviceDetailView | null;
  loading: boolean;
  error: string;
  tab: DetailTab;
  setTab: (t: DetailTab) => void;
  now: number;
  sites: string[];
  routers: SavedRouterOption[];
  demo: boolean;
  onBack: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onRetry: () => void;
}) {
  const [wanSel, setWanSel] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState("");

  if (!detail) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onBack} className="text-sm text-brand hover:underline">
          ← Perangkat
        </button>
        {error ? (
          <Note tone="bad">
            Gagal memuat detail: {error}{" "}
            <button type="button" onClick={onRetry} className="font-medium underline">
              Coba lagi
            </button>
          </Note>
        ) : (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
      </div>
    );
  }

  const { device: d, config, samples, findings } = detail;
  const mikrotik = d.vendor === "mikrotik";
  const active = findings.filter((f) => f.status === "active");
  const times = samples.map((s) => s.at);
  const wanName = config.wanInterfaces.includes(wanSel) ? wanSel : (config.wanInterfaces[0] ?? "");
  const wanSeries = (k: "rxBps" | "txBps") => samples.map((s) => s.wan?.find((w) => w.name === wanName)?.[k] ?? null);
  const fresh = d.status !== "nodata";

  const remove = async () => {
    if (demo) return setDelError("Mode demo: perangkat tidak bisa dihapus.");
    if (!window.confirm(`Hapus ${d.name} beserta riwayat sampel dan temuannya?`)) return;
    setDelBusy(true);
    setDelError("");
    try {
      const res = await fetch(`/api/nm/devices/${d.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Gagal menghapus.");
      onDeleted();
    } catch (e) {
      setDelError(e instanceof Error ? e.message : "Gagal menghapus.");
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <button type="button" onClick={onBack} className="text-brand hover:underline">
          Perangkat
        </button>
        <span className="text-faint">/</span>
        <span className="truncate text-ink">{d.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">{d.name}</h2>
            <StatusBadge status={d.status} />
            {loading && <span className="text-[11px] text-faint">memperbarui…</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {KIND_LABEL[d.kind]}
            {d.site ? ` · ${d.site}` : ""}
            {d.host ? ` · ${d.host}` : ""}
            {d.metrics.identity ? ` · ${d.metrics.identity}` : ""}
            {d.metrics.version ? ` · RouterOS ${d.metrics.version}` : ""}
            {d.metrics.board ? ` · ${d.metrics.board}` : ""}
          </p>
          <p className={`mt-1 text-xs ${d.status === "down" ? "text-bad" : d.status === "warning" ? "text-warn" : "text-muted"}`}>{d.statusReason}</p>
        </div>
        <p className="text-xs text-muted sm:text-right">
          Cek terakhir
          <span className="block font-medium text-ink">{fmtAgo(d.lastCheckAt, now)}</span>
          {d.lastCheckAt && <span className="block text-faint">{fmtTime(d.lastCheckAt, now)} · tiap {d.intervalSec} detik</span>}
        </p>
      </header>

      <Tabs
        label="Detail perangkat"
        value={tab}
        onChange={setTab}
        items={[
          { id: "ringkasan" as const, label: "Ringkasan" },
          ...(mikrotik ? [{ id: "analisa" as const, label: "Analisa", count: active.length || undefined }] : []),
          { id: "pengaturan" as const, label: "Pengaturan" },
        ]}
      />

      {tab === "ringkasan" && (
        <div className="space-y-4">
          {!d.collected && <Note>{d.statusReason}</Note>}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="CPU" value={d.metrics.cpu === null ? NA : `${d.metrics.cpu}%`} na={d.metrics.cpu === null} />
            <Metric label="RAM" value={d.metrics.memPct === null ? NA : `${Math.round(d.metrics.memPct)}%`} na={d.metrics.memPct === null} />
            <Metric label="Uptime" value={fmtUptime(d.metrics.uptimeSec)} na={d.metrics.uptimeSec === null} />
            <Metric label="PPPoE aktif" value={d.metrics.ppp === null ? NA : String(d.metrics.ppp)} na={d.metrics.ppp === null} sub={d.sources.ppp ?? undefined} />
            <Metric label="Hotspot aktif" value={d.metrics.hotspot === null ? NA : String(d.metrics.hotspot)} na={d.metrics.hotspot === null} sub={d.sources.hotspot ?? undefined} />
            <Metric label="Temuan aktif" value={String(d.activeFindings)} />
          </div>

          {d.collected && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-4">
                <Card title="CPU (%)">
                  <LineChart now={now} times={times} max={100} threshold={config.rules.cpuThreshold} thresholdLabel={`ambang ${config.rules.cpuThreshold}%`} format={(v) => `${Math.round(v)}%`} series={[{ name: "CPU", color: "var(--nm-s1)", values: samples.map((s) => s.cpu) }]} />
                </Card>
                <Card
                  title="Trafik WAN"
                  right={
                    config.wanInterfaces.length > 1 ? (
                      <span className="w-44">
                        <Select value={wanName} placeholder="" onChange={setWanSel} options={config.wanInterfaces.map((w) => ({ value: w, label: w }))} className="!h-8 !text-xs" aria-label="Interface WAN" />
                      </span>
                    ) : (
                      wanName && <span className="font-mono text-xs text-muted">{wanName}</span>
                    )
                  }
                >
                  {wanName ? (
                    <LineChart
                      now={now}
                      times={times}
                      format={(v) => fmtBps(v)}
                      series={[
                        { name: "RX (masuk)", color: "var(--nm-s1)", values: wanSeries("rxBps") },
                        { name: "TX (keluar)", color: "var(--nm-s2)", values: wanSeries("txBps") },
                      ]}
                    />
                  ) : (
                    <p className="text-sm text-muted">Belum ada interface WAN yang dipilih. Pilih di tab Pengaturan.</p>
                  )}
                  <p className="mt-2 text-[11px] text-faint">Dihitung dari selisih counter antar sampel. Celah pada grafik = sampel pertama, router reboot, atau counter di-reset.</p>
                </Card>
                {samples.some((s) => s.ppp !== null) && (
                  <Card title="Sesi PPPoE aktif">
                    <LineChart now={now} times={times} format={(v) => `${Math.round(v)} sesi`} series={[{ name: "PPPoE", color: "var(--nm-s1)", values: samples.map((s) => s.ppp) }]} />
                  </Card>
                )}
              </div>
              <div className="space-y-4">
                <Card title="Status WAN">
                  {d.wan.length ? (
                    <ul className="space-y-2.5">
                      {d.wan.map((w) => (
                        <li key={w.name} className="text-sm">
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-ink">{w.name}</span>
                            <span className={`text-xs font-medium ${WAN_LABEL[w.state].cls}`}>{WAN_LABEL[w.state].text}</span>
                          </span>
                          {w.state === "up" && (
                            <span className="mt-0.5 flex justify-between font-mono text-[11px] text-muted">
                              <span>RX {fmtBps(w.rxBps)}</span>
                              <span>TX {fmtBps(w.txBps)}</span>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">Belum ada WAN yang dipantau.</p>
                  )}
                </Card>
                <Card title="Sumber data">
                  <dl className="space-y-2 text-xs">
                    {(
                      [
                        ["Keterjangkauan", d.sources.reach.ok, d.sources.reach.msg],
                        ["RouterOS API", d.sources.api.ok, d.sources.api.msg],
                        ["PPPoE", d.sources.api.ok ? d.sources.ppp === null : null, d.sources.ppp ?? (d.sources.api.ok ? "OK" : "Belum terverifikasi")],
                        ["Hotspot", d.sources.api.ok ? d.sources.hotspot === null : null, d.sources.hotspot ?? (d.sources.api.ok ? "OK" : "Belum terverifikasi")],
                      ] as const
                    ).map(([k, ok, msg]) => (
                      <div key={k} className="flex items-start justify-between gap-3">
                        <dt className="text-muted">{k}</dt>
                        <dd className={`text-right ${ok === true ? "text-ok" : ok === false ? "text-warn" : "text-faint"}`}>{msg}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "analisa" && mikrotik && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["CPU tinggi", `Di atas ${config.rules.cpuThreshold}% selama ${config.rules.cpuMinutes} menit`],
                ["WAN link down", config.wanInterfaces.length ? `${config.wanInterfaces.join(", ")} down ${config.rules.wanChecks}× berturut-turut` : "Belum ada WAN dipilih"],
                ["Sesi PPPoE turun", `Turun > ${config.rules.pppDropPct}% dalam ${config.rules.pppMinutes} menit (awal ≥ ${config.rules.pppMinBase})`],
              ] as const
            ).map(([t, v]) => (
              <div key={t} className="rounded-md border border-line bg-surface px-3.5 py-3">
                <p className="text-sm font-semibold text-ink">{t}</p>
                <p className="mt-0.5 text-xs text-muted">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-faint">
            Aturan dinilai collector dari sampel tiap {d.intervalSec} detik. Ambang bisa diubah di tab{" "}
            <button type="button" onClick={() => setTab("pengaturan")} className="text-brand underline">
              Pengaturan
            </button>
            .
          </p>
          {!fresh && d.collected && <Note tone="warn">{d.statusReason} Temuan tidak dibuka maupun dipulihkan sampai data segar masuk lagi.</Note>}
          {findings.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Belum ada temuan untuk perangkat ini.</p>
          ) : (
            <ul className="space-y-3">
              {[...active, ...findings.filter((f) => f.status !== "active")].map((f) => (
                <FindingCard key={f.id} f={f} now={now} samples={samples} />
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "pengaturan" && (
        <div className="max-w-3xl rounded-md border border-line bg-surface p-4 sm:p-5">
          <DeviceForm key={d.id} mode="edit" device={d} config={config} sites={sites} routers={routers} demo={demo} onSaved={onSaved} onDelete={delBusy ? undefined : () => void remove()} />
          {delError && (
            <div className="mt-3">
              <Note tone="bad">{delError}</Note>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Nilai sampel perangkat yang relevan untuk grafik sebuah temuan. */
function findingMetric(f: FindingView): ((s: Sample) => number | null) | null {
  if (f.rule === "cpu_high") return (s) => s.cpu;
  if (f.rule === "ppp_drop") return (s) => s.ppp;
  if (f.rule === "wan_down") return (s) => (s.apiOk ? (s.wan?.find((w) => w.name === f.subject && w.found)?.running ? 1 : s.wan?.some((w) => w.name === f.subject && w.found) ? 0 : null) : null);
  if (f.rule === "unreachable") return (s) => (s.reachable ? 1 : 0);
  if (f.rule === "api_error") return (s) => (s.reachable ? (s.apiOk ? 1 : 0) : null);
  return null;
}

function FindingCard({ f, now, samples }: { f: FindingView; now: number; samples: Sample[] }) {
  const isActive = f.status === "active";
  const ev = f.evidence;
  const status = ev.unit === "status";
  // Grafik: sampel perangkat dari 15 menit sebelum mulai sampai pulih (+5 menit); bila sudah di luar
  // rentang yang dimuat, pakai sampel bukti yang tersimpan bersama temuan.
  const pick = findingMetric(f);
  const from = f.startedAt - 15 * 60_000;
  const to = (f.resolvedAt ?? now) + 5 * 60_000;
  const ctx = samples.filter((s) => s.at >= from && s.at <= to);
  const useCtx = pick && ctx.length >= 3 && ctx[0].at <= f.startedAt;
  const times = useCtx ? ctx.map((s) => s.at) : ev.samples.map((s) => s.at);
  const values = useCtx ? ctx.map(pick!) : ev.samples.map((s) => s.value);
  const unitFmt = (v: number) => (status ? (v >= 0.5 ? "OK/up" : "gagal/down") : `${Math.round(v)}${ev.unit === "%" ? "%" : ` ${ev.unit}`}`);
  return (
    <li className={`overflow-hidden rounded-md border bg-surface ${isActive ? "border-warn/50" : "border-line"}`}>
      <header className={`flex flex-wrap items-start justify-between gap-2 px-4 py-3 ${isActive ? "bg-warn/[0.06]" : ""}`}>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{f.summary}</p>
          <p className="mt-0.5 text-xs text-muted">
            {RULE_LABEL[f.rule]}
            {f.rule === "wan_down" ? ` · interface ${f.subject}` : ""} · mulai {fmtTime(f.startedAt, now)}
            {isActive ? ` · berlangsung ${fmtDuration(now - f.startedAt)}` : f.resolvedAt ? ` · pulih ${fmtTime(f.resolvedAt, now)} (${fmtDuration(f.resolvedAt - f.startedAt)})` : ""}
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${isActive ? "border-warn/40 bg-warn/10 text-warn" : "border-ok/35 bg-ok/10 text-ok"}`}>{isActive ? "Aktif" : "Pulih"}</span>
      </header>
      <div className="grid gap-4 border-t border-line-soft px-4 py-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Nilai pemicu</p>
            <p className="mt-0.5 text-sm text-ink">{f.triggerValue}</p>
          </div>
          {f.recovery && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Pemulihan</p>
              <p className="mt-0.5 text-sm text-ok">{f.recovery}</p>
            </div>
          )}
          {times.length > 1 && (
            <LineChart
              now={now}
              height={120}
              times={times}
              max={ev.unit === "%" ? 100 : status ? 1.15 : undefined}
              threshold={status ? undefined : ev.threshold}
              thresholdLabel={ev.threshold !== undefined && !status ? (ev.unit === "%" ? `ambang ${ev.threshold}%` : `batas ${ev.threshold}`) : undefined}
              format={unitFmt}
              series={[{ name: f.rule === "wan_down" ? `${f.subject} (1 = up)` : RULE_LABEL[f.rule], color: "var(--nm-s1)", values }]}
            />
          )}
          <details>
            <summary className="cursor-pointer text-xs font-medium text-brand">Sampel pendukung ({ev.samples.length})</summary>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {ev.samples.map((s) => (
                  <tr key={s.at} className="border-b border-line-soft last:border-0">
                    <td className="py-1 pr-3 font-mono text-muted">{fmtTime(s.at, now)}</td>
                    <td className="py-1 text-right font-mono text-ink">{s.note ?? (s.value === null ? "—" : `${s.value}${ev.unit === "%" ? "%" : ` ${ev.unit}`}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Langkah pengecekan</p>
          <ol className="mt-1.5 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
            {CHECK_STEPS[f.rule].map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
    </li>
  );
}
