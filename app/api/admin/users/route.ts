import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar akun harus selalu segar — jangan pernah di-cache browser maupun proxy. */
const NO_STORE = { "Cache-Control": "no-store" };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { configs: true } },
    },
  });

  return NextResponse.json(
    {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        configCount: u._count.configs,
      })),
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role === "ADMIN" ? "ADMIN" : "USER";

  if (username.length < 3) {
    return NextResponse.json({ error: "Username minimal 3 karakter." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ error: "Username sudah dipakai." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, name: name || null, passwordHash, role },
    select: { id: true, username: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json({
    user: { ...user, createdAt: user.createdAt.toISOString(), configCount: 0 },
  });
}
