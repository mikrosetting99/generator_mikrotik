import { uid } from "./defaults";
import type { IspEntry, LoadBalanceConfig } from "./types-loadbalance";

/** Target penguji jalur per ISP, berurutan: 1.1.1.1, 1.1.1.2, 1.1.1.3, dst. sampai 1.1.1.8. */
const checkTarget = (index: number) => `1.1.1.${index + 1}`;

export function newIsp(index: number): IspEntry {
  return {
    id: uid("isp"),
    name: `ISP ${index + 1}`,
    // Terisi berurutan: ether1 / 192.168.1.1, ether2 / 192.168.2.1, dst.
    iface: `ether${index + 1}`,
    gateway: `192.168.${index + 1}.1`,
    weight: "1",
    speed: "",
    checkTarget: checkTarget(index),
    distance: String(index + 1),
  };
}

export function createDefaultLoadBalanceConfig(): LoadBalanceConfig {
  return {
    ros: "",
    localMode: "addresslist",
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
