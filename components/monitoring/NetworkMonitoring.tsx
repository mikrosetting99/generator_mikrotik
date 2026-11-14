"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Note, Toggle } from "@/components/ui";
import { DeviceDetail, type DetailTab } from "@/components/monitoring/DeviceDetail";
import { DeviceForm, READONLY_SCRIPT, type SavedRouterOption } from "@/components/monitoring/DeviceForm";
import { DevicesPage, EMPTY_FILTERS, sitesOf, type DeviceFilters } from "@/components/monitoring/DevicesPage";
import { fmtAgo, fmtDuration, fmtTime, StatusIcon, STATUS_TONE, Tabs } from "@/components/monitoring/parts";
import type { DemoData } from "@/lib/nm/demo";
import { DEFAULT_RULES, RULE_LABEL, STATUS_LABEL, type DeviceDetailView, type DevicesResponse, type DeviceStatus, type FindingView } from "@/lib/nm/types";

export type NmPage = "ringkasan" | "perangkat" | "gangguan" | "konfigurasi" | "langsung";
const PAGES: Array<{ id: NmPage; label: string }> = [
  { id: "ringkasan", label: "Ringkasan" },
  { id: "perangkat", label: "Perangkat" },
  { id: "gangguan", label: "Gangguan" },
  { id: "konfigurasi", label: "Konfigurasi" },
];
const REFRESH_MS = 30_000;
/** Data di layar dianggap basi bila gagal dimuat ulang selama ini. */
const CLIENT_STALE_MS = 2 * 60_000;

