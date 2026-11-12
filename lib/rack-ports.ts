/**
 * Port perangkat dan kabel patch cord untuk simulasi rack. Murni tanpa React (diuji di
 * scripts/test-rack.mts).
 *
 * Koordinat port memakai muka perangkat yang dinormalkan: x 0..1 dari kiri ke kanan selebar
 * telinga 19", y 0..1 dari atas ke bawah setinggi perangkat. Port di belakang (server, NAS)
 * memakai muka belakang badan perangkat.
 */
import type { RackDevice, RackState } from "./rack";

export type PortType = "rj45" | "console" | "sfp" | "sfp+" | "sfp28" | "qsfp+" | "qsfp28" | "pon" | "lc";

export interface PortTypeInfo {
  id: PortType;
  label: string;
  /** Kecepatan maksimal (Gbps); 0 = pasif/konsol. */
  speed: number;
  medium: "copper" | "optic";
  /** Lebar relatif satu port di muka perangkat. */
  unit: number;
}

export const PORT_TYPES: PortTypeInfo[] = [
  { id: "rj45", label: "RJ45", speed: 1, medium: "copper", unit: 1 },
  { id: "console", label: "Console", speed: 0, medium: "copper", unit: 1 },
  { id: "sfp", label: "SFP 1G", speed: 1, medium: "optic", unit: 1.2 },
  { id: "sfp+", label: "SFP+ 10G", speed: 10, medium: "optic", unit: 1.2 },
  { id: "sfp28", label: "SFP28 25G", speed: 25, medium: "optic", unit: 1.2 },
  { id: "qsfp+", label: "QSFP+ 40G", speed: 40, medium: "optic", unit: 1.7 },
  { id: "qsfp28", label: "QSFP28 100G", speed: 100, medium: "optic", unit: 1.7 },
  { id: "pon", label: "PON (GPON/EPON)", speed: 2.5, medium: "optic", unit: 1.2 },
  { id: "lc", label: "LC duplex (fiber)", speed: 0, medium: "optic", unit: 0.9 },
];
export const PORT_TYPE = Object.fromEntries(PORT_TYPES.map((p) => [p.id, p])) as Record<PortType, PortTypeInfo>;

/** Port modul SFP (bisa diisi transceiver atau DAC). */
const SFP_FAMILY: PortType[] = ["sfp", "sfp+", "sfp28", "qsfp+", "qsfp28"];
export const isSfp = (t: PortType) => SFP_FAMILY.includes(t);

export interface PortGroup {
  type: PortType;
  count: number;
  /** Awalan nama, mis. "ether", "Gi1/0/", "sfp-sfpplus". */
  prefix: string;
  /** Nomor port pertama (Juniper mulai 0). */
  start: number;
  /** true: satu port tanpa nomor, namanya persis prefix (mis. "iDRAC"). */
  bare?: boolean;
}

export interface Port {
  name: string;
  type: PortType;
  group: number;
}

export const MAX_PORTS = 128;
export const MAX_PORT_GROUPS = 8;

export function devicePorts(d: Pick<RackDevice, "ports">): Port[] {
  const out: Port[] = [];
  d.ports.forEach((g, gi) => {
    if (g.bare) out.push({ name: g.prefix, type: g.type, group: gi });
    else for (let i = 0; i < g.count; i++) out.push({ name: `${g.prefix}${g.start + i}`, type: g.type, group: gi });
  });
  return out.slice(0, MAX_PORTS);
}

/** "24×RJ45 · 2×SFP+ 10G" */
export function portSummary(groups: PortGroup[]): string {
  const totals = new Map<PortType, number>();
  for (const g of groups) totals.set(g.type, (totals.get(g.type) ?? 0) + (g.bare ? 1 : g.count));
  return [...totals].map(([t, n]) => `${n}×${PORT_TYPE[t].label}`).join(" · ");
}

/** Nama port yang dobel (hanya bisa terjadi di perangkat custom). */
export function duplicatePortNames(groups: PortGroup[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const p of devicePorts({ ports: groups })) (seen.has(p.name) ? dup : seen).add(p.name);
  return [...dup];
}

