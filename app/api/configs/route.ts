import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasSecrets, normalizeConfig, stripSecrets } from "@/lib/storage";

/** Daftar riwayat konfigurasi — punya sendiri, atau semua akun bila admin & scope=all. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const scope = new URL(request.url).searchParams.get("scope");
  const wantsAll = scope === "all" && session.user.role === "ADMIN";

  const entries = await prisma.savedConfig.findMany({
    where: wantsAll ? {} : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      hasSecrets: true,
      createdAt: true,
      userId: true,
      user: { select: { username: true } },
    },
    take: 200,
  });

  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      hasSecrets: e.hasSecrets,
      savedAt: e.createdAt.toISOString(),
      ownerUsername: wantsAll ? e.user.username : undefined,
      mine: e.userId === session.user.id,
    })),
  });
}

/** Simpan konfigurasi baru sebagai entri riwayat (tidak menimpa yang lama). */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const includeSecrets = Boolean(body.includeSecrets);
  const config = normalizeConfig(body.config);
  const payload = includeSecrets ? config : stripSecrets(config);

  const created = await prisma.savedConfig.create({
    data: {
      userId: session.user.id,
      name: name || "Tanpa nama",
      config: payload as unknown as Prisma.InputJsonValue,
      hasSecrets: includeSecrets && hasSecrets(config),
    },
    select: { id: true, name: true, hasSecrets: true, createdAt: true },
  });

  return NextResponse.json({
    entry: {
      id: created.id,
      name: created.name,
      hasSecrets: created.hasSecrets,
      savedAt: created.createdAt.toISOString(),
      mine: true,
    },
  });
}
