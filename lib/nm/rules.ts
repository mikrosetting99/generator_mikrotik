import type { FindingEvidence, RuleConfig, RuleId, Sample } from "@/lib/nm/types";

/**
 * Aturan Analisa Tahap 1. Murni: menerima sampel tersimpan dan temuan yang sedang aktif, lalu
 * mengembalikan temuan yang harus dibuka, diperbarui, atau dipulihkan. Tidak ada aturan yang
 * dinilai dari data yang tidak ada: bila router tidak terjangkau atau API gagal, aturan CPU,
 * WAN, dan PPPoE tidak dibuka maupun dipulihkan (statusnya "belum terverifikasi").
 */

export interface ActiveFinding {
  key: string;
  rule: RuleId;
  subject: string;
  startedAt: number;
  evidence: FindingEvidence;
}

export interface FindingDraft {
  key: string;
  rule: RuleId;
  subject: string;
  summary: string;
  triggerValue: string;
  evidence: FindingEvidence;
  /** Waktu mulai gangguan (sampel pertama yang memenuhi kondisi), bukan waktu evaluasi. */
  startedAt: number;
}

export interface Evaluation {
  open: FindingDraft[];
  /** Temuan aktif yang kondisinya masih terpenuhi (lastSeenAt diperbarui). */
  touch: string[];
  resolve: Array<{ key: string; recovery: string }>;
}

export interface EvaluateInput {
  deviceId: string;
  deviceName: string;
  cfg: RuleConfig;
  intervalSec: number;
  wanNames: string[];
  /** Urut naik menurut waktu; cukup mencakup jendela aturan terpanjang + beberapa sampel. */
  samples: Sample[];
  active: ActiveFinding[];
  now: number;
}

/** Kunci satu temuan aktif: perangkat + aturan + interface (bila relevan). */
export const findingKey = (deviceId: string, rule: RuleId, subject = "") => `${deviceId}:${rule}:${subject}`;

const clock = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
/** Jam WIB untuk teks temuan, mis. "14.05 WIB". */
export const hhmm = (ms: number) => `${clock.format(new Date(ms))} WIB`;

function maxGap(list: Sample[]): number {
  let g = 0;
  for (let i = 1; i < list.length; i++) g = Math.max(g, list[i].at - list[i - 1].at);
  return g;
}

/** Awal deretan sampel terakhir yang memenuhi `pred` (untuk waktu mulai gangguan). */
function streakStart(samples: Sample[], pred: (s: Sample) => boolean): number {
  let i = samples.length - 1;
  while (i > 0 && pred(samples[i - 1])) i--;
  return samples[i]?.at ?? 0;
}

/** Sampel cukup lengkap untuk mencakup jendela `windowMs`: rentang penuh dan tanpa celah besar. */
export function coversWindow(win: Sample[], windowMs: number, intervalMs: number): boolean {
  if (win.length < 2) return false;
  return win[win.length - 1].at - win[0].at >= windowMs - intervalMs / 2 && maxGap(win) <= 2 * intervalMs;
}