/** "#nm/perangkat/<id>/analisa" atau "#nm-demo/…" ⇄ state. */
function parseHash(h: string): { page: NmPage; id: string | null; tab: DetailTab; demo: boolean } | null {
  const parts = h.replace(/^#/, "").split("/");
  if (parts[0] !== "nm" && parts[0] !== "nm-demo") return null;
  const page = (["ringkasan", "perangkat", "gangguan", "konfigurasi", "langsung"] as const).find((p) => p === parts[1]) ?? "perangkat";
  const tab = (["ringkasan", "analisa", "pengaturan"] as const).find((t) => t === parts[3]) ?? "ringkasan";
  return { page, id: parts[2] ? decodeURIComponent(parts[2]) : null, tab, demo: parts[0] === "nm-demo" };
}

export function NetworkMonitoring({ routers, live }: { routers: SavedRouterOption[]; live: ReactNode }) {
  const [page, setPage] = useState<NmPage>("perangkat");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("ringkasan");
  const [demo, setDemo] = useState(false);
  const [hashReady, setHashReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filters, setFilters] = useState<DeviceFilters>(EMPTY_FILTERS);
  const [adding, setAdding] = useState(false);

  const [list, setList] = useState<DevicesResponse | null>(null);
  const [listState, setListState] = useState({ loading: true, error: "", okAt: 0 });
  const [detail, setDetail] = useState<DeviceDetailView | null>(null);
  const [detailState, setDetailState] = useState({ loading: false, error: "" });
  const [history, setHistory] = useState<FindingView[] | null>(null);
  const [historyState, setHistoryState] = useState({ loading: false, error: "" });
  const demoRef = useRef<DemoData | null>(null);

  useEffect(() => {
    const p = parseHash(window.location.hash);
    if (p) {
      setPage(p.page);
      setDeviceId(p.id);
      setTab(p.tab);
      setDemo(p.demo);
    }
    setHashReady(true);
  }, []);
  useEffect(() => {
    if (!hashReady) return;
    const h = `#${demo ? "nm-demo" : "nm"}/${page}${deviceId && page === "perangkat" ? `/${encodeURIComponent(deviceId)}/${tab}` : ""}`;
    if (window.location.hash !== h) window.history.replaceState(null, "", h);
  }, [page, deviceId, tab, demo, hashReady]);

  const getDemo = useCallback(async (fresh = false) => {
    if (!demoRef.current || fresh) {
      const { buildDemo } = await import("@/lib/nm/demo");
      demoRef.current = await buildDemo(Date.now());
    }
    return demoRef.current;
  }, []);

  const loadList = useCallback(async () => {
    setListState((s) => ({ ...s, loading: true }));
    try {
      if (demo) {
        const d = await getDemo(true);
        setList(d.list);
      } else {
        const res = await fetch("/api/nm/devices", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as DevicesResponse & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setList(data);
      }
      setListState({ loading: false, error: "", okAt: Date.now() });
    } catch (e) {
      setListState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Gagal memuat." }));
    }
  }, [demo, getDemo]);

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailState((s) => ({ ...s, loading: true }));
      try {
        if (demo) {
          const d = (await getDemo()).details[id];
          if (!d) throw new Error("Perangkat demo tidak ditemukan.");
          setDetail(d);
        } else {
          const res = await fetch(`/api/nm/devices/${encodeURIComponent(id)}?hours=3`, { cache: "no-store" });
          const data = (await res.json().catch(() => ({}))) as DeviceDetailView & { error?: string };
          if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
          setDetail(data);
        }
        setDetailState({ loading: false, error: "" });
      } catch (e) {
        setDetailState({ loading: false, error: e instanceof Error ? e.message : "Gagal memuat." });
      }
    },
    [demo, getDemo],
  );

  const loadHistory = useCallback(async () => {
    setHistoryState({ loading: true, error: "" });
    try {
      if (demo) setHistory((await getDemo()).findings);
      else {
        const res = await fetch("/api/nm/findings?status=all", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { findings?: FindingView[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setHistory(data.findings ?? []);
      }
      setHistoryState({ loading: false, error: "" });
    } catch (e) {
      setHistoryState({ loading: false, error: e instanceof Error ? e.message : "Gagal memuat." });
    }
  }, [demo, getDemo]);

  // Muat ulang berkala (hanya membaca hasil tersimpan; tidak menghubungi perangkat).
  useEffect(() => {
    if (!hashReady) return;
    setList(null);
    setDetail(null);
    setHistory(null);
    demoRef.current = null;
    void loadList();
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (!document.hidden) void loadList();
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [hashReady, loadList]);

  useEffect(() => {
    if (!hashReady || page !== "perangkat" || !deviceId) return;
    setDetail((d) => (d?.device.id === deviceId ? d : null));
    void loadDetail(deviceId);
    const t = window.setInterval(() => {
      if (!document.hidden) void loadDetail(deviceId);
    }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [hashReady, page, deviceId, loadDetail]);

  useEffect(() => {
    if (hashReady && page === "gangguan") void loadHistory();
  }, [hashReady, page, loadHistory]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);

  const open = (id: string, t: DetailTab = "ringkasan") => {
    setPage("perangkat");
    setDeviceId(id);
    setTab(t);
  };
  const go = (p: NmPage) => {
    setPage(p);
    setDeviceId(null);
  };
  const devices = list?.devices ?? null;
  const sites = sitesOf(devices ?? []);
  const activeCount = list?.findings.length ?? 0;
  const collector = list?.collector ?? null;
  const clientStale = !!listState.error && listState.okAt > 0 && now - listState.okAt > CLIENT_STALE_MS;

  return (
    <div className="nm-theme flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas">
      {/* bilah kontrol bergaya Odoo: judul/breadcrumb + menu horizontal */}
      <div className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 px-4">
          <p className="hidden py-2 text-sm font-semibold text-ink sm:block">Network Monitoring</p>
          <nav aria-label="Menu Network Monitoring" className="order-last -mb-px flex w-full min-w-0 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
            {PAGES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-current={page === p.id ? "page" : undefined}
                onClick={() => go(p.id)}
                className={`min-h-11 shrink-0 border-b-2 px-3 text-sm transition-colors ${page === p.id ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-ink"}`}
              >
                {p.label}
                {p.id === "gangguan" && activeCount > 0 && <span className="ml-1.5 rounded-full bg-bad px-1.5 py-px text-[11px] font-semibold text-white">{activeCount}</span>}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 py-1.5">
            {demo && <span className="rounded-full border border-brand/40 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">Mode demo</span>}
            <button
              type="button"
              onClick={() => go("langsung")}
              aria-current={page === "langsung" ? "page" : undefined}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${page === "langsung" ? "border-brand text-brand" : "border-line text-muted hover:text-ink"}`}
              title="Grafik langsung dari browser untuk Mikrotik di tab Mikrotik (tidak disimpan)"
            >
              Pantau langsung
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] space-y-3 p-4">
        {demo && (
          <Note>
            <b>Mode demo:</b> semua data di bawah adalah simulasi yang dijalankan lewat aturan Analisa yang sama, bukan dari perangkat Anda. Perubahan tidak disimpan.{" "}
            <button type="button" onClick={() => setDemo(false)} className="font-medium text-brand underline">
              Keluar dari mode demo
            </button>
          </Note>
        )}
        {!demo && list && page !== "langsung" && (!collector || collector.stale) && list.devices.some((d) => d.collected && d.enabled) && (
          <Note tone="warn">
            {collector
              ? `Collector berhenti mengirim data sejak ${fmtAgo(collector.lastBeatAt, now)}. Status perangkat ditandai kedaluwarsa sampai collector berjalan lagi.`
              : "Collector belum pernah berjalan, jadi belum ada data perangkat."}{" "}
            <button type="button" onClick={() => go("konfigurasi")} className="font-medium underline">
              Cara menjalankan collector
            </button>
          </Note>
        )}
        {clientStale && (
          <Note tone="warn">
            Data kedaluwarsa: gagal memuat ulang ({listState.error}). Yang tampil adalah data dari {fmtAgo(listState.okAt, now)}.
          </Note>
        )}

        {page === "perangkat" && !deviceId && (
          <DevicesPage
            devices={devices}
            findings={list?.findings ?? []}
            loading={listState.loading}
            error={list ? "" : listState.error}
            filters={filters}
            setFilters={setFilters}
            now={now}
            onOpen={open}
            onAdd={() => setAdding(true)}
            onRetry={() => void loadList()}
            onDemo={() => setDemo(true)}
            onAllFindings={() => go("gangguan")}
            demo={demo}
          />
        )}
        {page === "perangkat" && deviceId && (
          <DeviceDetail
            detail={detail?.device.id === deviceId ? detail : null}
            loading={detailState.loading}
            error={detailState.error}
            tab={tab}
            setTab={setTab}
            now={now}
            sites={sites}
            routers={routers}
            demo={demo}
            onBack={() => setDeviceId(null)}
            onSaved={() => {
              void loadDetail(deviceId);
              void loadList();
            }}
            onDeleted={() => {
              setDeviceId(null);
              void loadList();
            }}
            onRetry={() => void loadDetail(deviceId)}
          />
        )}
        {page === "ringkasan" && <OverviewPage list={list} loading={listState.loading} error={listState.error} now={now} onOpen={open} onStatus={(s) => { setFilters({ ...EMPTY_FILTERS, statuses: [s] }); go("perangkat"); }} onSite={(site) => { setFilters({ ...EMPTY_FILTERS, site }); go("perangkat"); }} onRetry={() => void loadList()} />}
        {page === "gangguan" && <FindingsPage findings={history} loading={historyState.loading} error={historyState.error} now={now} onOpen={open} onRetry={() => void loadHistory()} />}
        {page === "konfigurasi" && <ConfigPage list={list} now={now} demo={demo} setDemo={setDemo} />}
        {page === "langsung" && <div className="-m-4 flex min-h-[60vh] flex-col">{live}</div>}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Tambah Perangkat" description="Kredensial disimpan terenkripsi di server dan hanya dipakai collector." wide>
        <div className="nm-theme">
          <DeviceForm
            mode="add"
            sites={sites}
            routers={routers}
            demo={demo}
            onCancel={() => setAdding(false)}
            onSaved={(id) => {
              setAdding(false);
              void loadList();
              open(id);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------------- Ringkasan */

function OverviewPage({
  list,
  loading,
  error,
  now,
  onOpen,
  onStatus,
  onSite,
  onRetry,
}: {
  list: DevicesResponse | null;
  loading: boolean;
  error: string;
  now: number;
  onOpen: (id: string, tab?: DetailTab) => void;
  onStatus: (s: DeviceStatus) => void;
  onSite: (site: string) => void;
  onRetry: () => void;
}) {
  if (!list) {
    return error ? (
      <Note tone="bad">
        Gagal memuat ringkasan: {error}{" "}
        <button type="button" onClick={onRetry} className="font-medium underline">
          Coba lagi
        </button>
      </Note>
    ) : (
      <p className="py-10 text-center text-sm text-muted">{loading ? "Memuat ringkasan…" : ""}</p>
    );
  }
  const devices = list.devices;
  const statuses: DeviceStatus[] = ["online", "warning", "down", "nodata"];
  const bySite = [...new Set(devices.map((d) => d.site || "—"))].sort().map((site) => {
    const ds = devices.filter((d) => (d.site || "—") === site);
    return { site, total: ds.length, ...Object.fromEntries(statuses.map((s) => [s, ds.filter((d) => d.status === s).length])) } as { site: string; total: number } & Record<DeviceStatus, number>;
  });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statuses.map((s) => {
          const n = devices.filter((d) => d.status === s).length;
          const t = STATUS_TONE[s];
          return (
            <button key={s} type="button" onClick={() => onStatus(s)} className="rounded-md border border-line bg-surface px-4 py-3 text-left hover:border-brand/50">
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${t.text}`}>
                <StatusIcon status={s} />
                {STATUS_LABEL[s]}
              </span>
              <span className="mt-1 block text-2xl font-semibold text-ink">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-md border border-line bg-surface">
          <header className="border-b border-line-soft px-4 py-2.5">
            <h2 className="text-sm font-semibold text-ink">Gangguan aktif</h2>
          </header>
          {list.findings.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">{devices.length ? "Tidak ada gangguan aktif." : "Belum ada perangkat."}</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {list.findings.slice(0, 8).map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => onOpen(f.deviceId, "analisa")} className="block w-full px-4 py-2.5 text-left hover:bg-raised">
                    <span className="block text-sm font-medium text-ink">{f.summary}</span>
                    <span className="block text-xs text-muted">
                      {RULE_LABEL[f.rule]} · {f.deviceName}
                      {f.site ? ` · ${f.site}` : ""} · {fmtDuration(now - f.startedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="overflow-x-auto rounded-md border border-line bg-surface">
          <header className="border-b border-line-soft px-4 py-2.5">
            <h2 className="text-sm font-semibold text-ink">Per site</h2>
          </header>
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-[0.08em] text-muted">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Site</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-right font-semibold text-ok">Online</th>
                <th className="px-2 py-2 text-right font-semibold text-warn">Peringatan</th>
                <th className="px-2 py-2 text-right font-semibold text-bad">Down</th>
                <th className="px-4 py-2 text-right font-semibold">Tanpa data</th>
              </tr>
            </thead>
            <tbody>
              {bySite.map((r) => (
                <tr key={r.site} className="border-t border-line-soft">
                  <td className="px-4 py-2">
                    {r.site === "—" ? (
                      <span className="text-faint">Tanpa site</span>
                    ) : (
                      <button type="button" onClick={() => onSite(r.site)} className="text-brand hover:underline">
                        {r.site}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{r.total}</td>
                  <td className="px-2 py-2 text-right font-mono">{r.online}</td>
                  <td className="px-2 py-2 text-right font-mono">{r.warning}</td>
                  <td className="px-2 py-2 text-right font-mono">{r.down}</td>
                  <td className="px-4 py-2 text-right font-mono">{r.nodata}</td>
                </tr>
              ))}
              {!bySite.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted">
                    Belum ada perangkat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Gangguan */

function FindingsPage({ findings, loading, error, now, onOpen, onRetry }: { findings: FindingView[] | null; loading: boolean; error: string; now: number; onOpen: (id: string, tab?: DetailTab) => void; onRetry: () => void }) {
  const [filter, setFilter] = useState<"active" | "resolved" | "all">("active");
  const list = (findings ?? []).filter((f) => filter === "all" || f.status === filter);
  const count = (s: "active" | "resolved") => (findings ?? []).filter((f) => f.status === s).length;
  return (
    <div className="space-y-3">
      <Tabs
        label="Status temuan"
        value={filter}
        onChange={setFilter}
        items={[
          { id: "active" as const, label: "Aktif", count: count("active") },
          { id: "resolved" as const, label: "Pulih", count: count("resolved") },
          { id: "all" as const, label: "Semua", count: findings?.length ?? 0 },
        ]}
      />
      {error ? (
        <Note tone="bad">
          Gagal memuat gangguan: {error}{" "}
          <button type="button" onClick={onRetry} className="font-medium underline">
            Coba lagi
          </button>
        </Note>
      ) : !findings ? (
        <p className="py-10 text-center text-sm text-muted">{loading ? "Memuat gangguan…" : ""}</p>
      ) : list.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-10 text-center text-sm text-muted">{filter === "active" ? "Tidak ada gangguan aktif." : "Belum ada temuan."}</p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-md border border-line bg-surface">
          {list.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onOpen(f.deviceId, "analisa")} className="grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-raised md:grid-cols-[90px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${f.status === "active" ? "border-warn/40 bg-warn/10 text-warn" : "border-ok/35 bg-ok/10 text-ok"}`}>{f.status === "active" ? "Aktif" : "Pulih"}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{f.summary}</span>
                  <span className="block text-xs text-muted">{f.triggerValue}</span>
                </span>
                <span className="min-w-0 text-xs text-muted">
                  <span className="block font-medium text-ink">{f.deviceName}</span>
                  {f.site || "—"}
                </span>
                <span className="text-xs text-muted">
                  Mulai {fmtTime(f.startedAt, now)}
                  <span className="block">{f.resolvedAt ? `Pulih ${fmtTime(f.resolvedAt, now)} · ${fmtDuration(f.resolvedAt - f.startedAt)}` : `Berlangsung ${fmtDuration(now - f.startedAt)}`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Konfigurasi */

function ConfigPage({ list, now, demo, setDemo }: { list: DevicesResponse | null; now: number; demo: boolean; setDemo: (v: boolean) => void }) {
  const c = list?.collector ?? null;
  const state = !c ? { text: "Belum pernah berjalan", cls: "text-warn" } : c.stale ? { text: `Berhenti (detak terakhir ${fmtAgo(c.lastBeatAt, now)})`, cls: "text-bad" } : { text: `Berjalan · detak ${fmtAgo(c.lastBeatAt, now)}`, cls: "text-ok" };
  const polled = (list?.devices ?? []).filter((d) => d.collected && d.enabled).length;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Collector</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Status</dt>
            <dd className={`text-right font-medium ${state.cls}`}>{demo ? "Demo" : state.text}</dd>
          </div>
          {c?.info?.version && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Versi</dt>
              <dd className="font-mono text-xs">{c.info.version}</dd>
            </div>
          )}
          {c?.info?.lastCycleMs !== undefined && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Putaran terakhir</dt>
              <dd className="font-mono text-xs">{c.info.lastCycleMs} ms</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Perangkat Anda yang dipantau</dt>
            <dd className="font-mono text-xs">{polled}</dd>
          </div>
        </dl>
        <p className="text-xs leading-relaxed text-muted">
          Collector adalah proses terpisah dari web (PM2 <span className="font-mono">generator-mikrotik-nm</span>). Ia memeriksa tiap perangkat sesuai intervalnya (bawaan 60 detik), menyimpan sampel,
          lalu menjalankan aturan Analisa. Dashboard ini hanya membaca hasil yang tersimpan, dimuat ulang tiap 30 detik.
        </p>
        <pre className="overflow-x-auto rounded-md border border-line bg-code p-3 font-mono text-[11px] leading-relaxed text-ink">{`# di server, folder aplikasi
pm2 start ecosystem.config.js --only generator-mikrotik-nm
pm2 logs generator-mikrotik-nm

# uji satu putaran
npx tsx scripts/nm-collector.mts --once`}</pre>
        <p className="text-xs leading-relaxed text-muted">
          Port API bebas (mis. hasil port forwarding), kecuali dibatasi lewat <span className="font-mono">NM_ALLOWED_PORTS</span>. Collector hanya menghubungi IP publik, atau subnet privat yang didaftarkan di{" "}
          <span className="font-mono">NM_ALLOWED_NETWORKS</span> (mis. subnet tunnel VPN). Sampel disimpan 7 hari.
        </p>
      </section>

      <section className="space-y-3 rounded-md border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Aturan Analisa bawaan</h2>
        <ul className="space-y-1.5 text-sm text-muted">
          <li>
            <b className="text-ink">CPU tinggi</b> — di atas {DEFAULT_RULES.cpuThreshold}% selama {DEFAULT_RULES.cpuMinutes} menit, dari sampel segar yang mencakup seluruh periode.
          </li>
          <li>
            <b className="text-ink">WAN link down</b> — interface WAN terpilih down pada {DEFAULT_RULES.wanChecks} pemeriksaan berturut-turut.
          </li>
          <li>
            <b className="text-ink">Sesi PPPoE turun</b> — turun lebih dari {DEFAULT_RULES.pppDropPct}% dalam {DEFAULT_RULES.pppMinutes} menit, minimal {DEFAULT_RULES.pppMinBase} sesi di awal.
          </li>
          <li>
            <b className="text-ink">Tidak terjangkau</b> — {DEFAULT_RULES.unreachableChecks} pemeriksaan berturut-turut tanpa jawaban ICMP maupun port API. Selama itu status WAN belum terverifikasi.
          </li>
        </ul>
        <p className="text-xs text-faint">Ambang, durasi, dan interface WAN diatur per perangkat di Detail → Pengaturan.</p>

        <h2 className="pt-2 text-sm font-semibold text-ink">User read-only di MikroTik</h2>
        <pre className="overflow-x-auto rounded-md border border-line bg-code p-3 font-mono text-[11px] leading-relaxed text-ink">{READONLY_SCRIPT}</pre>

        <h2 className="pt-2 text-sm font-semibold text-ink">Mode demo</h2>
        <Toggle checked={demo} onChange={setDemo} label="Tampilkan data simulasi" hint="Hanya untuk melihat tampilan dan cara kerja aturan. Selalu diberi label Mode demo." />
      </section>
    </div>
  );
}
