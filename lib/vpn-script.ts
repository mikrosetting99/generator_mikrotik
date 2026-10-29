/**
 * Pembuat script VPN client (SSTP, L2TP, OVPN) untuk RouterOS 6/7. Admin hanya mengisi
 * username dan password VPN; sisanya (server, gateway tunnel, nama tunnel) punya nilai bawaan.
 * Bentuknya mengikuti script standar: interface client, Netwatch, dan scheduler yang
 * menyalakan ulang interface bila gateway tunnel tidak bisa di-ping.
 */

export type VpnProtocol = "sstp" | "l2tp" | "ovpn";

export const VPN_PROTOCOLS: Array<{ id: VpnProtocol; label: string }> = [
  { id: "sstp", label: "SSTP" },
  { id: "l2tp", label: "L2TP" },
  { id: "ovpn", label: "OVPN" },
];

export const DEFAULT_VPN_SERVER = "vpn-id1.mikrosetting.com";
export const DEFAULT_VPN_GATEWAY = "10.202.0.1";

export interface VpnScriptParams {
  protocol: VpnProtocol;
  ros: "v6" | "v7";
  /** Alamat server VPN; kosong = bawaan. */
  server: string;
  /** Nama interface tunnel; kosong = dibuat dari username. */
  tunnel: string;
  /** IP gateway di dalam tunnel yang dipantau Netwatch; kosong = bawaan. */
  gateway: string;
  user: string;
  password: string;
  /** Hanya L2TP: IPsec secret (kosong = tanpa IPsec). */
  ipsecSecret: string;
  /** Hanya OVPN: port server (0 = 1194). */
  port: number;
}

/** Nama tunnel bawaan dari username, mis. test33 → tunnel_mikrosetting-test33. */
export function defaultTunnelName(user: string): string {
  const clean = user.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `tunnel_mikrosetting-${clean || "client"}`;
}

/** String RouterOS selalu berkutip: backslash, kutip, $, dan ? di-escape agar tidak ditafsirkan router. */
function q(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\?/g, "\\?")}"`;
}

const HOST_OK = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const NAME_OK = /^[A-Za-z0-9_.-]+$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/** Pemeriksaan isian script VPN; mengembalikan pesan galat pertama, atau "" bila sah. */
export function checkVpnParams(p: VpnScriptParams): string {
  if (!p.user.trim()) return "Username VPN belum diisi.";
  if (!p.password) return "Password VPN belum diisi.";
  const server = (p.server || DEFAULT_VPN_SERVER).trim();
  if (!HOST_OK.test(server)) return "Alamat server VPN tidak valid.";
  const tunnel = (p.tunnel || defaultTunnelName(p.user)).trim();
  if (!NAME_OK.test(tunnel)) return "Nama tunnel hanya boleh huruf, angka, titik, strip, dan underscore.";
  if (!IPV4.test((p.gateway || DEFAULT_VPN_GATEWAY).trim())) return "Gateway tunnel harus berupa alamat IPv4, mis. 10.202.0.1.";
  if (p.protocol === "ovpn" && p.port !== 0 && (p.port < 1 || p.port > 65535)) return "Port OVPN harus 1–65535.";
  return "";
}

export function generateVpnScript(p: VpnScriptParams): string {
  const server = (p.server || DEFAULT_VPN_SERVER).trim();
  const tunnel = (p.tunnel || defaultTunnelName(p.user)).trim();
  const gateway = (p.gateway || DEFAULT_VPN_GATEWAY).trim();
  const label = { sstp: "SSTP", l2tp: "L2TP", ovpn: "OVPN" }[p.protocol];
  const menu = `/interface ${p.protocol}-client`;
  const schedulerName = `tunnel-scheduler-${tunnel.replace(/^tunnel[_-]/, "").replace(/_/g, "-")}`;
  const netwatchComment = `tunnel-gateway-mikrosetting-${gateway}`;

  const common = `disabled=no connect-to=${server} name=${tunnel} user=${q(p.user.trim())} password=${q(p.password)} comment=${tunnel}`;
  let add = `${menu} add ${common}`;
  const notes: string[] = [];
  if (p.protocol === "l2tp") {
    add += p.ipsecSecret ? ` use-ipsec=yes ipsec-secret=${q(p.ipsecSecret)}` : " use-ipsec=no";
  } else if (p.protocol === "ovpn") {
    add += ` port=${p.port || 1194} mode=ip auth=sha1 cipher=${p.ros === "v7" ? "aes256-cbc" : "aes256"}`;
    notes.push("# Bila server OVPN memakai sertifikat, tambahkan certificate=<nama-sertifikat> pada perintah di atas.");
  }

  // Scheduler: satu baris tanpa \r\n; "\$" mencegah variabel diisi saat perintah add dijalankan.
  const onEvent =
    `:local ip \\"${gateway}\\"; :local interface \\"${tunnel}\\"; ` +
    `:if ([/ping \\$ip count=5] = 0) do={ :log warning \\"Interface \\$interface is restarting\\"; ` +
    `/interface disable \\$interface; :delay 3; /interface enable \\$interface }`;

  return [
    `# Tambah Interface ${label} Client`,
    `${menu} remove [find comment="${tunnel}"]`,
    add,
    ...notes,
    "",
    "# Netwatch",
    `/tool netwatch remove [find comment="${netwatchComment}"]`,
    `/tool netwatch add host=${gateway} comment=${netwatchComment}${p.ros === "v7" ? " type=simple" : ""}`,
    "",
    "# Disable Enable Interface (Optional)",
    `/system scheduler remove [find name="${schedulerName}"]`,
    `/system scheduler add interval=1m name=${schedulerName} on-event="${onEvent}" policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon`,
  ].join("\n");
}