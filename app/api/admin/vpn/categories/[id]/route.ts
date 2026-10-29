import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { VPN_LIMITS } from "@/lib/vpn-input";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, VPN_LIMITS.category) : "";
  if (!name) return NextResponse.json({ error: "Nama kategori belum diisi." }, { status: 400 });
  const existing = await prisma.vpnCategory.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  const clash = await prisma.vpnCategory.findUnique({ where: { name } });
  if (clash && clash.id !== id) return NextResponse.json({ error: "Nama kategori sudah ada." }, { status: 409 });
  const updated = await prisma.vpnCategory.update({ where: { id }, data: { name } });
  return NextResponse.json({ category: { id: updated.id, name: updated.name } });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const used = await prisma.vpnScript.count({ where: { categoryId: id } });
  if (used > 0) {
    return NextResponse.json(
      { error: `Kategori masih dipakai ${used} link script. Pindahkan atau hapus link-nya dulu.` },
      { status: 409 },
    );
  }
  await prisma.vpnCategory.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}