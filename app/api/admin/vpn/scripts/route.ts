import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { parseVpnScriptInput } from "@/lib/vpn-input";
import { newVpnToken } from "@/lib/vpn-server";
import { seal } from "@/lib/vault";

export const dynamic = "force-dynamic";
const MAX_SCRIPTS = 5000;

/** Daftar ringkas (tanpa password dan isi script). Filter: ?category=<id>&q=<nomor/nama/judul>. */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim();
  const digits = normalizePhone(q);

  const rows = await prisma.vpnScript.findMany({
    where: {
      ...(category ? { categoryId: category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { customer: { contains: q } },
              { username: { contains: q } },
              ...(digits.length >= 4 ? [{ phone: { contains: q.replace(/\D/g, "").replace(/^0/, "62") } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { category: { select: { name: true } } },
  });
  return NextResponse.json({
    scripts: rows.map((r) => ({
      id: r.id,
      token: r.token,
      phone: r.phone,
      customer: r.customer,
      categoryId: r.categoryId,
      category: r.category.name,
      title: r.title,
      username: r.username,
      protocol: r.protocol,
      hasMikhmon: Boolean(r.mikhmonUrl),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseVpnScriptInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const d = parsed.data;
  if (!(await prisma.vpnCategory.findUnique({ where: { id: d.categoryId } }))) {
    return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 400 });
  }
  if ((await prisma.vpnScript.count()) >= MAX_SCRIPTS) {
    return NextResponse.json({ error: `Maksimal ${MAX_SCRIPTS} link script.` }, { status: 400 });
  }
  const created = await prisma.vpnScript.create({
    data: {
      token: newVpnToken(),
      phone: d.phone,
      customer: d.customer,
      categoryId: d.categoryId,
      title: d.title,
      username: d.username,
      passwordEnc: seal(d.password),
      scriptEnc: seal(d.script),
      protocol: d.protocol,
      offered: d.offered.join(","),
      rosVersion: d.rosVersion,
      vpnServer: d.vpnServer,
      gatewayIp: d.gatewayIp,
      tunnelName: d.tunnelName,
      vpnPort: d.vpnPort,
      ipsecEnc: d.ipsecSecret ? seal(d.ipsecSecret) : "",
      winbox: d.winbox,
      api: d.api,
      mikhmonUrl: d.mikhmonUrl,
      tunnelIp: d.tunnelIp,
      publicIp: d.publicIp,
      natRules: d.nat.length ? JSON.stringify(d.nat) : "",
      note: d.note,
    },
    select: { id: true, token: true },
  });
  return NextResponse.json({ script: created });
}