/**
 * Database model Mikrotik + metadata kompatibilitas RouterOS.
 *
 * `supports` menentukan opsi RouterOS yang boleh dipilih pengguna:
 * perangkat ARM64 keluaran baru hanya punya build RouterOS v7.
 *
 * `interfaces` memakai penamaan bawaan pabrik. Untuk perangkat wireless
 * generasi ac ke bawah dipakai wlan1/wlan2 (paket wireless), sedangkan
 * perangkat ax memakai wifi1/wifi2 (paket wifi/wifiwave2 di RouterOS v7).
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

function seq(count: number, prefix = "ether", start = 1): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + start}`);
}

const BOTH: RosVersion[] = ["v6", "v7"];
const V7: RosVersion[] = ["v7"];
const V7_ONLY = "Hanya RouterOS v7 (perangkat ARM64).";

export const MIKROTIK_MODELS: MikrotikModel[] = [
  /* ------------------------------------------------- hEX / PowerBox (SOHO) */
  {
    id: "rb750r2",
    name: "hEX lite (RB750r2)",
    series: "hEX & PowerBox",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: seq(5),
    wireless: "none",
  },
  {
    id: "rb750upr2",
    name: "hEX PoE lite (RB750UPr2)",
    series: "hEX & PowerBox",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: seq(5),
    wireless: "none",
  },
  {
    id: "rb750gr3",
    name: "hEX (RB750Gr3)",
    series: "hEX & PowerBox",
    arch: "mmips",
    supports: BOTH,
    interfaces: seq(5),
    wireless: "none",
  },
  {
    id: "rb760igs",
    name: "hEX S (RB760iGS)",
    series: "hEX & PowerBox",
    arch: "mmips",
    supports: BOTH,
    interfaces: [...seq(5), "sfp1"],
    wireless: "none",
  },
  {
    id: "rb960pgs",
    name: "hEX PoE (RB960PGS)",
    series: "hEX & PowerBox",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: [...seq(5), "sfp1"],
    wireless: "none",
  },
  {
    id: "rb750p-pbr2",
    name: "PowerBox (RB750P-PBr2)",
    series: "hEX & PowerBox",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: seq(5),
    wireless: "none",
  },

  /* ------------------------------------------------------------ hAP (indoor) */
  {
    id: "rb931-2nd",
    name: "hAP mini (RB931-2nD)",
    series: "hAP",
    arch: "smips",
    supports: BOTH,
    interfaces: [...seq(3), "wlan1"],
    wireless: "legacy",
    note: "RAM 32 MB — hindari hotspot besar, queue banyak, atau logging berat.",
  },
  {
    id: "rb941-2nd",
    name: "hAP lite (RB941-2nD)",
    series: "hAP",
    arch: "smips",
    supports: BOTH,
    interfaces: [...seq(4), "wlan1"],
    wireless: "legacy",
    note: "RAM 32 MB — hindari hotspot besar, queue banyak, atau logging berat.",
  },
  {
    id: "rb951ui-2nd",
    name: "hAP (RB951Ui-2nD)",
    series: "hAP",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: [...seq(5), "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rb951ui-2hnd",
    name: "RB951Ui-2HnD",
    series: "hAP",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: [...seq(5), "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rb962-hap-ac",
    name: "hAP ac (RB962UiGS-5HacT2HnT)",
    series: "hAP",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: [...seq(5), "sfp1", "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rbd52g-hap-ac2",
    name: "hAP ac² (RBD52G-5HacD2HnD)",
    series: "hAP",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(5), "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rbd53ig-hap-ac3",
    name: "hAP ac³ (RBD53iG-5HacD2HnD)",
    series: "hAP",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(5), "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rbd25g-audience",
    name: "Audience (RBD25G-5HPacQD2HPnD)",
    series: "hAP",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(3), "wlan1", "wlan2", "wlan3"],
    wireless: "legacy",
    note: "Tiga radio: 2.4 GHz, 5 GHz klien, dan 5 GHz untuk mesh antar unit.",
  },
  {
    id: "l41g-hap-ax-lite",
    name: "hAP ax lite (L41G-2axD)",
    series: "hAP ax",
    arch: "arm64",
    supports: V7,
    interfaces: ["ether1", "wifi1"],
    wireless: "wifi",
    note: `${V7_ONLY} Hanya 1 port ethernet dan radio 2.4 GHz saja.`,
  },
  {
    id: "c52ig-hap-ax2",
    name: "hAP ax² (C52iG-5HaxD2HaxD)",
    series: "hAP ax",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(5), "wifi1", "wifi2"],
    wireless: "wifi",
    note: `${V7_ONLY} Wireless memakai paket wifi (wifiwave2).`,
  },
  {
    id: "c53uig-hap-ax3",
    name: "hAP ax³ (C53UiG+5HPaxD2HPaxD)",
    series: "hAP ax",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(5), "sfp-sfpplus1", "wifi1", "wifi2"],
    wireless: "wifi",
    note: `${V7_ONLY} Wireless memakai paket wifi (wifiwave2).`,
  },

  /* --------------------------------------------------- RB2011 s/d RB5009 */
  {
    id: "rb2011uias",
    name: "RB2011UiAS-2HnD",
    series: "RouterBOARD",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: [...seq(10), "sfp1", "wlan1"],
    wireless: "legacy",
    note: "ether1–5 Fast Ethernet, ether6–10 Gigabit — jangan tertukar saat memilih WAN.",
  },
  {
    id: "rb3011uias",
    name: "RB3011UiAS-RM",
    series: "RouterBOARD",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(10), "sfp1"],
    wireless: "none",
  },
  {
    id: "rb4011igs",
    name: "RB4011iGS+RM",
    series: "RouterBOARD",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(10), "sfp-sfpplus1"],
    wireless: "none",
  },
  {
    id: "rb4011-wifi",
    name: "RB4011iGS+5HacQ2HnD-IN",
    series: "RouterBOARD",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(10), "sfp-sfpplus1", "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rb1100ahx4",
    name: "RB1100AHx4",
    series: "RouterBOARD",
    arch: "arm",
    supports: BOTH,
    interfaces: seq(13),
    wireless: "none",
  },
  {
    id: "l009uigs",
    name: "L009UiGS-RM",
    series: "RouterBOARD",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(8), "sfp-sfpplus1"],
    wireless: "none",
    note: V7_ONLY,
  },
  {
    id: "rb5009",
    name: "RB5009UG+S+IN",
    series: "RouterBOARD",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(8), "sfp-sfpplus1"],
    wireless: "none",
    note: V7_ONLY,
  },
  {
    id: "rb5009upr",
    name: "RB5009UPr+S+IN (PoE-out)",
    series: "RouterBOARD",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(8), "sfp-sfpplus1"],
    wireless: "none",
    note: V7_ONLY,
  },

  /* --------------------------------------------------------------- CCR */
  {
    id: "ccr1009",
    name: "CCR1009-7G-1C-1S+",
    series: "Cloud Core Router",
    arch: "tile",
    supports: BOTH,
    interfaces: [...seq(7), "sfp1", "sfp-sfpplus1"],
    wireless: "none",
  },
  {
    id: "ccr1016",
    name: "CCR1016-12G",
    series: "Cloud Core Router",
    arch: "tile",
    supports: BOTH,
    interfaces: seq(12),
    wireless: "none",
  },
  {
    id: "ccr1036",
    name: "CCR1036-12G-4S",
    series: "Cloud Core Router",
    arch: "tile",
    supports: BOTH,
    interfaces: [...seq(12), ...seq(4, "sfp")],
    wireless: "none",
  },
  {
    id: "ccr1072",
    name: "CCR1072-1G-8S+",
    series: "Cloud Core Router",
    arch: "tile",
    supports: BOTH,
    interfaces: ["ether1", ...seq(8, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "ccr2004-16g",
    name: "CCR2004-16G-2S+",
    series: "Cloud Core Router",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(16), ...seq(2, "sfp-sfpplus")],
    wireless: "none",
    note: V7_ONLY,
  },
  {
    id: "ccr2004-12s",
    name: "CCR2004-1G-12S+2XS",
    series: "Cloud Core Router",
    arch: "arm64",
    supports: V7,
    interfaces: ["ether1", ...seq(12, "sfp-sfpplus")],
    wireless: "none",
    note: `${V7_ONLY} Dua port 25G (sfp28) tidak ikut didaftar — tambahkan manual bila dipakai.`,
  },
  {
    id: "ccr2116",
    name: "CCR2116-12G-4S+",
    series: "Cloud Core Router",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(12), ...seq(4, "sfp-sfpplus")],
    wireless: "none",
    note: V7_ONLY,
  },

  /* --------------------------------------------------------------- CRS */
  {
    id: "crs112-8g-4s",
    name: "CRS112-8G-4S",
    series: "Cloud Router Switch",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: [...seq(8), ...seq(4, "sfp")],
    wireless: "none",
  },
  {
    id: "crs305",
    name: "CRS305-1G-4S+",
    series: "Cloud Router Switch",
    arch: "arm",
    supports: BOTH,
    interfaces: ["ether1", ...seq(4, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "crs309",
    name: "CRS309-1G-8S+",
    series: "Cloud Router Switch",
    arch: "arm",
    supports: BOTH,
    interfaces: ["ether1", ...seq(8, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "crs317",
    name: "CRS317-1G-16S+",
    series: "Cloud Router Switch",
    arch: "arm",
    supports: BOTH,
    interfaces: ["ether1", ...seq(16, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "crs326-24g",
    name: "CRS326-24G-2S+",
    series: "Cloud Router Switch",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(24), ...seq(2, "sfp-sfpplus")],
    wireless: "none",
  },
  {
    id: "crs328-24p",
    name: "CRS328-24P-4S+ (PoE-out)",
    series: "Cloud Router Switch",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(24), ...seq(4, "sfp-sfpplus")],
    wireless: "none",
  },

  /* ------------------------------------------ Wireless outdoor / CPE / AP */
  {
    id: "rbgroove52",
    name: "Groove 52 (RBGroove52HPn)",
    series: "Wireless outdoor",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: ["ether1", "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rbsxtsq5nd",
    name: "SXTsq Lite5 (RBSXTsq5nD)",
    series: "Wireless outdoor",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: ["ether1", "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rblhg5nd",
    name: "LHG 5 (RBLHG-5nD)",
    series: "Wireless outdoor",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: ["ether1", "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rblhgg5acd",
    name: "LHG 5 ac (RBLHGG-5acD)",
    series: "Wireless outdoor",
    arch: "arm",
    supports: BOTH,
    interfaces: ["ether1", "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rbdisc5nd",
    name: "DISC Lite5 (RBDisc-5nD)",
    series: "Wireless outdoor",
    arch: "mipsbe",
    supports: BOTH,
    interfaces: ["ether1", "wlan1"],
    wireless: "legacy",
  },
  {
    id: "rbwapg-5hact2hnd",
    name: "wAP ac (RBwAPG-5HacT2HnD)",
    series: "Wireless outdoor",
    arch: "arm",
    supports: BOTH,
    interfaces: ["ether1", "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "rbcapgi-5acd2nd",
    name: "cAP ac (RBcAPGi-5acD2nD)",
    series: "Access Point",
    arch: "arm",
    supports: BOTH,
    interfaces: [...seq(2), "wlan1", "wlan2"],
    wireless: "legacy",
  },
  {
    id: "capgi-ax",
    name: "cAP ax (cAPGi-5HaxD2HaxD)",
    series: "Access Point",
    arch: "arm64",
    supports: V7,
    interfaces: [...seq(2), "wifi1", "wifi2"],
    wireless: "wifi",
    note: V7_ONLY,
  },

  /* ------------------------------------------------------------- custom */
  {
    id: "custom",
    name: "Lainnya / isi manual",
    series: "Custom",
    arch: "-",
    supports: BOTH,
    interfaces: seq(5),
    wireless: "none",
    note: "Daftar interface diisi manual sesuai perangkat Anda.",
  },
];

export function getModel(id: string): MikrotikModel | undefined {
  return MIKROTIK_MODELS.find((m) => m.id === id);
}

/** Model dikelompokkan per seri, untuk dropdown bertingkat. */
export function modelsBySeries(): Array<{ series: string; models: MikrotikModel[] }> {
  const groups: Array<{ series: string; models: MikrotikModel[] }> = [];
  for (const model of MIKROTIK_MODELS) {
    const existing = groups.find((g) => g.series === model.series);
    if (existing) existing.models.push(model);
    else groups.push({ series: model.series, models: [model] });
  }
  return groups;
}

export const ROS_LABEL: Record<RosVersion, string> = {
  v6: "RouterOS v6 (6.4x)",
  v7: "RouterOS v7",
};
