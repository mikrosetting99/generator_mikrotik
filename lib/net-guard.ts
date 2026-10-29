import dns from "node:dns/promises";
import net from "node:net";

/**
 * Penjaga koneksi keluar dari server: AI Mikrotik Engineer menyambung ke alamat yang diketik
 * pengguna, jadi hanya alamat publik yang boleh dituju (bukan jaringan internal server).
 * Untuk uji lokal, AI_ALLOW_PRIVATE_HOSTS=1 mematikan pemeriksaan ini.
 */

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return ipv4Private(mapped[1]);
    return lower === "::" || lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || /^fe[89ab]/.test(lower);
  }
  return true;
}

const HOST_OK = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;

/** Mengubah nama/IP menjadi alamat IP publik; melempar galat berbahasa Indonesia bila tidak boleh dituju. */
export async function resolvePublicHost(host: string): Promise<string> {
  const h = host.trim();
  if (!h || h.length > 253 || (!net.isIP(h) && !HOST_OK.test(h))) throw new Error("Alamat router tidak valid.");
  const allowPrivate = process.env.AI_ALLOW_PRIVATE_HOSTS === "1";
  let ip = h;
  if (!net.isIP(h)) {
    try {
      ip = (await dns.lookup(h)).address;
    } catch {
      throw new Error(`Domain ${h} tidak ditemukan.`);
    }
  }
  if (!allowPrivate && isPrivateIp(ip)) {
    throw new Error("Hanya IP publik atau domain yang boleh dituju (bukan alamat jaringan lokal).");
  }
  return ip;
}
