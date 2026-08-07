import type {
  AddressEntry,
  BridgeEntry,
  DhcpServerEntry,
  HotspotEntry,
  PoolEntry,
  PppoeSecret,
  RouterUser,
  SetupConfig,
  VlanEntry,
  VoucherPackage,
  WanEntry,
} from "./types";

let counter = 0;
/** ID lokal untuk key React & operasi list — tidak masuk ke script. */
export function uid(prefix = "row"): string {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newWan(iface = ""): WanEntry {
  return {
    id: uid("wan"),
    iface,
    mode: "dhcp",
    addDefaultRoute: true,
    dhcpDistance: "1",
    usePeerDns: true,
    address: "",
    gateway: "",
    staticDistance: "1",
    comment: "",
  };
}

export function newBridge(name = "bridge-lan"): BridgeEntry {
  return { id: uid("br"), name, ports: [] };
}

export function newVlan(): VlanEntry {
  return { id: uid("vlan"), name: "", vlanId: "", parent: "" };
}

export function newAddress(iface = ""): AddressEntry {
  return { id: uid("addr"), iface, address: "", comment: "" };
}

export function newPool(): PoolEntry {
  return { id: uid("pool"), name: "", rangeStart: "", rangeEnd: "" };
}

export function newDhcpServer(): DhcpServerEntry {
  return {
    id: uid("dhcp"),
    name: "",
    iface: "",
    pool: "",
    network: "",
    gateway: "",
    dnsServers: "",
    leaseTime: "1d",
  };
}

export function newHotspot(): HotspotEntry {
  return {
    id: uid("hs"),
    name: "hotspot1",
    iface: "",
    pool: "",
    dnsName: "",
    auth: ["http-chap", "http-pap"],
    addressesPerMac: "2",
  };
}

export function newSecret(): PppoeSecret {
  return { id: uid("sec"), user: "", password: "" };
}

export function newPackage(): VoucherPackage {
  return { id: uid("pkg"), name: "", duration: "", price: "" };
}

export function newUser(): RouterUser {
  return { id: uid("user"), name: "", password: "", group: "full", allowedAddress: "", comment: "" };
}

export function createDefaultConfig(): SetupConfig {
  return {
    modelId: "",
    customInterfaces: "",
    ros: "",
    system: {
      identity: "",
      adminUser: "admin",
      adminPassword: "",
      timezone: "Asia/Jakarta",
      ntp: true,
    },
    wans: [newWan()],
    dns: { servers: ["8.8.8.8", "1.1.1.1"], allowRemoteRequests: true },
    nat: { enabled: true, mode: "global", interfaces: [] },
    bridges: [],
    vlans: [],
    addresses: [],
    pools: [],
    dhcpServers: [],
    hotspots: [],
    hotspotPage: {
      template: "minimal",
      primaryColor: "#38bdf8",
      bgColor: "#0b1220",
      title: "",
      subtitle: "",
      logoDataUrl: "",
      logoName: "",
      logoHeight: 90,
      bgImageDataUrl: "",
      bgImageName: "",
      bgOverlay: 55,
      loginMode: "voucher",
      showModeSwitch: true,
      marquee: "Selamat datang di jaringan hotspot kami",
      showTrial: false,
      packages: [],
      terms: "",
      whatsapp: "",
      whatsappLabel: "Beli voucher via WhatsApp",
      footer: "",
    },
    pppoe: {
      enabled: false,
      iface: "",
      serviceName: "pppoe-service",
      profileName: "pppoe-profile",
      localAddress: "",
      pool: "",
      rateLimit: "",
      oneSessionPerHost: true,
      secrets: [],
    },
    firewall: {
      // Sengaja mati secara default — pengguna mengaktifkan sendiri bila perlu.
      enabled: false,
      dropInvalid: true,
      allowIcmp: true,
      protectInput: true,
      fasttrack: true,
      restrictServices: true,
      mgmtSubnet: "",
      disableUnusedServices: true,
      limitDiscovery: true,
      limitMacServer: true,
    },
    users: [],
  };
}

export const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "UTC",
];
