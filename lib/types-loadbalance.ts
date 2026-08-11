import type { RosVersion } from "./models";

export type { RosVersion };

/** Satu jalur ISP: interface, gateway asli, dan target penguji jalur. */
export interface IspEntry {
  id: string;
  name: string;
  iface: string;
  gateway: string;
  /** Bobot distribusi PCC — makin besar, makin banyak koneksi diarahkan ke ISP ini. */
  weight: string;
  /** IP publik yang dicek jalurnya — dipakai oleh metode failover manapun yang aktif. */
  checkTarget: string;
  /** Prioritas sebagai jalur cadangan bagi ISP lain — angka kecil = diutamakan. */
  distance: string;
}

export type PccClassifier = "src-address" | "both-addresses" | "both-addresses-and-ports";

export type FailoverMethod = "recursive" | "netwatch" | "schedule";

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
  /** Pembagian beban lewat Per Connection Classifier — independen dari failover. */
  pccEnabled: boolean;
  classifier: PccClassifier;
  /** Pindah otomatis ke ISP lain saat satu ISP putus — independen dari PCC. */
  failoverEnabled: boolean;
  failoverMethod: FailoverMethod;
  /** Interval cek jalur, format durasi RouterOS. Dipakai Netwatch & Scheduler. */
  checkInterval: string;
  natEnabled: boolean;
}
