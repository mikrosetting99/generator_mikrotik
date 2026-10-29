"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui";
import type { MonitorSnapshot } from "@/lib/routeros-api";

/** Router yang sedang tersambung dan siap dipantau. */
export interface MonitorTarget {
  id: string;
  name: string;
  /** Isi permintaan ke /api/ai/router (host, port, tls, username, password). */
  body: Record<string, unknown>;
}

interface Point {
  t: number;
  cpu: number;
  mem: number;
  /** nama interface → [rx, tx] bit per detik */
  traffic: Record<string, [number, number]>;
}

interface RouterState {
  snap: MonitorSnapshot | null;
  history: Point[];
  error: string;
  /** interface yang grafiknya ditampilkan; kosong = yang paling sibuk */
  iface: string;
}

const MAX_POINTS = 90;
const INTERVALS = [
  { value: "3", label: "3 detik" },
  { value: "5", label: "5 detik" },
  { value: "10", label: "10 detik" },
  { value: "30", label: "30 detik" },
];

/* --------------------------------------------------------------- pemformat */

export function fmtBps(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} Gbps`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} Mbps`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} Kbps`;
  return `${Math.round(n)} bps`;
}

export function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GiB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KiB`;
  return `${n} B`;
}

const pctColor = (p: number) => (p >= 85 ? "var(--color-bad)" : p >= 65 ? "var(--color-warn)" : "var(--color-brand)");

/* -------------------------------------------------------------- grafik SVG */

