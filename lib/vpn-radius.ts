/**
 * Logika murni untuk VPN berbasis RADIUS: server VPN (CHR), paket, dan akun VPN.
 * Tanpa database dan tanpa jaringan, supaya bisa diuji langsung (scripts/test-vpn-radius.mts).
 *
 * Satu akun VPN terikat ke satu server; setiap server punya subnet tunnel sendiri, sehingga IP
 * tunnel pelanggan tetap dan routing ke router pelanggan cukup per subnet.
 */

import type { VpnProtocol } from "@/lib/vpn-script";
import { VPN_PROTOCOLS } from "@/lib/vpn-script";

export const RADIUS_LIMITS = { name: 80, location: 80, domain: 160, note: 300 } as const;

/** Status akun VPN. Hanya "active" yang diterima FreeRADIUS (lihat view radius_check). */
export const VPN_ACCOUNT_STATUSES = [
  { id: "pending", label: "Menunggu" },
  { id: "active", label: "Aktif" },
  { id: "suspended", label: "Ditangguhkan" },
] as const;
export type VpnAccountStatus = (typeof VPN_ACCOUNT_STATUSES)[number]["id"];

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOST_OK = /^(?=.{1,160}$)[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export const isIpv4 = (s: string) => IPV4.test(s.trim());

export function ipToInt(ip: string): number {
  return ip.split(".").reduce((n, part) => n * 256 + Number(part), 0);
}

export function intToIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export interface Subnet {
  network: number;
  prefix: number;
  /** Alamat pertama dan terakhir yang boleh dipakai host (tanpa network dan broadcast). */
  first: number;
  last: number;
}

/** "10.202.0.0/16" → rentang host. Melempar galat berbahasa Indonesia bila tidak sah. */
export function parseSubnet(cidr: string): Subnet {
  const m = cidr.trim().match(/^([\d.]+)\/(\d{1,2})$/);
  if (!m || !isIpv4(m[1])) throw new Error("Subnet harus berbentuk alamat/prefix, mis. 10.202.0.0/16.");
  const prefix = Number(m[2]);
  if (prefix < 16 || prefix > 29) throw new Error("Prefix subnet harus antara /16 dan /29.");
  const size = 2 ** (32 - prefix);
  const network = Math.floor(ipToInt(m[1]) / size) * size;
  if (network !== ipToInt(m[1])) throw new Error(`Alamat subnet harus awal blok, mis. ${intToIp(network)}/${prefix}.`);
  return { network, prefix, first: network + 1, last: network + size - 2 };
}

export function subnetContains(s: Subnet, ip: string): boolean {
  if (!isIpv4(ip)) return false;
  const n = ipToInt(ip);
  return n >= s.first && n <= s.last;
}

/** Jumlah IP pelanggan yang muat di subnet (tanpa gateway server). */
export function subnetCapacity(s: Subnet): number {
  return s.last - s.first;
}

/** IP tunnel kosong berikutnya: dimulai setelah gateway, melewati yang sudah dipakai. null bila penuh. */
export function nextFreeIp(s: Subnet, gateway: string, used: Iterable<string>): string | null {
  const taken = new Set<number>([ipToInt(gateway)]);
  for (const ip of used) if (isIpv4(ip)) taken.add(ipToInt(ip));
  for (let n = s.first; n <= s.last; n++) {
    if (!taken.has(n)) return intToIp(n);
  }
  return null;
}

/** Daftar protokol dari teks "sstp,l2tp"; yang tidak dikenal dibuang, urutan mengikuti VPN_PROTOCOLS. */
export function parseProtocols(csv: string): VpnProtocol[] {
  const picked = new Set(csv.split(",").map((s) => s.trim()));
  return VPN_PROTOCOLS.map((p) => p.id).filter((id) => picked.has(id));
}

/**
 * Nilai Mikrotik-Rate-Limit untuk akun di server VPN. Dari sisi server, rx = data yang diterima
 * dari pelanggan (upload pelanggan) dan tx = yang dikirim ke pelanggan (download pelanggan).
 * 0 = tanpa batas; "" bila keduanya tanpa batas.
 */
export function rateLimitValue(uploadKbps: number, downloadKbps: number): string {
  if (!uploadKbps && !downloadKbps) return "";
  const fmt = (k: number) => (k === 0 ? "0" : k % 1024 === 0 ? `${k / 1024}M` : `${k}k`);
  return `${fmt(uploadKbps)}/${fmt(downloadKbps)}`;
}

/** Teks kecepatan untuk dibaca manusia: 10240 → "10 Mbps", 0 → "tanpa batas". */
export function speedLabel(kbps: number): string {
  if (!kbps) return "tanpa batas";
  return kbps % 1024 === 0 ? `${kbps / 1024} Mbps` : `${kbps} kbps`;
}

/* ------------------------------------------------------------------ isian admin */

export interface ServerInput {
  name: string;
  location: string;
  domain: string;
  publicIp: string;
  subnet: string;
  gatewayIp: string;
  protocols: VpnProtocol[];
  rosVersion: "v6" | "v7";
  capacity: number;
  active: boolean;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : NaN;
};

/** Membaca dan memeriksa isian server VPN. Mengembalikan data rapi, atau pesan galat pertama. */
export function readServerInput(b: Record<string, unknown>): { data: ServerInput } | { error: string } {
  const data: ServerInput = {
    name: str(b.name, RADIUS_LIMITS.name),
    location: str(b.location, RADIUS_LIMITS.location),
    domain: str(b.domain, RADIUS_LIMITS.domain).toLowerCase(),
    publicIp: str(b.publicIp, 15),
    subnet: str(b.subnet, 18),
    gatewayIp: str(b.gatewayIp, 15),
    protocols: parseProtocols(Array.isArray(b.protocols) ? b.protocols.join(",") : String(b.protocols ?? "")),
    rosVersion: b.rosVersion === "v7" ? "v7" : "v6",
    capacity: int(b.capacity),
    active: b.active !== false,
  };
  if (!data.name) return { error: "Nama server belum diisi." };
  if (!HOST_OK.test(data.domain)) return { error: "Domain server harus berupa nama domain, mis. vpn1.mikrosetting.com." };
  if (!isIpv4(data.publicIp)) return { error: "IP publik server harus berupa alamat IPv4." };
  let subnet: Subnet;
  try {
    subnet = parseSubnet(data.subnet);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (!subnetContains(subnet, data.gatewayIp)) return { error: `IP gateway harus berada di dalam subnet ${data.subnet}.` };
  if (!data.protocols.length) return { error: "Pilih minimal satu protokol." };
  if (!Number.isInteger(data.capacity) || data.capacity < 1) return { error: "Kapasitas akun minimal 1." };
  if (data.capacity > subnetCapacity(subnet)) return { error: `Kapasitas melebihi jumlah IP di subnet (${subnetCapacity(subnet)}).` };
  return { data };
}

export interface PackageInput {
  name: string;
  priceIdr: number;
  durationDays: number;
  uploadKbps: number;
  downloadKbps: number;
  portForwards: number;
  maxAccounts: number;
  protocols: VpnProtocol[];
  /** Kosong = semua server boleh dipilih. */
  serverIds: string[];
  active: boolean;
}

export function readPackageInput(b: Record<string, unknown>): { data: PackageInput } | { error: string } {
  const data: PackageInput = {
    name: str(b.name, RADIUS_LIMITS.name),
    priceIdr: int(b.priceIdr),
    durationDays: int(b.durationDays),
    uploadKbps: int(b.uploadKbps),
    downloadKbps: int(b.downloadKbps),
    portForwards: int(b.portForwards),
    maxAccounts: int(b.maxAccounts),
    protocols: parseProtocols(Array.isArray(b.protocols) ? b.protocols.join(",") : String(b.protocols ?? "")),
    serverIds: (Array.isArray(b.serverIds) ? b.serverIds : []).map(String).filter(Boolean).slice(0, 50),
    active: b.active !== false,
  };
  if (!data.name) return { error: "Nama paket belum diisi." };
  if (!Number.isInteger(data.priceIdr) || data.priceIdr < 0) return { error: "Harga harus angka 0 atau lebih." };
  if (!Number.isInteger(data.durationDays) || data.durationDays < 1 || data.durationDays > 3660) return { error: "Masa aktif harus 1–3660 hari." };
  for (const [label, v] of [["Upload", data.uploadKbps], ["Download", data.downloadKbps]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 10_485_760) return { error: `${label} harus 0 (tanpa batas) sampai 10 Gbps.` };
  }
  if (!Number.isInteger(data.portForwards) || data.portForwards < 0 || data.portForwards > 50) return { error: "Kuota port-forward tambahan harus 0–50." };
  if (!Number.isInteger(data.maxAccounts) || data.maxAccounts < 1 || data.maxAccounts > 1000) return { error: "Maksimal akun per pelanggan harus 1–1000." };
  if (!data.protocols.length) return { error: "Pilih minimal satu protokol." };
  return { data };
}

/* ------------------------------------------------------------------ akun */

const USERNAME_OK = /^[a-z0-9][a-z0-9._-]{2,40}$/;

/** Tanggal "YYYY-MM-DD" → akhir hari itu (23:59:59 WIB); "" atau null → null (tanpa batas); tidak dikirim → undefined. */
export function readExpiry(v: unknown): Date | null | undefined | "invalid" {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "invalid";
  const d = new Date(`${v}T23:59:59+07:00`);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** Username VPN: huruf kecil, angka, titik, strip, underscore; 3–41 karakter. */
export function checkVpnUsername(u: string): string {
  return USERNAME_OK.test(u) ? "" : "Username VPN 3–41 karakter: huruf kecil, angka, titik, strip, atau underscore.";
}

/** Password acak tanpa huruf yang mirip (0/O, 1/l/I), aman ditulis di script RouterOS. */
export function randomVpnPassword(bytes: Uint8Array): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Secret RADIUS acak (huruf dan angka saja, agar aman di script tanpa escape). */
export function randomRadiusSecret(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/* ------------------------------------------------------------------ script CHR */

export interface ChrScriptParams {
  serverName: string;
  rosVersion: "v6" | "v7";
  protocols: VpnProtocol[];
  gatewayIp: string;
  /** IP server FreeRADIUS (server aaPanel), dilihat dari CHR. */
  radiusIp: string;
  radiusSecret: string;
}

export const RADIUS_PROFILE = "mikrosetting-radius";
const TAG = "mikrosetting-radius";

/**
 * Script sekali tempel di CHR: daftarkan FreeRADIUS, aktifkan AAA PPP lewat RADIUS dengan accounting,
 * profil PPP berisi IP gateway tunnel, server VPN memakai profil itu, dan CoA hanya dari server RADIUS.
 * Aman dijalankan ulang (yang lama ditimpa).
 */
export function generateChrScript(p: ChrScriptParams): string {
  const lines: string[] = [
    `# Setup RADIUS untuk server VPN: ${p.serverName}`,
    "# Dibuat oleh generator.mikrosetting.com. Aman dijalankan ulang.",
    "# Akun lokal di /ppp secret tetap berlaku (diperiksa lebih dulu); sisakan satu akun darurat admin.",
    "",
    "# 1. Server RADIUS",
    `/radius remove [find comment="${TAG}"]`,
    `/radius add service=ppp address=${p.radiusIp} secret="${p.radiusSecret}" timeout=3000ms comment="${TAG}"`,
    "/radius incoming set accept=yes port=3799",
    "/ppp aaa set use-radius=yes accounting=yes interim-update=5m",
    "",
    "# 2. Profil PPP untuk akun dari RADIUS (IP pelanggan dikirim RADIUS lewat Framed-IP-Address)",
    `:if ([:len [/ppp profile find name="${RADIUS_PROFILE}"]] = 0) do={ /ppp profile add name="${RADIUS_PROFILE}" }`,
    `/ppp profile set [find name="${RADIUS_PROFILE}"] local-address=${p.gatewayIp} change-tcp-mss=yes use-encryption=yes`,
    "",
    "# 3. Server VPN memakai profil di atas. Autentikasi hanya MS-CHAPv2: RADIUS menyimpan hash NT,",
    "#    bukan password asli, jadi CHAP tidak bisa diperiksa.",
  ];
  if (p.protocols.includes("sstp")) {
    lines.push(`/interface sstp-server server set enabled=yes default-profile="${RADIUS_PROFILE}" authentication=mschap2`);
  }
  if (p.protocols.includes("l2tp")) {
    lines.push(`/interface l2tp-server server set enabled=yes default-profile="${RADIUS_PROFILE}" authentication=mschap2`);
  }
  if (p.protocols.includes("ovpn")) {
    if (p.rosVersion === "v6") {
      lines.push(`/interface ovpn-server server set enabled=yes default-profile="${RADIUS_PROFILE}"`);
    } else {
      lines.push(`# OVPN (RouterOS 7): set default-profile="${RADIUS_PROFILE}" pada server OVPN Anda di /interface ovpn-server server.`);
    }
  }
  lines.push(
    "",
    "# 4. CoA/Disconnect (UDP 3799) hanya dari server RADIUS",
    `/ip firewall filter remove [find comment="${TAG}-coa"]`,
    `/ip firewall filter add chain=input protocol=udp dst-port=3799 src-address=!${p.radiusIp} action=drop comment="${TAG}-coa"`,
    `/ip firewall filter move [find comment="${TAG}-coa"] destination=0`,
  );
  if (p.protocols.includes("sstp") && p.rosVersion === "v7") {
    lines.push(
      "",
      "# 5. (Opsional) Sertifikat SSTP dari Let's Encrypt; port 80 CHR harus terbuka saat dijalankan:",
      "# /certificate enable-ssl-certificate dns-name=<domain server ini>",
    );
  }
  return lines.join("\n");
}
