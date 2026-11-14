import { blankResult, pollDevice, type CollectorDevice } from "@/lib/nm/collector";
import type { PollResult } from "@/lib/nm/poller";
import { buildDeviceView, splitWan } from "@/lib/nm/status";
import { MemoryStore } from "@/lib/nm/store-memory";
import { normalizeRules, type DeviceDetailView, type DevicesResponse, type FindingView } from "@/lib/nm/types";

/**
 * Mode demo: data simulasi yang dijalankan lewat collector dan aturan yang sama dengan produksi
 * (store memori, tanpa jaringan). Hanya dipakai bila pengguna menyalakan mode demo; tampilan
 * selalu memberi label "Mode demo".
 */

interface DemoSpec {
  id: string;
  name: string;
  site: string;
  kind: string;
  vendor: string;
  wan: string;
  /** Hasil poll pada menit ke-i (0 = paling lama) dari total n menit. */
  sim?: (i: number, n: number) => Partial<PollResult> | "down" | "apifail";
}

const MINUTES = 180;

/** Acak deterministik supaya demo tidak berubah-ubah antar render. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function router(seed: number, opts: { cpu?: (i: number, n: number) => number; ppp?: (i: number, n: number) => number; wanUp?: (i: number, n: number) => boolean; hotspot?: boolean } = {}) {
  const r = rng(seed);
  let rx = 1e9 * seed;
  let tx = 4e8 * seed;
  return (i: number, n: number): Partial<PollResult> => {
    const load = 0.55 + 0.35 * Math.sin((i / n) * Math.PI * 2 + seed);
    const up = opts.wanUp ? opts.wanUp(i, n) : true;
    // Link down: counter berhenti (tidak ada trafik), seperti di router sungguhan.
    if (up) {
      rx += (60e6 + 90e6 * load + r() * 20e6) * 7.5; // ≈ bit/s × 60/8
      tx += (8e6 + 12e6 * load + r() * 4e6) * 7.5;
    }
    return {
      reachable: true,
      reachVia: "tcp",
      apiOk: true,
      identity: `DEMO-${seed}`,
      version: seed % 2 ? "7.15.3 (stable)" : "6.49.17 (long-term)",
      board: seed % 2 ? "RB4011iGS+" : "CCR1036-8G-2S+",
      uptimeSec: 86400 * 12 + i * 60,
      cpu: Math.round(opts.cpu ? opts.cpu(i, n) : 18 + 22 * load + r() * 6),
      memPct: Math.round((38 + 10 * load + r() * 3) * 10) / 10,
      ppp: Math.round(opts.ppp ? opts.ppp(i, n) : 140 + 60 * load + r() * 4),
      hotspot: opts.hotspot ? Math.round(30 + 25 * load) : null,
      sourceErrors: { ppp: null, hotspot: opts.hotspot ? null : "Hotspot tidak tersedia: no such command prefix" },
      interfaces: [
        { name: "ether1-isp", type: "ether", running: up, disabled: false, rxByte: rx, txByte: tx },
        { name: "ether2-isp2", type: "ether", running: true, disabled: false, rxByte: rx / 3, txByte: tx / 3 },
        { name: "bridge-lan", type: "bridge", running: true, disabled: false, rxByte: tx, txByte: rx },
      ],
    };
  };
}

/** Dibuat baru setiap demo dibangun: counter simulasi tiap router bertahan antar menit di satu demo. */
const specs = (): DemoSpec[] => [
  { id: "demo-pusat", name: "RB-Pusat-Core", site: "Kantor Pusat", kind: "router", vendor: "mikrotik", wan: "ether1-isp,ether2-isp2", sim: router(1) },
  {
    id: "demo-cabang-a",
    name: "RB-Cabang-Utara",
    site: "Cabang Utara",
    kind: "router",
    vendor: "mikrotik",
    wan: "ether1-isp",
    sim: router(2, { cpu: (i, n) => (i > n - 9 ? 94 + (i % 4) : 35 + (i % 9)) }),
  },
  {
    id: "demo-cabang-b",
    name: "RB-Cabang-Selatan",
    site: "Cabang Selatan",
    kind: "router",
    vendor: "mikrotik",
    wan: "ether1-isp,ether2-isp2",
    sim: router(3, { wanUp: (i, n) => i < n - 14 }),
  },
  {
    id: "demo-pop",
    name: "CCR-POP-Timur",
    site: "POP Timur",
    kind: "router",
    vendor: "mikrotik",
    wan: "ether1-isp",
    sim: ((r) => (i: number, n: number) => (i > n - 7 ? "down" : r(i, n)))(router(4)),
  },
  {
    id: "demo-bras",
    name: "CCR-BRAS-PPPoE",
    site: "Kantor Pusat",
    kind: "router",
    vendor: "mikrotik",
    wan: "ether1-isp",
    // Sesi PPPoE jatuh 480 → 310 sekitar 70 menit lalu lalu pulih 20 menit kemudian.
    sim: router(5, { ppp: (i, n) => (i > n - 72 && i < n - 50 ? 310 + (i % 5) : 480 + (i % 7)), hotspot: true }),
  },
  { id: "demo-ap", name: "cAP-Lobby", site: "Kantor Pusat", kind: "ap", vendor: "mikrotik", wan: "", sim: router(6) },
  { id: "demo-hex", name: "hEX-Gudang", site: "Cabang Utara", kind: "router", vendor: "mikrotik", wan: "ether1-isp", sim: ((r) => (i: number, n: number) => (i > n - 4 ? "apifail" : r(i, n)))(router(7)) },
  { id: "demo-olt", name: "OLT-HSGQ-01", site: "POP Timur", kind: "olt", vendor: "other", wan: "" },
  { id: "demo-onu", name: "ONU-Pelanggan-0142", site: "POP Timur", kind: "onu", vendor: "other", wan: "" },
  { id: "demo-srv", name: "SRV-RADIUS", site: "Kantor Pusat", kind: "server", vendor: "other", wan: "" },
];

