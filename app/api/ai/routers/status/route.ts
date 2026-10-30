import { NextResponse } from "next/server";
import { isGuardResponse, requireAiUser } from "@/lib/ai-guard";
import { checkMany, checkTarget, diagnoseRouter, loadTarget, parseRouterInput } from "@/lib/ai-routers";
import { resolvePublicHost } from "@/lib/net-guard";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/vault";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Status tersambung atau tidak untuk Mikrotik tersimpan (ids kosong = semua), atau uji koneksi
 * dengan isian form yang belum disimpan ({ test: {...} }, atau { test: {...}, id } untuk memakai
 * password tersimpan saat password dikosongkan).
 */
export async function POST(request: Request) {
  const guard = await requireAiUser("status", 1200);
  if (isGuardResponse(guard)) return guard;
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (b?.test) {
    const parsed = parseRouterInput(b.test);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const d = parsed.data;
    let password = d.password;
    if (!password && typeof b.id === "string") {
      const row = await prisma.aiRouter.findFirst({ where: { id: b.id, userId: guard.userId } });
      password = row ? open(row.passwordEnc) : "";
    }
    if (!password) return NextResponse.json({ error: "Isi password untuk menguji koneksi." }, { status: 400 });
    if (b.diagnose) return NextResponse.json({ diagnosis: await diagnoseRouter({ host: d.host, port: d.port, tls: d.tls, username: d.username, password }) });
    try {
      const ip = await resolvePublicHost(d.host);
      const status = await checkTarget("test", { ip, host: d.host, port: d.port, tls: d.tls, username: d.username, password });
      return NextResponse.json({ statuses: [status] });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Alamat tidak boleh dituju." }, { status: 400 });
    }
  }

  // Test koneksi router tersimpan (tanpa mengirim password dari browser).
  if (b?.diagnose && typeof b.id === "string") {
    const row = await prisma.aiRouter.findFirst({ where: { id: b.id, userId: guard.userId } });
    if (!row) return NextResponse.json({ error: "Router tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ diagnosis: await diagnoseRouter({ host: row.host, port: row.port, tls: row.tls, username: row.username, password: open(row.passwordEnc) }) });
  }

  const ids = Array.isArray(b?.ids) ? (b?.ids as unknown[]).map(String).slice(0, 40) : [];
  const rows = await prisma.aiRouter.findMany({ where: { userId: guard.userId, ...(ids.length ? { id: { in: ids } } : {}) } });
  const statuses = await checkMany(rows.map((r) => ({ id: r.id, load: async () => (await loadTarget(guard.userId, r.id)).target })));
  return NextResponse.json({ statuses });
}