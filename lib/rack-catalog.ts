/**
 * Katalog perangkat untuk simulasi rack: perangkat generik dan model asli multi-brand beserta
 * port dan penamaannya. Angka daya (pemakaian umum, bukan kapasitas PSU), berat, dan kedalaman
 * adalah perkiraan dari datasheet; selalu cek datasheet model yang dibeli.
 */
import type { DeviceKind } from "./rack";
import type { PortGroup, PortType } from "./rack-ports";

export interface DeviceTemplate {
  id: string;
  name: string;
  brand: string;
  kind: DeviceKind;
  u: number;
  watts: number;
  kg: number;
  depthMm: number;
  upsWatts?: number;
  ports: PortGroup[];
  /** Letak port jaringan: depan (switch/router) atau belakang (server, NAS). */
  portSide?: "front" | "rear";
}

const grp = (type: PortType, count: number, prefix: string, start = 1): PortGroup => ({ type, count, prefix, start });
const rj = (count: number, prefix: string, start = 1) => grp("rj45", count, prefix, start);
const one = (type: PortType, name: string): PortGroup => ({ type, count: 1, prefix: name, start: 0, bare: true });

export const GENERIC_BRAND = "Generik";

export const DEVICE_LIBRARY: DeviceTemplate[] = [
  /* --------------------------------------------------------------- generik */
  { id: "router-1u", name: "Router 1U", brand: GENERIC_BRAND, kind: "router", u: 1, watts: 60, kg: 4, depthMm: 250, ports: [rj(8, "ether"), grp("sfp+", 2, "sfp")] },
  { id: "switch-24", name: "Switch 24 port", brand: GENERIC_BRAND, kind: "switch", u: 1, watts: 30, kg: 3, depthMm: 250, ports: [rj(24, "Port "), grp("sfp", 4, "SFP")] },
  { id: "switch-48", name: "Switch 48 port", brand: GENERIC_BRAND, kind: "switch", u: 1, watts: 60, kg: 4.5, depthMm: 300, ports: [rj(48, "Port "), grp("sfp+", 4, "SFP+")] },
  { id: "switch-48-poe", name: "Switch 48 port PoE", brand: GENERIC_BRAND, kind: "switch", u: 1, watts: 450, kg: 6, depthMm: 400, ports: [rj(48, "Port "), grp("sfp+", 4, "SFP+")] },
  {
    id: "olt-1u",
    name: "OLT GPON 8 PON",
    brand: GENERIC_BRAND,
    kind: "olt",
    u: 1,
    watts: 90,
    kg: 5,
    depthMm: 300,
    ports: [grp("pon", 8, "PON"), rj(4, "GE"), grp("sfp+", 2, "XGE")],
  },
  { id: "server-1u", name: "Server 1U", brand: GENERIC_BRAND, kind: "server", u: 1, watts: 350, kg: 15, depthMm: 700, ports: [rj(2, "NIC"), one("rj45", "IPMI")], portSide: "rear" },
  { id: "server-2u", name: "Server 2U", brand: GENERIC_BRAND, kind: "server", u: 2, watts: 550, kg: 25, depthMm: 750, ports: [rj(4, "NIC"), one("rj45", "IPMI")], portSide: "rear" },
  { id: "server-4u", name: "Server 4U", brand: GENERIC_BRAND, kind: "server", u: 4, watts: 900, kg: 40, depthMm: 800, ports: [rj(4, "NIC"), one("rj45", "IPMI")], portSide: "rear" },
  { id: "storage-2u", name: "Storage / NAS 2U", brand: GENERIC_BRAND, kind: "storage", u: 2, watts: 250, kg: 20, depthMm: 600, ports: [rj(4, "LAN")], portSide: "rear" },
  { id: "ups-2u", name: "UPS 2U 1500VA", brand: GENERIC_BRAND, kind: "ups", u: 2, watts: 0, kg: 25, depthMm: 500, upsWatts: 1000, ports: [] },
  { id: "ups-3u", name: "UPS 3U 3000VA", brand: GENERIC_BRAND, kind: "ups", u: 3, watts: 0, kg: 40, depthMm: 600, upsWatts: 2700, ports: [] },
  { id: "pdu-1u", name: "PDU 1U", brand: GENERIC_BRAND, kind: "pdu", u: 1, watts: 0, kg: 2, depthMm: 150, ports: [] },
  { id: "cable-1u", name: "Cable manager 1U", brand: GENERIC_BRAND, kind: "cable", u: 1, watts: 0, kg: 1, depthMm: 100, ports: [] },
  { id: "shelf-1u", name: "Shelf 1U", brand: GENERIC_BRAND, kind: "shelf", u: 1, watts: 0, kg: 3, depthMm: 450, ports: [] },
  { id: "shelf-2u", name: "Shelf 2U", brand: GENERIC_BRAND, kind: "shelf", u: 2, watts: 0, kg: 5, depthMm: 550, ports: [] },
  { id: "kvm-1u", name: "KVM console 1U", brand: GENERIC_BRAND, kind: "kvm", u: 1, watts: 25, kg: 10, depthMm: 650, ports: [] },
  { id: "blank-1u", name: "Blank panel 1U", brand: GENERIC_BRAND, kind: "blank", u: 1, watts: 0, kg: 0.3, depthMm: 20, ports: [] },

  /* ------------------------------------------------------ patch panel & ODF */
  { id: "patch-24", name: "Patch panel Cat6 24 port", brand: "Patch panel", kind: "patch", u: 1, watts: 0, kg: 1.5, depthMm: 100, ports: [rj(24, "")] },
  { id: "patch-48", name: "Patch panel Cat6 48 port", brand: "Patch panel", kind: "patch", u: 2, watts: 0, kg: 2.5, depthMm: 100, ports: [rj(48, "")] },
  { id: "patch-48hd", name: "Patch panel Cat6 48 port HD 1U", brand: "Patch panel", kind: "patch", u: 1, watts: 0, kg: 2, depthMm: 120, ports: [rj(48, "")] },
  { id: "odf-12", name: "ODF fiber 12 core (6 LC duplex)", brand: "Patch panel", kind: "patch", u: 1, watts: 0, kg: 2, depthMm: 250, ports: [grp("lc", 6, "")] },
  { id: "odf-24", name: "ODF fiber 24 core (12 LC duplex)", brand: "Patch panel", kind: "patch", u: 1, watts: 0, kg: 2.5, depthMm: 250, ports: [grp("lc", 12, "")] },
  { id: "odf-48", name: "ODF fiber 48 core (24 LC duplex)", brand: "Patch panel", kind: "patch", u: 1, watts: 0, kg: 3, depthMm: 300, ports: [grp("lc", 24, "")] },
  { id: "odf-96", name: "ODF fiber 96 core (48 LC duplex)", brand: "Patch panel", kind: "patch", u: 2, watts: 0, kg: 5, depthMm: 300, ports: [grp("lc", 48, "")] },

  /* -------------------------------------------------------------- MikroTik */
  { id: "mt-ccr2004-1g-12s-2xs", name: "CCR2004-1G-12S+2XS", brand: "MikroTik", kind: "router", u: 1, watts: 20, kg: 2.6, depthMm: 230, ports: [rj(1, "ether"), grp("sfp+", 12, "sfp-sfpplus"), grp("sfp28", 2, "sfp28-")] },
  { id: "mt-ccr2004-16g-2s", name: "CCR2004-16G-2S+", brand: "MikroTik", kind: "router", u: 1, watts: 25, kg: 2.4, depthMm: 230, ports: [rj(16, "ether"), grp("sfp+", 2, "sfp-sfpplus")] },
  { id: "mt-ccr2116-12g-4s", name: "CCR2116-12G-4S+", brand: "MikroTik", kind: "router", u: 1, watts: 60, kg: 3.5, depthMm: 300, ports: [rj(13, "ether"), grp("sfp+", 4, "sfp-sfpplus")] },
  { id: "mt-ccr2216-1g-12xs-2xq", name: "CCR2216-1G-12XS-2XQ", brand: "MikroTik", kind: "router", u: 1, watts: 90, kg: 6, depthMm: 400, ports: [rj(1, "ether"), grp("sfp28", 12, "sfp28-"), grp("qsfp28", 2, "qsfp28-")] },
  { id: "mt-ccr1036-8g-2s", name: "CCR1036-8G-2S+", brand: "MikroTik", kind: "router", u: 1, watts: 75, kg: 3.5, depthMm: 270, ports: [rj(8, "ether"), grp("sfp+", 2, "sfp-sfpplus")] },
  { id: "mt-rb1100ahx4", name: "RB1100AHx4", brand: "MikroTik", kind: "router", u: 1, watts: 20, kg: 2, depthMm: 250, ports: [rj(13, "ether")] },
  { id: "mt-rb4011igs-rm", name: "RB4011iGS+RM", brand: "MikroTik", kind: "router", u: 1, watts: 18, kg: 1.5, depthMm: 160, ports: [rj(10, "ether"), grp("sfp+", 1, "sfp-sfpplus")] },
  { id: "mt-crs326-24g-2s", name: "CRS326-24G-2S+RM", brand: "MikroTik", kind: "switch", u: 1, watts: 19, kg: 1.9, depthMm: 220, ports: [rj(24, "ether"), grp("sfp+", 2, "sfp-sfpplus")] },
  { id: "mt-crs354-48g-4s-2q", name: "CRS354-48G-4S+2Q+RM", brand: "MikroTik", kind: "switch", u: 1, watts: 64, kg: 3.5, depthMm: 260, ports: [rj(48, "ether"), grp("sfp+", 4, "sfp-sfpplus"), grp("qsfp+", 2, "qsfpplus")] },
  { id: "mt-crs317-1g-16s", name: "CRS317-1G-16S+RM", brand: "MikroTik", kind: "switch", u: 1, watts: 40, kg: 3.3, depthMm: 280, ports: [rj(1, "ether"), grp("sfp+", 16, "sfp-sfpplus")] },
  { id: "mt-crs518-16xs-2xq", name: "CRS518-16XS-2XQ-RM", brand: "MikroTik", kind: "switch", u: 1, watts: 90, kg: 6, depthMm: 400, ports: [rj(1, "ether"), grp("sfp28", 16, "sfp28-"), grp("qsfp28", 2, "qsfp28-")] },

  /* ----------------------------------------------------------------- Cisco */
  { id: "cs-c2960x-24ts", name: "Catalyst 2960X-24TS-L", brand: "Cisco", kind: "switch", u: 1, watts: 30, kg: 4, depthMm: 280, ports: [rj(24, "Gi1/0/"), grp("sfp", 4, "Gi1/0/", 25), one("console", "Console")] },
  { id: "cs-c9200l-48p-4g", name: "Catalyst 9200L-48P-4G", brand: "Cisco", kind: "switch", u: 1, watts: 150, kg: 5, depthMm: 290, ports: [rj(48, "Gi1/0/"), grp("sfp", 4, "Gi1/1/"), one("console", "Console")] },
  { id: "cs-c9300-48p", name: "Catalyst 9300-48P", brand: "Cisco", kind: "switch", u: 1, watts: 200, kg: 7.5, depthMm: 445, ports: [rj(48, "Gi1/0/"), grp("sfp+", 4, "Te1/1/"), one("console", "Console")] },

  /* --------------------------------------------------------------- Juniper */
  { id: "jn-ex2300-24t", name: "EX2300-24T", brand: "Juniper", kind: "switch", u: 1, watts: 40, kg: 3.3, depthMm: 255, ports: [rj(24, "ge-0/0/", 0), grp("sfp+", 4, "xe-0/1/", 0), one("console", "Console")] },
  { id: "jn-mx204", name: "MX204", brand: "Juniper", kind: "router", u: 1, watts: 350, kg: 9, depthMm: 475, ports: [grp("qsfp28", 4, "et-0/0/", 0), grp("sfp+", 8, "xe-0/1/", 0), one("console", "Console")] },

  /* ---------------------------------------------------------------- Huawei */
  { id: "hw-s5735-l24t4x", name: "S5735-L24T4X-A1", brand: "Huawei", kind: "switch", u: 1, watts: 30, kg: 2.5, depthMm: 220, ports: [rj(24, "GE0/0/"), grp("sfp+", 4, "XGE0/0/"), one("console", "Console")] },
  { id: "hw-s5735-l48t4x", name: "S5735-L48T4X-A1", brand: "Huawei", kind: "switch", u: 1, watts: 45, kg: 3.5, depthMm: 220, ports: [rj(48, "GE0/0/"), grp("sfp+", 4, "XGE0/0/"), one("console", "Console")] },

  /* ------------------------------------------------------------- Ubiquiti */
  { id: "ui-udm-pro", name: "UniFi Dream Machine Pro", brand: "Ubiquiti", kind: "router", u: 1, watts: 33, kg: 3.9, depthMm: 285, ports: [rj(9, "Port "), grp("sfp+", 2, "Port ", 10)] },
  { id: "ui-usw-pro-24", name: "UniFi Switch Pro 24", brand: "Ubiquiti", kind: "switch", u: 1, watts: 25, kg: 3.6, depthMm: 285, ports: [rj(24, "Port "), grp("sfp+", 2, "Port ", 25)] },
  { id: "ui-usw-pro-48-poe", name: "UniFi Switch Pro 48 PoE", brand: "Ubiquiti", kind: "switch", u: 1, watts: 200, kg: 6, depthMm: 400, ports: [rj(48, "Port "), grp("sfp+", 4, "Port ", 49)] },

  /* --------------------------------------------------------------- TP-Link */
  { id: "tp-sg3428", name: "Omada TL-SG3428", brand: "TP-Link", kind: "switch", u: 1, watts: 20, kg: 2.5, depthMm: 180, ports: [rj(24, "1/0/"), grp("sfp", 4, "1/0/", 25), one("console", "Console")] },
  { id: "tp-sg3452p", name: "Omada TL-SG3452P", brand: "TP-Link", kind: "switch", u: 1, watts: 120, kg: 5, depthMm: 330, ports: [rj(48, "1/0/"), grp("sfp", 4, "1/0/", 49), one("console", "Console")] },

  /* ------------------------------------------------------------ server */
  { id: "dl-r650", name: "Dell PowerEdge R650", brand: "Dell", kind: "server", u: 1, watts: 450, kg: 20, depthMm: 772, ports: [rj(2, "NIC"), one("rj45", "iDRAC")], portSide: "rear" },
  { id: "dl-r750", name: "Dell PowerEdge R750", brand: "Dell", kind: "server", u: 2, watts: 650, kg: 28, depthMm: 772, ports: [rj(2, "NIC"), one("rj45", "iDRAC")], portSide: "rear" },
  { id: "hp-dl360-g10", name: "HPE ProLiant DL360 Gen10", brand: "HPE", kind: "server", u: 1, watts: 400, kg: 16, depthMm: 750, ports: [rj(4, "NIC"), one("rj45", "iLO")], portSide: "rear" },
  { id: "hp-dl380-g10", name: "HPE ProLiant DL380 Gen10", brand: "HPE", kind: "server", u: 2, watts: 500, kg: 25, depthMm: 730, ports: [rj(4, "NIC"), one("rj45", "iLO")], portSide: "rear" },

  /* --------------------------------------------------------------- storage */
  { id: "sy-rs822p", name: "Synology RS822+", brand: "Synology", kind: "storage", u: 1, watts: 45, kg: 6, depthMm: 470, ports: [rj(4, "LAN")], portSide: "rear" },
  { id: "sy-rs1221p", name: "Synology RS1221+", brand: "Synology", kind: "storage", u: 2, watts: 70, kg: 9.5, depthMm: 485, ports: [rj(4, "LAN")], portSide: "rear" },

  /* ------------------------------------------------------------------- UPS */
  { id: "apc-smt1500rmi2u", name: "APC Smart-UPS SMT1500RMI2U", brand: "APC", kind: "ups", u: 2, watts: 0, kg: 28, depthMm: 457, upsWatts: 1000, ports: [] },
  { id: "apc-smt3000rmi2u", name: "APC Smart-UPS SMT3000RMI2U", brand: "APC", kind: "ups", u: 2, watts: 0, kg: 38, depthMm: 660, upsWatts: 2700, ports: [] },
];

/** Urutan merek di daftar perangkat. */
export const BRANDS = [GENERIC_BRAND, "Patch panel", "MikroTik", "Cisco", "Juniper", "Huawei", "Ubiquiti", "TP-Link", "Dell", "HPE", "Synology", "APC"];
