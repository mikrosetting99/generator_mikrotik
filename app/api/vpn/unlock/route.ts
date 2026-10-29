import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { clearFailures, isBlocked, registerFailure, sweepRateLimits } from "@/lib/rate-limit";
import { toFull } from "@/lib/vpn-server";

export const dynamic = "force-dynamic";

const LIMIT = 8; // percobaan gagal
const WINDOW = 15 * 60 * 1000; // per 15 menit
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Membuka link script pelanggan: butuh token (dari link) DAN nomor HP yang cocok.
 * Pesan galatnya sengaja sama untuk "link salah" dan "nomor salah" agar token tidak bisa ditebak,
 * dan percobaan gagal dibatasi per alamat IP dan per token.
 */
export async function POST(request: Request) {
  sweepRateLimits();
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.slice(0, 60) : "";
  const phone = normalizePhone(typeof body?.phone === "string" ? body.phone.slice(0, 30) : "");
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipKey = `vpn-ip:${ip}`;
  const tokenKey = `vpn-token:${token}`;

  if (isBlocked(ipKey, LIMIT) || isBlocked(tokenKey, LIMIT)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." },
      { status: 429, headers: NO_STORE },
    );
  }

  const row = token
    ? await prisma.vpnScript.findUnique({ where: { token }, include: { category: { select: { name: true } } } })
    : null;
  if (!row || !phone || row.phone !== phone) {
    registerFailure(ipKey, LIMIT, WINDOW);
    registerFailure(tokenKey, LIMIT, WINDOW);
    return NextResponse.json({ error: "Link atau nomor HP tidak cocok." }, { status: 404, headers: NO_STORE });
  }

  clearFailures(tokenKey);
  // Semua link milik nomor ini (yang dibuka paling atas), agar pelanggan melihat seluruh script-nya.
  const rows = await prisma.vpnScript.findMany({
    where: { phone: row.phone },
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });
  const entries = rows
    .map((r) => {
      const full = toFull(r);
      // Pelanggan tidak perlu id internal dan nomor HP penuh.
      return {
        token: full.token,
        category: full.category,
        title: full.title,
        username: full.username,
        password: full.password,
        script: full.script,
        protocol: full.protocol,
        offered: full.offered,
        ros: full.rosVersion,
        vpnServer: full.vpnServer,
        gatewayIp: full.gatewayIp,
        tunnelName: full.tunnelName,
        vpnPort: full.vpnPort,
        ipsecSecret: full.ipsecSecret,
        winbox: full.winbox,
        api: full.api,
        mikhmonUrl: full.mikhmonUrl,
        note: full.note,
        createdAt: full.createdAt,
      };
    })
    .sort((a, b) => Number(b.token === row.token) - Number(a.token === row.token));
  return NextResponse.json({ customer: row.customer, opened: row.token, entries }, { headers: NO_STORE });
}