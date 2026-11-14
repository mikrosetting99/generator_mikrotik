import type { Prisma } from "@prisma/client";
import { checkPort } from "@/lib/nm/allow";
import { buildDeviceView, splitWan } from "@/lib/nm/status";
import {
  COLLECTOR_STALE_MS,
  DEFAULT_INTERVAL,
  DEVICE_KINDS,
  MAX_INTERVAL,
  MIN_INTERVAL,
  VENDORS,
  isCollected,
  normalizeRules,
  type CollectorView,
  type DeviceConfigView,
  type DeviceState,
  type DeviceView,
  type FindingEvidence,
  type FindingView,
  type RuleConfig,
  type RuleId,
} from "@/lib/nm/types";
import { normFingerprint } from "@/lib/routeros-api";

/** Batas perangkat per pengguna. */
export const MAX_NM_DEVICES = 200;

/** Kolom perangkat yang boleh dibaca route (tanpa passwordEnc). */
export const DEVICE_SELECT = {
  id: true,
  name: true,
  site: true,
  kind: true,
  vendor: true,
  host: true,
  apiPort: true,
  tls: true,
  tlsFingerprint: true,
  username: true,
  enabled: true,
  intervalSec: true,
  wanInterfaces: true,
  rules: true,
  lastSampleAt: true,
  state: true,
} satisfies Prisma.NmDeviceSelect;

export type DeviceRow = Prisma.NmDeviceGetPayload<{ select: typeof DEVICE_SELECT }>;

type FindingRow = {
  id: string;
  deviceId: string;
  rule: string;
  subject: string;
  status: string;
  summary: string;
  triggerValue: string;
  evidence: Prisma.JsonValue;
  recovery: string;
  startedAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  device: { name: string; site: string };
};

export const findingToView = (f: FindingRow): FindingView => ({
  id: f.id,
  deviceId: f.deviceId,
  deviceName: f.device.name,
  site: f.device.site,
  rule: f.rule as RuleId,
  subject: f.subject,
  status: f.status === "resolved" ? "resolved" : "active",
  summary: f.summary,
  triggerValue: f.triggerValue,
  evidence: (f.evidence as unknown as FindingEvidence) ?? { unit: "", samples: [] },
  recovery: f.recovery,
  startedAt: f.startedAt.getTime(),
  lastSeenAt: f.lastSeenAt.getTime(),
  resolvedAt: f.resolvedAt?.getTime() ?? null,
});

export function deviceToView(r: DeviceRow, active: FindingView[], collector: CollectorView | null, now: number): DeviceView {
  return buildDeviceView(
    { ...r, lastSampleAt: r.lastSampleAt?.getTime() ?? null, state: (r.state as unknown as DeviceState | null) ?? null },
    active,
    collector,
    now,
  );
}

export function configView(r: DeviceRow, hasPassword: boolean): DeviceConfigView {
  const st = r.state as unknown as DeviceState | null;
  return {
    apiPort: r.apiPort,
    tls: r.tls,
    tlsFingerprint: r.tlsFingerprint,
    username: r.username,
    hasPassword,
    wanInterfaces: splitWan(r.wanInterfaces),
    rules: normalizeRules(r.rules),
    interfaces: st?.interfaces ?? [],
  };
}

/** Detak collector terbaru. Info dibatasi supaya jumlah perangkat tenant lain tidak terlihat. */
export function collectorToView(c: { id: string; startedAt: Date; lastBeatAt: Date; info: Prisma.JsonValue } | null, now: number): CollectorView | null {
  if (!c) return null;
  const info = (c.info ?? {}) as Record<string, unknown>;
  return {
    id: "collector",
    startedAt: c.startedAt.getTime(),
    lastBeatAt: c.lastBeatAt.getTime(),
    stale: now - c.lastBeatAt.getTime() > COLLECTOR_STALE_MS,
    info: { version: typeof info.version === "string" ? info.version : undefined, lastCycleMs: typeof info.lastCycleMs === "number" ? info.lastCycleMs : undefined },
  };
}

/* ------------------------------------------------------------------ input */

export interface DeviceInput {
  name: string;
  site: string;
  kind: string;
  vendor: string;
  host: string;
  apiPort: number;
  tls: boolean;
  tlsFingerprint: string;
  username: string;
  /** Kosong saat mengubah = pertahankan password lama. */
  password: string;
  enabled: boolean;
  intervalSec: number;
  wanInterfaces: string;
  rules: RuleConfig;
}

const HOST_OK = /^[A-Za-z0-9]([A-Za-z0-9.:-]*[A-Za-z0-9])?$/;
/** Nama interface RouterOS: apa saja kecuali koma (pemisah) dan karakter kontrol. */
const IFACE_OK = /^[^,\u0000-\u001f]{1,64}$/;

export function parseDeviceInput(body: unknown): { ok: true; data: DeviceInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const name = str(b.name, 80);
  const kind = DEVICE_KINDS.some((k) => k.id === b.kind) ? String(b.kind) : "router";
  const vendor = VENDORS.some((v) => v.id === b.vendor) ? String(b.vendor) : "mikrotik";
  const host = str(b.host, 253);
  const tls = Boolean(b.tls);
  const apiPort = Math.round(Number(b.apiPort ?? (tls ? 8729 : 8728))) || 0;
  const fp = normFingerprint(str(b.tlsFingerprint, 140));
  const wanList = (Array.isArray(b.wanInterfaces) ? b.wanInterfaces.map(String) : splitWan(String(b.wanInterfaces ?? ""))).map((x) => x.trim()).filter(Boolean);
  const collected = isCollected(kind, vendor);

  if (!name) return { ok: false, error: "Nama perangkat belum diisi." };
  if (collected || host) {
    if (!host || !HOST_OK.test(host)) return { ok: false, error: "Alamat perangkat (IP atau domain) tidak valid." };
  }
  if (collected) {
    const pe = checkPort(apiPort);
    if (pe) return { ok: false, error: pe };
    if (!str(b.username, 100)) return { ok: false, error: "Username monitoring belum diisi." };
  }
  if (fp && fp.length !== 64) return { ok: false, error: "Fingerprint SHA-256 harus 64 digit heksadesimal (boleh dengan titik dua)." };
  if (wanList.length > 8) return { ok: false, error: "Maksimal 8 interface WAN per perangkat." };
  const badIface = wanList.find((x) => !IFACE_OK.test(x));
  if (badIface) return { ok: false, error: `Nama interface tidak valid: ${badIface}` };
  const interval = Math.round(Number(b.intervalSec ?? DEFAULT_INTERVAL)) || DEFAULT_INTERVAL;

  return {
    ok: true,
    data: {
      name,
      site: str(b.site, 80),
      kind,
      vendor,
      host,
      apiPort: apiPort || 8728,
      tls,
      tlsFingerprint: fp,
      username: str(b.username, 100),
      password: String(b.password ?? "").slice(0, 200),
      enabled: b.enabled === undefined ? true : Boolean(b.enabled),
      intervalSec: Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, interval)),
      wanInterfaces: [...new Set(wanList)].join(","),
      rules: normalizeRules(b.rules),
    },
  };
}

/** Password tersimpan hanya boleh dipakai ulang bila tujuan dan username tidak berubah. */
export const sameDeviceEndpoint = (row: { host: string; apiPort: number; username: string }, d: { host: string; apiPort: number; username: string }) =>
  row.host.trim().toLowerCase() === d.host.trim().toLowerCase() && row.apiPort === d.apiPort && row.username === d.username;
