/**
 * Simulasi desain rack server: perangkat ditempatkan per U (1U = 1,75 inci), lalu dihitung
 * pemakaian ruang, daya, panas, berat, dan kapasitas UPS. Murni tanpa React supaya bisa diuji
 * (scripts/test-rack.mts). Semua angka perangkat bawaan adalah perkiraan umum, bisa diubah.
 *
 * Posisi memakai penomoran standar: U1 di paling bawah. Perangkat setinggi h di posisi pos
 * menempati U pos sampai pos + h - 1.
 */

export type DeviceKind =
  | "server"
  | "storage"
  | "switch"
  | "router"
  | "olt"
  | "ups"
  | "pdu"
  | "patch"
  | "cable"
  | "shelf"
  | "kvm"
  | "blank"
  | "other";

export const DEVICE_KINDS: Array<{ id: DeviceKind; label: string; color: string }> = [
  { id: "server", label: "Server", color: "#71639e" },
  { id: "storage", label: "Storage / NAS", color: "#f0ad4e" },
  { id: "switch", label: "Switch", color: "#3bb0d4" },
  { id: "router", label: "Router", color: "#4cc38a" },
  { id: "olt", label: "OLT", color: "#2fb7a3" },
  { id: "ups", label: "UPS", color: "#f1707d" },
  { id: "pdu", label: "PDU", color: "#e8c547" },
  { id: "patch", label: "Patch panel", color: "#9aa5b1" },
  { id: "cable", label: "Cable manager", color: "#6b7280" },
  { id: "shelf", label: "Shelf / tray", color: "#8b8f99" },
  { id: "kvm", label: "KVM / console", color: "#c084fc" },
  { id: "blank", label: "Blank panel", color: "#3a404b" },
  { id: "other", label: "Lainnya", color: "#a3a3a3" },
];

export const KIND_COLOR = Object.fromEntries(DEVICE_KINDS.map((k) => [k.id, k.color])) as Record<DeviceKind, string>;
export const KIND_LABEL = Object.fromEntries(DEVICE_KINDS.map((k) => [k.id, k.label])) as Record<DeviceKind, string>;

export interface RackDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  /** Tinggi dalam U. */
  u: number;
  /** U paling bawah yang ditempati (1 = dasar rack). */
  pos: number;
  /** Daya listrik yang dipakai (watt). UPS: 0, karena UPS menyalurkan daya, bukan bebannya. */
  watts: number;
  kg: number;
  /** Hanya UPS: kapasitas daya keluaran (watt). */
  upsWatts: number;
  note: string;
}

export interface RackState {
  name: string;
  heightU: number;
  /** Beban maksimal rack (kg), dari spesifikasi rack. */
  maxKg: number;
  /** Kapasitas listrik jalur/PDU yang memasok rack (watt). */
  maxWatts: number;
  /** Tegangan listrik (V), untuk menghitung arus. */
  voltage: number;
  devices: RackDevice[];
}

export const MIN_U = 4;
export const MAX_U = 52;
export const MAX_DEVICE_U = 12;
export const MAX_DEVICES = 120;

/** Ukuran rack umum beserta beban maksimal perkiraan (rack dinding vs rack berdiri). */
export const RACK_PRESETS: Array<{ u: number; label: string; maxKg: number }> = [
  { u: 6, label: "6U (dinding)", maxKg: 30 },
  { u: 9, label: "9U (dinding)", maxKg: 40 },
  { u: 12, label: "12U (dinding)", maxKg: 60 },
  { u: 15, label: "15U", maxKg: 80 },
  { u: 20, label: "20U", maxKg: 300 },
  { u: 27, label: "27U", maxKg: 400 },
  { u: 32, label: "32U", maxKg: 500 },
  { u: 42, label: "42U (standar)", maxKg: 600 },
  { u: 45, label: "45U", maxKg: 800 },
  { u: 47, label: "47U", maxKg: 800 },
];

export interface DeviceTemplate {
  id: string;
  name: string;
  kind: DeviceKind;
  u: number;
  watts: number;
  kg: number;
  upsWatts?: number;
}

