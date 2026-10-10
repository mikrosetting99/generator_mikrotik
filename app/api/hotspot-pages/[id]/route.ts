import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import { prisma } from "@/lib/prisma";

async function loadOwned(id: string, userId: string) {
  const entry = await prisma.savedLoginPage.findUnique({ where: { id } });
  return entry && entry.userId === userId ? entry : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await params;
  const entry = await loadOwned(id, session.user.id);
  if (!entry) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  return NextResponse.json({
    id: entry.id,
    name: entry.name,
    config: normalizeHotspotPage(entry.config),
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const { id } = await params;
  const entry = await loadOwned(id, session.user.id);
  if (!entry) return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });

  await prisma.savedLoginPage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