function Spark({ values, max, color, height = 34 }: { values: number[]; max?: number; color: string; height?: number }) {
  const w = 160;
  if (values.length < 2) return <svg viewBox={`0 0 ${w} ${height}`} className="h-[34px] w-full" aria-hidden />;
  const top = max ?? Math.max(...values, 1);
  // Minimal 30 slot supaya beberapa titik pertama tidak menumpuk di tepi kanan.
  const step = w / (Math.max(values.length, 30) - 1);
  const x0 = w - (values.length - 1) * step;
  const pts = values.map((v, i) => `${(x0 + i * step).toFixed(1)},${(height - 2 - (Math.min(v, top) / top) * (height - 4)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <polygon points={`${x0.toFixed(1)},${height} ${pts.join(" ")} ${w},${height}`} fill={color} opacity={0.14} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TrafficChart({ rx, tx }: { rx: number[]; tx: number[] }) {
  const w = 600;
  const h = 150;
  const top = Math.max(...rx, ...tx, 1000) * 1.15;
  const step = w / (Math.max(rx.length, 30) - 1);
  const line = (vals: number[]) => {
    const x0 = w - (vals.length - 1) * step;
    return { x0, pts: vals.map((v, i) => `${(x0 + i * step).toFixed(1)},${(h - 4 - (v / top) * (h - 8)).toFixed(1)}`) };
  };
  const a = line(rx);
  const b = line(tx);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[150px] w-full rounded-md border border-line bg-surface" aria-hidden>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1={0} x2={w} y1={h * g} y2={h * g} stroke="var(--color-line-soft)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {rx.length > 1 && (
          <>
            <polygon points={`${a.x0.toFixed(1)},${h} ${a.pts.join(" ")} ${w},${h}`} fill="var(--color-brand)" opacity={0.12} />
            <polyline points={a.pts.join(" ")} fill="none" stroke="var(--color-brand)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
            <polyline points={b.pts.join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <span className="pointer-events-none absolute left-2 top-1 font-mono text-[10px] text-faint">{fmtBps(top)}</span>
    </div>
  );
}

function Stat({ label, value, sub, pct, spark }: { label: string; value: string; sub?: string; pct?: number; spark?: number[] }) {
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-none text-ink">{value}</p>
      {sub && <p className="mt-1 truncate text-[11px] text-faint">{sub}</p>}
      {pct !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: pctColor(pct) }} />
        </div>
      )}
      {spark && <div className="mt-1.5"><Spark values={spark} max={100} color={pctColor(pct ?? 0)} /></div>}
    </div>
  );
}

/* ----------------------------------------------------------------- komponen */

export function RouterMonitor({ targets }: { targets: MonitorTarget[] }) {
  const [state, setState] = useState<Record<string, RouterState>>({});
  const [every, setEvery] = useState("5");
  const [paused, setPaused] = useState(false);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const busy = useRef(false);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (const t of targetsRef.current) {
        try {
          const res = await fetch("/api/ai/router", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "monitor", ...t.body }),
            cache: "no-store",
          });
          const data = (await res.json().catch(() => ({}))) as { snapshot?: MonitorSnapshot; error?: string };
          setState((prev) => {
            const cur = prev[t.id] ?? { snap: null, history: [], error: "", iface: "" };
            if (!res.ok || !data.snapshot) return { ...prev, [t.id]: { ...cur, error: data.error ?? "Gagal membaca router." } };
            const s = data.snapshot;
            const traffic: Point["traffic"] = {};
            for (const i of s.interfaces) if (i.running) traffic[i.name] = [i.rxBps, i.txBps];
            const point: Point = { t: s.at, cpu: s.cpuLoad, mem: s.totalMemory ? ((s.totalMemory - s.freeMemory) / s.totalMemory) * 100 : 0, traffic };
            return { ...prev, [t.id]: { ...cur, snap: s, error: "", history: [...cur.history, point].slice(-MAX_POINTS) } };
          });
        } catch {
          setState((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] ?? { snap: null, history: [], iface: "" }), error: "Gagal menghubungi server." } }));
        }
      }
    } finally {
      busy.current = false;
    }
  }, []);

  const ids = targets.map((t) => t.id).join(",");
  useEffect(() => {
    if (paused || !ids) return;
    void poll();
    const timer = window.setInterval(() => {
      if (!document.hidden) void poll();
    }, Number(every) * 1000);
    return () => window.clearInterval(timer);
  }, [paused, every, ids, poll]);

  if (targets.length === 0) {
    return (
      <div className="m-auto max-w-md space-y-2 px-4 py-12 text-center">
        <p className="text-base font-semibold text-ink">Belum ada router tersambung</p>
        <p className="text-sm leading-relaxed text-muted">Buka Pengaturan &gt; Router, tambahkan Mikrotik lalu tekan Hubungkan. Router yang tersambung otomatis dipantau di sini.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-faint" : "animate-pulse bg-ok"}`} />
          {paused ? "Dijeda" : "Langsung"} · {targets.length} router
        </span>
        <label className="flex items-center gap-1.5">
          Perbarui tiap
          <span className="w-28">
            <Select value={every} placeholder="" onChange={setEvery} options={INTERVALS} className="!h-8 !text-xs" />
          </span>
        </label>
        <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-md border border-line px-2.5 py-1 font-medium text-ink hover:bg-raised">
          {paused ? "Lanjutkan" : "Jeda"}
        </button>
      </div>

      <div className="grid gap-4 p-4 2xl:grid-cols-2">
        {targets.map((t) => {
          const st = state[t.id];
          const s = st?.snap;
          const live = s?.interfaces.filter((i) => i.running && !i.disabled) ?? [];
          const busiest = [...live].sort((a, b) => b.rxBps + b.txBps - (a.rxBps + a.txBps))[0]?.name ?? "";
          const chosen = st?.iface && live.some((i) => i.name === st.iface) ? st.iface : busiest;
          const rx = st?.history.map((p) => p.traffic[chosen]?.[0] ?? 0) ?? [];
          const tx = st?.history.map((p) => p.traffic[chosen]?.[1] ?? 0) ?? [];
          const cur = live.find((i) => i.name === chosen);
          const memUsed = s ? s.totalMemory - s.freeMemory : 0;
          const diskUsed = s ? s.totalHdd - s.freeHdd : 0;
          const counts = s?.counts ?? {};
          return (
            <section key={t.id} className="overflow-hidden rounded-[10px] border border-line bg-surface shadow-sm">
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-raised px-4 py-2.5">
                <h3 className="text-[15px] font-semibold text-ink">{t.name}</h3>
                {s && (
                  <span className="font-mono text-xs text-muted">
                    {s.identity} · RouterOS {s.version} · {s.board} · up {s.uptime}
                  </span>
                )}
                {st?.error && <span className="rounded-full bg-bad/10 px-2 py-0.5 text-[11px] font-medium text-bad">{st.error}</span>}
                {s && <span className="ml-auto text-[11px] text-faint">{new Date(s.at).toLocaleTimeString("id-ID")}</span>}
              </header>

              {!s ? (
                <p className="px-4 py-8 text-center text-sm text-muted">{st?.error ? "Gagal membaca data." : "Membaca data router…"}</p>
              ) : (
                <div className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    <Stat label="CPU" value={`${s.cpuLoad}%`} sub={`${s.cpuCount} core`} pct={s.cpuLoad} spark={st?.history.map((p) => p.cpu)} />
                    <Stat
                      label="Memori"
                      value={s.totalMemory ? `${Math.round((memUsed / s.totalMemory) * 100)}%` : "-"}
                      sub={`${fmtBytes(memUsed)} / ${fmtBytes(s.totalMemory)}`}
                      pct={s.totalMemory ? (memUsed / s.totalMemory) * 100 : 0}
                      spark={st?.history.map((p) => p.mem)}
                    />
                    {s.totalHdd > 0 && (
                      <Stat label="Penyimpanan" value={`${Math.round((diskUsed / s.totalHdd) * 100)}%`} sub={`${fmtBytes(diskUsed)} / ${fmtBytes(s.totalHdd)}`} pct={(diskUsed / s.totalHdd) * 100} />
                    )}
                    {Object.entries(s.health).map(([k, v]) => (
                      <Stat key={k} label={/temp/i.test(k) ? `Suhu ${k.replace(/temperature|-?temp/i, "").trim()}`.trim() : k} value={/temp/i.test(k) ? `${v}°C` : /volt/i.test(k) ? `${v} V` : String(v)} />
                    ))}
                    {counts.hotspotActive !== undefined && <Stat label="Hotspot aktif" value={String(counts.hotspotActive)} />}
                    {counts.pppActive !== undefined && <Stat label="PPP aktif" value={String(counts.pppActive)} />}
                    {counts.dhcpLeases !== undefined && <Stat label="Lease DHCP" value={String(counts.dhcpLeases)} />}
                    {counts.connections !== undefined && <Stat label="Koneksi" value={counts.connections.toLocaleString("id-ID")} />}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">Trafik</h4>
                      {live.length > 0 && (
                        <span className="w-44">
                          <Select
                            value={chosen}
                            placeholder=""
                            onChange={(v) => setState((prev) => ({ ...prev, [t.id]: { ...prev[t.id], iface: v } }))}
                            options={live.map((i) => ({ value: i.name, label: i.name }))}
                            className="!h-8 !text-xs"
                          />
                        </span>
                      )}
                      <span className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-ink">
                          <span className="h-2 w-2 rounded-full bg-brand" />
                          Unduh {fmtBps(cur?.rxBps ?? 0)}
                        </span>
                        <span className="flex items-center gap-1 text-ink">
                          <span className="h-2 w-2 rounded-full bg-accent" />
                          Unggah {fmtBps(cur?.txBps ?? 0)}
                        </span>
                      </span>
                    </div>
                    <TrafficChart rx={rx} tx={tx} />
                  </div>

                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-line bg-raised text-[11px] uppercase tracking-[0.08em] text-muted">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Interface</th>
                          <th className="px-3 py-2 font-semibold">Tipe</th>
                          <th className="px-3 py-2 text-right font-semibold">Rx</th>
                          <th className="px-3 py-2 text-right font-semibold">Tx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.interfaces.map((i) => (
                          <tr key={i.name} className="border-b border-line-soft last:border-0">
                            <td className="px-3 py-1.5 font-mono text-[13px] text-ink">
                              <span className={`mr-2 inline-block h-2 w-2 rounded-full ${i.disabled ? "bg-faint" : i.running ? "bg-ok" : "bg-bad"}`} />
                              {i.name}
                            </td>
                            <td className="px-3 py-1.5 text-muted">{i.type}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-[13px] text-ink">{i.running ? fmtBps(i.rxBps) : "-"}</td>
                            <td className="px-3 py-1.5 text-right font-mono text-[13px] text-ink">{i.running ? fmtBps(i.txBps) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
