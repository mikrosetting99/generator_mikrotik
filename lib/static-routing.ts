/**
 * Static routing per aplikasi (YouTube, TikTok, Facebook, WhatsApp, atau domain kustom)
 * lewat RAW + mangle, untuk RouterOS 6 dan 7.
 *
 * Cara kerja:
 *  1. RAW (prerouting, sebelum connection tracking) mengenali domain pada paket TCP dari LAN
 *     dengan `content=` (bawaan) atau `tls-host=`, lalu memasukkan IP tujuannya ke address-list aplikasi
 *     (`add-dst-to-address-list`). Daftar IP terisi sendiri dan menyesuaikan perubahan CDN.
 *  2. (Opsional) alamat domain utama dimasukkan lebih dulu ke address-list sebagai entri domain (FQDN),
 *     supaya koneksi pertama pun sudah lewat ISP yang benar.
 *  3. Mangle prerouting memberi routing-mark pada lalu lintas LAN yang menuju address-list itu.
 *  4. Tabel routing tiap ISP punya rute default ke gateway ISP-nya, dan NAT masquerade
 *     per interface ISP memastikan paketnya keluar dengan alamat yang benar.
 */

import { isIpv4 } from "./net";
import { args, type ArgValue, raw, ScriptBuilder } from "./generator/script-builder";

export type AppId = "youtube" | "tiktok" | "facebook" | "whatsapp" | "custom";

export interface AppDef {
  id: AppId;
  label: string;
  /** Warna penanda di antarmuka. */
  color: string;
  /**
   * Pola nama host TLS (tls-host=). Pola `*.nama.*` cocok untuk semua TLD (mis. youtube.co.id).
   * Untuk mode content, tanda * di ujung dibuang sehingga tersisa potongan teks yang dicari.
   */
  tlsHosts: string[];
  /** Rentang IP (CIDR) yang dimasukkan ke address-list lebih dulu, agar routing berlaku sejak paket pertama. */
  ranges: string[];
  /** Domain (FQDN) utama yang dimasukkan ke address-list; di-resolve router lewat DNS. */
  seeds: string[];
  note: string;
}

