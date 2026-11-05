import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { readServerInput } from "@/lib/vpn-radius";
import { accountsOutsideSubnet, chrScriptFor, newRadiusSecret, serverJson } from "@/lib/vpn-radius-db";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Script setup CHR untuk server ini (berisi secret RADIUS, jadi hanya admin). */
export async function GET(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const s = await prisma.vpnServer.findUnique({ where: { id } });
  if (!s) return NextResponse.json({ error: "Server VPN tidak ditemukan." }, { status: 404 });
  const r = chrScriptFor(s);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ script: r.script }, { headers: { "Cache-Control": "no-store" } });
}

/** Ubah server. `rotateSecret: true` membuat secret RADIUS baru (script CHR harus ditempel ulang). */
export async function PUT(request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const current = await prisma.vpnServer.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Server VPN tidak ditemukan." }, { status: 404 });

  const parsed = readServerInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  const clash = await prisma.vpnServer.findFirst({ where: { id: { not: id }, OR: [{ domain: d.domain }, { publicIp: d.publicIp }] } });
  if (clash) return NextResponse.json({ error: `Domain atau IP publik sudah dipakai server ${clash.name}.` }, { status: 409 });

  if (d.subnet !== current.subnet || d.gatewayIp !== current.gatewayIp) {
    const outside = await accountsOutsideSubnet(id, d.subnet, d.gatewayIp);
    if (outside.length) {
      return NextResponse.json(
        { error: `${outside.length} akun memakai IP di luar subnet baru atau sama dengan gateway (mis. ${outside.slice(0, 3).join(", ")}). Pindahkan dulu akunnya.` },
        { status: 400 },
      );
    }
  }
  const accounts = await prisma.vpnAccount.count({ where: { serverId: id } });
  if (d.capacity < accounts) return NextResponse.json({ error: `Kapasitas tidak boleh di bawah jumlah akun yang ada (${accounts}).` }, { status: 400 });

  const updated = await prisma.vpnServer.update({
    where: { id },
    data: { ...d, protocols: d.protocols.join(","), ...(body.rotateSecret === true ? { radiusSecret: newRadiusSecret() } : {}) },
  });
  return NextResponse.json({ server: serverJson(updated, accounts) });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const accounts = await prisma.vpnAccount.count({ where: { serverId: id } });
  if (accounts) return NextResponse.json({ error: `Server masih punya ${accounts} akun VPN. Hapus atau pindahkan dulu.` }, { status: 400 });
  await prisma.vpnServer.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
