import type { RosVersion } from "./models";

export type { RosVersion };

/** Satu jalur ISP: interface, gateway asli, dan target penguji jalur. */
export interface IspEntry {
  id: string;
  name: string;
  iface: string;
  gateway: string;
  /** Bobot distribusi PCC — makin besar, makin banyak koneksi diarahkan ke ISP ini. Dipakai sebagai cadangan; bobot sebenarnya dihitung dari `speed` bila rasio bandwidth aktif. */
  weight: string;
  /** Kecepatan jalur dalam Mbps — dasar pembagian beban bila rasio bandwidth aktif. */
  speed: string;
  /** IP publik yang dicek jalurnya — dipakai oleh metode failover manapun yang aktif. */
  checkTarget: string;
  /** Prioritas sebagai jalur cadangan bagi ISP lain — angka kecil = diutamakan. */
  distance: string;
}

/** Sumber trafik lokal yang dibagi PCC: satu interface LAN, satu interface-list, atau daftar alamat privat (RFC1918). */
export type LocalMode = "interface" | "interfacelist" | "addresslist";

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
  /** Cara menandai trafik lokal: lewat interface LAN, atau address-list RFC1918. */
  localMode: LocalMode;
  /** Interface/bridge sisi LAN yang trafiknya dibagi lewat PCC (mode interface). */
  lanIface: string;
  /** Nama interface-list sisi LAN (mode interface-list), mis. LAN. */
  lanList: string;
  /** Bagi beban sesuai kecepatan tiap ISP (Mbps) alih-alih rata. */
  ratioEnabled: boolean;
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
