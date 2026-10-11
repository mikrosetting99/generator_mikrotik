import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Gambar sebuah latar siap pakai. Id tidak pernah berubah isinya, jadi aman di-cache lama. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.backgroundPreset.findUnique({
    where: { id },
    select: { data: true, mime: true },
  });
  if (!row) return new NextResponse("Tidak ditemukan", { status: 404 });

  return new NextResponse(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}