export function evaluate(input: EvaluateInput): Evaluation {
  const { deviceId, deviceName, cfg, samples, now } = input;
  const I = input.intervalSec * 1000;
  const out: Evaluation = { open: [], touch: [], resolve: [] };
  const latest = samples[samples.length - 1];
  if (!latest) return out;
  const activeBy = new Map(input.active.map((a) => [a.key, a]));
  const want = (d: FindingDraft) => (activeBy.has(d.key) ? out.touch.push(d.key) : out.open.push(d));
  const resolveIf = (key: string, recovery: string) => {
    if (activeBy.has(key)) out.resolve.push({ key, recovery });
  };
  const keepIf = (key: string) => {
    if (activeBy.has(key)) out.touch.push(key);
  };
  // Sampel terakhir harus segar; sampel lama tidak boleh membuka atau memulihkan apa pun.
  const fresh = now - latest.at <= 2 * I;

  /* ------------------------------------------------ router tidak terjangkau */
  const kU = findingKey(deviceId, "unreachable");
  const lastU = samples.slice(-cfg.unreachableChecks);
  if (fresh && lastU.length === cfg.unreachableChecks && lastU.every((s) => !s.reachable)) {
    const since = streakStart(samples, (s) => !s.reachable);
    want({
      key: kU,
      rule: "unreachable",
      subject: "",
      startedAt: since,
      summary: `${deviceName} tidak terjangkau sejak ${hhmm(since)}`,
      triggerValue: `${lastU.length} pemeriksaan berturut-turut gagal: ${latest.error || "ICMP dan port API tidak menjawab"}`,
      evidence: { unit: "status", samples: samples.slice(-10).map((s) => ({ at: s.at, value: s.reachable ? 1 : 0, note: s.reachable ? "terjangkau" : s.error || "tidak terjangkau" })) },
    });
  } else if (fresh && latest.reachable) {
    resolveIf(kU, `Router kembali terjangkau pada ${hhmm(latest.at)}`);
  }

  /* ------------------------- router terjangkau tetapi metrik gagal diambil */
  const kA = findingKey(deviceId, "api_error");
  const lastA = samples.slice(-2);
  if (fresh && lastA.length === 2 && lastA.every((s) => s.reachable && !s.apiOk)) {
    const since = streakStart(samples, (s) => s.reachable && !s.apiOk);
    want({
      key: kA,
      rule: "api_error",
      subject: "api",
      startedAt: since,
      summary: `Metrik ${deviceName} gagal diambil lewat RouterOS API`,
      triggerValue: latest.error || "API tidak menjawab",
      evidence: { unit: "status", samples: samples.slice(-10).map((s) => ({ at: s.at, value: s.apiOk ? 1 : 0, note: s.apiOk ? "API OK" : s.error || "API gagal" })) },
    });
  } else if (fresh && latest.apiOk) {
    resolveIf(kA, `API kembali menjawab pada ${hhmm(latest.at)}`);
  } else if (fresh && !latest.reachable) {
    // Router tidak terjangkau: masalah API tertutup oleh temuan "tidak terjangkau", biarkan aktif.
    keepIf(kA);
  }

  const usable = latest.apiOk && fresh;

  /* -------------------------------------------------------------- CPU tinggi */
  const kC = findingKey(deviceId, "cpu_high");
  if (usable && latest.cpu !== null) {
    const W = cfg.cpuMinutes * 60_000;
    const win = samples.filter((s) => s.apiOk && s.cpu !== null && s.at >= now - W - I / 2);
    const thr = cfg.cpuThreshold;
    if (coversWindow(win, W, I) && win.every((s) => (s.cpu as number) > thr)) {
      const vals = win.map((s) => s.cpu as number);
      want({
        key: kC,
        rule: "cpu_high",
        subject: "",
        startedAt: streakStart(samples, (s) => s.apiOk && s.cpu !== null && s.cpu > thr),
        summary: `CPU ${deviceName} di atas ${thr}% selama ${cfg.cpuMinutes} menit`,
        triggerValue: `CPU ${Math.min(...vals)}–${Math.max(...vals)}% pada ${win.length} sampel (ambang ${thr}%)`,
        evidence: { unit: "%", threshold: thr, windowMinutes: cfg.cpuMinutes, current: latest.cpu, samples: win.map((s) => ({ at: s.at, value: s.cpu })) },
      });
    } else if (latest.cpu <= thr) {
      resolveIf(kC, `CPU turun ke ${latest.cpu}% pada ${hhmm(latest.at)}`);
    } else {
      keepIf(kC);
    }
  } else {
    keepIf(kC);
  }

  /* ----------------------------------------------------------- WAN link down */
  const entry = (s: Sample, name: string) => s.wan?.find((w) => w.name === name);
  const verified = (s: Sample, name: string) => s.apiOk && entry(s, name)?.found === true;
  for (const name of input.wanNames) {
    const k = findingKey(deviceId, "wan_down", name);
    const lastN = samples.slice(-cfg.wanChecks);
    const isDown = (s: Sample) => verified(s, name) && !entry(s, name)!.running;
    if (fresh && lastN.length === cfg.wanChecks && lastN.every(isDown)) {
      const since = streakStart(samples, isDown);
      const disabled = entry(latest, name)?.disabled;
      want({
        key: k,
        rule: "wan_down",
        subject: name,
        startedAt: since,
        summary: `WAN ${name} di ${deviceName} down${disabled ? " (interface dinonaktifkan)" : ""}`,
        triggerValue: `${name} running=false pada ${lastN.length} pemeriksaan berturut-turut`,
        evidence: {
          unit: "status",
          samples: samples.slice(-10).map((s) => {
            const e = entry(s, name);
            return { at: s.at, value: verified(s, name) ? (e!.running ? 1 : 0) : null, note: !s.reachable ? "router tidak terjangkau" : !s.apiOk ? "API gagal" : !e?.found ? "interface tidak ada" : e.running ? "up" : e.disabled ? "disabled" : "down" };
          }),
        },
      });
    } else if (fresh && verified(latest, name) && entry(latest, name)!.running) {
      resolveIf(k, `Link ${name} kembali up pada ${hhmm(latest.at)}`);
    } else {
      keepIf(k);
    }
  }
  // WAN yang tidak lagi dipantau: tutup temuannya.
  for (const a of input.active) {
    if (a.rule === "wan_down" && !input.wanNames.includes(a.subject)) out.resolve.push({ key: a.key, recovery: `Interface ${a.subject} tidak lagi dipantau sebagai WAN` });
  }

  /* -------------------------------------------------------- sesi PPPoE turun */
  const kP = findingKey(deviceId, "ppp_drop");
  if (usable && latest.ppp !== null) {
    const pct = cfg.pppDropPct;
    const act = activeBy.get(kP);
    if (act) {
      const base = act.evidence.baseline ?? 0;
      const drop = base > 0 ? ((base - latest.ppp) / base) * 100 : 0;
      if (drop <= pct) resolveIf(kP, `Sesi PPPoE pulih ke ${latest.ppp} (awal ${base}) pada ${hhmm(latest.at)}`);
      else keepIf(kP);
    } else {
      const W = cfg.pppMinutes * 60_000;
      const win = samples.filter((s) => s.apiOk && s.ppp !== null && s.at >= now - W - I / 2);
      const base = win[0];
      if (win.length >= 2 && base !== latest && (base.ppp as number) >= cfg.pppMinBase) {
        const b = base.ppp as number;
        const drop = ((b - latest.ppp) / b) * 100;
        if (drop > pct) {
          want({
            key: kP,
            rule: "ppp_drop",
            subject: "pppoe",
            startedAt: latest.at,
            summary: `Sesi PPPoE ${deviceName} turun ${Math.round(drop)}% dalam ${cfg.pppMinutes} menit`,
            triggerValue: `${b} → ${latest.ppp} sesi (turun ${Math.round(drop)}%, ambang ${pct}%, minimal awal ${cfg.pppMinBase})`,
            evidence: { unit: "sesi", baseline: b, current: latest.ppp, windowMinutes: cfg.pppMinutes, threshold: Math.ceil(b * (1 - pct / 100)), samples: win.map((s) => ({ at: s.at, value: s.ppp })) },
          });
        }
      }
    }
  } else {
    keepIf(kP);
  }

  return out;
}
