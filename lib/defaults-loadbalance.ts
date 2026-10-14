import { uid } from "./defaults";
import type { IspEntry, LoadBalanceConfig } from "./types-loadbalance";

/**
 * Target penguji jalur per ISP: 1.1.1.1, 1.1.1.2, 1.1.1.3 (ketiganya menjawab ping),
 * lalu resolver publik lain untuk ISP ke-4 dan seterusnya — alamat 1.1.1.4 dst
 * tidak dijamin menjawab ping, padahal tiap target wajib berbeda dan harus hidup.
 */
const TARGET_POOL = ["1.1.1.1", "1.1.1.2", "1.1.1.3", "8.8.8.8", "9.9.9.9", "208.67.222.222", "149.112.112.112", "8.8.4.4"];

export function newIsp(index: number): IspEntry {
  return {
    id: uid("isp"),
    name: `ISP ${index + 1}`,
    // Terisi berurutan: ether1 / 192.168.1.1, ether2 / 192.168.2.1, dst.
    iface: `ether${index + 1}`,
    gateway: `192.168.${index + 1}.1`,
    weight: "1",
    speed: "",
    checkTarget: TARGET_POOL[index % TARGET_POOL.length],
    distance: String(index + 1),
  };
}

export function createDefaultLoadBalanceConfig(): LoadBalanceConfig {
  return {
    ros: "",
    localMode: "interface",
    lanIface: "bridge-lan",
    lanList: "LAN",
    ratioEnabled: false,
    isps: [newIsp(0), newIsp(1)],
    pccEnabled: true,
    classifier: "both-addresses-and-ports",
    failoverEnabled: true,
    failoverMethod: "recursive",
    checkInterval: "10s",
    natEnabled: true,
  };
}