/** Daftar pola dan rentang IP mengikuti script acuan RAW Buananet (tls-host + address-list statis). */
export const APPS: AppDef[] = [
  {
    id: "youtube",
    label: "YouTube",
    color: "#e53935",
    tlsHosts: ["*youtube.com*", "*.youtube.*", "*.googlevideo.*", "*.youtu.*", "*.ytimg.*", "*yt3.ggpht.com*", "*youtubei.googleapis.com*"],
    ranges: [
      "64.18.0.0/20",
      "64.233.160.0/19",
      "66.102.0.0/20",
      "66.249.80.0/20",
      "72.14.192.0/18",
      "74.125.0.0/16",
      "173.194.0.0/16",
      "207.126.144.0/20",
      "209.85.128.0/17",
      "216.58.208.0/20",
      "216.239.32.0/19",
    ],
    seeds: ["www.youtube.com", "m.youtube.com", "i.ytimg.com", "youtu.be"],
    note: "Video dilayani dari googlevideo (banyak subdomain) dan rentang IP Google.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#111827",
    tlsHosts: ["*tiktok.com*", "*.tiktok.*", "*.tiktoktv.*", "*.e.tiktok.*", "*.tiktokcdn.*", "*.musical.*"],
    ranges: [
      "147.160.176.0/24",
      "147.160.177.0/24",
      "147.160.178.0/24",
      "147.160.179.0/24",
      "147.160.180.0/24",
      "147.160.181.0/24",
      "147.160.182.0/24",
      "147.160.183.0/24",
      "147.160.184.0/24",
      "147.160.185.0/24",
      "147.160.187.0/24",
      "147.160.188.0/24",
      "147.160.189.0/24",
      "147.160.190.0/24",
      "147.160.191.0/24",
      "103.136.221.0/24",
      "103.136.220.0/24",
      "103.136.220.0/23",
      "192.64.14.0/24",
      "199.103.24.0/24",
      "199.103.25.0/24",
      "130.44.212.0/24",
      "130.44.213.0/24",
      "130.44.214.0/24",
      "130.44.215.0/24",
      "139.177.224.0/24",
      "139.177.225.0/24",
      "139.177.226.0/24",
      "139.177.254.0/24",
      "139.177.255.0/24",
    ],
    seeds: ["www.tiktok.com", "m.tiktok.com"],
    note: "Konten video lewat CDN tiktokcdn dan rentang IP ByteDance.",
  },
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877f2",
    tlsHosts: ["*facebook.com*", "*.facebook.*", "*.m.me*", "*.fb.me*", "*.msngr.*", "*.messenger.*", "*.fbcdn.*", "*.fbsbx.*"],
    ranges: [
      "31.13.24.0/21",
      "31.13.64.0/18",
      "45.64.40.0/22",
      "66.220.144.0/21",
      "66.220.152.0/21",
      "69.63.176.0/21",
      "69.63.184.0/21",
      "74.119.76.0/22",
      "102.132.96.0/20",
      "103.4.96.0/22",
      "129.134.0.0/16",
      "157.240.0.0/17",
      "163.70.128.0/17",
      "163.114.128.0/20",
      "173.252.64.0/19",
      "179.60.192.0/22",
      "185.60.216.0/22",
      "185.89.216.0/22",
      "204.15.20.0/22",
    ],
    seeds: ["www.facebook.com", "m.facebook.com", "static.xx.fbcdn.net"],
    note: "Termasuk Messenger; memakai rentang IP Meta.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    color: "#25d366",
    tlsHosts: ["*whatsapp.com*", "*.whatsapp.*", "*wa.me*", "*.wa.*"],
    ranges: ["66.111.48.0/22"],
    seeds: ["web.whatsapp.com", "g.whatsapp.net", "mmg.whatsapp.net"],
    note: "Pesan, panggilan, dan WhatsApp Web.",
  },
];

/** Pola tls-host → potongan teks untuk mode content: *.youtube.* → .youtube. ; *youtube.com* → youtube.com */
export function contentOf(pattern: string): string {
  return pattern.replace(/^\*/, "").replace(/\*$/, "");
}
export interface IspRow {
  id: string;
  /** Nama routing mark jalur ini (v7: juga nama tabel routing), dipakai apa adanya, mis. to-ISP1. */
  mark: string;
  /** Interface WAN, mis. ether1. */
  iface: string;
  /** Gateway ISP, mis. 192.168.1.1. */
  gateway: string;
}

export interface AppSelection {
  id: AppId;
  enabled: boolean;
  /** id baris ISP tujuan. */
  isp: string;
  /** Hanya aplikasi kustom. */
  customName: string;
  /** Hanya aplikasi kustom: satu domain per baris / dipisah koma. */
  customDomains: string;
}

export type LocalMode = "addresslist" | "interfacelist" | "interface";
export type ListTimeout = "6h" | "1d" | "3d" | "7d";
/** Cara rule RAW mengenali domain: teks di isi paket (content) atau nama host TLS (tls-host). */
export type MatchMode = "content" | "tlshost";

export interface StaticRoutingConfig {
  ros: "" | "v6" | "v7";
  isps: IspRow[];
  apps: AppSelection[];
  localMode: LocalMode;
  lanList: string;
  lanIface: string;
  /** Pencocok domain pada rule RAW. Bawaan: content. */
  matchMode: MatchMode;
  /** Lama sebuah IP bertahan di address-list sejak terakhir terlihat. */
  timeout: ListTimeout;
  /** Buat NAT masquerade pada interface ISP tujuan (bila belum ada). */
  nat: boolean;
  /** Batasi FastTrack ke koneksi tanpa mark supaya mangle tetap berlaku. */
  fasttrack: boolean;
  /** Isi address-list lebih dulu dengan rentang IP aplikasi (CIDR), agar routing berlaku sejak paket pertama. */
  ranges: boolean;
  /** Isi address-list juga dengan nama host utama (di-resolve DNS router). */
  seed: boolean;
  /** Buang paket QUIC (UDP 443) ke IP aplikasi agar klien pindah ke TCP/TLS yang bisa dibaca SNI-nya. */
  blockQuic: boolean;
  /** Rute cadangan lewat ISP lain bila ISP tujuan mati. */
  fallback: boolean;
  /** Letakkan rule mangle di paling atas (place-before=0) agar mendahului aturan lain, mis. Load Balance. */
  top: boolean;
}

