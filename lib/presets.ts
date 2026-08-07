import {
  createDefaultConfig,
  newAddress,
  newBridge,
  newDhcpServer,
  newHotspot,
  newPackage,
  newPool,
  newPppoeProfile,
  newSecret,
  newWan,
} from "./defaults";
import type { SetupConfig } from "./types";

/**
 * Konfigurasi siap pakai.
 *
 * Semuanya memakai hEX (RB750Gr3) dengan RouterOS v7 sebagai dasar — 5 port,
 * model paling umum di lapangan. Setelah dimuat, pengguna tinggal mengganti
 * model, interface, dan subnet sesuai perangkatnya.
 *
 * Password admin sengaja dibiarkan kosong: preset dipakai banyak orang, jadi
 * memasang password bawaan justru berbahaya. Validasi akan mengingatkan.
 */
export interface Preset {
  id: string;
  name: string;
  description: string;
  /** Ringkasan isi, tampil sebagai daftar di dialog pemilihan. */
  points: string[];
  build: () => SetupConfig;
}

function base(): SetupConfig {
  const config = createDefaultConfig();
  return {
    ...config,
    modelId: "rb750gr3",
    ros: "v7",
    wans: [{ ...newWan("ether1"), comment: "ISP utama" }],
    firewall: { ...config.firewall, enabled: true },
  };
}

/* ------------------------------------------------------ 1. router dasar */

function routerDasar(): SetupConfig {
  const config = base();
  return {
    ...config,
    system: { ...config.system, identity: "Router-Kantor" },
    bridges: [{ ...newBridge("bridge-lan"), ports: ["ether2", "ether3", "ether4", "ether5"] }],
    addresses: [{ ...newAddress("bridge-lan"), address: "192.168.10.1/24", comment: "LAN" }],
    pools: [
      { ...newPool(), name: "pool-lan", rangeStart: "192.168.10.10", rangeEnd: "192.168.10.254" },
    ],
    dhcpServers: [
      { ...newDhcpServer(), name: "dhcp-lan", iface: "bridge-lan", pool: "pool-lan" },
    ],
    firewall: { ...config.firewall, mgmtSubnet: "192.168.10.0/24" },
  };
}

/* -------------------------------------------------- 2. warnet + hotspot */

function warnetHotspot(): SetupConfig {
  const config = base();
  return {
    ...config,
    system: { ...config.system, identity: "Router-Warnet" },
    bridges: [
      { ...newBridge("bridge-lan"), ports: ["ether2"] },
      { ...newBridge("bridge-hotspot"), ports: ["ether3", "ether4", "ether5"] },
    ],
    addresses: [
      { ...newAddress("bridge-lan"), address: "192.168.10.1/24", comment: "LAN kasir & kantor" },
      { ...newAddress("bridge-hotspot"), address: "10.10.0.1/24", comment: "segmen hotspot" },
    ],
    pools: [
      { ...newPool(), name: "pool-lan", rangeStart: "192.168.10.10", rangeEnd: "192.168.10.254" },
      { ...newPool(), name: "pool-hotspot", rangeStart: "10.10.0.10", rangeEnd: "10.10.0.254" },
    ],
    dhcpServers: [
      { ...newDhcpServer(), name: "dhcp-lan", iface: "bridge-lan", pool: "pool-lan" },
      // Klien hotspot tetap butuh DHCP; poolnya sengaja sama dengan hotspot.
      {
        ...newDhcpServer(),
        name: "dhcp-hotspot",
        iface: "bridge-hotspot",
        pool: "pool-hotspot",
        leaseTime: "1h",
      },
    ],
    hotspots: [
      {
        ...newHotspot(),
        name: "hotspot1",
        iface: "bridge-hotspot",
        pool: "pool-hotspot",
        dnsName: "wifi.lokal",
        auth: ["http-chap", "http-pap"],
      },
    ],
    hotspotPage: {
      ...config.hotspotPage,
      template: "voucher",
      primaryColor: "#f59e0b",
      title: "Warnet Kita",
      subtitle: "Internet cepat untuk semua",
      loginMode: "voucher",
      marquee: "Selamat datang — masukkan kode voucher untuk mulai",
      packages: [
        { ...newPackage(), name: "2 Jam", duration: "2 jam", price: "Rp 5.000" },
        { ...newPackage(), name: "1 Hari", duration: "24 jam", price: "Rp 10.000" },
        { ...newPackage(), name: "1 Minggu", duration: "7 hari", price: "Rp 50.000" },
      ],
      whatsappLabel: "Beli voucher via WhatsApp",
      footer: "Hubungi petugas bila mengalami kendala",
    },
    firewall: { ...config.firewall, mgmtSubnet: "192.168.10.0/24", fasttrack: false },
  };
}

