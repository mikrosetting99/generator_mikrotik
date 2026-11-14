import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CollectorDevice, NmStore } from "@/lib/nm/collector";
import type { ActiveFinding, FindingDraft } from "@/lib/nm/rules";
import { MIN_INTERVAL, type DeviceState, type FindingEvidence, type Sample, type WanSample } from "@/lib/nm/types";

/** Penyimpanan collector di MySQL lewat Prisma (tabel nm_*). */

const json = (v: unknown) => v as Prisma.InputJsonValue;

export function rowToSample(r: {
  at: Date;
  reachable: boolean;
  apiOk: boolean;
  cpu: number | null;
  memPct: number | null;
  uptimeSec: number | null;
  ppp: number | null;
  hotspot: number | null;
  wan: Prisma.JsonValue;
  error: string;
}): Sample {
  return {
    at: r.at.getTime(),
    reachable: r.reachable,
    apiOk: r.apiOk,
    cpu: r.cpu,
    memPct: r.memPct,
    uptimeSec: r.uptimeSec,
    ppp: r.ppp,
    hotspot: r.hotspot,
    wan: Array.isArray(r.wan) ? (r.wan as unknown as WanSample[]) : null,
    error: r.error,
  };
}

export const prismaStore: NmStore = {
  async dueDevices(now) {
    const rows = await prisma.nmDevice.findMany({
      where: {
        enabled: true,
        vendor: "mikrotik",
        kind: { in: ["router", "ap"] },
        OR: [{ lastPollAt: null }, { lastPollAt: { lte: new Date(now - MIN_INTERVAL * 1000 + 5000) } }],
      },
      orderBy: { lastPollAt: { sort: "asc", nulls: "first" } },
      take: 2000,
    });
    return rows
      .map(
        (r): CollectorDevice => ({
          id: r.id,
          userId: r.userId,
          name: r.name,
          kind: r.kind,
          vendor: r.vendor,
          host: r.host,
          apiPort: r.apiPort,
          tls: r.tls,
          tlsFingerprint: r.tlsFingerprint,
          username: r.username,
          passwordEnc: r.passwordEnc,
          intervalSec: r.intervalSec,
          wanInterfaces: r.wanInterfaces,
          rules: r.rules,
          lastPollAt: r.lastPollAt?.getTime() ?? null,
          state: (r.state as unknown as DeviceState | null) ?? null,
        }),
      )
      .filter((d) => d.lastPollAt === null || d.lastPollAt <= now - d.intervalSec * 1000 + 5000);
  },

  async claim(id, now, intervalSec) {
    const r = await prisma.nmDevice.updateMany({
      where: { id, OR: [{ lastPollAt: null }, { lastPollAt: { lte: new Date(now - intervalSec * 1000 + 5000) } }] },
      data: { lastPollAt: new Date(now) },
    });
    return r.count === 1;
  },

  async recentSamples(deviceId, since) {
    const rows = await prisma.nmSample.findMany({ where: { deviceId, at: { gte: new Date(since) } }, orderBy: { at: "desc" }, take: 500 });
    return rows.reverse().map(rowToSample);
  },

  async saveSample(device, s, state) {
    await prisma.$transaction([
      prisma.nmSample.create({
        data: {
          deviceId: device.id,
          at: new Date(s.at),
          reachable: s.reachable,
          apiOk: s.apiOk,
          cpu: s.cpu,
          memPct: s.memPct,
          uptimeSec: s.uptimeSec,
          ppp: s.ppp,
          hotspot: s.hotspot,
          wan: s.wan ? json(s.wan) : Prisma.DbNull,
          error: s.error,
        },
      }),
      prisma.nmDevice.update({ where: { id: device.id }, data: { lastSampleAt: new Date(s.at), state: json(state) } }),
    ]);
  },

  async activeFindings(deviceId): Promise<ActiveFinding[]> {
    const rows = await prisma.nmFinding.findMany({ where: { deviceId, status: "active", activeKey: { not: null } } });
    return rows.map((r) => ({ key: r.activeKey!, rule: r.rule as ActiveFinding["rule"], subject: r.subject, startedAt: r.startedAt.getTime(), evidence: r.evidence as unknown as FindingEvidence }));
  },

  async openFinding(device, d: FindingDraft, now) {
    try {
      await prisma.nmFinding.create({
        data: {
          userId: device.userId,
          deviceId: device.id,
          rule: d.rule,
          subject: d.subject.slice(0, 80),
          activeKey: d.key.slice(0, 200),
          status: "active",
          summary: d.summary.slice(0, 300),
          triggerValue: d.triggerValue.slice(0, 200),
          evidence: json(d.evidence),
          startedAt: new Date(d.startedAt),
          lastSeenAt: new Date(now),
        },
      });
      return true;
    } catch (e) {
      // UNIQUE(activeKey): temuan aktif yang sama sudah dibuat (retry atau worker lain).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  },

  async touchFindings(keys, now) {
    await prisma.nmFinding.updateMany({ where: { activeKey: { in: keys } }, data: { lastSeenAt: new Date(now) } });
  },

  async resolveFinding(key, now, recovery) {
    await prisma.nmFinding.updateMany({
      where: { activeKey: key },
      data: { activeKey: null, status: "resolved", resolvedAt: new Date(now), recovery: recovery.slice(0, 300) },
    });
  },

  async beat(id, startedAt, now, info) {
    await prisma.nmCollector.upsert({
      where: { id },
      create: { id, startedAt: new Date(startedAt), lastBeatAt: new Date(now), info: json(info) },
      update: { startedAt: new Date(startedAt), lastBeatAt: new Date(now), info: json(info) },
    });
  },

  async prune(samplesBefore, resolvedBefore) {
    await prisma.nmSample.deleteMany({ where: { at: { lt: new Date(samplesBefore) } } });
    await prisma.nmFinding.deleteMany({ where: { status: "resolved", resolvedAt: { lt: new Date(resolvedBefore) } } });
  },
};
