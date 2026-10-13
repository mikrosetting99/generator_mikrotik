import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import { prisma } from "@/lib/prisma";

const MAX_TEMPLATES = 60;

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  return null;
}

/** Terbitkan desain sebagai template; bila `id` dikirim, template itu ditimpa. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
  }

  const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 80);
  if (!name) return NextResponse.json({ error: "Beri nama template dulu." }, { status: 400 });
  const description = (typeof body.description === "string" ? body.description.trim() : "").slice(0, 180);
  const page = normalizeHotspotPage(body.config);

  const data = {
    name,
    description,
    design: page.template,
    primaryColor: page.primaryColor,
    bgColor: page.bgColor,
    config: page as unknown as Prisma.InputJsonValue,
  };

  if (typeof body.id === "string" && body.id) {
    const existing = await prisma.hotspotTemplate.findUnique({ where: { id: body.id } });
    if (existing) {
      const updated = await prisma.hotspotTemplate.update({ where: { id: existing.id }, data, select: { id: true, name: true } });
      return NextResponse.json({ template: updated, updated: true });
    }
  }

  if ((await prisma.hotspotTemplate.count()) >= MAX_TEMPLATES) {
    return NextResponse.json({ error: `Maksimal ${MAX_TEMPLATES} template.` }, { status: 400 });
  }
  const created = await prisma.hotspotTemplate.create({ data, select: { id: true, name: true } });
  return NextResponse.json({ template: created, updated: false });
}