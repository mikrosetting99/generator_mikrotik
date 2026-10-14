import { NextResponse } from "next/server";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Template default (bila admin menetapkannya) — dimuat editor saat pertama dibuka. Publik. */
export async function GET() {
  try {
    const row = await prisma.hotspotTemplate.findFirst({ where: { isDefault: true } });
    if (!row) return NextResponse.json({ template: null }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(
      { template: { id: row.id, name: row.name, config: normalizeHotspotPage(row.config) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ template: null });
  }
}