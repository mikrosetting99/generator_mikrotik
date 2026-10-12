import { NextResponse } from "next/server";
import { parsePresetKind } from "@/lib/preset-kinds";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar galeri (?kind=background|logo) — publik, karena Halaman Login Hotspot bisa dipakai tanpa akun. */
export async function GET(request: Request) {
  const kind = parsePresetKind(new URL(request.url).searchParams.get("kind"));
  try {
    const rows = await prisma.backgroundPreset.findMany({
      where: { kind },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 100,
    });
    return NextResponse.json({ presets: rows });
  } catch {
    return NextResponse.json({ presets: [] });
  }
}