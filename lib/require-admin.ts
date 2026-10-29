import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/** Penjaga API khusus admin: null bila lolos, atau respons 401/403 yang siap dikembalikan. */
export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  return null;
}