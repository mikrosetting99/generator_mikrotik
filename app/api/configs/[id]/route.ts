import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeConfig } from "@/lib/storage";

async function loadOwned(id: string, session: { id: string; role: string }) {
  const entry = await prisma.savedConfig.findUnique({
    where: { id },
    include: { user: { select: { username: true } } },
  });
  if (!entry) return null;
  if (entry.userId !== session.id && session.role !== "ADMIN") return null;
  return entry;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await params;
  const entry = await loadOwned(id, session.user);
  if (!entry) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  return NextResponse.json({
    id: entry.id,
    name: entry.name,
    savedAt: entry.createdAt.toISOString(),
    ownerUsername: entry.user.username,
    config: normalizeConfig(entry.config),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await params;
  const entry = await loadOwned(id, session.user);
  if (!entry) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  await prisma.savedConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
