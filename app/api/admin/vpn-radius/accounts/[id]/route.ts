import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { VPN_PROTOCOLS, type VpnProtocol } from "@/lib/vpn-script";
import { RADIUS_LIMITS, readExpiry, VPN_ACCOUNT_STATUSES, type VpnAccountStatus } from "@/lib/vpn-radius";
import { accountClientScript, newVpnPassword, setAccountPassword } from "@/lib/vpn-radius-db";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Script client pelanggan: ?protocol=sstp|l2tp|ovpn&ros=v6|v7. Berisi password, jadi tidak di-cache. */
export async function GET(request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const protocol = (VPN_PROTOCOLS.some((p) => p.id === q.get("protocol")) ? q.get("protocol") : "sstp") as VpnProtocol;
  const r = await accountClientScript(id, protocol, q.get("ros") === "v7" ? "v7" : "v6");
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Ubah akun: status, paket, masa aktif, catatan, atau password (`resetPassword: true` = acak,
 * atau `password` = pilihan admin). Perubahan langsung terbaca RADIUS pada login berikutnya.
 */
export async function PUT(request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const current = await prisma.vpnAccount.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Akun VPN tidak ditemukan." }, { status: 404 });

  const data: { status?: VpnAccountStatus; packageId?: string; expiresAt?: Date | null; note?: string } = {};
  if (b.status !== undefined) {
    if (!VPN_ACCOUNT_STATUSES.some((s) => s.id === b.status)) return NextResponse.json({ error: "Status tidak dikenal." }, { status: 400 });
    data.status = b.status as VpnAccountStatus;
  }
  if (b.packageId !== undefined && b.packageId !== current.packageId) {
    const pkg = await prisma.vpnPackage.findUnique({ where: { id: String(b.packageId) } });
    if (!pkg) return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 400 });
    const allowed = pkg.serverIds ? pkg.serverIds.split(",").filter(Boolean) : [];
    if (allowed.length && !allowed.includes(current.serverId)) {
      return NextResponse.json({ error: `Paket ${pkg.name} tidak tersedia di server akun ini.` }, { status: 400 });
    }
    data.packageId = pkg.id;
  }
  const expiry = readExpiry(b.expiresAt);
  if (expiry === "invalid") return NextResponse.json({ error: "Tanggal masa aktif tidak valid." }, { status: 400 });
  if (expiry !== undefined) data.expiresAt = expiry;
  if (typeof b.note === "string") data.note = b.note.trim().slice(0, RADIUS_LIMITS.note);

  let password: string | undefined;
  if (b.resetPassword === true) password = newVpnPassword();
  else if (typeof b.password === "string" && b.password) {
    if (b.password.length < 8 || b.password.length > 64) return NextResponse.json({ error: "Password VPN 8–64 karakter." }, { status: 400 });
    password = b.password;
  }

  if (Object.keys(data).length) await prisma.vpnAccount.update({ where: { id }, data });
  if (password) await setAccountPassword(id, password);
  return NextResponse.json({ ok: true, ...(password ? { password } : {}) });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  await prisma.vpnAccount.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
