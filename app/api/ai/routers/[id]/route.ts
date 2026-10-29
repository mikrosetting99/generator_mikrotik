import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { parseRouterInput, sealPassword, toPublic } from "@/lib/ai-routers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Ubah Mikrotik; password kosong = tetap memakai password lama. */
export async function PUT(request: Request, { params }: Ctx) {
  const guard = await requireAiUser("routers-write", 60);
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  const parsed = parseRouterInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  const found = await prisma.aiRouter.findFirst({ where: { id, userId: guard.userId }, select: { id: true } });
  if (!found) return NextResponse.json({ error: "Router tidak ditemukan." }, { status: 404 });
  const row = await prisma.aiRouter.update({
    where: { id },
    data: {
      name: d.name,
      host: d.host,
      port: d.port,
      tls: d.tls,
      username: d.username,
      ...(d.password ? { passwordEnc: sealPassword(d.password) } : {}),
    },
  });
  return NextResponse.json({ router: toPublic(row) });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const guard = await requireAiUser("routers-write", 60);
  if (isGuardResponse(guard)) return guard;
  const { id } = await params;
  await prisma.aiRouter.deleteMany({ where: { id, userId: guard.userId } });
  return NextResponse.json({ ok: true });
}