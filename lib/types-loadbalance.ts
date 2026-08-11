import type { RosVersion } from "./models";

export type { RosVersion };

/** Satu jalur ISP: interface, gateway asli, dan target penguji recursive gateway. */
export interface IspEntry {
  id: string;
  name: string;
  iface: string;
  gateway: string;
  /** Bobot distribusi PCC — makin besar, makin banyak koneksi diarahkan ke ISP ini. */
  weight: string;
  /** IP publik yang dicek hidup/matinya lewat ISP ini (host route /32, check-gateway=ping). */
  recursiveTarget: string;
  /** Prioritas sebagai jalur cadangan bagi ISP lain — angka kecil = diutamakan. */
  distance: string;
}

export type PccClassifier = "src-address" | "both-addresses" | "both-addresses-and-ports";

export type LbSectionId = "ros" | "lan" | "isp" | "options";

export interface LbIssue {
  section: LbSectionId;
  level: "error" | "warn";
  message: string;
}

export interface LoadBalanceConfig {
  ros: RosVersion | "";
  /** Interface/bridge sisi LAN yang trafiknya dibagi lewat PCC. */
  lanIface: string;
  isps: IspEntry[];
  classifier: PccClassifier;
  natEnabled: boolean;
}
