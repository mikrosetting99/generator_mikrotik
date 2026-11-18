import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isBlocked, registerFailure, sweepRateLimits } from "@/lib/rate-limit";
import { isToken, parseStatus, validateRequest } from "@/lib/setting-request";
import { requestData } from "@/lib/setting-request-server";

export const dynamic = "force-dynamic";

/**
 * Form publik untuk pelanggan (tanpa login). Pemegang link hanya bisa melihat dan
 * mengubah isiannya sendiri; catatan admin dan password router tidak pernah dikirim.
 */
const NO_STORE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const LIMIT = 30;
const WINDOW = 10 * 60_000;

function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

async function findByToken(token: string) {
  if (!isToken(token)) return null;
  return prisma.settingRequest.findUnique({ where: { token } });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = `setting-form:get:${clientIp(request)}`;
  if (isBlocked(key, LIMIT * 4)) return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });

  const row = await findByToken(token);
  if (!row) {
    // Hanya token salah yang dihitung, supaya link tidak bisa ditebak.
    registerFailure(key, LIMIT * 4, WINDOW);
    return NextResponse.json({ error: "Link tidak ditemukan atau sudah dihapus." }, { status: 404, headers: NO_STORE });
  }
  const status = parseStatus(row.status);
  return NextResponse.json(
    { status, submitted: Boolean(row.submittedAt), locked: status === "selesai", data: requestData(row) },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  sweepRateLimits();
  const key = `setting-form:post:${clientIp(request)}`;
  if (registerFailure(key, LIMIT, WINDOW)) {
    return NextResponse.json({ error: "Terlalu banyak pengiriman. Coba lagi beberapa menit lagi." }, { status: 429 });
  }

  const row = await findByToken(token);
  if (!row) return NextResponse.json({ error: "Link tidak ditemukan atau sudah dihapus." }, { status: 404 });
  if (parseStatus(row.status) === "selesai") {
    return NextResponse.json({ error: "Permintaan ini sudah dikerjakan admin dan tidak bisa diubah lagi." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const { data, errors } = validateRequest(body);
  if (Object.keys(errors).length) return NextResponse.json({ error: "Isian belum lengkap.", errors }, { status: 400 });

  await prisma.settingRequest.update({
    where: { id: row.id },
    data: { ...data, status: "masuk", submittedAt: row.submittedAt ?? new Date() },
  });
  return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
}