/* --------------------------------------------------- 3. RT/RW Net PPPoE */

function rtRwPppoe(): SetupConfig {
  const config = base();
  return {
    ...config,
    system: { ...config.system, identity: "Router-RTRW" },
    bridges: [{ ...newBridge("bridge-lan"), ports: ["ether2", "ether3", "ether4", "ether5"] }],
    addresses: [
      { ...newAddress("bridge-lan"), address: "10.0.0.1/24", comment: "jaringan distribusi" },
    ],
    pools: [
      { ...newPool(), name: "pool-10mbps", rangeStart: "10.10.10.2", rangeEnd: "10.10.10.254" },
      { ...newPool(), name: "pool-20mbps", rangeStart: "10.10.20.2", rangeEnd: "10.10.20.254" },
    ],
    pppoe: {
      ...config.pppoe,
      enabled: true,
      iface: "bridge-lan",
      serviceName: "rtrw-net",
      defaultProfile: "paket-10mbps",
      profiles: [
        {
          ...newPppoeProfile(),
          name: "paket-10mbps",
          localAddress: "10.10.10.1",
          pool: "pool-10mbps",
          rateLimit: "10M/10M",
        },
        {
          ...newPppoeProfile(),
          name: "paket-20mbps",
          localAddress: "10.10.20.1",
          pool: "pool-20mbps",
          rateLimit: "20M/20M",
        },
      ],
      secrets: [
        { ...newSecret(), user: "pelanggan01", password: "GantiPassword01", profile: "paket-10mbps" },
        { ...newSecret(), user: "pelanggan02", password: "GantiPassword02", profile: "paket-20mbps" },
      ],
    },
    firewall: { ...config.firewall, mgmtSubnet: "10.0.0.0/24" },
  };
}

/* ------------------------------------------- 4. hotspot + PPPoE sekaligus */

function hotspotDanPppoe(): SetupConfig {
  const config = base();
  return {
    ...config,
    system: { ...config.system, identity: "Router-ISP" },
    bridges: [
      { ...newBridge("bridge-hotspot"), ports: ["ether2", "ether3"] },
      { ...newBridge("bridge-pppoe"), ports: ["ether4", "ether5"] },
    ],
    addresses: [
      { ...newAddress("bridge-hotspot"), address: "10.10.0.1/24", comment: "segmen hotspot" },
      { ...newAddress("bridge-pppoe"), address: "10.0.0.1/24", comment: "distribusi PPPoE" },
    ],
    pools: [
      { ...newPool(), name: "pool-hotspot", rangeStart: "10.10.0.10", rangeEnd: "10.10.0.254" },
      { ...newPool(), name: "pool-pppoe", rangeStart: "10.20.0.2", rangeEnd: "10.20.0.254" },
    ],
    dhcpServers: [
      {
        ...newDhcpServer(),
        name: "dhcp-hotspot",
        iface: "bridge-hotspot",
        pool: "pool-hotspot",
        leaseTime: "1h",
      },
    ],
    hotspots: [
      {
        ...newHotspot(),
        name: "hotspot1",
        iface: "bridge-hotspot",
        pool: "pool-hotspot",
        dnsName: "wifi.lokal",
        auth: ["http-chap", "http-pap"],
      },
    ],
    hotspotPage: {
      ...config.hotspotPage,
      template: "minimal",
      title: "Hotspot",
      loginMode: "voucher",
      marquee: "Masukkan kode voucher untuk terhubung",
    },
    pppoe: {
      ...config.pppoe,
      enabled: true,
      iface: "bridge-pppoe",
      serviceName: "layanan-pppoe",
      defaultProfile: "paket-standar",
      profiles: [
        {
          ...newPppoeProfile(),
          name: "paket-standar",
          localAddress: "10.20.0.1",
          pool: "pool-pppoe",
          rateLimit: "10M/10M",
        },
      ],
      secrets: [
        { ...newSecret(), user: "pelanggan01", password: "GantiPassword01", profile: "paket-standar" },
      ],
    },
    firewall: { ...config.firewall, mgmtSubnet: "10.0.0.0/24", fasttrack: false },
  };
}

