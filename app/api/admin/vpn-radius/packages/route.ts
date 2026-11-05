import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { readPackageInput } from "@/lib/vpn-radius";
import { packageJson } from "@/lib/vpn-radius-db";

export const dynamic = "force-dynamic";
const MAX_PACKAGES = 50;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rows = await prisma.vpnPackage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { accounts: true } } },
  });
  return NextResponse.json({ packages: rows.map((p) => packageJson(p, p._count.accounts)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = readPackageInput((await request.json().catch(() => null)) ?? {});
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  if ((await prisma.vpnPackage.count()) >= MAX_PACKAGES) {
    return NextResponse.json({ error: `Maksimal ${MAX_PACKAGES} paket.` }, { status: 400 });
  }
  const last = await prisma.vpnPackage.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.vpnPackage.create({
    data: { ...d, protocols: d.protocols.join(","), serverIds: d.serverIds.join(","), sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ package: packageJson(created, 0) });
}
