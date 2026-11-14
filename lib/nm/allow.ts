import dns from "node:dns/promises";
import net from "node:net";
import { isPrivateIp } from "@/lib/net-guard";

/**
 * Target yang boleh dihubungi collector.
 *  - Port: hanya NM_ALLOWED_PORTS (bawaan 8728,8729 = API dan API-SSL RouterOS).
 *  - Alamat: IP publik, atau alamat privat di dalam NM_ALLOWED_NETWORKS (CIDR IPv4 dipisah koma,
 *    mis. subnet tunnel VPN "10.88.0.0/16"). Jaringan internal server lainnya selalu ditolak.
 *    AI_ALLOW_PRIVATE_HOSTS=1 (uji lokal) mengizinkan semua alamat privat.
 */

export function allowedPorts(): number[] {
  const raw = process.env.NM_ALLOWED_PORTS ?? "8728,8729";
  return raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 65536);
}

interface Cidr {
  base: number;
  mask: number;
}

const ip4 = (ip: string) => ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;

export function parseCidrs(raw: string): Cidr[] {
  const out: Cidr[] = [];
  for (const part of raw.split(",").map((x) => x.trim()).filter(Boolean)) {
    const [addr, bitsRaw] = part.split("/");
    const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
    if (!net.isIPv4(addr) || !Number.isInteger(bits) || bits < 8 || bits > 32) continue; // /0–/7 terlalu luas: abaikan
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    out.push({ base: ip4(addr) & mask, mask });
  }
  return out;
}

export function inCidrs(ip: string, cidrs: Cidr[]): boolean {
  if (!net.isIPv4(ip)) return false;
  const n = ip4(ip);
  return cidrs.some((c) => (n & c.mask) >>> 0 === c.base);
}

/** Galat bila port tidak diizinkan; dipakai juga saat menyimpan perangkat. */
export function checkPort(port: number): string | null {
  const ports = allowedPorts();
  return ports.includes(port) ? null : `Port ${port} tidak diizinkan untuk collector. Port yang diizinkan: ${ports.join(", ")}.`;
}

const HOST_OK = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;

/** Me-resolve host dan memastikan alamatnya boleh dihubungi collector. */
export async function resolveAllowedTarget(host: string, port: number): Promise<string> {
  const portErr = checkPort(port);
  if (portErr) throw new Error(portErr);
  const h = host.trim();
  if (!h || h.length > 253 || (!net.isIP(h) && !HOST_OK.test(h))) throw new Error("Alamat perangkat tidak valid.");
  let ip = h;
  if (!net.isIP(h)) {
    try {
      ip = (await dns.lookup(h)).address;
    } catch {
      throw new Error(`Domain ${h} tidak ditemukan.`);
    }
  }
  if (isPrivateIp(ip) && process.env.AI_ALLOW_PRIVATE_HOSTS !== "1" && !inCidrs(ip, parseCidrs(process.env.NM_ALLOWED_NETWORKS ?? ""))) {
    throw new Error(`Alamat ${ip} berada di jaringan privat yang tidak diizinkan untuk collector. Tambahkan subnet site/VPN ke NM_ALLOWED_NETWORKS di server bila memang boleh.`);
  }
  return ip;
}
