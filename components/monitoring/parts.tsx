"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Check, Clock } from "@/components/icons";
import { STATUS_LABEL, type DeviceStatus } from "@/lib/nm/types";

/* ---------------------------------------------------------------- format */

const clockFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Jam WIB; tanggal ikut ditulis bila bukan hari ini. */
export function fmtTime(ms: number, now: number): string {
  const sameDay = new Date(ms + 7 * 3600_000).toISOString().slice(0, 10) === new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
  return `${sameDay ? clockFmt.format(ms) : dateFmt.format(ms)} WIB`;
}

export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  if (m < 1) return "< 1 menit";
  if (m < 60) return `${m} menit`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam ${m % 60 ? `${m % 60} mnt` : ""}`.trim();
  return `${Math.floor(h / 24)} hari ${h % 24} jam`;
}

export function fmtAgo(ms: number | null, now: number): string {
  if (ms === null) return "Belum pernah";
  return `${fmtDuration(now - ms)} lalu`.replace("< 1 menit lalu", "baru saja");
}

export function fmtUptime(sec: number | null): string {
  if (sec === null) return "Tidak tersedia";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d} hari ${h} jam` : h ? `${h} jam ${m} mnt` : `${m} mnt`;
}

export function fmtBps(n: number | null): string {
  if (n === null) return "Tidak tersedia";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} Gbps`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} Mbps`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} Kbps`;
  return `${Math.round(n)} bps`;
}

export const NA = "Tidak tersedia";

/* ---------------------------------------------------------------- status */

export const STATUS_TONE: Record<DeviceStatus, { text: string; bg: string; border: string; dot: string }> = {
  online: { text: "text-ok", bg: "bg-ok/10", border: "border-ok/35", dot: "bg-ok" },
  warning: { text: "text-warn", bg: "bg-warn/10", border: "border-warn/40", dot: "bg-warn" },
  down: { text: "text-bad", bg: "bg-bad/10", border: "border-bad/40", dot: "bg-bad" },
  nodata: { text: "text-muted", bg: "bg-raised", border: "border-line", dot: "bg-faint" },
};

export function StatusIcon({ status, className = "h-3.5 w-3.5" }: { status: DeviceStatus; className?: string }) {
  if (status === "online") return <Check className={className} />;
  if (status === "warning") return <AlertTriangle className={className} />;
  if (status === "down") return <AlertCircle className={className} />;
  return <Clock className={className} />;
}

/** Status selalu dengan ikon + teks, bukan warna saja. */
export function StatusBadge({ status, title }: { status: DeviceStatus; title?: string }) {
  const t = STATUS_TONE[status];
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${t.border} ${t.bg} ${t.text}`}>
      <StatusIcon status={status} className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Tabs<T extends string>({ items, value, onChange, label }: { items: Array<{ id: T; label: ReactNode; count?: number }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mb-px flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`min-h-10 shrink-0 border-b-2 px-3 text-sm transition-colors ${value === it.id ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-ink"}`}
        >
          {it.label}
          {it.count !== undefined && <span className="ml-1.5 rounded-full bg-raised px-1.5 py-px text-[11px] font-normal text-muted">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded bg-raised ${className}`} />;
}

/* ------------------------------------------------------------------ grafik */

export interface ChartSeries {
  name: string;
  color: string;
  values: Array<number | null>;
}

/**
 * Grafik garis satu sumbu dengan celah untuk nilai kosong (bukan garis menyambung ke nol),
 * garis ambang opsional, dan tooltip saat kursor bergerak di atas grafik.
 */
export function LineChart({
  times,
  series,
  format,
  max,
  threshold,
  thresholdLabel,
  height = 150,
  now,
}: {
  times: number[];
  series: ChartSeries[];
  format: (v: number) => string;
  max?: number;
  threshold?: number;
  thresholdLabel?: string;
  height?: number;
  now: number;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 4, r: 4, t: 10, b: 18 };
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId();
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (times.length < 2 || !all.length) {
    return <div className="grid h-[120px] place-items-center rounded-md border border-dashed border-line text-xs text-muted">{NA}: belum ada cukup sampel untuk grafik.</div>;
  }
  const top = max ?? Math.max(...all, threshold ?? 0, 1) * 1.15;
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const x = (t: number) => pad.l + ((t - t0) / Math.max(t1 - t0, 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - Math.min(v, top) / top) * (H - pad.t - pad.b);
  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tx = t0 + ((e.clientX - rect.left) / rect.width) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - tx) < Math.abs(times[best] - tx)) best = i;
    setHover(best);
  };
  const hx = hover !== null ? x(times[hover]) : 0;

  return (
    <div className="relative">
      {series.length > 1 && (
        <div className="mb-1.5 flex flex-wrap gap-3 text-[11px] text-muted">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full touch-none" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={series.map((s) => s.name).join(", ")}>
        <defs>
          <clipPath id={clip}>
            <rect x={0} y={0} width={W} height={H - pad.b} />
          </clipPath>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={0} x2={W} y1={y(top * g)} y2={y(top * g)} stroke="var(--color-line-soft)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {threshold !== undefined && (
          <line x1={0} x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--color-bad)" strokeWidth={1} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        )}
        <g clipPath={`url(#${clip})`}>
          {paths.map((d, i) => (
            <path key={series[i].name} d={d} fill="none" stroke={series[i].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        {hover !== null && <line x1={hx} x2={hx} y1={pad.t} y2={H - pad.b} stroke="var(--color-faint)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className="pointer-events-none absolute left-1 top-0 font-mono text-[10px] text-faint" style={{ top: series.length > 1 ? 22 : 0 }}>
        {format(top)}
      </span>
      {threshold !== undefined && thresholdLabel && (
        <span className="pointer-events-none absolute right-1 font-mono text-[10px] text-bad" style={{ top: y(threshold) + (series.length > 1 ? 22 : 0) + 2 }}>
          {thresholdLabel}
        </span>
      )}
      <div className="mt-0.5 flex justify-between font-mono text-[10px] text-faint">
        <span>{fmtTime(t0, now)}</span>
        <span>{fmtTime(t1, now)}</span>
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, (hx / W) * 100))}%`, top: series.length > 1 ? 26 : 4 }}
        >
          <p className="font-medium text-ink">{fmtTime(times[hover], now)}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
              <span className="font-mono text-ink">{s.values[hover] === null ? "—" : format(s.values[hover] as number)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
