import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Sama dengan batas latar buatan pengguna di editor, supaya paket tetap ringan. */
const MAX_BYTES = 600 * 1024;
const MAX_PRESETS = 60;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Belum masuk." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Hanya admin." }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const name = String(form?.get("name") ?? "").trim().slice(0, 80);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pilih berkas gambar dulu." }, { status: 400 });
  }
  if (!TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Berkas harus JPG, PNG, atau WEBP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Ukuran ${Math.round(file.size / 1024)} KB — maksimal ${MAX_BYTES / 1024} KB.` },
      { status: 400 },
    );
  }
  if ((await prisma.backgroundPreset.count()) >= MAX_PRESETS) {
    return NextResponse.json({ error: `Maksimal ${MAX_PRESETS} latar di galeri.` }, { status: 400 });
  }

  const created = await prisma.backgroundPreset.create({
    data: {
      name: name || file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Latar",
      mime: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ preset: created });
}