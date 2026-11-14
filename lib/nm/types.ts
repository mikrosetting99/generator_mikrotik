/**
 * Tipe bersama Network Monitoring: dipakai collector (server), API, dan tampilan (browser).
 * File ini tidak boleh mengimpor modul server (prisma, vault, node:*).
 */

export type DeviceKind = "router" | "olt" | "ap" | "onu" | "server";
export const DEVICE_KINDS: Array<{ id: DeviceKind; label: string }> = [
  { id: "router", label: "Router" },
  { id: "olt", label: "OLT" },
  { id: "ap", label: "Access Point" },
  { id: "onu", label: "ONU" },
  { id: "server", label: "Server" },
];
export const KIND_LABEL: Record<DeviceKind, string> = Object.fromEntries(DEVICE_KINDS.map((k) => [k.id, k.label])) as Record<DeviceKind, string>;

export type Vendor = "mikrotik" | "ruijie" | "other";
export const VENDORS: Array<{ id: Vendor; label: string }> = [
  { id: "mikrotik", label: "MikroTik (RouterOS)" },
  { id: "ruijie", label: "Ruijie" },
  { id: "other", label: "Lainnya" },
];
/** Collector Tahap 1 hanya memeriksa MikroTik lewat RouterOS API. */
export const isCollected = (kind: string, vendor: string) => vendor === "mikrotik" && (kind === "router" || kind === "ap");

/** Status perangkat di daftar: empat chip di halaman Perangkat. */
export type DeviceStatus = "online" | "warning" | "down" | "nodata";
export const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  warning: "Peringatan",
  down: "Down",
  nodata: "Data Tidak Tersedia",
};

export type RuleId = "cpu_high" | "wan_down" | "ppp_drop" | "unreachable" | "api_error";
export const RULE_LABEL: Record<RuleId, string> = {
  cpu_high: "CPU tinggi",
  wan_down: "WAN link down",
  ppp_drop: "Sesi PPPoE turun",
  unreachable: "Router tidak terjangkau",
  api_error: "Gagal mengambil metrik",
};

/** Ambang aturan Analisa yang bisa diatur per perangkat. */
export interface RuleConfig {
  cpuThreshold: number;
  cpuMinutes: number;
  wanChecks: number;
  pppDropPct: number;
  pppMinBase: number;
  pppMinutes: number;
  /** Pemeriksaan gagal berturut-turut sebelum router dinyatakan tidak terjangkau. */
  unreachableChecks: number;
}

export const DEFAULT_RULES: RuleConfig = {
  cpuThreshold: 90,
  cpuMinutes: 5,
  wanChecks: 3,
  pppDropPct: 20,
  pppMinBase: 20,
  pppMinutes: 5,
  unreachableChecks: 2,
};

const LIMITS: Record<keyof RuleConfig, [number, number]> = {
  cpuThreshold: [10, 100],
  cpuMinutes: [1, 60],
  wanChecks: [1, 20],
  pppDropPct: [1, 100],
  pppMinBase: [1, 100000],
  pppMinutes: [1, 60],
  unreachableChecks: [1, 20],
};

/** Menggabungkan isian (boleh sebagian/rusak) dengan bawaan dan membatasi rentangnya. */
export function normalizeRules(v: unknown): RuleConfig {
  const src = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const out = { ...DEFAULT_RULES };
  for (const k of Object.keys(LIMITS) as Array<keyof RuleConfig>) {
    const n = Math.round(Number(src[k]));
    if (src[k] !== undefined && src[k] !== "" && Number.isFinite(n)) out[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], n));
  }
  return out;
}

export const MIN_INTERVAL = 30;
export const MAX_INTERVAL = 900;
export const DEFAULT_INTERVAL = 60;

/* ------------------------------------------------------------ data sampel */

export interface WanSample {
  name: string;
  /** false = interface itu tidak ada di router (salah ketik atau dihapus). */
  found: boolean;
  running: boolean;
  disabled: boolean;
  rxByte: number | null;
  txByte: number | null;
  /** bit per detik dari selisih counter; null bila belum bisa dihitung (sampel pertama, reset, reboot). */
  rxBps: number | null;
  txBps: number | null;
}

