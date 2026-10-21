/**
 * Perkiraan kebutuhan bandwidth: murni perhitungan (tanpa database), dipakai halaman
 * /hitung-bandwidth di browser.
 *
 * Model per paket:
 *   user online saat jam sibuk  = jumlah user × % online puncak
 *   beban tiap user online      = batas kecepatan × intensitas × pengali skenario
 *   kebutuhan puncak paket      = user online × beban tiap user
 * Kebutuhan seluruh paket dijumlahkan, lalu ditambah cadangan (headroom).
 */

export type ServiceKind = "pppoe" | "hotspot" | "dhcp";

export interface Plan {
  id: string;
  name: string;
  /** Batas download per user (Mbps). */
  down: number;
  /** Batas upload per user (Mbps). */
  up: number;
  /** Jumlah user (pelanggan/voucher/perangkat) di paket ini. */
  users: number;
  /** Hanya layanan DHCP: subnet/IP tujuan simple queue, mis. 192.168.10.0/24. */
  target: string;
}

export interface Service {
  kind: ServiceKind;
  enabled: boolean;
  /** Persen user yang online bersamaan saat jam sibuk. */
  online: number;
  /** Persen dari batas kecepatan yang benar-benar dipakai tiap user online saat sibuk. */
  intensity: number;
  plans: Plan[];
}

export type Scenario = "hemat" | "normal" | "aman";

export interface Assumptions {
  /** Cadangan di atas kebutuhan puncak (%). */
  headroom: number;
  scenario: Scenario;
  /** Jumlah ISP (jalur) yang akan dipakai bersama (Load Balance). */
  isps: number;
}

export interface BandwidthState {
  services: Service[];
  assumptions: Assumptions;
}

export const SERVICE_LABEL: Record<ServiceKind, string> = {
  pppoe: "PPPoE",
  hotspot: "Hotspot",
  dhcp: "IP DHCP",
};

export const SERVICE_HINT: Record<ServiceKind, string> = {
  pppoe: "Pelanggan rumahan/RT-RW Net dengan akun PPPoE dan paket tetap.",
  hotspot: "Pengguna voucher di warnet, kafe, atau area publik.",
  dhcp: "Perangkat yang mendapat IP lewat DHCP, dibatasi per subnet (mis. kantor, kost).",
};

/** Pengali intensitas tiap skenario. */
export const SCENARIO_FACTOR: Record<Scenario, number> = { hemat: 0.7, normal: 1, aman: 1.4 };

export const SCENARIO_LABEL: Record<Scenario, string> = {
  hemat: "Hemat (×0,7)",
  normal: "Normal (×1)",
  aman: "Aman (×1,4)",
};

/** Profil pemakaian siap pakai untuk mengisi intensitas. */
export const USAGE_PRESETS: Array<{ id: string; label: string; intensity: number; hint: string }> = [
  { id: "ringan", label: "Ringan", intensity: 15, hint: "Browsing, chat, media sosial" },
  { id: "sedang", label: "Sedang", intensity: 30, hint: "Video streaming SD/HD bergantian" },
  { id: "berat", label: "Berat", intensity: 50, hint: "Streaming HD, game online, unduhan" },
];

/** Ukuran paket ISP yang lazim dijual (Mbps). */
export const ISP_TIERS = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500, 1000, 2000, 5000, 10000];

export function newPlan(partial: Partial<Plan> = {}): Plan {
  return {
    id: `plan-${Math.random().toString(36).slice(2, 8)}`,
    name: "Paket baru",
    down: 10,
    up: 5,
    users: 10,
    target: "",
    ...partial,
  };
}

export function defaultState(): BandwidthState {
  return {
    services: [
      {
        kind: "pppoe",
        enabled: true,
        online: 60,
        intensity: 30,
        plans: [
          newPlan({ name: "Paket 10 Mbps", down: 10, up: 5, users: 30 }),
          newPlan({ name: "Paket 20 Mbps", down: 20, up: 10, users: 15 }),
        ],
      },
      {
        kind: "hotspot",
        enabled: true,
        online: 40,
        intensity: 25,
        plans: [newPlan({ name: "Voucher 5 Mbps", down: 5, up: 2, users: 50 })],
      },
      {
        kind: "dhcp",
        enabled: false,
        online: 70,
        intensity: 20,
        plans: [newPlan({ name: "Kantor", down: 10, up: 5, users: 20, target: "192.168.10.0/24" })],
      },
    ],
    assumptions: { headroom: 20, scenario: "normal", isps: 1 },
  };
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
/** Angka tersimpan bila valid; bila hilang/rusak, kembali ke nilai bawaan. */
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;

/** Memulihkan data tersimpan (localStorage) menjadi bentuk yang pasti valid. */
export function normalizeState(raw: unknown): BandwidthState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, unknown>;

  const savedServices = Array.isArray(input.services) ? (input.services as Array<Record<string, unknown>>) : [];
  const services = base.services.map((def) => {
    const saved = savedServices.find((s) => s && s.kind === def.kind);
    if (!saved) return def;
    const plans = Array.isArray(saved.plans)
      ? (saved.plans as Array<Record<string, unknown>>).slice(0, 20).map((p) =>
          newPlan({
            id: typeof p.id === "string" && p.id ? p.id.slice(0, 20) : undefined,
            name: typeof p.name === "string" ? p.name.slice(0, 40) : "Paket",
            down: num(p.down, 10, 0, 100000),
            up: num(p.up, 5, 0, 100000),
            users: Math.round(num(p.users, 10, 0, 1000000)),
            target: typeof p.target === "string" ? p.target.slice(0, 40) : "",
          }),
        )
      : def.plans;
    return {
      kind: def.kind,
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : def.enabled,
      online: num(saved.online, def.online, 1, 100),
      intensity: num(saved.intensity, def.intensity, 1, 100),
      plans,
    };
  });

  const a = (input.assumptions && typeof input.assumptions === "object" ? input.assumptions : {}) as Record<string, unknown>;
  const scenario: Scenario = a.scenario === "hemat" || a.scenario === "aman" ? a.scenario : "normal";
  return {
    services,
    assumptions: {
      headroom: num(a.headroom, base.assumptions.headroom, 0, 200),
      scenario,
      isps: Math.round(num(a.isps, 1, 1, 8)),
    },
  };
}

