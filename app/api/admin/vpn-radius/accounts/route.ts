import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { RADIUS_LIMITS, readExpiry, VPN_ACCOUNT_STATUSES, type VpnAccountStatus } from "@/lib/vpn-radius";
import { accountJson, createAccount, onlineSessions } from "@/lib/vpn-radius-db";

export const dynamic = "force-dynamic";

const REFS = {
  user: { select: { username: true, name: true } },
  server: { select: { name: true, domain: true } },
  package: { select: { name: true } },
} as const;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rows = await prisma.vpnAccount.findMany({ orderBy: { createdAt: "desc" }, include: REFS, take: 2000 });
  const online = await onlineSessions(rows.map((r) => r.username));
  return NextResponse.json({ accounts: rows.map((a) => accountJson(a, online.get(a.username))) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const status = VPN_ACCOUNT_STATUSES.some((s) => s.id === b.status) ? (b.status as VpnAccountStatus) : "active";
  const expiresAt = readExpiry(b.expiresAt);
  if (expiresAt === "invalid") return NextResponse.json({ error: "Tanggal masa aktif tidak valid." }, { status: 400 });

  const r = await createAccount({
    userId: String(b.userId ?? ""),
    serverId: String(b.serverId ?? ""),
    packageId: String(b.packageId ?? ""),
    username: typeof b.username === "string" ? b.username.trim().toLowerCase() : "",
    password: typeof b.password === "string" ? b.password : "",
    status,
    expiresAt,
    note: typeof b.note === "string" ? b.note.trim().slice(0, RADIUS_LIMITS.note) : "",
  });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const row = await prisma.vpnAccount.findUniqueOrThrow({ where: { id: r.id }, include: REFS });
  return NextResponse.json({ account: accountJson(row, undefined) });
}