export interface SrIssue {
  level: "error" | "warn";
  message: string;
}

export const TIMEOUT_LABEL: Record<ListTimeout, string> = {
  "6h": "6 jam",
  "1d": "1 hari",
  "3d": "3 hari",
  "7d": "7 hari",
};

/** id bawaan tetap (agar server dan browser sama); baris tambahan memakai id unik. */
export function newIspRow(index: number, unique = false): IspRow {
  return {
    id: unique ? `isp-${index + 1}-${Math.random().toString(36).slice(2, 6)}` : `isp-${index + 1}`,
    mark: `sr-ISP${index + 1}`,
    iface: `ether${index + 1}`,
    gateway: `192.168.${index + 1}.1`,
  };
}

export function defaultStaticRouting(): StaticRoutingConfig {
  const isps = [newIspRow(0), newIspRow(1)];
  return {
    ros: "",
    isps,
    apps: [
      { id: "youtube", enabled: true, isp: isps[1].id, customName: "", customDomains: "" },
      { id: "tiktok", enabled: false, isp: isps[1].id, customName: "", customDomains: "" },
      { id: "facebook", enabled: false, isp: isps[1].id, customName: "", customDomains: "" },
      { id: "whatsapp", enabled: false, isp: isps[0].id, customName: "", customDomains: "" },
      { id: "custom", enabled: false, isp: isps[0].id, customName: "", customDomains: "" },
    ],
    localMode: "addresslist",
    lanList: "LAN",
    lanIface: "bridge-lan",
    matchMode: "content",
    timeout: "1d",
    nat: false,
    fasttrack: false,
    ranges: true,
    seed: false,
    blockQuic: false,
    fallback: false,
    top: true,
  };
}

/* ------------------------------------------------------------ utilitas */

const BRAND = "By Mikrosetting";
/** Comment rule Static Routing ditulis huruf kecil semua, mis. "sr rute to-isp1 - by mikrosetting". */
const tag = (text: string) => `${text} - ${BRAND}`.toLowerCase();

const cleanName = (value: string) => value.trim().replace(/[^A-Za-z0-9]+/g, "");

/** Nama routing mark yang sah di RouterOS: huruf, angka, titik, strip, dan underscore. */
export const MARK_OK = /^[A-Za-z0-9_.-]+$/;
const markOf = (isp: IspRow) => isp.mark.trim();

/** Domain kustom: dipisah koma/spasi/baris, dibersihkan, tanpa duplikat. */
export function parseDomains(text: string): string[] {
  const out: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const d = part.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^\*\./, "");
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) && !out.includes(d)) out.push(d);
  }
  return out;
}

interface ResolvedApp {
  id: AppId;
  label: string;
  list: string;
  tlsHosts: string[];
  ranges: string[];
  seeds: string[];
  isp: IspRow;
  ispIndex: number;
}