/* --------------------------------------------------------------- hitung */

export interface PlanResult {
  plan: Plan;
  onlineUsers: number;
  /** Jumlah batas seluruh user (kasus terburuk, semua user penuh bersamaan). */
  worstDown: number;
  worstUp: number;
  peakDown: number;
  peakUp: number;
}

export interface ServiceResult {
  kind: ServiceKind;
  users: number;
  onlineUsers: number;
  plans: PlanResult[];
  worstDown: number;
  worstUp: number;
  peakDown: number;
  peakUp: number;
}

export interface BandwidthResult {
  services: ServiceResult[];
  users: number;
  onlineUsers: number;
  worstDown: number;
  worstUp: number;
  peakDown: number;
  peakUp: number;
  /** Kebutuhan puncak + cadangan. */
  needDown: number;
  needUp: number;
  /** Paket ISP terdekat yang cukup (Mbps). */
  tierDown: number;
  tierUp: number;
  /** Rasio overbooking: total batas kecepatan dibanding paket ISP yang disarankan (1 : x). */
  overbooking: number;
  perIsp: {
    isps: number;
    /** Bagian tiap ISP saat semua jalur hidup. */
    normal: number;
    /** Bagian tiap ISP bila satu ISP mati (null bila hanya satu ISP). */
    failover: number | null;
  };
}

export function tierFor(mbps: number): number {
  if (!(mbps > 0)) return 0;
  const found = ISP_TIERS.find((t) => t >= mbps);
  if (found) return found;
  return Math.ceil(mbps / 1000) * 1000;
}

export function calculateBandwidth(state: BandwidthState): BandwidthResult {
  const factor = SCENARIO_FACTOR[state.assumptions.scenario];
  const services: ServiceResult[] = [];

  for (const svc of state.services) {
    if (!svc.enabled) continue;
    const load = Math.min(1, (svc.intensity / 100) * factor);
    const plans: PlanResult[] = svc.plans.map((plan) => {
      const onlineUsers = plan.users * (svc.online / 100);
      return {
        plan,
        onlineUsers,
        worstDown: plan.users * plan.down,
        worstUp: plan.users * plan.up,
        peakDown: onlineUsers * plan.down * load,
        peakUp: onlineUsers * plan.up * load,
      };
    });
    const sum = (pick: (p: PlanResult) => number) => plans.reduce((s, p) => s + pick(p), 0);
    services.push({
      kind: svc.kind,
      users: sum((p) => p.plan.users),
      onlineUsers: sum((p) => p.onlineUsers),
      plans,
      worstDown: sum((p) => p.worstDown),
      worstUp: sum((p) => p.worstUp),
      peakDown: sum((p) => p.peakDown),
      peakUp: sum((p) => p.peakUp),
    });
  }

  const total = (pick: (s: ServiceResult) => number) => services.reduce((s, v) => s + pick(v), 0);
  const peakDown = total((s) => s.peakDown);
  const peakUp = total((s) => s.peakUp);
  const worstDown = total((s) => s.worstDown);
  const worstUp = total((s) => s.worstUp);
  const mult = 1 + state.assumptions.headroom / 100;
  const needDown = peakDown * mult;
  const needUp = peakUp * mult;
  const tierDown = tierFor(needDown);
  const isps = state.assumptions.isps;

  return {
    services,
    users: total((s) => s.users),
    onlineUsers: total((s) => s.onlineUsers),
    worstDown,
    worstUp,
    peakDown,
    peakUp,
    needDown,
    needUp,
    tierDown,
    tierUp: tierFor(needUp),
    overbooking: tierDown > 0 ? worstDown / tierDown : 0,
    perIsp: {
      isps,
      normal: needDown / isps,
      failover: isps > 1 ? needDown / (isps - 1) : null,
    },
  };
}

