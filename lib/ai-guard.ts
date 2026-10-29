import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { registerFailure } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/site-settings-server";

/**
 * Penjaga API AI Mikrotik Engineer: wajib login; user biasa hanya bila admin membuka menunya
 * (sama dengan aturan halaman). Juga membatasi jumlah panggilan per pengguna.
 * Mengembalikan id pengguna, atau respons galat yang siap dikirim.
 */
export async function requireAiUser(bucket: string, limit: number, windowMs = 10 * 60_000): Promise<{ userId: string } | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  const userId = session.user.id ?? session.user.username ?? "?";
  if (session.user.role !== "ADMIN") {
    const menu = (await getSiteSettings()).menus.find((m) => m.id === "ai-engineer");
    if (!menu || !menu.visible || !menu.userVisible || menu.devMode) {
      return NextResponse.json({ error: "Menu ini tidak tersedia untuk pengguna." }, { status: 403 });
    }
  }
  if (registerFailure(`ai:${bucket}:${userId}`, limit, windowMs)) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." }, { status: 429 });
  }
  return { userId };
}

export function isGuardResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}