import crypto from "node:crypto";
import { Prisma, type VpnAccount, type VpnPackage, type VpnServer } from "@prisma/client";
import { ntHash } from "@/lib/nt-hash";
import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/vault";
import { generateVpnScript, type VpnProtocol } from "@/lib/vpn-script";
import {
  checkVpnUsername,
  generateChrScript,
  nextFreeIp,
  parseProtocols,
  parseSubnet,
  randomRadiusSecret,
  randomVpnPassword,
  subnetContains,
  type VpnAccountStatus,
} from "@/lib/vpn-radius";

/**
 * Akses database untuk VPN RADIUS (server, paket, akun). Dipakai route /api/admin/vpn-radius/*.
 * FreeRADIUS membaca tabel-tabel ini lewat view (lihat migrasi *_vpn_radius), bukan lewat kode ini.
 */

/** Sesi dianggap online bila ada interim-update dalam 15 menit (sama dengan simul_count_query). */
const ONLINE_WINDOW_MS = 15 * 60_000;

export const newRadiusSecret = () => randomRadiusSecret(crypto.randomBytes(32));
export const newVpnPassword = () => randomVpnPassword(crypto.randomBytes(14));

/** IP server FreeRADIUS seperti dilihat CHR; dari .env (VPN_RADIUS_IP). */
export function radiusIp(): string {
  return (process.env.VPN_RADIUS_IP ?? "").trim();
}

export function serverJson(s: VpnServer, accounts: number) {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    domain: s.domain,
    publicIp: s.publicIp,
    subnet: s.subnet,
    gatewayIp: s.gatewayIp,
    protocols: parseProtocols(s.protocols),
    rosVersion: s.rosVersion === "v7" ? "v7" : "v6",
    capacity: s.capacity,
    active: s.active,
    accounts,
  };
}

export function packageJson(p: VpnPackage, accounts: number) {
  return {
    id: p.id,
    name: p.name,
    priceIdr: p.priceIdr,
    durationDays: p.durationDays,
    uploadKbps: p.uploadKbps,
    downloadKbps: p.downloadKbps,
    portForwards: p.portForwards,
    maxAccounts: p.maxAccounts,
    protocols: parseProtocols(p.protocols),
    serverIds: p.serverIds ? p.serverIds.split(",").filter(Boolean) : [],
    active: p.active,
    accounts,
  };
}

/** Script setup CHR, atau pesan galat bila IP RADIUS belum diatur. */
export function chrScriptFor(s: VpnServer): { script: string } | { error: string } {
  const ip = radiusIp();
  if (!ip) return { error: "VPN_RADIUS_IP belum diisi di .env server (IP publik server FreeRADIUS)." };
  return {
    script: generateChrScript({
      serverName: s.name,
      rosVersion: s.rosVersion === "v7" ? "v7" : "v6",
      protocols: parseProtocols(s.protocols),
      gatewayIp: s.gatewayIp,
      radiusIp: ip,
      radiusSecret: s.radiusSecret,
    }),
  };
}

/** Akun yang IP tunnelnya akan berada di luar subnet bila subnet/gateway server diganti. */
export async function accountsOutsideSubnet(serverId: string, subnet: string, gatewayIp: string): Promise<string[]> {
  const s = parseSubnet(subnet);
  const rows = await prisma.vpnAccount.findMany({ where: { serverId }, select: { username: true, tunnelIp: true } });
  return rows.filter((r) => !subnetContains(s, r.tunnelIp) || r.tunnelIp === gatewayIp).map((r) => r.username);
}

/* ------------------------------------------------------------------ akun */

type AccountWithRefs = VpnAccount & {
  user: { username: string; name: string | null };
  server: { name: string; domain: string };
  package: { name: string };
};

