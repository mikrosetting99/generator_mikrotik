"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button, Note, Select } from "@/components/ui";
import { Plus, Rotate, X } from "@/components/icons";
import { fmtAgo, fmtDuration, fmtTime, Skeleton, StatusBadge, StatusIcon, STATUS_TONE, Tabs } from "@/components/monitoring/parts";
import { DEVICE_KINDS, KIND_LABEL, RULE_LABEL, STATUS_LABEL, type DeviceKind, type DeviceStatus, type DeviceView, type FindingView } from "@/lib/nm/types";

export interface DeviceFilters {
  q: string;
  site: string;
  statuses: DeviceStatus[];
  kind: "all" | DeviceKind;
}
export const EMPTY_FILTERS: DeviceFilters = { q: "", site: "", statuses: [], kind: "all" };

const STATUSES: DeviceStatus[] = ["online", "warning", "down", "nodata"];

/** Semua filter dipakai bersamaan: pencarian, site, chip status (boleh beberapa), dan tab jenis. */
export function applyFilters(devices: DeviceView[], f: DeviceFilters, skip?: "status" | "kind"): DeviceView[] {
  const q = f.q.trim().toLowerCase();
  return devices.filter(
    (d) =>
      (!q || `${d.name} ${d.metrics.identity ?? ""}`.toLowerCase().includes(q)) &&
      (!f.site || d.site === f.site) &&
      (skip === "status" || !f.statuses.length || f.statuses.includes(d.status)) &&
      (skip === "kind" || f.kind === "all" || d.kind === f.kind),
  );
}

