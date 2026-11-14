import { evaluate, type ActiveFinding, type FindingDraft } from "@/lib/nm/rules";
import { splitWan } from "@/lib/nm/status";
import { counterRate } from "@/lib/nm/traffic";
import { normalizeRules, type DeviceState, type Sample, type WanSample } from "@/lib/nm/types";
import type { PollResult } from "@/lib/nm/poller";

/**
 * Siklus collector, terpisah dari proses web. Penyimpanan lewat antarmuka NmStore supaya alur
 * yang sama bisa diuji dengan store memori (scripts/test-nm.mts) dan dijalankan dengan Prisma
 * (scripts/nm-collector.mts).
 */

export interface CollectorDevice {
  id: string;
  userId: string;
  name: string;
  kind: string;
  vendor: string;
  host: string;
  apiPort: number;
  tls: boolean;
  tlsFingerprint: string;
  username: string;
  passwordEnc: string;
  intervalSec: number;
  wanInterfaces: string;
  rules: unknown;
  lastPollAt: number | null;
  state: DeviceState | null;
}

export interface NmStore {
  /** Perangkat aktif yang dipantau collector dan sudah waktunya diperiksa. */
  dueDevices(now: number): Promise<CollectorDevice[]>;
  /** Klaim atomik; false bila worker lain sudah mengambilnya untuk interval ini. */
  claim(id: string, now: number, intervalSec: number): Promise<boolean>;
  /** Sampel sejak `since`, urut naik. */
  recentSamples(deviceId: string, since: number): Promise<Sample[]>;
  saveSample(device: CollectorDevice, sample: Sample, state: DeviceState): Promise<void>;
  activeFindings(deviceId: string): Promise<ActiveFinding[]>;
  /** Membuka temuan; false bila temuan aktif dengan kunci sama sudah ada (retry/worker paralel). */
  openFinding(device: CollectorDevice, draft: FindingDraft, now: number): Promise<boolean>;
  touchFindings(keys: string[], now: number): Promise<void>;
  resolveFinding(key: string, now: number, recovery: string): Promise<void>;
  beat(collectorId: string, startedAt: number, now: number, info: Record<string, unknown>): Promise<void>;
  prune(samplesBefore: number, resolvedBefore: number): Promise<void>;
}

export interface CollectorDeps {
  store: NmStore;
  now: () => number;
  /** Membuka kredensial, memeriksa target yang diizinkan, lalu memeriksa perangkat. */
  poll: (device: CollectorDevice) => Promise<PollResult>;
  log?: (msg: string) => void;
}

export function blankResult(error: string): PollResult {
  return {
    reachable: false,
    reachVia: null,
    apiOk: false,
    error,
    identity: null,
    version: null,
    board: null,
    uptimeSec: null,
    cpu: null,
    memPct: null,
    ppp: null,
    hotspot: null,
    sourceErrors: { ppp: null, hotspot: null },
    interfaces: [],
  };
}

/** Rentang sampel yang dibaca aturan: jendela terpanjang + beberapa interval. */
export function lookbackMs(d: Pick<CollectorDevice, "rules" | "intervalSec">): number {
  const cfg = normalizeRules(d.rules);
  const I = d.intervalSec * 1000;
  const checks = Math.max(cfg.wanChecks, cfg.unreachableChecks, 10) + 1;
  return Math.max(cfg.cpuMinutes, cfg.pppMinutes) * 60_000 + Math.max(checks * I, 3 * I);
}

