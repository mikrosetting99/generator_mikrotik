import { isIpv4 } from "./net";
import type { LbIssue, LoadBalanceConfig } from "./types-loadbalance";

/** Nama objek RouterOS: hindari spasi & karakter yang butuh escaping. */
const NAME_OK = /^[A-Za-z0-9_.-]+$/;

export function validateLoadBalanceConfig(config: LoadBalanceConfig): LbIssue[] {
  const issues: LbIssue[] = [];
  const err = (section: LbIssue["section"], message: string) =>
    issues.push({ section, level: "error", message });
  const warn = (section: LbIssue["section"], message: string) =>
    issues.push({ section, level: "warn", message });

  // --- RouterOS -----------------------------------------------------------
  if (!config.ros) {
    err("ros", "Versi RouterOS wajib dipilih sebelum mengisi section lain.");
  }

  // --- LAN ------------------------------------------------------------------
  if (!config.lanIface.trim()) {
    err("lan", "Interface/bridge sisi LAN wajib diisi — ini sumber trafik yang dibagi PCC.");
  } else if (!NAME_OK.test(config.lanIface.trim())) {
    err("lan", "Nama interface LAN hanya boleh huruf, angka, titik, strip, dan underscore.");
  }

  // --- ISP --------------------------------------------------------------
  const filled = config.isps.filter((i) => i.iface.trim());
  if (config.isps.length < 2 || filled.length < 2) {
    err("isp", "Minimal 2 ISP wajib diisi — load balance & failover butuh lebih dari satu jalur.");
  }

  const ifaces = filled.map((i) => i.iface.trim());
  if (new Set(ifaces).size !== ifaces.length) {
    err("isp", "Satu interface tidak boleh dipakai oleh dua ISP sekaligus.");
  }
  if (config.lanIface.trim() && ifaces.includes(config.lanIface.trim())) {
    err("isp", "Interface ISP tidak boleh sama dengan interface LAN.");
  }

  const targets = filled.map((i) => i.recursiveTarget.trim()).filter(Boolean);
  if (new Set(targets).size !== targets.length) {
    err("isp", "Target recursive gateway tidak boleh sama antar-ISP — masing-masing butuh host route sendiri.");
  }

  const distances = filled.map((i) => i.distance);
  if (distances.length > 1 && new Set(distances).size !== distances.length) {
    warn("isp", "Beberapa ISP memakai distance yang sama — urutan cadangan jadi tidak pasti, sebaiknya dibedakan.");
  }

  config.isps.forEach((isp, i) => {
    const tag = isp.name.trim() || `ISP ${i + 1}`;
    if (!isp.iface.trim()) {
      err("isp", `${tag}: interface belum diisi.`);
      return;
    }
    if (!isIpv4(isp.gateway)) {
      err("isp", `${tag}: gateway bukan alamat IPv4 yang valid.`);
    }
    if (!isIpv4(isp.recursiveTarget)) {
      err("isp", `${tag}: target recursive gateway bukan alamat IPv4 yang valid.`);
    }
    if (!/^\d+$/.test(isp.weight) || Number(isp.weight) < 1) {
      err("isp", `${tag}: bobot PCC harus bilangan bulat 1 atau lebih.`);
    }
    if (!/^\d+$/.test(isp.distance) || Number(isp.distance) < 1 || Number(isp.distance) > 255) {
      err("isp", `${tag}: distance harus angka 1–255.`);
    }
  });

  const totalWeight = filled.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
  if (totalWeight > 20) {
    warn("isp", "Total bobot PCC cukup besar — makin banyak rule mangle yang dibuat (satu rule per satuan bobot).");
  }

  return issues;
}
