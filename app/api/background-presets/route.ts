import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar galeri latar — publik, karena Halaman Login Hotspot bisa dipakai tanpa akun. */
export async function GET() {
  try {
    const rows = await prisma.backgroundPreset.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 100,
    });
    return NextResponse.json({ presets: rows });
  } catch {
    return NextResponse.json({ presets: [] });
  }
}