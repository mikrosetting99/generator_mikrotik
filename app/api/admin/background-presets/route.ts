import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PRESET_LIMITS, parsePresetKind } from "@/lib/preset-kinds";
import { prisma } from "@/lib/prisma";

const MAX_PRESETS = 60;

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
  const kind = parsePresetKind(form?.get("kind"));
  const limit = PRESET_LIMITS[kind];

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pilih berkas gambar dulu." }, { status: 400 });
  }
  if (!limit.types.includes(file.type)) {
    return NextResponse.json({ error: `Berkas harus ${limit.typeLabel}.` }, { status: 400 });
  }
  if (file.size > limit.maxBytes) {
    return NextResponse.json(
      { error: `Ukuran ${Math.round(file.size / 1024)} KB — maksimal ${limit.maxBytes / 1024} KB.` },
      { status: 400 },
    );
  }
  if ((await prisma.backgroundPreset.count({ where: { kind } })) >= MAX_PRESETS) {
    return NextResponse.json({ error: `Maksimal ${MAX_PRESETS} ${limit.label} di galeri.` }, { status: 400 });
  }

  const created = await prisma.backgroundPreset.create({
    data: {
      kind,
      name: name || file.name.replace(/\.[^.]+$/, "").slice(0, 80) || (kind === "logo" ? "Logo" : "Latar"),
      mime: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ preset: created });
}