/** Satu pemeriksaan + simpan + evaluasi aturan untuk satu perangkat yang sudah diklaim. */
export async function pollDevice(deps: CollectorDeps, d: CollectorDevice): Promise<{ sample: Sample; opened: number; resolved: number }> {
  const { store } = deps;
  const now = deps.now();
  let res: PollResult;
  try {
    res = await deps.poll(d);
  } catch (e) {
    res = blankResult(e instanceof Error ? e.message : "Gagal memeriksa perangkat.");
  }

  const history = await store.recentSamples(d.id, now - lookbackMs(d));
  const prev = history[history.length - 1] ?? null;
  const wanNames = splitWan(d.wanInterfaces);
  const maxGap = 3 * d.intervalSec * 1000;

  let wan: WanSample[] | null = null;
  if (res.apiOk) {
    wan = wanNames.map((name) => {
      const i = res.interfaces.find((x) => x.name === name);
      if (!i) return { name, found: false, running: false, disabled: false, rxByte: null, txByte: null, rxBps: null, txBps: null };
      const p = prev?.apiOk ? prev.wan?.find((w) => w.name === name && w.found) : undefined;
      const prevPt = (byte: number | null) => (p && prev ? { at: prev.at, uptimeSec: prev.uptimeSec, byte } : null);
      const rx = counterRate(prevPt(p?.rxByte ?? null), { at: now, uptimeSec: res.uptimeSec, byte: i.rxByte }, maxGap);
      const tx = counterRate(prevPt(p?.txByte ?? null), { at: now, uptimeSec: res.uptimeSec, byte: i.txByte }, maxGap);
      return { name, found: true, running: i.running, disabled: i.disabled, rxByte: i.rxByte, txByte: i.txByte, rxBps: rx.bps, txBps: tx.bps };
    });
  }

  const sample: Sample = {
    at: now,
    reachable: res.reachable,
    apiOk: res.apiOk,
    cpu: res.apiOk ? res.cpu : null,
    memPct: res.apiOk ? res.memPct : null,
    uptimeSec: res.apiOk ? res.uptimeSec : null,
    ppp: res.apiOk ? res.ppp : null,
    hotspot: res.apiOk ? res.hotspot : null,
    wan,
    error: res.error.slice(0, 300),
  };
  const state: DeviceState = {
    at: now,
    reachable: res.reachable,
    reachVia: res.reachVia,
    apiOk: res.apiOk,
    error: sample.error,
    // Identitas dan daftar interface dipertahankan dari sampel sebelumnya saat API gagal.
    identity: res.identity ?? d.state?.identity ?? null,
    version: res.version ?? d.state?.version ?? null,
    board: res.board ?? d.state?.board ?? null,
    uptimeSec: sample.uptimeSec,
    cpu: sample.cpu,
    memPct: sample.memPct,
    ppp: sample.ppp,
    hotspot: sample.hotspot,
    sources: res.apiOk ? res.sourceErrors : { ppp: d.state?.sources.ppp ?? null, hotspot: d.state?.sources.hotspot ?? null },
    wan: wan ?? [],
    interfaces: res.apiOk ? res.interfaces.map((i) => i.name).slice(0, 300) : (d.state?.interfaces ?? []),
  };
  await store.saveSample(d, sample, state);

  const ev = evaluate({
    deviceId: d.id,
    deviceName: d.name,
    cfg: normalizeRules(d.rules),
    intervalSec: d.intervalSec,
    wanNames,
    samples: [...history, sample],
    active: await store.activeFindings(d.id),
    now,
  });
  let opened = 0;
  for (const draft of ev.open) if (await store.openFinding(d, draft, now)) opened++;
  if (ev.touch.length) await store.touchFindings(ev.touch, now);
  for (const r of ev.resolve) await store.resolveFinding(r.key, now, r.recovery);
  return { sample, opened, resolved: ev.resolve.length };
}

export interface CycleResult {
  due: number;
  polled: number;
  skipped: number;
  ms: number;
}

/** Satu putaran: ambil perangkat yang jatuh tempo, klaim, periksa paralel terbatas, kirim detak. */
export async function runCycle(deps: CollectorDeps, opts: { collectorId: string; startedAt: number; concurrency: number; version: string }): Promise<CycleResult> {
  const t0 = deps.now();
  const due = await deps.store.dueDevices(t0);
  let polled = 0;
  let skipped = 0;
  const queue = [...due];
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try {
        if (!(await deps.store.claim(d.id, deps.now(), d.intervalSec))) {
          skipped++;
          continue;
        }
        await pollDevice(deps, d);
        polled++;
      } catch (e) {
        deps.log?.(`perangkat ${d.id}: ${e instanceof Error ? e.message : "galat"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency, queue.length)) }, worker));
  const ms = deps.now() - t0;
  await deps.store.beat(opts.collectorId, opts.startedAt, deps.now(), { version: opts.version, devices: due.length, polled, lastCycleMs: ms });
  return { due: due.length, polled, skipped, ms };
}
