import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import { prisma } from "@/lib/prisma";

/** Daftar desain halaman login milik akun yang sedang masuk. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const entries = await prisma.savedLoginPage.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, updatedAt: true },
    take: 200,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({ id: e.id, name: e.name, savedAt: e.updatedAt.toISOString() })),
  });
}

/** Simpan desain baru, atau timpa yang lama bila `id` milik akun ini dikirim. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 120) || "Tanpa nama";
  const config = normalizeHotspotPage(body.config) as unknown as Prisma.InputJsonValue;

  if (typeof body.id === "string" && body.id) {
    const existing = await prisma.savedLoginPage.findUnique({ where: { id: body.id } });
    if (existing && existing.userId === session.user.id) {
      const updated = await prisma.savedLoginPage.update({
        where: { id: existing.id },
        data: { name, config },
        select: { id: true, name: true, updatedAt: true },
      });
      return NextResponse.json({
        entry: { id: updated.id, name: updated.name, savedAt: updated.updatedAt.toISOString() },
      });
    }
  }

  const created = await prisma.savedLoginPage.create({
    data: { userId: session.user.id, name, config },
    select: { id: true, name: true, updatedAt: true },
  });
  return NextResponse.json({
    entry: { id: created.id, name: created.name, savedAt: created.updatedAt.toISOString() },
  });
}
