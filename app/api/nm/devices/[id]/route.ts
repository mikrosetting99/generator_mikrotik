import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { rowToSample } from "@/lib/nm/store-prisma";
import { isCollected, type DeviceDetailView } from "@/lib/nm/types";
import { DEVICE_SELECT, collectorToView, configView, deviceToView, findingToView, parseDeviceInput, sameDeviceEndpoint } from "@/lib/nm/server";
import { prisma } from "@/lib/prisma";
import { seal } from "@/lib/vault";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Detail perangkat: status, sampel beberapa jam terakhir (untuk grafik), temuan, dan pengaturan. */
export async function GET(request: Request, { params }: Ctx) {
  const guard = await requireAiUser("nm", 3000);
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const hours = Math.min(24, Math.max(1, Number(new URL(request.url).searchParams.get("hours")) || 3));
  const now = Date.now();

  const row = await prisma.nmDevice.findFirst({ where: { id, userId: guard.userId }, select: { ...DEVICE_SELECT, passwordEnc: true } });
  if (!row) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  const [samples, findings, beat] = await Promise.all([
    prisma.nmSample.findMany({ where: { deviceId: id, at: { gte: new Date(now - hours * 3600_000) } }, orderBy: { at: "asc" }, take: 3000 }),
    prisma.nmFinding.findMany({ where: { deviceId: id, userId: guard.userId }, include: { device: { select: { name: true, site: true } } }, orderBy: { startedAt: "desc" }, take: 60 }),
    prisma.nmCollector.findFirst({ orderBy: { lastBeatAt: "desc" } }),
  ]);
  const { passwordEnc, ...safe } = row;
  const views = findings.map(findingToView);
  const body: DeviceDetailView = {
    device: deviceToView(safe, views, collectorToView(beat, now), now),
    config: configView(safe, Boolean(passwordEnc)),
    samples: samples.map(rowToSample),
    findings: views,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const guard = await requireAiUser("nm-write", 300);
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const row = await prisma.nmDevice.findFirst({ where: { id, userId: guard.userId } });
  if (!row) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  const parsed = parseDeviceInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;

  // Password lama hanya dipakai lagi untuk alamat, port, dan username yang sama.
  let passwordEnc = row.passwordEnc;
  if (d.password) passwordEnc = seal(d.password);
  else if (!sameDeviceEndpoint(row, d) && isCollected(d.kind, d.vendor)) {
    return NextResponse.json({ error: "Alamat, port, atau username berubah. Isi password lagi." }, { status: 400 });
  }
  if (isCollected(d.kind, d.vendor) && !passwordEnc) return NextResponse.json({ error: "Password user monitoring belum diisi." }, { status: 400 });

  await prisma.nmDevice.update({
    where: { id },
    data: {
      name: d.name,
      site: d.site,
      kind: d.kind,
      vendor: d.vendor,
      host: d.host,
      apiPort: d.apiPort,
      tls: d.tls,
      tlsFingerprint: d.tlsFingerprint,
      username: d.username,
      passwordEnc,
      enabled: d.enabled,
      intervalSec: d.intervalSec,
      wanInterfaces: d.wanInterfaces,
      rules: d.rules as unknown as object,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await requireAiUser("nm-write", 300);
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const r = await prisma.nmDevice.deleteMany({ where: { id, userId: guard.userId } });
  if (!r.count) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
