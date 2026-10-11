import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings-server";

/**
 * Mencatat satu kali pemakaian sebuah menu. Hanya menghitung — tanpa IP, akun,
 * atau data pribadi. Id yang tidak dikenal diabaikan agar tabel tidak bisa
 * dibanjiri baris sampah.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === "string" ? body.id : "";

  const settings = await getSiteSettings();
  if (!settings.menus.some((m) => m.id === id)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await prisma.menuUsage.upsert({
      where: { menuId: id },
      update: { count: { increment: 1 } },
      create: { menuId: id, count: 1 },
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}