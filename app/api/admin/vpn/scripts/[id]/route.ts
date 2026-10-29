import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { parseVpnScriptInput } from "@/lib/vpn-input";
import { toFull } from "@/lib/vpn-server";
import { seal } from "@/lib/vault";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const row = await prisma.vpnScript.findUnique({ where: { id }, include: { category: { select: { name: true } } } });
  if (!row) return NextResponse.json({ error: "Link script tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ script: toFull(row) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const parsed = parseVpnScriptInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  if (!(await prisma.vpnScript.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Link script tidak ditemukan." }, { status: 404 });
  }
  if (!(await prisma.vpnCategory.findUnique({ where: { id: d.categoryId } }))) {
    return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 400 });
  }
  // Token (link) tidak berubah saat diedit, jadi link yang sudah dikirim ke pelanggan tetap berlaku.
  await prisma.vpnScript.update({
    where: { id },
    data: {
      phone: d.phone,
      customer: d.customer,
      categoryId: d.categoryId,
      title: d.title,
      username: d.username,
      passwordEnc: seal(d.password),
      scriptEnc: seal(d.script),
      note: d.note,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  await prisma.vpnScript.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}