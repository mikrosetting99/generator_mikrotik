import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { isCollected, type DevicesResponse } from "@/lib/nm/types";
import { DEVICE_SELECT, MAX_NM_DEVICES, collectorToView, deviceToView, findingToView, parseDeviceInput } from "@/lib/nm/server";
import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/vault";

export const dynamic = "force-dynamic";

/**
 * Network Monitoring — daftar perangkat milik pengguna ini beserta status yang dihitung dari
 * sampel tersimpan dan temuan aktif. Tidak menghubungi perangkat; itu tugas collector.
 */
export async function GET() {
  const guard = await requireAiUser("nm", 3000);
  if (isGuardResponse(guard)) return guard;
  const now = Date.now();
  const [rows, active, beat] = await Promise.all([
    prisma.nmDevice.findMany({ where: { userId: guard.userId }, select: DEVICE_SELECT, orderBy: { name: "asc" } }),
    prisma.nmFinding.findMany({
      where: { userId: guard.userId, status: "active" },
      include: { device: { select: { name: true, site: true } } },
      orderBy: { startedAt: "desc" },
      take: 300,
    }),
    prisma.nmCollector.findFirst({ orderBy: { lastBeatAt: "desc" } }),
  ]);
  const findings = active.map(findingToView);
  const collector = collectorToView(beat, now);
  const body: DevicesResponse = { generatedAt: now, devices: rows.map((r) => deviceToView(r, findings, collector, now)), findings, collector };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** Tambah perangkat. `fromRouterId` menyalin alamat dan kredensial dari Mikrotik tersimpan (di server). */
export async function POST(request: Request) {
  const guard = await requireAiUser("nm-write", 300);
  if (isGuardResponse(guard)) return guard;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });

  let input: Record<string, unknown> = b;
  let password = "";
  if (typeof b.fromRouterId === "string" && b.fromRouterId) {
    const r = await prisma.aiRouter.findFirst({ where: { id: b.fromRouterId, userId: guard.userId } });
    if (!r) return NextResponse.json({ error: "Mikrotik tersimpan tidak ditemukan." }, { status: 404 });
    if (r.port <= 0) return NextResponse.json({ error: "Mikrotik itu tidak memakai API; collector butuh RouterOS API." }, { status: 400 });
    input = { ...b, host: r.host, apiPort: r.port, tls: r.tls, username: r.username };
    password = open(r.passwordEnc);
  }

  const parsed = parseDeviceInput(input);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  password ||= d.password;
  if (isCollected(d.kind, d.vendor) && !password) return NextResponse.json({ error: "Password user monitoring belum diisi." }, { status: 400 });

  const count = await prisma.nmDevice.count({ where: { userId: guard.userId } });
  if (count >= MAX_NM_DEVICES) return NextResponse.json({ error: `Maksimal ${MAX_NM_DEVICES} perangkat.` }, { status: 400 });

  const row = await prisma.nmDevice.create({
    data: {
      userId: guard.userId,
      name: d.name,
      site: d.site,
      kind: d.kind,
      vendor: d.vendor,
      host: d.host,
      apiPort: d.apiPort,
      tls: d.tls,
      tlsFingerprint: d.tlsFingerprint,
      username: d.username,
      passwordEnc: password ? seal(password) : "",
      enabled: d.enabled,
      intervalSec: d.intervalSec,
      wanInterfaces: d.wanInterfaces,
      rules: d.rules as unknown as object,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: row.id });
}
