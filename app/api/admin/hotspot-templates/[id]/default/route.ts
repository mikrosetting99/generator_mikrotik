import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  return null;
}

/** Jadikan template ini default (yang lain otomatis dilepas — hanya satu default). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const exists = await prisma.hotspotTemplate.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  await prisma.$transaction([
    prisma.hotspotTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.hotspotTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  return NextResponse.json({ ok: true });
}

/** Lepas status default — editor kembali mulai dari desain kosong bawaan. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  await prisma.hotspotTemplate.updateMany({ where: { id }, data: { isDefault: false } });
  return NextResponse.json({ ok: true });
}