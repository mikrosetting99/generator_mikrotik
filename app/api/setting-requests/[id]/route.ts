import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseStatus, randomPassword, validateRequest } from "@/lib/setting-request";
import { requestToView } from "@/lib/setting-request-server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

async function owned(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: "Belum masuk." }, { status: 401 }) };
  const row = await prisma.settingRequest.findFirst({ where: { id, userId: session.user.id } });
  if (!row) return { error: NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 }) };
  return { row };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await owned(id);
  if (r.error) return r.error;
  return NextResponse.json({ request: requestToView(r.row) }, { headers: NO_STORE });
}

/**
 * Ubah oleh admin: { label?, status?, resetPassword?, data? }.
 * `data` = isian form (admin boleh merapikan isian pelanggan); divalidasi sama seperti form publik.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await owned(id);
  if (r.error) return r.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") update.label = body.label.trim().slice(0, 120);
  if (body.status !== undefined) {
    const status = parseStatus(body.status);
    // Link yang belum diisi tidak bisa langsung "selesai"/"masuk" tanpa data.
    if (status !== "menunggu" && !r.row.submittedAt && !body.data) {
      return NextResponse.json({ error: "Pelanggan belum mengisi form." }, { status: 400 });
    }
    update.status = status;
  }
  if (body.resetPassword === true) update.routerPassword = randomPassword();
  if (body.data !== undefined) {
    const { data, errors } = validateRequest(body.data);
    if (Object.keys(errors).length) return NextResponse.json({ error: "Isian belum lengkap.", errors }, { status: 400 });
    Object.assign(update, data);
    if (!r.row.submittedAt) {
      update.submittedAt = new Date();
      if (update.status === undefined) update.status = "masuk";
    }
  }

  const row = await prisma.settingRequest.update({ where: { id: r.row.id }, data: update });
  return NextResponse.json({ request: requestToView(row) }, { headers: NO_STORE });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await owned(id);
  if (r.error) return r.error;
  await prisma.settingRequest.delete({ where: { id: r.row.id } });
  return NextResponse.json({ ok: true });
}