export interface DemoData {
  list: DevicesResponse;
  details: Record<string, DeviceDetailView>;
  findings: FindingView[];
}

export async function buildDemo(now: number): Promise<DemoData> {
  const store = new MemoryStore();
  const start = now - MINUTES * 60_000;
  const SPECS = specs();
  for (const s of SPECS) {
    store.addDevice({ id: s.id, userId: "demo", name: s.name, kind: s.kind, vendor: s.vendor, host: "203.0.113.10", wanInterfaces: s.wan }, { site: s.site });
  }
  for (const s of SPECS) {
    if (!s.sim) continue;
    const dev = store.devices.get(s.id)! as CollectorDevice;
    for (let i = 0; i < MINUTES; i++) {
      const at = start + i * 60_000;
      const sim = s.sim(i, MINUTES);
      const result: PollResult =
        sim === "down"
          ? blankResult("Tidak terjangkau: waktu habis (demo)")
          : sim === "apifail"
            ? { ...blankResult("Login router gagal: username atau password salah. (demo)"), reachable: true, reachVia: "tcp" }
            : { ...blankResult(""), ...sim };
      await pollDevice({ store, now: () => at, poll: async () => result }, dev);
    }
  }
  const findings = [...store.findings].sort((a, b) => b.startedAt - a.startedAt) as FindingView[];
  const active = findings.filter((f) => f.status === "active");
  const collector = { id: "demo", startedAt: start, lastBeatAt: now - 20_000, stale: false, info: { version: "demo" } };
  const nowSeen = now - 30_000;
  const details: Record<string, DeviceDetailView> = {};
  const devices = [...store.devices.values()].map((d) => {
    // Sampel terakhir dianggap baru saja (30 detik lalu) supaya status tidak kedaluwarsa.
    const shift = d.lastSampleAt ? nowSeen - d.lastSampleAt : 0;
    const view = buildDeviceView({ ...d, lastSampleAt: d.lastSampleAt ? nowSeen : null, state: d.state ? { ...d.state, at: nowSeen } : null }, active, collector, now);
    details[d.id] = {
      device: view,
      config: {
        apiPort: 8728,
        tls: false,
        tlsFingerprint: "",
        username: "nm-read",
        hasPassword: true,
        wanInterfaces: splitWan(d.wanInterfaces),
        rules: normalizeRules(d.rules),
        interfaces: d.state?.interfaces ?? [],
      },
      samples: (store.samples.get(d.id) ?? []).map((s) => ({ ...s, at: s.at + shift })),
      findings: findings.filter((f) => f.deviceId === d.id),
    };
    return view;
  });
  devices.sort((a, b) => a.name.localeCompare(b.name));
  return { list: { generatedAt: now, devices, findings: active, collector }, details, findings };
}
