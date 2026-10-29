import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { open } from "@/lib/vault";
import { generateVpnScript, parseNatRules, VPN_PROTOCOLS, type VpnNatRule, type VpnProtocol } from "@/lib/vpn-script";

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
  /** Script yang ditampilkan: dibuat otomatis bila protocol terisi, selain itu script manual. */
  script: string;
  protocol: "" | VpnProtocol;
  /** Tipe yang boleh dipilih pelanggan (kosong bila mode manual). */
  offered: VpnProtocol[];
  rosVersion: "v6" | "v7";
  vpnServer: string;
  gatewayIp: string;
  tunnelName: string;
  vpnPort: number;
  ipsecSecret: string;
  winbox: string;
  api: string;
  mikhmonUrl: string;
  tunnelIp: string;
  nat: VpnNatRule[];
  publicIp: string;
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
  protocol: string;
  offered: string;
  rosVersion: string;
  vpnServer: string;
  gatewayIp: string;
  tunnelName: string;
  vpnPort: number;
  ipsecEnc: string;
  winbox: string;
  api: string;
  mikhmonUrl: string;
  tunnelIp: string;
  natRules: string;
  publicIp: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Baris database → bentuk lengkap dengan password dan script yang sudah dibuka. */
export function toFull(row: Row): VpnScriptFull {
  const password = open(row.passwordEnc);
  const protocol: "" | VpnProtocol = VPN_PROTOCOLS.some((p) => p.id === row.protocol) ? (row.protocol as VpnProtocol) : "";
  const rosVersion: "v6" | "v7" = row.rosVersion === "v7" ? "v7" : "v6";
  // Data lama tanpa daftar tawaran: pelanggan boleh memilih ketiganya.
  const offeredList = row.offered.split(",").filter((x) => VPN_PROTOCOLS.some((p) => p.id === x)) as VpnProtocol[];
  const offered: VpnProtocol[] = protocol ? (offeredList.length ? offeredList : VPN_PROTOCOLS.map((p) => p.id)) : [];
  const ipsecSecret = row.ipsecEnc ? open(row.ipsecEnc) : "";
  const nat = parseNatRules(row.natRules);
  return {
    id: row.id,
    token: row.token,
    phone: row.phone,
    customer: row.customer,
    categoryId: row.categoryId,
    category: row.category.name,
    title: row.title,
    username: row.username,
    password,
    script: protocol
      ? generateVpnScript({
          protocol,
          ros: rosVersion,
          server: row.vpnServer,
          tunnel: row.tunnelName,
          gateway: row.gatewayIp,
          user: row.username,
          password,
          ipsecSecret,
          port: row.vpnPort,
          tunnelIp: row.tunnelIp,
          nat,
        })
      : open(row.scriptEnc),
    protocol,
    offered,
    rosVersion,
    vpnServer: row.vpnServer,
    gatewayIp: row.gatewayIp,
    tunnelName: row.tunnelName,
    vpnPort: row.vpnPort,
    ipsecSecret,
    winbox: row.winbox,
    api: row.api,
    mikhmonUrl: row.mikhmonUrl,
    tunnelIp: row.tunnelIp,
    nat,
    publicIp: row.publicIp,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}