/** Perangkat siap pakai. Angka daya dan berat adalah perkiraan umum; sesuaikan dengan datasheet. */
export const DEVICE_LIBRARY: DeviceTemplate[] = [
  { id: "router-1u", name: "Router 1U", kind: "router", u: 1, watts: 60, kg: 4 },
  { id: "switch-24", name: "Switch 24 port", kind: "switch", u: 1, watts: 30, kg: 3 },
  { id: "switch-48", name: "Switch 48 port", kind: "switch", u: 1, watts: 60, kg: 4.5 },
  { id: "switch-48-poe", name: "Switch 48 port PoE", kind: "switch", u: 1, watts: 450, kg: 6 },
  { id: "olt-1u", name: "OLT 1U", kind: "olt", u: 1, watts: 90, kg: 5 },
  { id: "server-1u", name: "Server 1U", kind: "server", u: 1, watts: 350, kg: 15 },
  { id: "server-2u", name: "Server 2U", kind: "server", u: 2, watts: 550, kg: 25 },
  { id: "server-4u", name: "Server 4U", kind: "server", u: 4, watts: 900, kg: 40 },
  { id: "storage-2u", name: "Storage / NAS 2U", kind: "storage", u: 2, watts: 250, kg: 20 },
  { id: "ups-2u", name: "UPS 2U 1500VA", kind: "ups", u: 2, watts: 0, kg: 25, upsWatts: 1000 },
  { id: "ups-3u", name: "UPS 3U 3000VA", kind: "ups", u: 3, watts: 0, kg: 40, upsWatts: 2700 },
  { id: "pdu-1u", name: "PDU 1U", kind: "pdu", u: 1, watts: 0, kg: 2 },
  { id: "patch-24", name: "Patch panel 24 port", kind: "patch", u: 1, watts: 0, kg: 1.5 },
  { id: "cable-1u", name: "Cable manager 1U", kind: "cable", u: 1, watts: 0, kg: 1 },
  { id: "shelf-1u", name: "Shelf 1U", kind: "shelf", u: 1, watts: 0, kg: 3 },
  { id: "shelf-2u", name: "Shelf 2U", kind: "shelf", u: 2, watts: 0, kg: 5 },
  { id: "kvm-1u", name: "KVM console 1U", kind: "kvm", u: 1, watts: 25, kg: 10 },
  { id: "blank-1u", name: "Blank panel 1U", kind: "blank", u: 1, watts: 0, kg: 0.3 },
];

/** Perangkat yang sebaiknya di bagian bawah rack (berat atau UPS); yang lain diisi dari atas. */
export const fillsFromBottom = (d: Pick<RackDevice, "kind" | "kg">) => d.kind === "ups" || d.kind === "storage" || d.kg >= 20;

/* ------------------------------------------------------------------ penempatan */

/** True bila perangkat setinggi u bisa diletakkan di pos tanpa keluar rack atau menimpa yang lain. */
export function canPlace(state: Pick<RackState, "heightU" | "devices">, u: number, pos: number, exceptId?: string): boolean {
  if (!Number.isInteger(u) || !Number.isInteger(pos) || u < 1 || pos < 1 || pos + u - 1 > state.heightU) return false;
  const top = pos + u - 1;
  return state.devices.every((d) => d.id === exceptId || d.pos + d.u - 1 < pos || d.pos > top);
}

/** Posisi pertama yang muat: dari bawah ke atas, atau dari atas ke bawah. null bila rack penuh. */
export function firstFit(state: Pick<RackState, "heightU" | "devices">, u: number, fromTop: boolean): number | null {
  const last = state.heightU - u + 1;
  for (let i = 0; i < last; i++) {
    const pos = fromTop ? last - i : i + 1;
    if (canPlace(state, u, pos)) return pos;
  }
  return null;
}

/** Perangkat yang menempati U tertentu, bila ada. */
export function deviceAt(devices: RackDevice[], unit: number): RackDevice | undefined {
  return devices.find((d) => unit >= d.pos && unit <= d.pos + d.u - 1);
}

/** Perangkat yang keluar dari rack bila tingginya diubah ke heightU. */
export function devicesAbove(devices: RackDevice[], heightU: number): RackDevice[] {
  return devices.filter((d) => d.pos + d.u - 1 > heightU);
}

/* ------------------------------------------------------------------ ringkasan */

export interface RackSummary {
  usedU: number;
  freeU: number;
  usedPct: number;
  watts: number;
  amps: number;
  /** Panas yang perlu dibuang pendingin (BTU/jam) = watt × 3,412. */
  btu: number;
  kg: number;
  upsWatts: number;
  /** Beban terhadap UPS (%); null bila tidak ada UPS. */
  upsLoadPct: number | null;
  powerLoadPct: number;
  /** Jumlah perangkat yang memakai listrik (watt > 0). */
  powered: number;
}

