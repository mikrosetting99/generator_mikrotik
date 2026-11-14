import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { findingToView } from "@/lib/nm/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Riwayat temuan milik pengguna ini: ?status=active|resolved|all (bawaan all), maks 300 terbaru. */
export async function GET(request: Request) {
  const guard = await requireAiUser("nm", 3000);
  if (isGuardResponse(guard)) return guard;
  const status = new URL(request.url).searchParams.get("status");
  const rows = await prisma.nmFinding.findMany({
    where: { userId: guard.userId, ...(status === "active" || status === "resolved" ? { status } : {}) },
    include: { device: { select: { name: true, site: true } } },
    orderBy: { startedAt: "desc" },
    take: 300,
  });
  return NextResponse.json({ findings: rows.map(findingToView) }, { headers: { "Cache-Control": "no-store" } });
}
