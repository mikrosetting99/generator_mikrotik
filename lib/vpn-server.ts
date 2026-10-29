import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/vault";

export const DEFAULT_VPN_CATEGORIES = ["Mikhmon online", "VPN Remote"];

/** Pastikan kategori bawaan ada (dibuat sekali bila tabelnya masih kosong). */
export async function ensureVpnCategories(): Promise<void> {
  if ((await prisma.vpnCategory.count()) > 0) return;
  await prisma.vpnCategory.createMany({
    data: DEFAULT_VPN_CATEGORIES.map((name, i) => ({ name, sortOrder: i })),
    skipDuplicates: true,
  });
}

/** Bagian acak di link pelanggan (24 karakter, tidak bisa ditebak). */
export function newVpnToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

export interface VpnScriptFull {
  id: string;
  token: string;
  phone: string;
  customer: string;
  categoryId: string;
  category: string;
  title: string;
  username: string;
  password: string;
  script: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: string;
  token: string;
  phone: string;
  customer: string;
  categoryId: string;
  category: { name: string };
  title: string;
  username: string;
  passwordEnc: string;
  scriptEnc: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Baris database → bentuk lengkap dengan password dan script yang sudah dibuka. */
export function toFull(row: Row): VpnScriptFull {
  return {
    id: row.id,
    token: row.token,
    phone: row.phone,
    customer: row.customer,
    categoryId: row.categoryId,
    category: row.category.name,
    title: row.title,
    username: row.username,
    password: open(row.passwordEnc),
    script: open(row.scriptEnc),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}