export function accountJson(a: AccountWithRefs, online: { since: Date; ip: string } | undefined) {
  return {
    id: a.id,
    userId: a.userId,
    owner: a.user.name ? `${a.user.name} (${a.user.username})` : a.user.username,
    serverId: a.serverId,
    server: a.server.name,
    domain: a.server.domain,
    packageId: a.packageId,
    package: a.package.name,
    username: a.username,
    tunnelIp: a.tunnelIp,
    status: a.status as VpnAccountStatus,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    note: a.note,
    online: online ? { since: online.since.toISOString() } : null,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Username yang sedang online menurut radacct, beserta waktu mulai sesinya. */
export async function onlineSessions(usernames: string[]): Promise<Map<string, { since: Date; ip: string }>> {
  const map = new Map<string, { since: Date; ip: string }>();
  if (!usernames.length) return map;
  const rows = await prisma.radAcct.findMany({
    where: { username: { in: usernames }, acctstoptime: null, acctupdatetime: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    select: { username: true, acctstarttime: true, framedipaddress: true },
  });
  for (const r of rows) map.set(r.username, { since: r.acctstarttime ?? new Date(), ip: r.framedipaddress });
  return map;
}

export interface NewAccount {
  userId: string;
  serverId: string;
  packageId: string;
  /** Kosong = dibuat dari username pemilik + angka acak. */
  username: string;
  /** Kosong = password acak. */
  password: string;
  status: VpnAccountStatus;
  /** undefined = hari ini + masa aktif paket; null = tanpa batas waktu. */
  expiresAt: Date | null | undefined;
  note: string;
}

/** Username otomatis: nama pemilik yang dirapikan + 4 angka, mis. budi-4821. */
function autoUsername(owner: string): string {
  const base = owner.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "vpn";
  return `${base}-${crypto.randomInt(1000, 10000)}`;
}

/**
 * Membuat akun VPN: memeriksa paket/server/kapasitas, memberi IP tunnel kosong berikutnya, dan
 * menyimpan password terenkripsi beserta NT-Password. Diulang bila IP atau username bentrok
 * dengan permintaan lain yang berjalan bersamaan.
 */
export async function createAccount(input: NewAccount): Promise<{ id: string } | { error: string }> {
  const [owner, server, pkg] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId }, select: { username: true } }),
    prisma.vpnServer.findUnique({ where: { id: input.serverId } }),
    prisma.vpnPackage.findUnique({ where: { id: input.packageId } }),
  ]);
  if (!owner) return { error: "Pemilik akun tidak ditemukan." };
  if (!server) return { error: "Server VPN tidak ditemukan." };
  if (!pkg) return { error: "Paket tidak ditemukan." };
  const allowed = pkg.serverIds ? pkg.serverIds.split(",").filter(Boolean) : [];
  if (allowed.length && !allowed.includes(server.id)) return { error: `Paket ${pkg.name} tidak tersedia di server ${server.name}.` };

  const used = await prisma.vpnAccount.count({ where: { serverId: server.id } });
  if (used >= server.capacity) return { error: `Server ${server.name} penuh (${server.capacity} akun).` };
  const owned = await prisma.vpnAccount.count({ where: { userId: input.userId, packageId: pkg.id } });
  if (owned >= pkg.maxAccounts) return { error: `Pemilik ini sudah punya ${owned} akun di paket ${pkg.name} (maksimal ${pkg.maxAccounts}).` };

  const password = input.password || newVpnPassword();
  if (password.length < 8 || password.length > 64) return { error: "Password VPN 8–64 karakter." };
  if (input.username) {
    const err = checkVpnUsername(input.username);
    if (err) return { error: err };
  }

  const expiresAt =
    input.expiresAt === undefined ? new Date(Date.now() + pkg.durationDays * 86_400_000) : input.expiresAt;
  const subnet = parseSubnet(server.subnet);

  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await prisma.vpnAccount.findMany({ where: { serverId: server.id }, select: { tunnelIp: true } });
    const tunnelIp = nextFreeIp(subnet, server.gatewayIp, taken.map((t) => t.tunnelIp));
    if (!tunnelIp) return { error: `Subnet ${server.subnet} di server ${server.name} sudah penuh.` };
    const username = input.username || autoUsername(owner.username);
    try {
      const row = await prisma.vpnAccount.create({
        data: {
          userId: input.userId,
          serverId: server.id,
          packageId: pkg.id,
          username,
          passwordEnc: seal(password),
          ntHash: ntHash(password),
          tunnelIp,
          status: input.status,
          expiresAt,
          note: input.note,
        },
        select: { id: true },
      });
      return row;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown } | undefined)?.target ?? "");
        // Username pilihan admin sudah dipakai: tidak ada gunanya diulang.
        if (input.username && target.includes("username")) return { error: `Username ${input.username} sudah dipakai.` };
        continue;
      }
      throw e;
    }
  }
  return { error: "Gagal membagi IP tunnel karena banyak permintaan bersamaan. Coba lagi." };
}

/** Ganti password akun: simpan versi terenkripsi dan NT-Password baru. */
export async function setAccountPassword(id: string, password: string): Promise<void> {
  await prisma.vpnAccount.update({ where: { id }, data: { passwordEnc: seal(password), ntHash: ntHash(password) } });
}

/** Script client pelanggan untuk akun ini (dibuat oleh generator VPN yang sudah ada). */
export async function accountClientScript(
  id: string,
  protocol: VpnProtocol,
  ros: "v6" | "v7",
): Promise<{ script: string; username: string; password: string } | { error: string }> {
  const a = await prisma.vpnAccount.findUnique({ where: { id }, include: { server: true } });
  if (!a) return { error: "Akun VPN tidak ditemukan." };
  if (!parseProtocols(a.server.protocols).includes(protocol)) return { error: `Server ${a.server.name} tidak menyediakan ${protocol.toUpperCase()}.` };
  const password = open(a.passwordEnc);
  if (!password) return { error: "Password akun tidak bisa dibuka (kunci enkripsi server berubah). Ganti password akun ini." };
  return {
    username: a.username,
    password,
    script: generateVpnScript({
      protocol,
      ros,
      server: a.server.domain,
      tunnel: "",
      gateway: a.server.gatewayIp,
      user: a.username,
      password,
      ipsecSecret: "",
      port: 0,
    }),
  };
}
