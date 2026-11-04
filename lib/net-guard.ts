import { lookup as dnsLookup } from "node:dns";
import dns from "node:dns/promises";
import net, { type LookupFunction } from "node:net";

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

/** IPv6 sebagai 8 kelompok 16-bit, termasuk bentuk singkat (::) dan ekor IPv4 (::ffff:1.2.3.4). */
function ipv6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const tail = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const [a, b, c, d] = tail[2].split(".").map(Number);
    s = `${tail[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - left.length - right.length : 0;
  if (fill < 0) return null;
  const groups = [...left, ...Array(fill).fill("0"), ...right].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => g >= 0 && g <= 0xffff) ? groups : null;
}

function ipv4From(hi: number, lo: number): string {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function ipv6Private(ip: string): boolean {
  const g = ipv6Groups(ip.split("%")[0]);
  if (!g) return true;
  const zero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  // Bentuk yang membawa alamat IPv4 di dalamnya: dinilai dari alamat IPv4 itu.
  if (zero(0, 5) && g[5] === 0xffff) return ipv4Private(ipv4From(g[6], g[7])); // ::ffff:a.b.c.d (mapped)
  if (zero(0, 6)) return ipv4Private(ipv4From(g[6], g[7])); // ::a.b.c.d (compatible), juga :: dan ::1
  if (g[0] === 0x64 && g[1] === 0xff9b && zero(2, 6)) return ipv4Private(ipv4From(g[6], g[7])); // NAT64
  if (g[0] === 0x2002) return ipv4Private(ipv4From(g[1], g[2])); // 6to4
  return (
    (g[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (g[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (g[0] & 0xffc0) === 0xfec0 || // fec0::/10 site-local (usang)
    (g[0] & 0xff00) === 0xff00 // ff00::/8 multicast
  );
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  if (net.isIPv6(ip)) return ipv6Private(ip);
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
    throw new Error(PRIVATE_MSG);
  }
  return ip;
}

const PRIVATE_MSG = "Hanya IP publik atau domain yang boleh dituju (bukan alamat jaringan lokal).";

/**
 * Fungsi `lookup` untuk node:https/node:net: me-resolve nama saat koneksi dibuat dan menolak bila
 * ada alamat hasil yang privat. Karena pemeriksaan dan koneksi memakai jawaban DNS yang sama,
 * DNS rebinding (jawaban berubah antara pemeriksaan dan koneksi) tidak bisa lolos.
 * Catatan: Node tidak memanggil lookup untuk host berupa IP literal; itu diperiksa oleh resolvePublicHost.
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses.filter((a) => a.family === 4 || a.family === 6);
    if (!list.length) return callback(Object.assign(new Error(`Domain ${hostname} tidak ditemukan.`), { code: "ENOTFOUND" }), "", 0);
    if (process.env.AI_ALLOW_PRIVATE_HOSTS !== "1" && list.some((a) => isPrivateIp(a.address))) {
      return callback(Object.assign(new Error(PRIVATE_MSG), { code: "EPRIVATEHOST" }), "", 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
};
