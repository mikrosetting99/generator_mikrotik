/**
 * Helper perhitungan IP / CIDR.
 * Semua berjalan di sisi client — tidak ada data yang dikirim ke server.
 */

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isIpv4(value: string): boolean {
  const m = value.trim().match(IPV4);
  if (!m) return false;
  return m.slice(1).every((oct) => {
    const n = Number(oct);
    return n >= 0 && n <= 255 && String(n) === String(Number(oct));
  });
}

/** Terima "192.168.10.1/24". Prefix wajib. */
export function isCidr(value: string): boolean {
  const [ip, prefix, ...rest] = value.trim().split("/");
  if (rest.length > 0 || prefix === undefined) return false;
  const p = Number(prefix);
  return isIpv4(ip) && Number.isInteger(p) && p >= 0 && p <= 32;
}

export function ipToInt(ip: string): number {
  return ip
    .trim()
    .split(".")
    .reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

export function intToIp(int: number): string {
  return [24, 16, 8, 0].map((shift) => (int >>> shift) & 255).join(".");
}

/** "192.168.10.5/24" -> "192.168.10.0/24" */
export function networkOf(cidr: string): string {
  if (!isCidr(cidr)) return "";
  const [ip, prefixRaw] = cidr.trim().split("/");
  const prefix = Number(prefixRaw);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return `${intToIp(ipToInt(ip) & mask)}/${prefix}`;
}

/** Alamat host pertama yang bisa dipakai pada sebuah CIDR. */
export function firstHostOf(cidr: string): string {
  if (!isCidr(cidr)) return "";
  const network = networkOf(cidr);
  const [ip, prefixRaw] = network.split("/");
  if (Number(prefixRaw) >= 31) return ip;
  return intToIp(ipToInt(ip) + 1);
}

/** Alamat host terakhir (sebelum broadcast). */
export function lastHostOf(cidr: string): string {
  if (!isCidr(cidr)) return "";
  const [ip, prefixRaw] = networkOf(cidr).split("/");
  const prefix = Number(prefixRaw);
  if (prefix >= 31) return ip;
  const size = 2 ** (32 - prefix);
  return intToIp(ipToInt(ip) + size - 2);
}

/** Apakah sebuah IP berada di dalam subnet CIDR. */
export function ipInCidr(ip: string, cidr: string): boolean {
  if (!isIpv4(ip) || !isCidr(cidr)) return false;
  const [net, prefixRaw] = networkOf(cidr).split("/");
  const prefix = Number(prefixRaw);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  // `&` menghasilkan int bertanda — kembalikan ke unsigned sebelum dibandingkan.
  return ((ipToInt(ip) & mask) >>> 0) === ipToInt(net);
}

/** Hanya alamat IP tanpa prefix: "192.168.10.1/24" -> "192.168.10.1" */
export function addressPart(cidr: string): string {
  return cidr.trim().split("/")[0] ?? "";
}

/**
 * Usulan range pool dari sebuah CIDR interface, menyisakan 10 alamat awal
 * untuk perangkat statis (router, AP, printer, dsb).
 */
export function suggestPoolRange(cidr: string): { start: string; end: string } {
  if (!isCidr(cidr)) return { start: "", end: "" };
  const [, prefixRaw] = networkOf(cidr).split("/");
  const prefix = Number(prefixRaw);
  if (prefix >= 30) return { start: "", end: "" };
  const netInt = ipToInt(networkOf(cidr).split("/")[0]);
  return { start: intToIp(netInt + 10), end: lastHostOf(cidr) };
}
