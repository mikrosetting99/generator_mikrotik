import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { readServerInput } from "@/lib/vpn-radius";
import { newRadiusSecret, radiusIp, serverJson } from "@/lib/vpn-radius-db";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };
const MAX_SERVERS = 50;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rows = await prisma.vpnServer.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { accounts: true } } },
  });
  return NextResponse.json(
    { servers: rows.map((s) => serverJson(s, s._count.accounts)), radiusIpSet: Boolean(radiusIp()) },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = readServerInput((await request.json().catch(() => null)) ?? {});
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  if ((await prisma.vpnServer.count()) >= MAX_SERVERS) {
    return NextResponse.json({ error: `Maksimal ${MAX_SERVERS} server VPN.` }, { status: 400 });
  }
  const clash = await prisma.vpnServer.findFirst({ where: { OR: [{ domain: d.domain }, { publicIp: d.publicIp }] } });
  if (clash) return NextResponse.json({ error: `Domain atau IP publik sudah dipakai server ${clash.name}.` }, { status: 409 });
  const last = await prisma.vpnServer.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.vpnServer.create({
    data: { ...d, protocols: d.protocols.join(","), radiusSecret: newRadiusSecret(), sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ server: serverJson(created, 0) });
}
