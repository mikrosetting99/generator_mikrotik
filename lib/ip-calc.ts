/**
 * Kalkulator subnet IPv4. Murni (tanpa DOM) supaya mudah diuji.
 * Semua hitungan memakai bilangan 32-bit tak bertanda (>>> 0).
 */

export interface IpResult {
  ip: string;
  prefix: number;
  netmask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  ipClass: string;
  kind: string;
  ipBinary: string;
  maskBinary: string;
}

export type ParseResult = { ok: true; ip: number; prefix: number } | { ok: false; error: string };

const toInt = (a: number, b: number, c: number, d: number) => ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function parseIp(text: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text.trim());
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return toInt(parts[0], parts[1], parts[2], parts[3]);
}

/** Netmask 255.255.255.0 → 24; null bila bukan mask yang berurutan. */
function maskToPrefix(mask: number): number | null {
  const inverted = (~mask) >>> 0;
  if ((inverted & (inverted + 1)) !== 0) return null;
  let prefix = 0;
  for (let bit = 31; bit >= 0; bit -= 1) {
    if ((mask >>> bit) & 1) prefix += 1;
    else break;
  }
  return prefix;
}

export function prefixToMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

/** Menerima "192.168.1.10/24", "192.168.1.10 255.255.255.0", atau "192.168.1.10" (anggap /32). */
export function parseInput(raw: string): ParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Masukkan alamat IP, mis. 192.168.1.10/24." };

  const slash = /^(\S+)\s*\/\s*(\d{1,2})$/.exec(text);
  if (slash) {
    const ip = parseIp(slash[1]);
    const prefix = Number(slash[2]);
    if (ip === null) return { ok: false, error: "Alamat IP tidak valid (tiap bagian 0–255)." };
    if (prefix > 32) return { ok: false, error: "Prefix harus 0–32." };
    return { ok: true, ip, prefix };
  }

  const spaced = /^(\S+)\s+(\S+)$/.exec(text);
  if (spaced) {
    const ip = parseIp(spaced[1]);
    const mask = parseIp(spaced[2]);
    if (ip === null) return { ok: false, error: "Alamat IP tidak valid (tiap bagian 0–255)." };
    if (mask === null) return { ok: false, error: "Netmask tidak valid." };
    const prefix = maskToPrefix(mask);
    if (prefix === null) return { ok: false, error: "Netmask harus berurutan, mis. 255.255.255.0." };
    return { ok: true, ip, prefix };
  }

  const ip = parseIp(text);
  if (ip === null) return { ok: false, error: "Format tidak dikenali. Contoh: 192.168.1.10/24" };
  return { ok: true, ip, prefix: 32 };
}

function classify(ip: number): { ipClass: string; kind: string } {
  const a = ip >>> 24;
  const b = (ip >>> 16) & 255;
  const ipClass = a < 128 ? "A" : a < 192 ? "B" : a < 224 ? "C" : a < 240 ? "D (multicast)" : "E (cadangan)";

  let kind = "Publik";
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) kind = "Privat (RFC 1918)";
  else if (a === 127) kind = "Loopback";
  else if (a === 169 && b === 254) kind = "Link-local (APIPA)";
  else if (a === 100 && b >= 64 && b <= 127) kind = "CGNAT (RFC 6598)";
  else if (a >= 224 && a < 240) kind = "Multicast";
  else if (a >= 240) kind = "Cadangan";
  else if (a === 0) kind = "Jaringan ini (0.0.0.0/8)";
  return { ipClass, kind };
}

const binary = (n: number) =>
  [24, 16, 8, 0].map((s) => ((n >>> s) & 255).toString(2).padStart(8, "0")).join(".");

export function calculate(ip: number, prefix: number): IpResult {
  const mask = prefixToMask(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  const total = 2 ** (32 - prefix);

  // /31 (titik-ke-titik, RFC 3021) memakai kedua alamat; /32 hanya satu host.
  let first = network + 1;
  let last = broadcast - 1;
  let usable = Math.max(total - 2, 0);
  if (prefix === 31) {
    first = network;
    last = broadcast;
    usable = 2;
  } else if (prefix === 32) {
    first = network;
    last = network;
    usable = 1;
  }

  const { ipClass, kind } = classify(ip);
  return {
    ip: intToIp(ip),
    prefix,
    netmask: intToIp(mask),
    wildcard: intToIp((~mask) >>> 0),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(first >>> 0),
    lastHost: intToIp(last >>> 0),
    totalAddresses: total,
    usableHosts: usable,
    ipClass,
    kind,
    ipBinary: binary(ip),
    maskBinary: binary(mask),
  };
}

export interface Subnet {
  network: string;
  prefix: number;
  range: string;
  broadcast: string;
  usable: number;
}

/** Bagi jaringan menjadi `count` subnet sama besar (dibulatkan ke pangkat dua). */
export function splitSubnets(ip: number, prefix: number, count: number): { ok: true; subnets: Subnet[]; newPrefix: number } | { ok: false; error: string } {
  if (!Number.isInteger(count) || count < 2) return { ok: false, error: "Jumlah subnet minimal 2." };
  if (count > 256) return { ok: false, error: "Maksimal 256 subnet." };
  const bits = Math.ceil(Math.log2(count));
  const newPrefix = prefix + bits;
  if (newPrefix > 32) return { ok: false, error: `Tidak muat: /${prefix} tidak bisa dibagi ${count} subnet.` };

  const base = (ip & prefixToMask(prefix)) >>> 0;
  const size = 2 ** (32 - newPrefix);
  const real = 2 ** bits;
  const subnets: Subnet[] = [];
  for (let i = 0; i < real; i += 1) {
    const r = calculate((base + i * size) >>> 0, newPrefix);
    subnets.push({
      network: r.network,
      prefix: newPrefix,
      range: `${r.firstHost} – ${r.lastHost}`,
      broadcast: r.broadcast,
      usable: r.usableHosts,
    });
  }
  return { ok: true, subnets, newPrefix };
}
