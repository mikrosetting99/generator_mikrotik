import { NextResponse } from "next/server";
import { getSiteSettings } from "@/lib/site-settings-server";

export const dynamic = "force-dynamic";

/** Logo situs. Alamatnya memuat ?v=<versi>, jadi aman di-cache lama. */
export async function GET() {
  const { logoDataUrl } = await getSiteSettings();
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(logoDataUrl);
  if (!match) return new NextResponse("Tidak ada logo", { status: 404 });

  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=86400",
      // SVG tidak boleh menjalankan skrip bila dibuka langsung.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}