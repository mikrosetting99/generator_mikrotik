import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { readPackageInput } from "@/lib/vpn-radius";
import { packageJson } from "@/lib/vpn-radius-db";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Ubah paket. Kecepatan baru langsung terbaca RADIUS (view radius_reply) dan berlaku saat pelanggan tersambung ulang. */
export async function PUT(request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!(await prisma.vpnPackage.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  }
  const parsed = readPackageInput((await request.json().catch(() => null)) ?? {});
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  const updated = await prisma.vpnPackage.update({
    where: { id },
    data: { ...d, protocols: d.protocols.join(","), serverIds: d.serverIds.join(",") },
  });
  const accounts = await prisma.vpnAccount.count({ where: { packageId: id } });
  return NextResponse.json({ package: packageJson(updated, accounts) });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const accounts = await prisma.vpnAccount.count({ where: { packageId: id } });
  if (accounts) return NextResponse.json({ error: `Paket masih dipakai ${accounts} akun. Nonaktifkan saja, atau pindahkan akunnya dulu.` }, { status: 400 });
  await prisma.vpnPackage.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
