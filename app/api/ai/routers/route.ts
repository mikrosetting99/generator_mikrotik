import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { MAX_AI_ROUTERS, parseRouterInput, sealPassword, toPublic } from "@/lib/ai-routers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar Mikrotik milik pengguna (tanpa password). */
export async function GET() {
  const guard = await requireAiUser("routers-list", 300);
  if (isGuardResponse(guard)) return guard;
  const rows = await prisma.aiRouter.findMany({ where: { userId: guard.userId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ routers: rows.map(toPublic) });
}

/** Tambah Mikrotik baru; password wajib dan disimpan terenkripsi. */
export async function POST(request: Request) {
  const guard = await requireAiUser("routers-write", 60);
  if (isGuardResponse(guard)) return guard;
  const parsed = parseRouterInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  if (!d.password) return NextResponse.json({ error: "Password router belum diisi." }, { status: 400 });
  if ((await prisma.aiRouter.count({ where: { userId: guard.userId } })) >= MAX_AI_ROUTERS) {
    return NextResponse.json({ error: `Maksimal ${MAX_AI_ROUTERS} router.` }, { status: 400 });
  }
  const row = await prisma.aiRouter.create({
    data: { userId: guard.userId, name: d.name, host: d.host, port: d.port, tls: d.tls, username: d.username, passwordEnc: sealPassword(d.password) },
  });
  return NextResponse.json({ router: toPublic(row) });
}