/** Satu sampel dalam bentuk yang dibaca aturan dan grafik. Waktu dalam milidetik epoch. */
export interface Sample {
  at: number;
  reachable: boolean;
  apiOk: boolean;
  cpu: number | null;
  memPct: number | null;
  uptimeSec: number | null;
  ppp: number | null;
  hotspot: number | null;
  wan: WanSample[] | null;
  error: string;
}

/** Ringkasan sampel terakhir yang disimpan di NmDevice.state. */
export interface DeviceState {
  at: number;
  reachable: boolean;
  /** Cara keterjangkauan dibuktikan: port API menjawab (TCP), atau ICMP. */
  reachVia: "tcp" | "icmp" | null;
  apiOk: boolean;
  error: string;
  identity: string | null;
  version: string | null;
  board: string | null;
  uptimeSec: number | null;
  cpu: number | null;
  memPct: number | null;
  ppp: number | null;
  hotspot: number | null;
  /** null = sumber tidak tersedia di router ini (paket tidak ada atau perintah ditolak). */
  sources: { ppp: string | null; hotspot: string | null };
  wan: WanSample[];
  /** Nama interface yang terlihat (untuk memilih WAN di Pengaturan). */
  interfaces: string[];
}

/* ------------------------------------------------------- bentuk untuk browser */

export interface WanView {
  name: string;
  /** up | down | missing (tidak ada di router) | unverified (router tidak terjangkau/data basi) | unknown (API gagal) */
  state: "up" | "down" | "missing" | "unverified" | "unknown";
  rxBps: number | null;
  txBps: number | null;
}

export interface DeviceView {
  id: string;
  name: string;
  site: string;
  kind: DeviceKind;
  vendor: Vendor;
  host: string;
  enabled: boolean;
  intervalSec: number;
  collected: boolean;
  status: DeviceStatus;
  /** Penjelasan singkat status (mis. "Data kedaluwarsa: cek terakhir 14 menit lalu"). */
  statusReason: string;
  indicator: string;
  lastCheckAt: number | null;
  metrics: {
    identity: string | null;
    version: string | null;
    board: string | null;
    uptimeSec: number | null;
    cpu: number | null;
    memPct: number | null;
    ppp: number | null;
    hotspot: number | null;
  };
  wan: WanView[];
  sources: { reach: { ok: boolean | null; msg: string }; api: { ok: boolean | null; msg: string }; ppp: string | null; hotspot: string | null };
  activeFindings: number;
}

export interface FindingEvidence {
  /** Nilai yang memicu aturan, dalam angka (untuk grafik/garis ambang). */
  threshold?: number;
  baseline?: number;
  current?: number;
  windowMinutes?: number;
  samples: Array<{ at: number; value: number | null; note?: string }>;
  /** Satuan nilai sampel (%, sesi, status). */
  unit: string;
}

export interface FindingView {
  id: string;
  deviceId: string;
  deviceName: string;
  site: string;
  rule: RuleId;
  subject: string;
  status: "active" | "resolved";
  summary: string;
  triggerValue: string;
  evidence: FindingEvidence;
  recovery: string;
  startedAt: number;
  lastSeenAt: number;
  resolvedAt: number | null;
}

export interface DeviceConfigView {
  apiPort: number;
  tls: boolean;
  tlsFingerprint: string;
  username: string;
  hasPassword: boolean;
  wanInterfaces: string[];
  rules: RuleConfig;
  interfaces: string[];
}

export interface DeviceDetailView {
  device: DeviceView;
  config: DeviceConfigView;
  samples: Sample[];
  findings: FindingView[];
}

export interface CollectorView {
  id: string;
  lastBeatAt: number;
  startedAt: number;
  /** true bila detak lebih tua dari COLLECTOR_STALE_MS. */
  stale: boolean;
  info: { version?: string; devices?: number; lastCycleMs?: number; polled?: number } | null;
}

export interface DevicesResponse {
  generatedAt: number;
  devices: DeviceView[];
  findings: FindingView[];
  collector: CollectorView | null;
}

export const COLLECTOR_STALE_MS = 3 * 60_000;
