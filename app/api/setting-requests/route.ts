import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomPassword, randomToken } from "@/lib/setting-request";
import { MAX_REQUESTS_PER_USER, requestToView } from "@/lib/setting-request-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Daftar link Form Setting Mikrotik milik akun ini, terbaru dulu. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const rows = await prisma.settingRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: MAX_REQUESTS_PER_USER,
  });
  return NextResponse.json({ requests: rows.map(requestToView) }, { headers: NO_STORE });
}

/** Buat link baru. Body opsional: { label } — catatan admin, mis. nama pelanggan. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { label?: unknown } | null;
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 120) : "";

  const count = await prisma.settingRequest.count({ where: { userId: session.user.id } });
  if (count >= MAX_REQUESTS_PER_USER) {
    return NextResponse.json({ error: `Maksimal ${MAX_REQUESTS_PER_USER} link. Hapus link lama terlebih dahulu.` }, { status: 400 });
  }

  const row = await prisma.settingRequest.create({
    data: { userId: session.user.id, token: randomToken(), label, routerPassword: randomPassword() },
  });
  return NextResponse.json({ request: requestToView(row) }, { headers: NO_STORE });
}
