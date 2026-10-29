import { isValidPhone, normalizePhone } from "@/lib/phone";
import { checkVpnParams, MAX_NAT_RULES, VPN_PROTOCOLS, type VpnNatRule, type VpnProtocol } from "@/lib/vpn-script";

export const VPN_LIMITS = {
  category: 80,
  title: 160,
  username: 160,
  password: 200,
  customer: 120,
  note: 500,
  script: 200_000,
  address: 200,
  url: 300,
  server: 160,
  tunnel: 80,
  ipsec: 100,
};

export interface VpnScriptInput {
  phone: string;
  customer: string;
  categoryId: string;
  title: string;
  /** Untuk script VPN otomatis: username dan password VPN. */
  username: string;
  password: string;
  /** "" = script manual (tempel sendiri); selain itu script dibuat otomatis. Ini pilihan awal pelanggan. */
  protocol: "" | VpnProtocol;
  /** Tipe yang boleh dipilih pelanggan (urut SSTP, L2TP, OVPN); kosong bila mode manual. */
  offered: VpnProtocol[];
  rosVersion: "v6" | "v7";
  vpnServer: string;
  gatewayIp: string;
  tunnelName: string;
  vpnPort: number;
  ipsecSecret: string;
  /** Hanya mode manual. */
  script: string;
  /** Alamat akses router untuk pelanggan. */
  winbox: string;
  api: string;
  mikhmonUrl: string;
  /** Kategori VPN Remote: IP tunnel pelanggan dan port-forward dst-nat. */
  tunnelIp: string;
  nat: VpnNatRule[];
  note: string;
}

/** Alamat akses: IPv4 atau domain, boleh diikuti :port. */
const ACCESS_OK = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:\d{1,5})?$/;

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

  const protocolRaw = str(b.protocol, 10);
  const offeredRaw: string[] = Array.isArray(b.offered)
    ? b.offered.filter((x): x is string => typeof x === "string")
    : typeof b.offered === "string"
      ? b.offered.split(",")
      : [];
  const picked = VPN_PROTOCOLS.map((p) => p.id).filter((id) => offeredRaw.includes(id) || id === protocolRaw);
  // Mode VPN bila ada tipe yang ditawarkan; pilihan awal = tipe pertama yang ditawarkan.
  const offered: VpnProtocol[] = picked;
  const protocol: "" | VpnProtocol = offered[0] ?? "";
  const portNum = Math.round(Number(b.vpnPort));
  const nat: VpnNatRule[] = Array.isArray(b.nat)
    ? b.nat
        .slice(0, MAX_NAT_RULES)
        .map((r: Record<string, unknown>) => {
          const port = Math.round(Number(r?.port));
          const toPort = Math.round(Number(r?.toPort)) || port;
          return { port, toAddress: str(r?.toAddress, 45).trim(), toPort };
        })
        .filter((r) => r.port || r.toAddress)
    : [];

  const data: VpnScriptInput = {
    phone,
    customer: str(b.customer, VPN_LIMITS.customer).trim(),
    categoryId,
    title,
    username: str(b.username, VPN_LIMITS.username).trim(),
    password: str(b.password, VPN_LIMITS.password),
    protocol,
    offered,
    rosVersion: b.rosVersion === "v7" ? "v7" : "v6",
    vpnServer: str(b.vpnServer, VPN_LIMITS.server).trim(),
    gatewayIp: str(b.gatewayIp, 45).trim(),
    tunnelName: str(b.tunnelName, VPN_LIMITS.tunnel).trim(),
    vpnPort: Number.isFinite(portNum) && portNum > 0 ? portNum : 0,
    ipsecSecret: protocol === "l2tp" ? str(b.ipsecSecret, VPN_LIMITS.ipsec) : "",
    script: protocol ? "" : str(b.script, VPN_LIMITS.script).replace(/\r\n/g, "\n"),
    winbox: str(b.winbox, VPN_LIMITS.address).trim(),
    api: str(b.api, VPN_LIMITS.address).trim(),
    mikhmonUrl: str(b.mikhmonUrl, VPN_LIMITS.url).trim(),
    tunnelIp: str(b.tunnelIp, 45).trim(),
    nat,
    note: str(b.note, VPN_LIMITS.note).trim(),
  };

  if (data.winbox && !ACCESS_OK.test(data.winbox)) return { ok: false, error: "Alamat Winbox harus IP publik atau domain, boleh dengan port. Contoh: 103.1.2.3:8291 atau vpn.contoh.com:8291." };
  if (data.api && !ACCESS_OK.test(data.api)) return { ok: false, error: "Alamat API harus IP publik atau domain, boleh dengan port. Contoh: 103.1.2.3:8728 atau vpn.contoh.com:8728." };
  if (data.mikhmonUrl && !/^https?:\/\/[^\s]+$/i.test(data.mikhmonUrl)) {
    return { ok: false, error: "Link Mikhmon online harus diawali http:// atau https://." };
  }

  if (protocol) {
    const problem = checkVpnParams({
      protocol,
      ros: data.rosVersion,
      server: data.vpnServer,
      tunnel: data.tunnelName,
      gateway: data.gatewayIp,
      user: data.username,
      password: data.password,
      ipsecSecret: data.ipsecSecret,
      port: data.vpnPort,
      tunnelIp: data.tunnelIp,
      nat: data.nat,
    });
    if (problem) return { ok: false, error: problem };
  } else if (!data.username && !data.password && !data.script.trim() && !data.winbox && !data.api && !data.mikhmonUrl) {
    return { ok: false, error: "Isi minimal salah satu: username/password, script, IP Winbox, IP API, atau link Mikhmon." };
  }
  if (!protocol) {
    data.nat = [];
    data.tunnelIp = "";
  }
  return { ok: true, data };
}