export function sitesOf(devices: DeviceView[]): string[] {
  return [...new Set(devices.map((d) => d.site).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function DevicesPage({
  devices,
  findings,
  loading,
  error,
  filters,
  setFilters,
  now,
  onOpen,
  onAdd,
  onRetry,
  onDemo,
  onAllFindings,
  demo,
}: {
  devices: DeviceView[] | null;
  findings: FindingView[];
  loading: boolean;
  error: string;
  filters: DeviceFilters;
  setFilters: Dispatch<SetStateAction<DeviceFilters>>;
  now: number;
  onOpen: (id: string, tab?: "ringkasan" | "analisa") => void;
  onAdd: () => void;
  onRetry: () => void;
  onDemo: () => void;
  onAllFindings: () => void;
  demo: boolean;
}) {
  const list = devices ?? [];
  const sites = sitesOf(list);
  const shown = applyFilters(list, filters);
  // Hitungan chip mengikuti filter lain (bukan chip status itu sendiri), begitu pula tab jenis.
  const forStatus = applyFilters(list, filters, "status");
  const forKind = applyFilters(list, filters, "kind");
  const visibleIds = new Set(applyFilters(list, { ...filters, statuses: [] }).map((d) => d.id));
  const incidents = findings.filter((f) => f.status === "active" && visibleIds.has(f.deviceId));
  const filtered = filters.q || filters.site || filters.statuses.length || filters.kind !== "all";
  const toggle = (s: DeviceStatus) => setFilters((p) => ({ ...p, statuses: p.statuses.includes(s) ? p.statuses.filter((x) => x !== s) : [...p.statuses, s] }));

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Tambah Perangkat
        </Button>
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <input
            type="search"
            value={filters.q}
            onChange={(e) => {
              const q = e.target.value;
              setFilters((p) => ({ ...p, q }));
            }}
            placeholder="Cari nama perangkat…"
            aria-label="Cari nama perangkat"
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand sm:h-10"
          />
        </div>
        <span className="w-full sm:w-52">
          <Select value={filters.site} onChange={(v) => setFilters((p) => ({ ...p, site: v }))} placeholder="Semua site" options={sites.map((s) => ({ value: s, label: s }))} aria-label="Filter site" />
        </span>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters((p) => ({ ...p, q: "", site: "", statuses: [], kind: "all" }))}>
            <X className="h-3.5 w-3.5" />
            Hapus filter
          </Button>
        )}
      </div>

      {/* chip status (disembunyikan selama data belum pernah berhasil dimuat) */}
      <div className={`flex flex-wrap gap-2 ${devices ? "" : "hidden"}`} role="group" aria-label="Filter status">
        {STATUSES.map((s) => {
          const on = filters.statuses.includes(s);
          const t = STATUS_TONE[s];
          const n = forStatus.filter((d) => d.status === s).length;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${on ? `${t.border} ${t.bg} ${t.text}` : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink"}`}
            >
              <span className={t.text}>
                <StatusIcon status={s} className="h-3.5 w-3.5" />
              </span>
              {STATUS_LABEL[s]}
              <span className={`rounded-full px-1.5 font-mono text-[11px] ${on ? "bg-surface/60" : "bg-raised"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <Note tone="bad">
          Gagal memuat perangkat: {error}{" "}
          <button type="button" onClick={onRetry} className="font-medium underline">
            Coba lagi
          </button>
        </Note>
      )}

      {/* gangguan aktif */}
      {incidents.length > 0 && (
        <section aria-label="Gangguan aktif" className="overflow-hidden rounded-md border border-bad/30 bg-surface">
          <header className="flex items-center justify-between gap-2 border-b border-bad/20 bg-bad/[0.06] px-4 py-2">
            <h2 className="text-sm font-semibold text-bad">Gangguan aktif · {incidents.length}</h2>
            {incidents.length > 5 && (
              <button type="button" onClick={onAllFindings} className="text-xs font-medium text-brand hover:underline">
                Lihat semua
              </button>
            )}
          </header>
          <ul className="divide-y divide-line-soft">
            {incidents.slice(0, 5).map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => onOpen(f.deviceId, "analisa")} className="grid w-full gap-x-4 gap-y-0.5 px-4 py-2.5 text-left hover:bg-raised sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{f.summary}</span>
                    <span className="block truncate text-xs text-muted">
                      {RULE_LABEL[f.rule]}
                      {f.subject && f.rule === "wan_down" ? ` · ${f.subject}` : ""}
                    </span>
                  </span>
                  <span className="min-w-0 truncate text-xs text-muted sm:self-center">
                    <span className="font-medium text-ink">{f.deviceName}</span>
                    {f.site ? ` · ${f.site}` : ""}
                  </span>
                  <span className="text-xs text-muted sm:self-center sm:text-right">
                    mulai {fmtTime(f.startedAt, now)} · {fmtDuration(now - f.startedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* tab jenis */}
      {devices && (
        <Tabs
          label="Jenis perangkat"
          value={filters.kind}
          onChange={(k) => setFilters((p) => ({ ...p, kind: k }))}
          items={[{ id: "all" as const, label: "Semua", count: forKind.length }, ...DEVICE_KINDS.map((k) => ({ id: k.id, label: k.label, count: forKind.filter((d) => d.kind === k.id).length }))]}
        />
      )}

      {loading && !devices ? (
        <div className="space-y-2" aria-busy="true" aria-label="Memuat perangkat">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : devices && list.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">Belum ada perangkat dipantau</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Tambahkan MikroTik dengan user read-only. Collector memeriksanya tiap menit dan menyimpan hasilnya di sini.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={onAdd}>
              <Plus className="h-4 w-4" />
              Tambah Perangkat
            </Button>
            {!demo && (
              <Button onClick={onDemo} title="Data simulasi, ditandai jelas sebagai demo">
                Lihat mode demo
              </Button>
            )}
          </div>
        </div>
      ) : shown.length === 0 && devices ? (
        <div className="rounded-md border border-dashed border-line px-6 py-10 text-center text-sm text-muted">
          Tidak ada perangkat yang cocok dengan filter.{" "}
          <button type="button" onClick={() => setFilters((p) => ({ ...p, q: "", site: "", statuses: [], kind: "all" }))} className="font-medium text-brand underline">
            Hapus filter
          </button>
        </div>
      ) : devices ? (
        <>
          {/* List View (desktop) */}
          <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-raised/60 text-[11px] uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Perangkat</th>
                  <th className="px-3 py-2.5 font-semibold">Site</th>
                  <th className="px-3 py-2.5 font-semibold">Jenis</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Indikator Utama</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cek Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id} className="border-b border-line-soft last:border-0 hover:bg-brand/[0.04]">
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => onOpen(d.id)} className="text-left font-medium text-brand hover:underline">
                        {d.name}
                      </button>
                      <span className="block font-mono text-[11px] text-faint">{d.host || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{d.site || "—"}</td>
                    <td className="px-3 py-2.5 text-muted">{KIND_LABEL[d.kind]}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={d.status} title={d.statusReason} />
                    </td>
                    <td className={`max-w-[340px] truncate px-3 py-2.5 ${d.status === "nodata" ? "text-faint" : d.activeFindings ? "text-warn" : "text-ink"}`} title={d.statusReason}>
                      {d.indicator}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs text-muted" title={d.lastCheckAt ? fmtTime(d.lastCheckAt, now) : undefined}>
                      {fmtAgo(d.lastCheckAt, now)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* kartu ringkas (HP) */}
          <ul className="space-y-2 md:hidden">
            {shown.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => onOpen(d.id)} className="w-full rounded-md border border-line bg-surface p-3 text-left active:bg-raised">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-brand">{d.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {KIND_LABEL[d.kind]}
                        {d.site ? ` · ${d.site}` : ""}
                      </span>
                    </span>
                    <StatusBadge status={d.status} />
                  </span>
                  <span className={`mt-2 block truncate text-xs ${d.status === "nodata" ? "text-faint" : d.activeFindings ? "text-warn" : "text-ink"}`}>{d.indicator}</span>
                  <span className="mt-1 block text-[11px] text-faint">Cek terakhir: {fmtAgo(d.lastCheckAt, now)}</span>
                </button>
              </li>
            ))}
          </ul>
          {loading && (
            <p className="flex items-center gap-1.5 text-xs text-faint">
              <Rotate className="h-3 w-3 animate-spin" />
              Memperbarui…
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
