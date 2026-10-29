import { isValidPhone, normalizePhone } from "@/lib/phone";

export const VPN_LIMITS = {
  category: 80,
  title: 160,
  username: 160,
  password: 200,
  customer: 120,
  note: 500,
  script: 200_000,
};

export interface VpnScriptInput {
  phone: string;
  customer: string;
  categoryId: string;
  title: string;
  username: string;
  password: string;
  script: string;
  note: string;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Memeriksa isian admin untuk satu link script; mengembalikan data bersih atau pesan galat. */
export function parseVpnScriptInput(body: unknown): { ok: true; data: VpnScriptInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const phone = normalizePhone(str(b.phone, 30));
  if (!isValidPhone(phone)) return { ok: false, error: "Nomor HP tidak valid. Contoh: 081234567890." };
  const title = str(b.title, VPN_LIMITS.title).trim();
  if (!title) return { ok: false, error: "Judul belum diisi." };
  const categoryId = str(b.categoryId, 60);
  if (!categoryId) return { ok: false, error: "Pilih kategori." };
  const data: VpnScriptInput = {
    phone,
    customer: str(b.customer, VPN_LIMITS.customer).trim(),
    categoryId,
    title,
    username: str(b.username, VPN_LIMITS.username).trim(),
    password: str(b.password, VPN_LIMITS.password),
    script: str(b.script, VPN_LIMITS.script).replace(/\r\n/g, "\n"),
    note: str(b.note, VPN_LIMITS.note).trim(),
  };
  if (!data.username && !data.password && !data.script.trim()) {
    return { ok: false, error: "Isi minimal salah satu: username, password, atau script." };
  }
  return { ok: true, data };
}