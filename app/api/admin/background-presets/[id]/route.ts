import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });

  const { id } = await params;
  await prisma.backgroundPreset.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}