function resolveApps(config: StaticRoutingConfig): ResolvedApp[] {
  const out: ResolvedApp[] = [];
  for (const sel of config.apps) {
    if (!sel.enabled) continue;
    const ispIndex = config.isps.findIndex((i) => i.id === sel.isp);
    if (ispIndex < 0) continue;
    if (sel.id === "custom") {
      const name = cleanName(sel.customName) || "Kustom";
      const domains = parseDomains(sel.customDomains);
      if (domains.length === 0) continue;
      out.push({
        id: "custom",
        label: sel.customName.trim() || "Kustom",
        list: `SR-${name.toUpperCase()}`,
        tlsHosts: domains.map((d) => `*${d}*`),
        ranges: [],
        seeds: domains.slice(0, 3).map((d) => (d.startsWith("www.") ? d : `www.${d}`)),
        isp: config.isps[ispIndex],
        ispIndex,
      });
      continue;
    }
    const def = APPS.find((a) => a.id === sel.id);
    if (!def) continue;
    out.push({
      id: def.id,
      label: def.label,
      list: `SR-${def.id.toUpperCase()}`,
      tlsHosts: def.tlsHosts,
      ranges: def.ranges,
      seeds: def.seeds,
      isp: config.isps[ispIndex],
      ispIndex,
    });
  }
  return out;
}

/* ------------------------------------------------------------ validasi */

export function validateStaticRouting(config: StaticRoutingConfig): SrIssue[] {
  const issues: SrIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warn", message });

  if (!config.ros) err("Versi RouterOS belum dipilih.");

  if (config.isps.length === 0) err("Tambahkan minimal satu jalur ISP.");
  const names = new Set<string>();
  config.isps.forEach((isp, i) => {
    const tagName = markOf(isp) || `ISP ${i + 1}`;
    if (!markOf(isp)) err(`ISP ${i + 1}: routing mark belum diisi.`);
    else if (!MARK_OK.test(markOf(isp))) err(`Routing mark "${tagName}" hanya boleh huruf, angka, titik, strip, dan underscore.`);
    else if (names.has(markOf(isp).toLowerCase())) err(`Routing mark "${tagName}" dipakai dua kali.`);
    names.add(markOf(isp).toLowerCase());
    if (!isp.iface.trim()) err(`${tagName}: interface belum diisi.`);
    if (!isIpv4(isp.gateway.trim())) err(`${tagName}: gateway harus berupa alamat IPv4, mis. 192.168.1.1.`);
  });

  const enabled = config.apps.filter((a) => a.enabled);
  if (enabled.length === 0) err("Pilih minimal satu aplikasi.");
  for (const sel of enabled) {
    if (!config.isps.some((i) => i.id === sel.isp)) err("Ada aplikasi yang jalur ISP-nya belum dipilih.");
    if (sel.id === "custom") {
      if (!sel.customName.trim()) err("Aplikasi kustom: nama belum diisi.");
      if (parseDomains(sel.customDomains).length === 0) err("Aplikasi kustom: isi minimal satu domain yang valid, mis. netflix.com.");
    }
  }

  if (config.localMode === "interfacelist" && !config.lanList.trim()) err("Nama interface-list LAN belum diisi.");
  if (config.localMode === "interface" && !config.lanIface.trim()) err("Interface LAN belum diisi.");

  const fb = enabled.find((a) => a.id === "facebook");
  const wa = enabled.find((a) => a.id === "whatsapp");
  if (fb && wa && fb.isp !== wa.isp) {
    warn(
      "Facebook dan WhatsApp memakai jalur ISP berbeda. Keduanya milik Meta dan sering berbagi alamat IP — IP yang sama bisa masuk dua daftar dan hanya rule mangle yang lebih atas yang berlaku.",
    );
  }
  if (config.fallback && config.isps.length < 2) warn("Rute cadangan butuh minimal dua jalur ISP; opsi diabaikan.");
  if (!config.ranges && !config.seed) {
    warn("Tanpa rentang IP maupun domain bawaan, address-list kosong di awal: koneksi pertama ke IP baru lewat jalur utama dulu, dan daftar baru terisi setelah paket TLS pertama terbaca.");
  }
  return issues;
}

/* ------------------------------------------------------------- script */

/** Pencocok asal trafik LAN pada rule RAW dan mangle. */
function localMatch(config: StaticRoutingConfig): Array<[string, ArgValue]> {
  if (config.localMode === "interfacelist") return [["in-interface-list", config.lanList.trim()]];
  if (config.localMode === "interface") return [["in-interface", config.lanIface.trim()]];
  return [["src-address-list", "LOCAL-IP"]];
}

