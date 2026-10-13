import { NextResponse } from "next/server";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Isi lengkap sebuah template — publik, supaya siapa pun bisa memuatnya ke editor. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.hotspotTemplate.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  return NextResponse.json(
    { id: row.id, name: row.name, config: normalizeHotspotPage(row.config) },
    { headers: { "Cache-Control": "no-store" } },
  );
}