export function summarize(state: RackState): RackSummary {
  const usedU = state.devices.reduce((n, d) => n + d.u, 0);
  const watts = state.devices.reduce((n, d) => n + d.watts, 0);
  const kg = state.devices.reduce((n, d) => n + d.kg, 0);
  const upsWatts = state.devices.reduce((n, d) => n + (d.kind === "ups" ? d.upsWatts : 0), 0);
  return {
    usedU,
    freeU: state.heightU - usedU,
    usedPct: state.heightU ? (usedU / state.heightU) * 100 : 0,
    watts,
    amps: state.voltage ? watts / state.voltage : 0,
    btu: watts * 3.412,
    kg: Math.round(kg * 10) / 10,
    upsWatts,
    upsLoadPct: upsWatts ? (watts / upsWatts) * 100 : null,
    powerLoadPct: state.maxWatts ? (watts / state.maxWatts) * 100 : 0,
    powered: state.devices.filter((d) => d.watts > 0).length,
  };
}

export interface RackWarning {
  tone: "bad" | "warn" | "info";
  text: string;
}

/** Beban listrik terus-menerus sebaiknya tidak melebihi 80% kapasitas jalur atau UPS. */
const CONTINUOUS_LIMIT = 80;

export function rackWarnings(state: RackState, s: RackSummary): RackWarning[] {
  const out: RackWarning[] = [];
  if (s.kg > state.maxKg) out.push({ tone: "bad", text: `Berat ${fmtNum(s.kg)} kg melebihi beban maksimal rack ${fmtNum(state.maxKg)} kg.` });
  else if (state.maxKg && s.kg > state.maxKg * 0.9) out.push({ tone: "warn", text: `Berat sudah ${Math.round((s.kg / state.maxKg) * 100)}% dari beban maksimal rack.` });

  if (state.maxWatts && s.watts > state.maxWatts) {
    out.push({ tone: "bad", text: `Daya ${fmtNum(s.watts)} W melebihi kapasitas listrik ${fmtNum(state.maxWatts)} W.` });
  } else if (state.maxWatts && s.powerLoadPct > CONTINUOUS_LIMIT) {
    out.push({ tone: "warn", text: `Daya ${Math.round(s.powerLoadPct)}% dari kapasitas listrik; untuk beban terus-menerus usahakan di bawah ${CONTINUOUS_LIMIT}%.` });
  }

  if (s.upsLoadPct !== null) {
    if (s.upsLoadPct > 100) out.push({ tone: "bad", text: `Beban ${fmtNum(s.watts)} W melebihi kapasitas UPS ${fmtNum(s.upsWatts)} W: UPS akan mati saat listrik padam.` });
    else if (s.upsLoadPct > CONTINUOUS_LIMIT) out.push({ tone: "warn", text: `UPS terbebani ${Math.round(s.upsLoadPct)}%; waktu cadangan akan sangat singkat.` });
  } else if (s.watts > 0) {
    out.push({ tone: "info", text: "Belum ada UPS: perangkat langsung mati saat listrik padam." });
  }

  // Perangkat berat di setengah atas padahal masih ada ruang kosong di bawahnya: rack mudah terguling.
  const half = state.heightU / 2;
  for (const d of state.devices) {
    if (!fillsFromBottom(d) || d.pos <= half) continue;
    const lower = firstFit({ heightU: Math.max(d.pos - 1, 0), devices: state.devices.filter((x) => x.id !== d.id) }, d.u, false);
    if (lower !== null) out.push({ tone: "warn", text: `${d.name} (${fmtNum(d.kg)} kg) ada di bagian atas; pindahkan ke bawah agar rack stabil.` });
  }

  if (s.usedPct >= 90 && s.watts > 1500) {
    out.push({ tone: "info", text: "Rack hampir penuh dengan beban panas tinggi: pastikan aliran udara depan-ke-belakang dan beri blank panel di slot kosong." });
  }
  return out;
}

export const fmtNum = (n: number) => (Math.round(n * 10) / 10).toLocaleString("id-ID");

/* ------------------------------------------------------------------ data */

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};
const int = (v: unknown, min: number, max: number, fallback: number) => Math.round(num(v, min, max, fallback));
const text = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);

