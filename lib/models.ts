/**
 * Database model Mikrotik + metadata kompatibilitas RouterOS.
 *
 * `supports` menentukan opsi RouterOS yang boleh dipilih pengguna:
 * sebagian device baru (ARM64) hanya punya build RouterOS v7.
 */

export type RosVersion = "v6" | "v7";

export type WirelessKind = "none" | "legacy" | "wifi";

export interface MikrotikModel {
  id: string;
  name: string;
  series: string;
  arch: string;
  supports: RosVersion[];
  /** Nama interface bawaan pabrik, sesuai urutan di RouterOS. */
  interfaces: string[];
  wireless: WirelessKind;
  note?: string;
}

function eth(count: number, prefix = "ether"): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

export const MIKROTIK_MODELS: MikrotikModel[] = [
  {
    id: "rb941-2nd",
    name: "hAP lite (RB941-2nD)",
    series: "hAP",
    arch: "smips",
    supports: ["v6", "v7"],
    interfaces: [...eth(4), "wlan1"],
    wireless: "legacy",
    note: "RAM 32 MB — hindari fitur berat seperti hotspot + queue besar.",
  },
  {
    id: "rb750r2",
    name: "hEX lite (RB750r2)",
    series: "hEX",
    arch: "mipsbe",
    supports: ["v6", "v7"],
    interfaces: eth(5),
    wireless: "none",
  },
  {
    id: "rb750gr3",
    name: "hEX (RB750Gr3)",
    series: "hEX",
    arch: "mmips",
    supports: ["v6", "v7"],
    interfaces: eth(5),
    wireless: "none",
  },
  {
    id: "rb760igs",
    name: "hEX S (RB760iGS)",
    series: "hEX",
    arch: "mmips",
    supports: ["v6", "v7"],
    interfaces: [...eth(5), "sfp1"],
    wireless: "none",
  },
  {
    id: "rb951ui-2hnd",
    name: "RB951Ui-2HnD",
    series: "RB900",
    arch: "mipsbe",
    supports: ["v6", "v7"],
    interfaces: [...eth(5), "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rb962-hap-ac",
    name: "hAP ac (RB962UiGS-5HacT2HnT)",
    series: "hAP",
    arch: "mipsbe",
    supports: ["v6", "v7"],
    interfaces: [...eth(5), "sfp1", "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rbd52g-hap-ac2",
    name: "hAP ac2 (RBD52G-5HacD2HnD)",
    series: "hAP",
    arch: "arm",
    supports: ["v6", "v7"],
    interfaces: [...eth(5), "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rbd53ig-hap-ac3",
    name: "hAP ac³ (RBD53iG-5HacD2HnD)",
    series: "hAP",
    arch: "arm",
    supports: ["v6", "v7"],
    interfaces: [...eth(5), "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "c52ig-hap-ax2",
    name: "hAP ax² (C52iG-5HaxD2HaxD)",
    series: "hAP ax",
    arch: "arm64",
    supports: ["v7"],
    interfaces: [...eth(5), "wifi1", "wifi2"],
    wireless: "wifi",
    note: "Hanya RouterOS v7 — wireless memakai paket wifi (wifiwave2).",
  },
  {
    id: "c53uig-hap-ax3",
    name: "hAP ax³ (C53UiG+5HPaxD2HPaxD)",
    series: "hAP ax",
    arch: "arm64",
    supports: ["v7"],
    interfaces: [...eth(5), "sfp-sfpplus1", "wifi1", "wifi2"],
    wireless: "wifi",
    note: "Hanya RouterOS v7.",
  },
  {
    id: "l009uigs",
    name: "L009UiGS-RM",
    series: "L009",
    arch: "arm64",
    supports: ["v7"],
    interfaces: [...eth(8), "sfp-sfpplus1"],
    wireless: "none",
    note: "Hanya RouterOS v7.",
  },
  {
    id: "rb2011uias",
    name: "RB2011UiAS-2HnD",
    series: "RB2011",
    arch: "mipsbe",
    supports: ["v6", "v7"],
    interfaces: [...eth(10), "sfp1", "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rb3011uias",
    name: "RB3011UiAS-RM",
    series: "RB3011",
    arch: "arm",
    supports: ["v6", "v7"],
    interfaces: [...eth(10), "sfp1"],
    wireless: "none",
  },
  {
    id: "rb4011igs",
    name: "RB4011iGS+RM",
    series: "RB4011",
    arch: "arm",
    supports: ["v6", "v7"],
    interfaces: [...eth(10), "sfp-sfpplus1"],
    wireless: "none",
  },
  {
    id: "rb5009",
    name: "RB5009UG+S+IN",
    series: "RB5009",
    arch: "arm64",
    supports: ["v7"],
    interfaces: [...eth(8), "sfp-sfpplus1"],
    wireless: "none",
    note: "Hanya RouterOS v7.",
  },
  {
    id: "ccr1009",
    name: "CCR1009-7G-1C-1S+",
    series: "CCR1000",
    arch: "tile",
    supports: ["v6", "v7"],
    interfaces: [...eth(7), "sfp1", "sfp-sfpplus1"],
    wireless: "none",
  },
  {
    id: "ccr1036",
    name: "CCR1036-12G-4S",
    series: "CCR1000",
    arch: "tile",
    supports: ["v6", "v7"],
    interfaces: [...eth(12), ...eth(4, "sfp")],
    wireless: "none",
  },
  {
    id: "ccr2004",
    name: "CCR2004-1G-12S+2XS",
    series: "CCR2000",
    arch: "arm64",
    supports: ["v7"],
    interfaces: ["ether1", ...eth(12, "sfp-sfpplus"), ...eth(2, "sfp28-")],
    wireless: "none",
    note: "Hanya RouterOS v7.",
  },
  {
    id: "crs112-8g-4s",
    name: "CRS112-8G-4S",
    series: "CRS100",
    arch: "mipsbe",
    supports: ["v6", "v7"],
    interfaces: [...eth(8), ...eth(4, "sfp")],
    wireless: "none",
  },
  {
    id: "crs309",
    name: "CRS309-1G-8S+",
    series: "CRS300",
    arch: "arm",
    supports: ["v6", "v7"],
    interfaces: ["ether1", ...eth(8, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "crs328-24p",
    name: "CRS328-24P-4S+",
    series: "CRS300",
    arch: "arm",
    supports: ["v6", "v7"],
    interfaces: [...eth(24), ...eth(4, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "custom",
    name: "Lainnya / isi manual",
    series: "Custom",
    arch: "-",
    supports: ["v6", "v7"],
    interfaces: eth(5),
    wireless: "none",
    note: "Daftar interface diisi manual sesuai perangkat Anda.",
  },
];

export function getModel(id: string): MikrotikModel | undefined {
  return MIKROTIK_MODELS.find((m) => m.id === id);
}

export const ROS_LABEL: Record<RosVersion, string> = {
  v6: "RouterOS v6 (6.4x)",
  v7: "RouterOS v7",
};
