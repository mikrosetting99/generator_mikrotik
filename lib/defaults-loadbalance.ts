import { uid } from "./defaults";
import type { IspEntry, LoadBalanceConfig } from "./types-loadbalance";

/** Resolver publik terkenal, dipakai bergilir sebagai target penguji jalur. */
const TARGET_POOL = ["8.8.8.8", "1.1.1.1", "9.9.9.9", "208.67.222.222", "149.112.112.112"];

export function newIsp(index: number): IspEntry {
  return {
    id: uid("isp"),
    name: `ISP ${index + 1}`,
    iface: "",
    gateway: "",
    weight: "1",
    checkTarget: TARGET_POOL[index % TARGET_POOL.length],
    distance: String(index + 1),
  };
}

export function createDefaultLoadBalanceConfig(): LoadBalanceConfig {
  return {
    ros: "",
    lanIface: "bridge-lan",
    isps: [newIsp(0), newIsp(1)],
    pccEnabled: true,
    classifier: "both-addresses-and-ports",
    failoverEnabled: true,
    failoverMethod: "recursive",
    checkInterval: "10s",
    natEnabled: true,
  };
}