/**
 * Merapikan data dari browser atau berkas impor: nilai di luar batas dipangkas, perangkat yang
 * keluar rack atau bertabrakan dibuang (yang pertama dipertahankan).
 */
export function normalizeRack(raw: unknown): RackState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const state: RackState = {
    name: text(r.name, 80, "Rack 1") || "Rack 1",
    heightU: int(r.heightU, MIN_U, MAX_U, 42),
    maxKg: num(r.maxKg, 0, 5000, 600),
    maxWatts: num(r.maxWatts, 0, 100_000, 3500),
    voltage: num(r.voltage, 100, 400, 220),
    devices: [],
  };
  const list = Array.isArray(r.devices) ? r.devices : [];
  for (const item of list.slice(0, MAX_DEVICES)) {
    const d = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const kind = DEVICE_KINDS.some((k) => k.id === d.kind) ? (d.kind as DeviceKind) : "other";
    const device: RackDevice = {
      id: text(d.id, 40) || newDeviceId(),
      name: text(d.name, 60) || KIND_LABEL[kind],
      kind,
      u: int(d.u, 1, MAX_DEVICE_U, 1),
      pos: int(d.pos, 1, MAX_U, 1),
      watts: num(d.watts, 0, 20_000, 0),
      kg: num(d.kg, 0, 500, 0),
      upsWatts: kind === "ups" ? num(d.upsWatts, 0, 100_000, 0) : 0,
      note: text(d.note, 200),
    };
    if (state.devices.some((x) => x.id === device.id)) device.id = newDeviceId();
    if (canPlace(state, device.u, device.pos)) state.devices.push(device);
  }
  return state;
}

export function newDeviceId(): string {
  return `dev-${Math.random().toString(36).slice(2, 10)}`;
}

/** Perangkat baru dari templat, di posisi pertama yang muat; null bila rack penuh. */
export function deviceFromTemplate(state: RackState, t: DeviceTemplate, pos?: number): RackDevice | null {
  const base = { kind: t.kind, kg: t.kg };
  const at = pos ?? firstFit(state, t.u, !fillsFromBottom(base));
  if (at === null || !canPlace(state, t.u, at)) return null;
  return { id: newDeviceId(), name: t.name, kind: t.kind, u: t.u, pos: at, watts: t.watts, kg: t.kg, upsWatts: t.upsWatts ?? 0, note: "" };
}

/** Contoh rack awal: jaringan di atas, server di tengah, UPS di bawah. */
export function exampleRack(): RackState {
  const state: RackState = { name: "Rack NOC 1", heightU: 42, maxKg: 600, maxWatts: 3500, voltage: 220, devices: [] };
  const place = (id: string, pos: number, name?: string) => {
    const t = DEVICE_LIBRARY.find((x) => x.id === id);
    const d = t && deviceFromTemplate(state, t, pos);
    if (d) state.devices.push(name ? { ...d, name } : d);
  };
  place("patch-24", 42);
  place("cable-1u", 41);
  place("switch-48", 40, "Switch core");
  place("router-1u", 39, "Router BGP");
  place("olt-1u", 38);
  place("cable-1u", 37);
  place("server-1u", 30, "Server billing");
  place("server-2u", 28, "Server Proxmox");
  place("storage-2u", 6, "NAS backup");
  place("pdu-1u", 4);
  place("ups-3u", 1);
  return state;
}

/** Daftar perangkat dari atas ke bawah sebagai teks (untuk disalin ke laporan/WhatsApp). */
export function billOfMaterials(state: RackState): string {
  const rows = [...state.devices].sort((a, b) => b.pos - a.pos);
  const s = summarize(state);
  return [
    `${state.name} — ${state.heightU}U`,
    ...rows.map((d) => {
      const range = d.u === 1 ? `U${d.pos}` : `U${d.pos}-${d.pos + d.u - 1}`;
      return `${range.padEnd(8)} ${d.name} (${d.u}U, ${fmtNum(d.watts)} W, ${fmtNum(d.kg)} kg)`;
    }),
    "",
    `Terpakai ${s.usedU}/${state.heightU}U · Daya ${fmtNum(s.watts)} W (${fmtNum(s.amps)} A @${state.voltage} V) · Panas ${Math.round(s.btu).toLocaleString("id-ID")} BTU/jam · Berat ${fmtNum(s.kg)} kg`,
  ].join("\n");
}
