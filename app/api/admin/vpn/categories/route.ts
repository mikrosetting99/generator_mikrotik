import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { ensureVpnCategories } from "@/lib/vpn-server";
import { VPN_LIMITS } from "@/lib/vpn-input";

export const dynamic = "force-dynamic";
const MAX_CATEGORIES = 50;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureVpnCategories();
  const rows = await prisma.vpnCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { scripts: true } } },
  });
  return NextResponse.json({
    categories: rows.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, scripts: c._count.scripts })),
  });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, VPN_LIMITS.category) : "";
  if (!name) return NextResponse.json({ error: "Nama kategori belum diisi." }, { status: 400 });
  if ((await prisma.vpnCategory.count()) >= MAX_CATEGORIES) {
    return NextResponse.json({ error: `Maksimal ${MAX_CATEGORIES} kategori.` }, { status: 400 });
  }
  if (await prisma.vpnCategory.findUnique({ where: { name } })) {
    return NextResponse.json({ error: "Nama kategori sudah ada." }, { status: 409 });
  }
  const last = await prisma.vpnCategory.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.vpnCategory.create({
    data: { name, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ category: { id: created.id, name: created.name, sortOrder: created.sortOrder, scripts: 0 } });
}