const localLabel = (config: StaticRoutingConfig) =>
  config.localMode === "addresslist"
    ? "IP Address List (RFC1918)"
    : config.localMode === "interfacelist"
      ? `In. Interface List (${config.lanList.trim() || "belum diisi"})`
      : `In. Interface (${config.lanIface.trim() || "belum diisi"})`;

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
}

export function generateStaticRouting(config: StaticRoutingConfig): string {
  const s = new ScriptBuilder();
  const v7 = config.ros === "v7";
  const apps = resolveApps(config);

  s.comment("MikroTik Static Routing per Aplikasi (RAW + Mangle)");
  s.comment("Generated by Mikrosetting.com");
  s.comment(`Date: ${stamp()}`);
  s.comment(`RouterOS: ${config.ros ? `${config.ros}.xx` : "(belum dipilih)"}`);
  s.comment(`Aplikasi: ${apps.length ? apps.map((a) => `${a.label}→${markOf(a.isp)}`).join(", ") : "(belum dipilih)"}`);
  s.comment(`Local Target: ${localLabel(config)}`);
  s.comment(`Masa simpan IP: ${TIMEOUT_LABEL[config.timeout]}`);

  if (!config.ros || apps.length === 0 || config.isps.length === 0) {
    s.blank().comment("Lengkapi dulu versi RouterOS, jalur ISP, dan minimal satu aplikasi.");
    return s.toString();
  }

  s.blank();
  s.comment("Syarat: interface tiap ISP sudah punya IP dan gateway-nya bisa dijangkau. Backup dulu:");
  s.comment("  /system backup save name=sebelum-static-routing");

  let currentMenu = "";
  const menu = (path: string) => {
    s.blank();
    s.line(path);
    currentMenu = path;
  };
  const add = (pairs: Array<[string, ArgValue]>, extra = "") => {
    if (!currentMenu) return;
    s.line(`add ${args(pairs)}${extra}`);
  };

  const usedIsps = [...new Set(apps.map((a) => a.ispIndex))].map((i) => ({ isp: config.isps[i], index: i }));
  const mark = (index: number) => markOf(config.isps[index]);

  // ------------------------------------------------------- address-list
  // Tiap daftar dibersihkan dulu lalu diisi ulang, jadi script aman dijalankan berkali-kali.
  s.blank();
  s.comment("1) Address-list: daftar IP tiap aplikasi (rentang IP bawaan + IP yang dipelajari rule RAW)");
  if (config.localMode === "addresslist") {
    for (const cidr of ["192.168.0.0/16", "172.16.0.0/12", "10.0.0.0/8"]) {
      s.addIfMissing(
        "/ip firewall address-list",
        [["list", "LOCAL-IP"], ["address", cidr]],
        args([["list", "LOCAL-IP"], ["address", cidr], ["comment", tag("Jaringan lokal (RFC1918)")]]),
      );
    }
  }
  menu("/ip firewall address-list");
  for (const app of apps) {
    s.line(`remove [find where list=${app.list}]`);
    if (config.ranges) {
      for (const cidr of app.ranges) add([["address", cidr], ["list", app.list]]);
    }
    if (config.seed) {
      for (const host of app.seeds) {
        add([["list", app.list], ["address", host], ["comment", tag(`SR domain ${app.label}`)]]);
      }
    }
  }

  // ----------------------------------------------------------------- RAW
  // Satu rule per pola; comment hanya di rule pertama tiap aplikasi (judul grup di Winbox).
  // Rule lama untuk address-list yang sama dihapus dulu.
  menu("/ip firewall raw");
  const local = localMatch(config);
  const notLocal: Array<[string, ArgValue]> =
    config.localMode === "addresslist" ? [["dst-address-list", raw("!LOCAL-IP")]] : [];
  for (const app of apps) {
    s.line(`remove [find where address-list=${app.list}]`);
    app.tlsHosts.forEach((pattern, di) => {
      // tls-host dan content ditulis tanpa kutip (pola berbintang), seperti script acuan.
      const matcher: [string, ArgValue] =
        config.matchMode === "tlshost" ? ["tls-host", raw(pattern)] : ["content", contentOf(pattern)];
      add([
        ["action", "add-dst-to-address-list"],
        ["address-list", app.list],
        ["address-list-timeout", config.timeout],
        ["chain", "prerouting"],
        ["protocol", "tcp"],
        matcher,
        ...notLocal,
        ...local,
        ...(di === 0 ? ([["comment", `${app.label.toLowerCase()} - mikrosetting.com`]] as Array<[string, ArgValue]>) : []),
      ]);
    });
  }
  if (config.blockQuic) {
    for (const app of apps) {
      const c = `${app.label.toLowerCase()} blokir quic - mikrosetting.com`;
      s.line(`remove [find where comment="${c}"]`);
      add([
        ["action", "drop"],
        ["chain", "prerouting"],
        ["dst-address-list", app.list],
        ["dst-port", 443],
        ["protocol", "udp"],
        ...local,
        ["comment", c],
      ]);
    }
  }

  // ------------------------------------------------------ routing table (v7)
  if (v7) {
    s.blank();
    s.comment("Tabel routing (dibuat bila belum ada, mis. sudah dibuat menu Load Balance)");
    for (const { index } of usedIsps) {
      s.addIfMissing(
        "/routing table",
        [["name", mark(index)]],
        `${args([["name", mark(index)]])} fib ${args([["comment", tag(`SR tabel ${mark(index)}`)]])}`,
      );
    }
  }

  // ---------------------------------------------------------------- route
  menu("/ip route");
  const markKey = v7 ? "routing-table" : "routing-mark";
  /** Hapus rute lama berkomentar sama lalu tambah lagi — aman dijalankan ulang. */
  const addRoute = (pairs: Array<[string, ArgValue]>, comment: string) => {
    s.line(`remove [find where comment="${comment}"]`);
    add([...pairs, ["comment", comment]]);
  };
  for (const { isp, index } of usedIsps) {
    addRoute(
      [
        ["dst-address", "0.0.0.0/0"],
        ["gateway", isp.gateway.trim()],
        [markKey, mark(index)],
        ["distance", 1],
        ["check-gateway", "ping"],
      ],
      tag(`SR rute ${markOf(isp)}`),
    );
  }
  if (config.fallback && config.isps.length > 1) {
    for (const { index } of usedIsps) {
      const other = config.isps.find((_, i) => i !== index)!;
      addRoute(
        [
          ["dst-address", "0.0.0.0/0"],
          ["gateway", other.gateway.trim()],
          [markKey, mark(index)],
          ["distance", 2],
          ["check-gateway", "ping"],
        ],
        tag(`SR cadangan ${mark(index)} via ${markOf(other)}`),
      );
    }
  }

  // ------------------------------------------------------------------ NAT
  if (config.nat) {
    s.blank();
    s.comment("NAT masquerade per jalur ISP (dilewati bila rule serupa sudah ada)");
    for (const { isp } of usedIsps) {
      s.addIfMissing(
        "/ip firewall nat",
        [["chain", "srcnat"], ["action", "masquerade"], ["out-interface", isp.iface.trim()]],
        args([["chain", "srcnat"], ["action", "masquerade"], ["out-interface", isp.iface.trim()], ["comment", tag(`SR NAT ${isp.iface.trim()}`)]]),
      );
    }
  }

  // --------------------------------------------------------------- mangle
  // Rule dihapus dulu lalu ditambah, kemudian dipindah ke paling atas dengan `move` — bukan
  // `place-before=0`, yang ditolak router bila daftar mangle masih kosong.
  menu("/ip firewall mangle");
  for (const app of apps) {
    const c = tag(`SR ${app.label} lewat ${markOf(app.isp)}`);
    s.line(`remove [find where comment="${c}"]`);
    add([
      ["action", "mark-routing"],
      ["chain", "prerouting"],
      ...local,
      ["dst-address-list", app.list],
      ["new-routing-mark", mark(app.ispIndex)],
      ["passthrough", false],
      ["comment", c],
    ]);
    if (config.top) s.line(`move [find where comment="${c}"] destination=0`);
  }
  // ------------------------------------------------------------ fasttrack
  if (config.fasttrack) {
    s.blank();
    s.comment("FastTrack bawaan melewati mangle, jadi dibatasi ke koneksi tanpa mark.");
    s.line("/ip firewall filter");
    s.line("set [find where action=fasttrack-connection] connection-mark=no-mark");
  }

  // -------------------------------------------------------------- penutup
  s.blank();
  s.comment("Cara cek: buka aplikasinya dari HP/komputer LAN, lalu lihat daftar IP yang terkumpul:");
  s.comment("  /ip firewall address-list print where list~\"^SR-\"");
  s.comment("  /ip firewall raw print stats  ->  counter rule SR naik bila paket TLS terbaca");
  s.comment("  /tool traceroute <ip-tujuan> routing-table=<mark>   (v7)  |  routing-mark=<mark>   (v6)");
  s.comment("Catatan: domain hanya terbaca pada TLS/TCP. QUIC (HTTP/3) tidak bisa dibaca; rule blokir QUIC (bila");
  s.comment("diaktifkan) memaksa klien beralih ke TCP. Koneksi pertama ke IP yang belum dikenal bisa putus sekali.");
  s.comment("Hapus semua pengaturan ini: pakai tab \"Hapus semua\".");
  return s.toString();
}

