import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar template siap pakai — publik; tanpa config besarnya, hanya ringkasan untuk kartu. */
export async function GET() {
  try {
    const rows = await prisma.hotspotTemplate.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, description: true, design: true, primaryColor: true, bgColor: true },
      take: 100,
    });
    return NextResponse.json({ templates: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}