/** Peringatan yang membantu pengguna menilai hasil. */
export function bandwidthWarnings(state: BandwidthState, result: BandwidthResult): string[] {
  const out: string[] = [];
  if (result.users === 0) return ["Belum ada user. Isi jumlah user di minimal satu paket."];
  if (result.overbooking > 15) {
    out.push(
      `Rasio overbooking ${result.overbooking.toFixed(1)} : 1 sangat tinggi — bila banyak user memakai kecepatan penuh bersamaan, jaringan akan terasa lambat. Naikkan paket ISP atau turunkan batas kecepatan.`,
    );
  } else if (result.overbooking > 8) {
    out.push(`Rasio overbooking ${result.overbooking.toFixed(1)} : 1 cukup tinggi; masih wajar untuk pemakaian ringan-sedang.`);
  }
  if (result.needUp > result.needDown) {
    out.push("Kebutuhan upload lebih besar dari download — periksa kembali batas upload tiap paket.");
  }
  for (const svc of state.services) {
    if (!svc.enabled) continue;
    for (const p of svc.plans) {
      if (p.users > 0 && (p.down <= 0 || p.up <= 0)) {
        out.push(`${SERVICE_LABEL[svc.kind]} · ${p.name || "paket"}: batas download/upload belum diisi.`);
      }
      if (p.up > p.down && p.down > 0) {
        out.push(`${SERVICE_LABEL[svc.kind]} · ${p.name || "paket"}: upload lebih besar dari download — biasanya sebaliknya.`);
      }
    }
  }
  if (result.perIsp.isps > 1 && result.perIsp.failover) {
    out.push(
      `Dengan ${result.perIsp.isps} ISP, agar tetap cukup saat satu ISP mati, tiap ISP sebaiknya ≥ ${fmtMbps(result.perIsp.failover)}.`,
    );
  }
  return out;
}

export function fmtMbps(value: number): string {
  if (!(value > 0)) return "0 Mbps";
  if (value >= 1000) return `${(value / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Gbps`;
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: value < 10 ? 2 : 1 })} Mbps`;
}

/* ------------------------------------------------------------ RouterOS */

function slug(name: string, fallback: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

/** Angka Mbps ke format rate RouterOS: 10 → "10M", 0.5 → "512k". */
function rate(mbps: number): string {
  if (!(mbps > 0)) return "0";
  if (mbps < 1) return `${Math.round(mbps * 1024)}k`;
  return `${Number.isInteger(mbps) ? mbps : Math.round(mbps * 10) / 10}M`;
}

const BRAND = "By Mikrosetting";

/**
 * Perintah RouterOS untuk membuat pembatasan tiap paket:
 * PPPoE → /ppp profile, Hotspot → /ip hotspot user profile,
 * DHCP → tipe PCQ + simple queue per subnet (batas per perangkat).
 * rate-limit RouterOS berformat upload/download dari sisi router (rx/tx).
 */
export function generateBandwidthScript(state: BandwidthState): string {
  const lines: string[] = [
    "# Pembatasan bandwidth per paket — dibuat dari menu Hitung Bandwidth",
    "# Generated by Mikrosetting.com",
    "# Format rate-limit: upload/download (sisi router: rx/tx)",
  ];
  let any = false;

  for (const svc of state.services) {
    if (!svc.enabled) continue;
    const plans = svc.plans.filter((p) => p.name.trim() && p.down > 0 && p.up > 0);
    if (plans.length === 0) continue;
    any = true;
    lines.push("");

    if (svc.kind === "pppoe") {
      lines.push("/ppp profile");
      plans.forEach((p, i) => {
        lines.push(`add name=${slug(p.name, `paket-${i + 1}`)} rate-limit=${rate(p.up)}/${rate(p.down)} comment="${p.name.trim().replace(/"/g, "")} - ${BRAND}"`);
      });
    } else if (svc.kind === "hotspot") {
      lines.push("/ip hotspot user profile");
      plans.forEach((p, i) => {
        lines.push(`add name=${slug(p.name, `voucher-${i + 1}`)} rate-limit=${rate(p.up)}/${rate(p.down)} shared-users=1 comment="${p.name.trim().replace(/"/g, "")} - ${BRAND}"`);
      });
    } else {
      lines.push("# DHCP: batas dibagi rata per perangkat memakai PCQ; target = subnet paket");
      lines.push("/queue type");
      plans.forEach((p, i) => {
        const s = slug(p.name, `dhcp-${i + 1}`);
        lines.push(`add name=pcq-${s}-down kind=pcq pcq-rate=${rate(p.down)} pcq-classifier=dst-address`);
        lines.push(`add name=pcq-${s}-up kind=pcq pcq-rate=${rate(p.up)} pcq-classifier=src-address`);
      });
      lines.push("/queue simple");
      plans.forEach((p, i) => {
        const s = slug(p.name, `dhcp-${i + 1}`);
        const target = p.target.trim() || "192.168.10.0/24";
        lines.push(
          `add name=q-${s} target=${target} queue=pcq-${s}-up/pcq-${s}-down comment="${p.name.trim().replace(/"/g, "")} - ${BRAND}"`,
        );
      });
    }
  }

  if (!any) lines.push("", "# Belum ada paket yang lengkap (nama, download, dan upload harus diisi).");
  return lines.join("\n");
}
