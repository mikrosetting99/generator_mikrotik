import crypto from "node:crypto";

/**
 * Enkripsi kecil untuk data sensitif di database (password dan isi script pelanggan).
 * AES-256-GCM; kuncinya diturunkan dari VPN_SECRET, atau NEXTAUTH_SECRET bila tidak diisi.
 * PENTING: bila rahasia itu diganti, data lama tidak bisa dibuka lagi.
 */
function key(): Buffer {
  const secret = process.env.VPN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("VPN_SECRET atau NEXTAUTH_SECRET belum diatur di .env.");
  return crypto.createHash("sha256").update(`vpn-vault:${secret}`).digest();
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

/** Membuka hasil seal(); string kosong bila datanya rusak atau kuncinya berbeda. */
export function open(sealed: string): string {
  try {
    if (!sealed.startsWith("v1:")) return "";
    const raw = Buffer.from(sealed.slice(3), "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}