/** Skrip penghapus: hanya rule berkomentar khas Static Routing yang dibuang. */
export function generateStaticRoutingRemove(config: StaticRoutingConfig): string {
  const s = new ScriptBuilder();
  const v7 = config.ros === "v7";
  // Cocok untuk comment huruf kecil (sekarang) maupun versi lama yang memakai huruf besar.
  const re = `comment~"^[Ss][Rr] .* - [Bb]y [Mm]ikrosetting$"`;
  s.comment("MikroTik Static Routing per Aplikasi - HAPUS SEMUA SETTINGAN");
  s.comment("Generated by Mikrosetting.com");
  s.comment(`Date: ${stamp()}`);
  s.comment(`RouterOS: ${config.ros ? `${config.ros}.xx` : "(belum dipilih)"}`);
  s.blank();
  s.comment("Hanya rule berkomentar \"sr ... - by mikrosetting\" yang dihapus. Backup dulu:");
  s.comment("  /system backup save name=sebelum-hapus-static-routing");
  s.blank();
  s.line("/ip firewall mangle");
  s.line(`remove [find where ${re}]`);
  s.blank();
  s.line("/ip firewall raw");
  // Rule RAW hanya punya comment di rule pertama tiap aplikasi, jadi dikenali dari nama address-list SR-*.
  s.line(`remove [find where address-list~"^SR-" or dst-address-list~"^SR-" or ${re}]`);
  s.blank();
  s.line("/ip route");
  s.line(`remove [find where ${re}]`);
  s.blank();
  s.line("/ip firewall nat");
  s.line(`remove [find where ${re}]`);
  s.blank();
  s.line("/ip firewall address-list");
  s.line(`remove [find where list~"^SR-"]`);
  if (v7) {
    s.blank();
    s.line("/routing table");
    s.line(`remove [find where ${re}]`);
  }
  s.blank();
  s.comment("Daftar LOCAL-IP (RFC1918) dan pembatasan FastTrack tidak ikut dihapus karena bisa dipakai menu lain");
  s.comment("(mis. Load Balance). Hapus manual bila tidak diperlukan:");
  s.comment("  /ip firewall filter unset [find where action=fasttrack-connection] connection-mark");
  return s.toString();
}