/* ------------------------------------------------------------------ tata letak port */

export interface PortSpot extends Port {
  /** Pusat port pada muka perangkat (0..1). */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bagian muka yang dipakai port; sebelah kiri untuk nama perangkat. */
const AREA_X0 = 0.33;
const AREA_X1 = 0.955;
const GROUP_GAP = 0.7;

/**
 * Port disusun per grup dari kiri ke kanan; grup berisi lebih dari 4 port memakai dua baris
 * (nomor ganjil di atas, genap di bawah, seperti switch pada umumnya).
 */
export function portLayout(d: Pick<RackDevice, "ports" | "u">): PortSpot[] {
  const ports = devicePorts(d);
  if (!ports.length) return [];
  const groups = d.ports.map((g, gi) => {
    const list = ports.filter((p) => p.group === gi);
    const rows = list.length > 4 ? 2 : 1;
    return { list, rows, cols: Math.ceil(list.length / rows), unit: PORT_TYPE[g.type].unit };
  });
  const total = groups.reduce((n, g) => n + g.cols * g.unit, 0) + GROUP_GAP * (groups.length - 1);
  const scale = (AREA_X1 - AREA_X0) / Math.max(total, 1);
  // tinggi port relatif terhadap tinggi perangkat: 1U muat dua baris; perangkat tinggi tetap kecil
  const rowH = Math.min(0.36, 0.36 / Math.max(d.u, 1) + 0.02);
  const out: PortSpot[] = [];
  let x = AREA_X0;
  for (const g of groups) {
    const cell = g.unit * scale;
    g.list.forEach((p, i) => {
      const col = g.rows === 2 ? Math.floor(i / 2) : i;
      const row = g.rows === 2 ? i % 2 : 0;
      const y = g.rows === 2 ? 0.5 + (row === 0 ? -1 : 1) * rowH * 0.55 : 0.5;
      out.push({ ...p, x: x + (col + 0.5) * cell, y, w: cell * 0.82, h: rowH * 0.9 });
    });
    x += g.cols * cell + GROUP_GAP * scale;
  }
  return out;
}

/* ------------------------------------------------------------------ kabel */

export type CableKind = "utp" | "fiber" | "dac";

export const CABLE_KINDS: Array<{ id: CableKind; label: string }> = [
  { id: "utp", label: "UTP Cat6 (RJ45)" },
  { id: "fiber", label: "Fiber patch cord (LC/SC)" },
  { id: "dac", label: "DAC (direct attach SFP)" },
];
export const CABLE_KIND_LABEL = Object.fromEntries(CABLE_KINDS.map((k) => [k.id, k.label])) as Record<CableKind, string>;

export const CABLE_COLORS: Array<{ id: string; label: string; hex: string }> = [
  { id: "blue", label: "Biru", hex: "#3b82f6" },
  { id: "yellow", label: "Kuning", hex: "#eab308" },
  { id: "red", label: "Merah", hex: "#ef4444" },
  { id: "green", label: "Hijau", hex: "#22c55e" },
  { id: "orange", label: "Oranye", hex: "#f97316" },
  { id: "aqua", label: "Aqua (OM3/OM4)", hex: "#22d3ee" },
  { id: "purple", label: "Ungu", hex: "#a855f7" },
  { id: "white", label: "Putih", hex: "#e5e7eb" },
  { id: "gray", label: "Abu-abu", hex: "#9ca3af" },
  { id: "black", label: "Hitam", hex: "#1f2937" },
];
export const CABLE_HEX = Object.fromEntries(CABLE_COLORS.map((c) => [c.id, c.hex])) as Record<string, string>;
export const CABLE_COLOR_LABEL = Object.fromEntries(CABLE_COLORS.map((c) => [c.id, c.label])) as Record<string, string>;

export interface CableEnd {
  dev: string;
  port: string;
}

export interface RackCable {
  id: string;
  a: CableEnd;
  b: CableEnd;
  kind: CableKind;
  color: string;
  /** Panjang yang dipilih (m); 0 = otomatis dari estimasi jalur. */
  lengthM: number;
  label: string;
}

export const MAX_CABLES = 400;
/** Panjang patch cord yang umum dijual (m). */
export const STD_LENGTHS = [0.3, 0.5, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30];
/** DAC pasif umumnya tersedia sampai 3 m (sebagian 5 m). */
export const DAC_MAX_M = 5;

export const findPort = (d: RackDevice, name: string) => devicePorts(d).find((p) => p.name === name);

export function portInUse(cables: RackCable[], end: CableEnd, exceptId?: string): RackCable | undefined {
  return cables.find((c) => c.id !== exceptId && ((c.a.dev === end.dev && c.a.port === end.port) || (c.b.dev === end.dev && c.b.port === end.port)));
}

/** Jenis kabel yang cocok untuk dua port. */
export function defaultCableKind(a: PortType, b: PortType): CableKind {
  if (PORT_TYPE[a].medium === "copper" || PORT_TYPE[b].medium === "copper") return "utp";
  if (isSfp(a) && isSfp(b)) return "dac";
  return "fiber";
}

export type CableCheck = { ok: false; reason: string } | { ok: true; notes: string[] };

/** Apakah dua port bisa disambung dengan jenis kabel ini. */
export function checkCable(state: Pick<RackState, "devices" | "cables">, a: CableEnd, b: CableEnd, kind: CableKind, exceptId?: string): CableCheck {
  const da = state.devices.find((d) => d.id === a.dev);
  const db = state.devices.find((d) => d.id === b.dev);
  if (!da || !db) return { ok: false, reason: "Pilih perangkat di kedua ujung." };
  const pa = findPort(da, a.port);
  const pb = findPort(db, b.port);
  if (!pa || !pb) return { ok: false, reason: "Pilih port di kedua ujung." };
  if (a.dev === b.dev && a.port === b.port) return { ok: false, reason: "Kedua ujung tidak boleh port yang sama." };
  for (const [end, dev] of [
    [a, da],
    [b, db],
  ] as const) {
    const used = portInUse(state.cables, end, exceptId);
    if (used) return { ok: false, reason: `${dev.name} ${end.port} sudah terpakai kabel lain.` };
  }

  const ta = PORT_TYPE[pa.type];
  const tb = PORT_TYPE[pb.type];
  const notes: string[] = [];

  if (pa.type === "pon" || pb.type === "pon") {
    const other = pa.type === "pon" ? pb : pa;
    if (other.type !== "lc") return { ok: false, reason: "Port PON disambung ke ODF / patch panel fiber (menuju splitter), bukan ke port perangkat lain." };
  }
  if (pa.type === "console" || pb.type === "console") {
    const other = pa.type === "console" ? pb : pa;
    if (other.type !== "rj45" && other.type !== "console") return { ok: false, reason: "Port console hanya disambung dengan kabel RJ45." };
  }

  if (kind === "utp") {
    const copperOrSfp = (t: PortType) => PORT_TYPE[t].medium === "copper" || t === "sfp" || t === "sfp+";
    if (!copperOrSfp(pa.type) || !copperOrSfp(pb.type) || (ta.medium === "optic" && tb.medium === "optic")) {
      return { ok: false, reason: "Kabel UTP butuh port RJ45 (atau SFP/SFP+ yang diisi modul RJ45)." };
    }
    for (const p of [pa, pb]) if (isSfp(p.type)) notes.push(`Port ${p.name} (${PORT_TYPE[p.type].label}) butuh modul ${p.type === "sfp" ? "SFP" : "SFP+"} RJ45.`);
  } else if (kind === "dac") {
    if (!isSfp(pa.type) || !isSfp(pb.type)) return { ok: false, reason: "DAC hanya untuk port SFP/SFP+/SFP28/QSFP di kedua ujung." };
  } else {
    if (ta.medium !== "optic" || tb.medium !== "optic") return { ok: false, reason: "Patch cord fiber butuh port optik (SFP, PON, atau LC) di kedua ujung." };
    for (const p of [pa, pb]) if (isSfp(p.type)) notes.push(`Port ${p.name} butuh transceiver ${PORT_TYPE[p.type].label}.`);
  }

  if (ta.speed && tb.speed && ta.speed !== tb.speed && kind !== "utp") {
    const big = Math.max(ta.speed, tb.speed);
    const small = Math.min(ta.speed, tb.speed);
    notes.push(
      big >= 40 && small <= 25
        ? `Kecepatan beda (${big}G ke ${small}G): butuh kabel breakout atau link turun ke ${small}G.`
        : `Kecepatan beda (${big}G ke ${small}G): link berjalan di ${small}G.`,
    );
  }
  return { ok: true, notes };
}

/* ------------------------------------------------------------------ jalur dan panjang */

const U_M = 0.04445;
const EAR_M = 0.4826;
const BODY_M = 0.44;
/** Kabel keluar tegak lurus dari muka port sebelum belok ke jalur samping. */
export const CABLE_OUT_M = 0.05;
/** Jalur kabel vertikal di samping rel (cable manager). */
export const CABLE_SIDE_M = EAR_M / 2 + 0.025;
/** Kelonggaran supaya kabel tidak tegang. */
const SLACK_M = 0.2;

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Posisi port dalam meter: x dari tengah rack (kanan positif, dilihat dari depan), y dari dasar
 * U1, z = 0 di muka rel depan (negatif ke belakang). out = arah kabel keluar (+1 depan, -1 belakang).
 */
export function portPoint(d: RackDevice, spot: PortSpot): Point3 & { out: 1 | -1 } {
  const h = d.u * U_M;
  const y = (d.pos - 1) * U_M + (1 - spot.y) * h;
  if (d.portSide === "rear") return { x: -(spot.x - 0.5) * BODY_M, y, z: -Math.max(d.depthMm, 10) / 1000, out: -1 };
  return { x: (spot.x - 0.5) * EAR_M, y, z: 0.004, out: 1 };
}

/** Titik-titik jalur kabel: keluar dari port, ke jalur samping terdekat, naik/turun, masuk port. */
export function cableRoute(state: Pick<RackState, "devices">, c: Pick<RackCable, "a" | "b">): Point3[] | null {
  const ends = [c.a, c.b].map((e) => {
    const d = state.devices.find((x) => x.id === e.dev);
    const spot = d && portLayout(d).find((p) => p.name === e.port);
    return d && spot ? portPoint(d, spot) : null;
  });
  const [A, B] = ends;
  if (!A || !B) return null;
  const side = (A.x + B.x) / 2 < 0 ? -CABLE_SIDE_M : CABLE_SIDE_M;
  const A1 = { x: A.x, y: A.y, z: A.z + A.out * CABLE_OUT_M };
  const B1 = { x: B.x, y: B.y, z: B.z + B.out * CABLE_OUT_M };
  // depan ke belakang: naik/turun dulu di sisi ujung A, baru menyusur kedalaman di ketinggian B
  const turn = Math.abs(A1.z - B1.z) > 0.01 ? [{ x: side, y: B1.y, z: A1.z }] : [];
  return [{ x: A.x, y: A.y, z: A.z }, A1, { x: side, y: A1.y, z: A1.z }, ...turn, { x: side, y: B1.y, z: B1.z }, B1, { x: B.x, y: B.y, z: B.z }];
}

const dist = (p: Point3, q: Point3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

/** Panjang jalur kabel (m) termasuk kelonggaran; null bila ujungnya tidak ditemukan. */
export function estimateLength(state: Pick<RackState, "devices">, c: Pick<RackCable, "a" | "b">): number | null {
  const route = cableRoute(state, c);
  if (!route) return null;
  let m = 0;
  for (let i = 1; i < route.length; i++) m += dist(route[i - 1], route[i]);
  return m + SLACK_M;
}

/** Ukuran standar terkecil yang cukup. */
export const roundToStd = (m: number) => STD_LENGTHS.find((s) => s >= m - 1e-9) ?? Math.ceil(m);

/** Panjang yang dipakai: pilihan pengguna, atau ukuran standar dari estimasi. */
export function cableLength(state: Pick<RackState, "devices">, c: RackCable): { estimate: number | null; length: number; tooShort: boolean } {
  const estimate = estimateLength(state, c);
  const length = c.lengthM > 0 ? c.lengthM : estimate === null ? 0 : roundToStd(estimate);
  return { estimate, length, tooShort: c.lengthM > 0 && estimate !== null && c.lengthM < estimate - 0.05 };
}

export interface CableBomRow {
  kind: CableKind;
  length: number;
  color: string;
  count: number;
}

/** Kebutuhan patch cord: dikelompokkan per jenis, panjang, dan warna. */
export function cableBom(state: Pick<RackState, "devices" | "cables">): CableBomRow[] {
  const rows = new Map<string, CableBomRow>();
  for (const c of state.cables) {
    const { length } = cableLength(state, c);
    const key = `${c.kind}|${length}|${c.color}`;
    const row = rows.get(key) ?? { kind: c.kind, length, color: c.color, count: 0 };
    row.count++;
    rows.set(key, row);
  }
  return [...rows.values()].sort((x, y) => x.kind.localeCompare(y.kind) || x.length - y.length || x.color.localeCompare(y.color));
}

export const fmtLength = (m: number) => `${m.toLocaleString("id-ID")} m`;

/* ------------------------------------------------------------------ perapian data */

export function normalizePortGroups(raw: unknown): PortGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: PortGroup[] = [];
  let total = 0;
  for (const item of raw.slice(0, MAX_PORT_GROUPS)) {
    const g = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const type = PORT_TYPES.some((t) => t.id === g.type) ? (g.type as PortType) : null;
    if (!type) continue;
    const bare = g.bare === true;
    const count = bare ? 1 : Math.min(Math.max(Math.round(Number(g.count)) || 0, 1), 64);
    if (total + count > MAX_PORTS) break;
    total += count;
    const prefix = typeof g.prefix === "string" ? g.prefix.slice(0, 20) : "";
    if (bare && !prefix) continue;
    out.push({ type, count, prefix, start: Math.min(Math.max(Math.round(Number(g.start)) || 0, 0), 999), ...(bare ? { bare: true } : {}) });
  }
  return out;
}

/** Kabel dari data impor: hanya yang kedua ujungnya ada, port belum dipakai, dan jenisnya cocok. */
export function normalizeCables(raw: unknown, devices: RackDevice[]): RackCable[] {
  if (!Array.isArray(raw)) return [];
  const out: RackCable[] = [];
  for (const item of raw.slice(0, MAX_CABLES)) {
    const c = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const end = (v: unknown): CableEnd => {
      const e = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
      return { dev: typeof e.dev === "string" ? e.dev : "", port: typeof e.port === "string" ? e.port : "" };
    };
    const kind = CABLE_KINDS.some((k) => k.id === c.kind) ? (c.kind as CableKind) : "utp";
    const cable: RackCable = {
      id: typeof c.id === "string" && c.id ? c.id.slice(0, 40) : newCableId(),
      a: end(c.a),
      b: end(c.b),
      kind,
      color: typeof c.color === "string" && CABLE_HEX[c.color] ? c.color : "blue",
      lengthM: STD_LENGTHS.includes(Number(c.lengthM)) ? Number(c.lengthM) : 0,
      label: typeof c.label === "string" ? c.label.slice(0, 40) : "",
    };
    if (out.some((x) => x.id === cable.id)) cable.id = newCableId();
    if (checkCable({ devices, cables: out }, cable.a, cable.b, cable.kind).ok) out.push(cable);
  }
  return out;
}

export function newCableId(): string {
  return `cab-${Math.random().toString(36).slice(2, 10)}`;
}

/** Buang kabel yang ujungnya hilang (perangkat dihapus atau portnya berubah). */
export function pruneCables(devices: RackDevice[], cables: RackCable[]): RackCable[] {
  const has = (e: CableEnd) => {
    const d = devices.find((x) => x.id === e.dev);
    return !!d && !!findPort(d, e.port);
  };
  return cables.filter((c) => has(c.a) && has(c.b));
}
