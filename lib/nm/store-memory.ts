import type { CollectorDevice, NmStore } from "@/lib/nm/collector";
import type { ActiveFinding, FindingDraft } from "@/lib/nm/rules";
import { isCollected, MIN_INTERVAL, type DeviceState, type FindingView, type Sample } from "@/lib/nm/types";

/**
 * Store di memori dengan aturan yang sama seperti tabel MySQL: klaim atomik per interval dan
 * activeKey unik. Dipakai untuk tes dan mode simulasi; tidak dipakai di produksi.
 */

interface MemFinding extends FindingView {
  userId: string;
  activeKey: string | null;
}

export class MemoryStore implements NmStore {
  devices = new Map<string, CollectorDevice & { enabled: boolean; site: string; lastSampleAt: number | null }>();
  samples = new Map<string, Sample[]>();
  findings: MemFinding[] = [];
  beats = new Map<string, { startedAt: number; lastBeatAt: number; info: Record<string, unknown> }>();
  private seq = 0;

  addDevice(d: Partial<CollectorDevice> & Pick<CollectorDevice, "id" | "userId" | "name">, extra: { enabled?: boolean; site?: string } = {}) {
    this.devices.set(d.id, {
      kind: "router",
      vendor: "mikrotik",
      host: "203.0.113.1",
      apiPort: 8728,
      tls: false,
      tlsFingerprint: "",
      username: "monitor",
      passwordEnc: "",
      intervalSec: 60,
      wanInterfaces: "",
      rules: null,
      lastPollAt: null,
      state: null,
      ...d,
      enabled: extra.enabled ?? true,
      site: extra.site ?? "",
      lastSampleAt: null,
    });
  }

  async dueDevices(now: number) {
    return [...this.devices.values()].filter(
      (d) => d.enabled && isCollected(d.kind, d.vendor) && (d.lastPollAt === null || d.lastPollAt <= now - Math.max(d.intervalSec, MIN_INTERVAL) * 1000 + 5000),
    );
  }

  async claim(id: string, now: number, intervalSec: number) {
    const d = this.devices.get(id);
    if (!d) return false;
    if (d.lastPollAt !== null && d.lastPollAt > now - intervalSec * 1000 + 5000) return false;
    d.lastPollAt = now;
    return true;
  }

  async recentSamples(deviceId: string, since: number) {
    return (this.samples.get(deviceId) ?? []).filter((s) => s.at >= since);
  }

  async saveSample(device: CollectorDevice, sample: Sample, state: DeviceState) {
    const list = this.samples.get(device.id) ?? [];
    list.push(sample);
    this.samples.set(device.id, list);
    const d = this.devices.get(device.id);
    if (d) {
      d.state = state;
      d.lastSampleAt = sample.at;
    }
  }

  async activeFindings(deviceId: string): Promise<ActiveFinding[]> {
    return this.findings
      .filter((f) => f.deviceId === deviceId && f.activeKey)
      .map((f) => ({ key: f.activeKey!, rule: f.rule, subject: f.subject, startedAt: f.startedAt, evidence: f.evidence }));
  }

  async openFinding(device: CollectorDevice, d: FindingDraft, now: number) {
    if (this.findings.some((f) => f.activeKey === d.key)) return false; // sama dengan UNIQUE(activeKey)
    const dev = this.devices.get(device.id);
    this.findings.push({
      id: `f${++this.seq}`,
      userId: device.userId,
      activeKey: d.key,
      deviceId: device.id,
      deviceName: device.name,
      site: dev?.site ?? "",
      rule: d.rule,
      subject: d.subject,
      status: "active",
      summary: d.summary,
      triggerValue: d.triggerValue,
      evidence: d.evidence,
      recovery: "",
      startedAt: d.startedAt,
      lastSeenAt: now,
      resolvedAt: null,
    });
    return true;
  }

  async touchFindings(keys: string[], now: number) {
    for (const f of this.findings) if (f.activeKey && keys.includes(f.activeKey)) f.lastSeenAt = now;
  }

  async resolveFinding(key: string, now: number, recovery: string) {
    for (const f of this.findings)
      if (f.activeKey === key) {
        f.activeKey = null;
        f.status = "resolved";
        f.resolvedAt = now;
        f.recovery = recovery;
      }
  }

  async beat(id: string, startedAt: number, now: number, info: Record<string, unknown>) {
    this.beats.set(id, { startedAt, lastBeatAt: now, info });
  }

  async prune(samplesBefore: number, resolvedBefore: number) {
    for (const [k, list] of this.samples) this.samples.set(k, list.filter((s) => s.at >= samplesBefore));
    this.findings = this.findings.filter((f) => f.status === "active" || (f.resolvedAt ?? 0) >= resolvedBefore);
  }

  /** Bacaan per pengguna, setara filter userId di route API. */
  findingsFor(userId: string): FindingView[] {
    return this.findings.filter((f) => f.userId === userId);
  }
  devicesFor(userId: string) {
    return [...this.devices.values()].filter((d) => d.userId === userId);
  }
}
