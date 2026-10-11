import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getSiteSettings, saveSiteSettings } from "@/lib/site-settings-server";

/** Hanya admin — middleware tidak menjaga /api, jadi dicek di sini. */
async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ settings: await getSiteSettings() });
}

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const settings = await saveSiteSettings((body as { settings?: unknown }).settings);
  revalidatePath("/");
  return NextResponse.json({ settings });
}
