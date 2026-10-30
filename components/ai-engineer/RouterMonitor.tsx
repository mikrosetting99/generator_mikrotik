"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui";
import type { MonitorSnapshot } from "@/lib/routeros-api";

/** Status koneksi sebuah router tersimpan (tersambung atau tidak). */
export interface RouterStatusItem {
  id: string;
  name: string;
  host: string;
  state: "online" | "offline" | "auth" | "timeout" | "blocked" | "checking";
  message: string;
  latencyMs: number;
  checkedAt: number;
}

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
const CONCURRENCY = 4;
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

const STATE_LABEL: Record<RouterStatusItem["state"], string> = {
  online: "Tersambung",
  offline: "Offline",
  auth: "Login gagal",
  timeout: "Tidak merespons",
  blocked: "Alamat ditolak",
  checking: "Memeriksa…",
};

/** Baris status semua router tersimpan: tersambung/offline, waktu respons, dan alasan bila gagal. */
function StatusStrip({ items, onCheck, checking }: { items: RouterStatusItem[]; onCheck: () => void; checking: boolean }) {
  const online = items.filter((i) => i.state === "online").length;
  return (
    <div className="space-y-2 border-b border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="font-semibold text-ink">
          {online} dari {items.length} router tersambung
        </span>
        <button type="button" onClick={onCheck} disabled={checking} className="rounded-md border border-line px-2.5 py-1 font-medium text-ink hover:bg-raised disabled:opacity-50">
          {checking ? "Memeriksa…" : "Periksa sekarang"}
        </button>
        <span className="text-faint">Diperiksa otomatis tiap menit</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => {
          const ok = i.state === "online";
          const wait = i.state === "checking";
          return (
            <div
              key={i.id}
              title={i.message || i.host}
              className={`flex min-w-[170px] items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${ok ? "border-ok/40 bg-ok/10" : wait ? "border-line bg-raised" : "border-bad/40 bg-bad/10"}`}
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${ok ? "bg-ok" : wait ? "animate-pulse bg-faint" : "bg-bad"}`} />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{i.name}</span>
                <span className={`block truncate ${ok ? "text-ok" : wait ? "text-muted" : "text-bad"}`}>
                  {STATE_LABEL[i.state]}
                  {ok && i.latencyMs > 0 ? ` · ${i.latencyMs} ms` : ""}
                  {!ok && !wait && i.message ? ` · ${i.message}` : ""}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RouterMonitor({
  targets,
  statusList,
  onCheck,
  checking,
}: {
  targets: MonitorTarget[];
  statusList: RouterStatusItem[];
  onCheck: () => void;
  checking: boolean;
}) {
  const [state, setState] = useState<Record<string, RouterState>>({});
  const [every, setEvery] = useState("5");
  const [paused, setPaused] = useState(false);
  /** Router yang dibuka rinciannya; kosong = ringkasan semua router. */
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "problem">("all");
  const [query, setQuery] = useState("");
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const busy = useRef(false);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const queue = [...targetsRef.current];
      const one = async (t: MonitorTarget) => {
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
      };
      // Beberapa router dibaca bersamaan (maks. CONCURRENCY) supaya puluhan router tetap cepat.
      const worker = async () => {
        for (let t = queue.shift(); t; t = queue.shift()) await one(t);
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {statusList.length > 0 && <StatusStrip items={statusList} onCheck={onCheck} checking={checking} />}
        <div className="m-auto max-w-md space-y-2 px-4 py-12">
          <p className="text-base font-semibold text-ink">{statusList.length ? "Tidak ada router yang tersambung" : "Belum ada Mikrotik"}</p>
          <p className="text-sm leading-relaxed text-muted">
            {statusList.length
              ? "Periksa alamat, port, dan service API router yang offline, lalu tekan Periksa sekarang."
              : "Buka tab Mikrotik di menu atas dan tekan Tambah Mikrotik. Router yang tersambung otomatis dipantau di sini."}
          </p>
        </div>
      </div>
    );
  }

  const detail = targets.find((t) => t.id === selected) ?? null;
  
  const q = query.trim().toLowerCase();
  const rows = statusList.map((item) => {
    const st = state[item.id];
    const s = st?.snap ?? null;
    const live = item.state === "online";
    const rx = s ? s.interfaces.filter((i) => i.running).reduce((n, i) => n + i.rxBps, 0) : 0;
    const tx = s ? s.interfaces.filter((i) => i.running).reduce((n, i) => n + i.txBps, 0) : 0;
    const mem = s && s.totalMemory ? ((s.totalMemory - s.freeMemory) / s.totalMemory) * 100 : 0;
    return { item, st, s, live, rx, tx, mem, cpu: s?.cpuLoad ?? 0 };
  });
  const shown = rows.filter((r) => {
    if (filter === "online" && !r.live) return false;
    if (filter === "problem" && (r.live && r.cpu < 85 && r.mem < 90)) return false;
    return !q || `${r.item.name} ${r.item.host} ${r.s?.identity ?? ""}`.toLowerCase().includes(q);
  });
  const onlineN = rows.filter((r) => r.live).length;
  const offlineN = rows.filter((r) => !r.live && r.item.state !== "checking").length;
  const totalRx = rows.reduce((n, r) => n + r.rx, 0);
  const totalTx = rows.reduce((n, r) => n + r.tx, 0);
  const hottest = rows.filter((r) => r.live && r.s).sort((x, y) => y.cpu - x.cpu)[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${paused ? "bg-faint" : "animate-pulse bg-ok"}`} />
          {paused ? "Dijeda" : "Langsung"} · {targets.length} router dipantau
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
        <button type="button" onClick={onCheck} disabled={checking} className="rounded-md border border-line px-2.5 py-1 font-medium text-ink hover:bg-raised disabled:opacity-50">
          {checking ? "Memeriksa…" : "Periksa status"}
        </button>
      </div>

      {!detail ? (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Tersambung" value={`${onlineN} / ${rows.length}`} sub={offlineN ? `${offlineN} router offline` : "Semua router normal"} />
            <Stat label="Trafik total" value={fmtBps(totalRx + totalTx)} sub={`↓ ${fmtBps(totalRx)} · ↑ ${fmtBps(totalTx)}`} />
            <Stat label="CPU tertinggi" value={hottest ? `${hottest.cpu}%` : "-"} sub={hottest?.item.name ?? "Belum ada data"} pct={hottest?.cpu ?? 0} />
            <Stat label="Perlu perhatian" value={String(offlineN + rows.filter((r) => r.live && (r.cpu >= 85 || r.mem >= 90)).length)} sub="offline, CPU ≥ 85%, atau memori ≥ 90%" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Filter router" className="inline-flex overflow-hidden rounded-md border border-line text-xs font-medium">
              {(
                [
                  ["all", `Semua (${rows.length})`],
                  ["online", `Tersambung (${onlineN})`],
                  ["problem", "Bermasalah"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={`min-h-8 px-3 ${filter === id ? "bg-brand text-brand-ink" : "bg-surface text-muted hover:bg-raised hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {rows.length > 6 && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, host, atau identity…"
                aria-label="Cari router"
                className="min-h-8 w-64 max-w-full rounded-md border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-brand"
              />
            )}
          </div>

          {shown.length === 0 ? (
            <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-sm text-muted">Tidak ada router yang cocok dengan filter.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {shown.map(({ item, st, s, live, rx, tx, mem, cpu }) => {
                const wait = item.state === "checking";
                const canOpen = live && targets.some((t) => t.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!canOpen}
                    onClick={() => setSelected(item.id)}
                    title={canOpen ? "Buka rincian" : item.message || item.host}
                    className={`flex flex-col justify-start rounded-[10px] border bg-surface p-3 text-left shadow-sm transition-colors ${canOpen ? "hover:border-brand" : "cursor-default"} ${live ? "border-line" : wait ? "border-line" : "border-bad/40"}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${live ? "bg-ok" : wait ? "animate-pulse bg-faint" : "bg-bad"}`} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span className={`shrink-0 text-[11px] font-medium ${live ? "text-ok" : wait ? "text-muted" : "text-bad"}`}>
                        {STATE_LABEL[item.state]}
                        {live && item.latencyMs > 0 ? ` · ${item.latencyMs} ms` : ""}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
                      {s ? `${s.identity} · RouterOS ${s.version} · up ${s.uptime}` : item.host}
                    </span>
                    {live && s ? (
                      <span className="mt-2.5 block space-y-1.5">
                        <span className="block">
                          <span className="flex justify-between text-[11px] text-muted"><span>CPU</span><span className="font-medium text-ink">{cpu}%</span></span>
                          <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, cpu)}%`, background: pctColor(cpu) }} /></span>
                        </span>
                        <span className="block">
                          <span className="flex justify-between text-[11px] text-muted"><span>Memori</span><span className="font-medium text-ink">{Math.round(mem)}%</span></span>
                          <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-raised"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, mem)}%`, background: pctColor(mem) }} /></span>
                        </span>
                        <span className="flex justify-between pt-0.5 font-mono text-[11px] text-ink">
                          <span>↓ {fmtBps(rx)}</span>
                          <span>↑ {fmtBps(tx)}</span>
                        </span>
                        <Spark values={st?.history.map((h) => h.cpu) ?? []} max={100} color={pctColor(cpu)} height={26} />
                      </span>
                    ) : (
                      <span className="mt-2.5 block text-xs text-bad">{wait ? <span className="text-muted">Memeriksa…</span> : item.message || "Tidak tersambung."}</span>
                    )}
                    {st?.error && live && <span className="mt-1 block text-[11px] text-bad">{st.error}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2 text-xs">
            <button type="button" onClick={() => setSelected("")} className="rounded-md border border-line px-2.5 py-1 font-medium text-ink hover:bg-raised">
              ← Semua router
            </button>
            <label className="flex items-center gap-1.5 text-muted">
              Router
              <span className="w-52">
                <Select value={detail.id} placeholder="" onChange={setSelected} options={targets.map((t) => ({ value: t.id, label: t.name }))} className="!h-8 !text-xs" />
              </span>
            </label>
          </div>
      <div className="p-4">
        {[detail].map((t) => {
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
        </>
      )}
    </div>
  );
}