/* ------------------------------------------------------ 5. kantor + VLAN */

function kantorVlan(): SetupConfig {
  const config = base();
  return {
    ...config,
    system: { ...config.system, identity: "Router-Kantor-VLAN" },
    bridges: [{ ...newBridge("bridge-utama"), ports: ["ether2", "ether3", "ether4", "ether5"] }],
    vlans: [
      { id: "v-staff", name: "vlan-staff", vlanId: "10", parent: "bridge-utama" },
      { id: "v-tamu", name: "vlan-tamu", vlanId: "20", parent: "bridge-utama" },
    ],
    addresses: [
      { ...newAddress("vlan-staff"), address: "192.168.10.1/24", comment: "jaringan staff" },
      { ...newAddress("vlan-tamu"), address: "192.168.20.1/24", comment: "jaringan tamu" },
    ],
    pools: [
      { ...newPool(), name: "pool-staff", rangeStart: "192.168.10.10", rangeEnd: "192.168.10.254" },
      { ...newPool(), name: "pool-tamu", rangeStart: "192.168.20.10", rangeEnd: "192.168.20.254" },
    ],
    dhcpServers: [
      { ...newDhcpServer(), name: "dhcp-staff", iface: "vlan-staff", pool: "pool-staff" },
      {
        ...newDhcpServer(),
        name: "dhcp-tamu",
        iface: "vlan-tamu",
        pool: "pool-tamu",
        leaseTime: "2h",
      },
    ],
    firewall: { ...config.firewall, mgmtSubnet: "192.168.10.0/24" },
  };
}

export const PRESETS: Preset[] = [
  {
    id: "router-dasar",
    name: "Router dasar",
    description: "Satu WAN dan satu jaringan LAN. Titik awal paling umum untuk router baru.",
    points: ["WAN ether1 DHCP", "bridge-lan ether2–5 · 192.168.10.0/24", "DHCP server + NAT + firewall"],
    build: routerDasar,
  },
  {
    id: "warnet-hotspot",
    name: "Warnet + Hotspot voucher",
    description:
      "LAN terpisah untuk kasir, segmen hotspot sendiri, lengkap dengan halaman login bergaya voucher dan tabel harga.",
    points: [
      "LAN kasir ether2 · hotspot ether3–5",
      "Hotspot 10.10.0.0/24 + DHCP sepool",
      "Halaman login Voucher, mode kode voucher, 3 paket harga",
    ],
    build: warnetHotspot,
  },
  {
    id: "rtrw-pppoe",
    name: "RT/RW Net PPPoE",
    description:
      "Layanan PPPoE dengan dua paket kecepatan, masing-masing punya pool sendiri, plus contoh akun pelanggan.",
    points: [
      "PPPoE di bridge-lan ether2–5",
      "Paket 10 Mbps & 20 Mbps, pool terpisah",
      "2 contoh akun pelanggan",
    ],
    build: rtRwPppoe,
  },
  {
    id: "hotspot-pppoe",
    name: "Hotspot + PPPoE sekaligus",
    description:
      "Dua layanan di satu router: hotspot voucher di dua port, PPPoE pelanggan di dua port lainnya.",
    points: [
      "Hotspot ether2–3 · PPPoE ether4–5",
      "Halaman login Minimal, mode voucher",
      "Paket PPPoE standar 10 Mbps",
    ],
    build: hotspotDanPppoe,
  },
  {
    id: "kantor-vlan",
    name: "Kantor dengan VLAN",
    description:
      "Jaringan staff dan tamu dipisah lewat VLAN di atas satu bridge, masing-masing dengan DHCP sendiri.",
    points: [
      "VLAN 10 staff · VLAN 20 tamu",
      "Dua subnet & dua DHCP server",
      "Akses Winbox dibatasi ke subnet staff",
    ],
    build: kantorVlan,
  },
];
