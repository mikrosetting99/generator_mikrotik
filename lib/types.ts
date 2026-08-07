import type { RosVersion } from "./models";

export type { RosVersion };

export interface WanEntry {
  id: string;
  iface: string;
  mode: "dhcp" | "static";
  /** Mode DHCP Client */
  addDefaultRoute: boolean;
  dhcpDistance: string;
  usePeerDns: boolean;
  /** Mode Static */
  address: string;
  gateway: string;
  staticDistance: string;
  comment: string;
}

export interface BridgeEntry {
  id: string;
  name: string;
  ports: string[];
}

export interface VlanEntry {
  id: string;
  name: string;
  vlanId: string;
  parent: string;
}

export interface AddressEntry {
  id: string;
  iface: string;
  address: string;
  comment: string;
}

export interface PoolEntry {
  id: string;
  name: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface DhcpServerEntry {
  id: string;
  name: string;
  iface: string;
  pool: string;
  /** Kosong = ikuti IP address interface secara otomatis. */
  network: string;
  gateway: string;
  dnsServers: string;
  leaseTime: string;
}

export type HotspotAuth = "http-pap" | "http-chap" | "mac-cookie" | "cookie";

export interface HotspotEntry {
  id: string;
  name: string;
  iface: string;
  pool: string;
  dnsName: string;
  auth: HotspotAuth[];
  addressesPerMac: string;
}

/* ------------------------------------------------ halaman login hotspot */

export type HotspotTemplateId = "minimal" | "voucher" | "korporat" | "gelap";
export type LoginMode = "voucher" | "member";

/** Satu baris pada tabel harga paket di halaman login. */
export interface VoucherPackage {
  id: string;
  name: string;
  duration: string;
  price: string;
}

/**
 * Kustomisasi halaman login hotspot. Satu router hanya punya satu folder
 * `hotspot` di File List, jadi pengaturan ini berlaku untuk seluruh hotspot.
 */
export interface HotspotPageConfig {
  template: HotspotTemplateId;
  primaryColor: string;
  /** Warna latar bebas; warna teks & garis diturunkan dari kecerahannya. */
  bgColor: string;
  /** Nama yang tampil di halaman login. Kosong = judul disembunyikan. */
  title: string;
  subtitle: string;
  /** Logo disimpan sebagai data URI, lalu ditulis jadi berkas di dalam zip. */
  logoDataUrl: string;
  logoName: string;
  /** Tinggi tampil logo dalam piksel, 40–260. Lebarnya menyesuaikan sendiri. */
  logoHeight: number;
  /** Gambar latar, juga ikut jadi berkas di dalam zip. */
  bgImageDataUrl: string;
  bgImageName: string;
  /** Kepekatan lapisan gelap di atas gambar latar, 0–90 persen. */
  bgOverlay: number;
  /** Mode yang aktif saat halaman login pertama kali dibuka. */
  loginMode: LoginMode;
  showModeSwitch: boolean;
  /** Teks berjalan di atas form login. */
  marquee: string;
  showTrial: boolean;
  packages: VoucherPackage[];
  terms: string;
  whatsapp: string;
  whatsappLabel: string;
  footer: string;
}

/** Nama profile bawaan RouterOS — selalu tersedia tanpa perlu dibuat. */
export const DEFAULT_PPP_PROFILE = "default";

/** Nama profile bawaan yang tidak boleh ditimpa. */
export const RESERVED_PPP_PROFILES = ["default", "default-encryption"];

/**
 * Satu paket layanan PPPoE. Dipakai untuk membedakan kecepatan atau
 * segmen IP antar kelompok pelanggan.
 */
export interface PppoeProfile {
  id: string;
  name: string;
  /** IP router pada sisi PPPoE. Kosong = ikut bawaan RouterOS. */
  localAddress: string;
  /** Pool untuk remote address. Kosong = ikut bawaan RouterOS. */
  pool: string;
  rateLimit: string;
  onlyOne: boolean;
}

export interface PppoeSecret {
  id: string;
  user: string;
  password: string;
  /** Nama profile yang dipakai akun ini. */
  profile: string;
}

export interface PppoeConfig {
  enabled: boolean;
  iface: string;
  serviceName: string;
  /** Profile untuk klien yang tidak punya profile sendiri. */
  defaultProfile: string;
  profiles: PppoeProfile[];
  oneSessionPerHost: boolean;
  secrets: PppoeSecret[];
}

export interface DnsConfig {
  servers: string[];
  allowRemoteRequests: boolean;
}

export interface NatConfig {
  enabled: boolean;
  mode: "global" | "perInterface";
  interfaces: string[];
}

export interface SystemConfig {
  identity: string;
  adminUser: string;
  adminPassword: string;
  timezone: string;
  ntp: boolean;
}

/** Group bawaan RouterOS. */
export type UserGroup = "full" | "write" | "read";

export interface RouterUser {
  id: string;
  name: string;
  password: string;
  group: UserGroup;
  /** Batasi login user ini hanya dari subnet tertentu (opsional). */
  allowedAddress: string;
  comment: string;
}

export interface FirewallConfig {
  enabled: boolean;
  dropInvalid: boolean;
  allowIcmp: boolean;
  protectInput: boolean;
  fasttrack: boolean;
  restrictServices: boolean;
  mgmtSubnet: string;
  disableUnusedServices: boolean;
  limitDiscovery: boolean;
  limitMacServer: boolean;
}

export interface SetupConfig {
  modelId: string;
  /** Dipakai saat model = custom: daftar interface dipisah koma/baris baru. */
  customInterfaces: string;
  ros: RosVersion | "";
  system: SystemConfig;
  wans: WanEntry[];
  dns: DnsConfig;
  nat: NatConfig;
  bridges: BridgeEntry[];
  vlans: VlanEntry[];
  addresses: AddressEntry[];
  pools: PoolEntry[];
  dhcpServers: DhcpServerEntry[];
  hotspots: HotspotEntry[];
  hotspotPage: HotspotPageConfig;
  pppoe: PppoeConfig;
  firewall: FirewallConfig;
  users: RouterUser[];
}

export type SectionId =
  | "device"
  | "wan"
  | "dns"
  | "nat"
  | "bridge"
  | "vlan"
  | "address"
  | "pool"
  | "dhcp"
  | "hotspot"
  | "pppoe"
  | "firewall"
  | "user";

export interface Issue {
  section: SectionId;
  level: "error" | "warn";
  message: string;
}
