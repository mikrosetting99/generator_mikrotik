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

export type PppoeAuth = "pap" | "chap" | "mschap1" | "mschap2";

export interface PppoeSecret {
  id: string;
  user: string;
  password: string;
}

export interface PppoeConfig {
  enabled: boolean;
  iface: string;
  serviceName: string;
  profileName: string;
  localAddress: string;
  pool: string;
  rateLimit: string;
  auth: PppoeAuth[];
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
  pppoe: PppoeConfig;
  firewall: FirewallConfig;
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
  | "firewall";

export interface Issue {
  section: SectionId;
  level: "error" | "warn";
  message: string;
}
