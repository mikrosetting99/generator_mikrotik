import {
  COLLECTOR_STALE_MS,
  KIND_LABEL,
  RULE_LABEL,
  isCollected,
  type DeviceKind,
  type DeviceState,
  type DeviceStatus,
  type DeviceView,
  type FindingView,
  type Vendor,
  type WanView,
} from "@/lib/nm/types";

/**
 * Status perangkat dihitung saat dibaca, dari sampel terakhir yang tersimpan, umur sampel itu,
 * detak collector, dan temuan aktif. Tidak ada status yang ditebak: tanpa data = "Data Tidak Tersedia".
 */

/** Sampel dianggap kedaluwarsa setelah 3× interval (minimal 3 menit). */
export const staleAfterMs = (intervalSec: number) => Math.max(3 * intervalSec * 1000, 180_000);

export function relTime(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.round(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`;
  return `${Math.round(s / 86400)} hari lalu`;
}

export interface DeviceRowLike {
  id: string;
  name: string;
  site: string;
  kind: string;
  vendor: string;
  host: string;
  enabled: boolean;
  intervalSec: number;
  wanInterfaces: string;
  lastSampleAt: number | null;
  state: DeviceState | null;
}

export const splitWan = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

export function buildDeviceView(row: DeviceRowLike, active: FindingView[], collector: { lastBeatAt: number } | null, now: number): DeviceView {
  const st = row.state;
  const collected = isCollected(row.kind, row.vendor);
  const age = row.lastSampleAt === null ? Infinity : now - row.lastSampleAt;
  const stale = age > staleAfterMs(row.intervalSec);
  const collectorDown = !collector || now - collector.lastBeatAt > COLLECTOR_STALE_MS;
  const mine = active.filter((f) => f.deviceId === row.id && f.status === "active");

  let status: DeviceStatus;
  let reason: string;
  if (!collected) {
    status = "nodata";
    reason = `Collector baru memantau Router/AP MikroTik. Pemantauan ${KIND_LABEL[row.kind as DeviceKind] ?? row.kind}${row.vendor === "mikrotik" ? "" : " non-MikroTik"} menyusul di tahap berikutnya.`;
  } else if (!row.enabled) {
    status = "nodata";
    reason = "Pemantauan dinonaktifkan.";
  } else if (!st || row.lastSampleAt === null) {
    status = "nodata";
    reason = collectorDown ? "Belum ada data: collector belum berjalan." : "Menunggu pemeriksaan pertama oleh collector.";
  } else if (stale) {
    status = "nodata";
    reason = `Data kedaluwarsa: cek terakhir ${relTime(row.lastSampleAt, now)}${collectorDown ? " (collector berhenti mengirim data)" : ""}.`;
  } else if (!st.reachable) {
    status = "down";
    reason = st.error || "Router tidak terjangkau (ICMP dan port API tidak menjawab).";
  } else if (!st.apiOk) {
    status = "warning";
    reason = `Router terjangkau, tetapi metrik gagal diambil: ${st.error || "API tidak menjawab"}.`;
  } else if (mine.length) {
    status = "warning";
    reason = mine.map((f) => RULE_LABEL[f.rule]).join(", ");
  } else {
    status = "online";
    reason = "Semua pemeriksaan normal.";
  }

  const verified = !!st && !stale && st.reachable && st.apiOk;
  const wanNames = splitWan(row.wanInterfaces);
  const wan: WanView[] = wanNames.map((name) => {
    const w = st?.wan.find((x) => x.name === name);
    let state: WanView["state"];
    if (!st || stale || !st.reachable) state = "unverified";
    else if (!st.apiOk) state = "unknown";
    else if (!w || !w.found) state = "missing";
    else state = w.running ? "up" : "down";
    return { name, state, rxBps: verified && w ? w.rxBps : null, txBps: verified && w ? w.txBps : null };
  });

  const m = verified && st ? st : null;
  const metrics = {
    identity: st?.identity ?? null,
    version: st?.version ?? null,
    board: st?.board ?? null,
    uptimeSec: m?.uptimeSec ?? null,
    cpu: m?.cpu ?? null,
    memPct: m?.memPct ?? null,
    ppp: m?.ppp ?? null,
    hotspot: m?.hotspot ?? null,
  };

  return {
    id: row.id,
    name: row.name,
    site: row.site,
    kind: (row.kind as DeviceKind) ?? "router",
    vendor: (row.vendor as Vendor) ?? "other",
    host: row.host,
    enabled: row.enabled,
    intervalSec: row.intervalSec,
    collected,
    status,
    statusReason: reason,
    indicator: indicatorFor(status, metrics, wan, mine, st, row.lastSampleAt, now),
    lastCheckAt: row.lastSampleAt,
    metrics,
    wan,
    sources: {
      reach: { ok: st && !stale ? st.reachable : null, msg: st ? (st.reachable ? (st.reachVia === "icmp" ? "ICMP menjawab" : "Port API menjawab") : "Tidak terjangkau") : "Belum diperiksa" },
      api: { ok: st && !stale && st.reachable ? st.apiOk : null, msg: !st ? "Belum diperiksa" : !st.reachable ? "Belum terverifikasi" : st.apiOk ? "OK" : st.error || "Gagal" },
      ppp: st?.sources.ppp ?? null,
      hotspot: st?.sources.hotspot ?? null,
    },
    activeFindings: mine.length,
  };
}

function indicatorFor(
  status: DeviceStatus,
  m: DeviceView["metrics"],
  wan: WanView[],
  findings: FindingView[],
  st: DeviceState | null,
  lastSampleAt: number | null,
  now: number,
): string {
  if (status === "nodata") return "Tidak tersedia";
  if (status === "down") return `Tidak terjangkau${lastSampleAt ? ` · cek ${relTime(lastSampleAt, now)}` : ""}`;
  if (findings.length) return findings[0].summary;
  if (st && !st.apiOk) return "Metrik tidak tersedia (API gagal)";
  const parts = [`CPU ${m.cpu ?? "–"}%`];
  if (m.memPct !== null) parts.push(`RAM ${Math.round(m.memPct)}%`);
  const down = wan.filter((w) => w.state === "down").length;
  if (wan.length) parts.push(down ? `WAN ${down} down` : `WAN up`);
  if (m.ppp !== null) parts.push(`PPPoE ${m.ppp}`);
  return parts.join(" · ");
}
