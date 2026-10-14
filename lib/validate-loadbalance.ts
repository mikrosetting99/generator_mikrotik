import { isIpv4 } from "./net";
import type { LbIssue, LoadBalanceConfig } from "./types-loadbalance";

/** Nama objek RouterOS: hindari spasi & karakter yang butuh escaping. */
const NAME_OK = /^[A-Za-z0-9_.-]+$/;

/** Format durasi RouterOS, mis. "10s", "500ms", "1m". */
const DURATION_OK = /^\d+(ms|s|m|h)$/;

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
  const needLan = config.localMode === "interface";
  if (config.localMode === "interfacelist") {
    if (!config.lanList.trim()) {
      err("lan", "Nama interface-list sisi LAN wajib diisi, mis. LAN.");
    } else if (!NAME_OK.test(config.lanList.trim())) {
      err("lan", "Nama interface-list hanya boleh huruf, angka, titik, strip, dan underscore.");
    }
  }
  if (needLan && !config.lanIface.trim()) {
    err("lan", "Interface/bridge sisi LAN wajib diisi — ini sumber trafik yang dibagi PCC.");
  } else if (needLan && !NAME_OK.test(config.lanIface.trim())) {
    err("lan", "Nama interface LAN hanya boleh huruf, angka, titik, strip, dan underscore.");
  }

  // --- Opsi -------------------------------------------------------------
  if (!config.pccEnabled && !config.failoverEnabled) {
    err("options", "Aktifkan minimal salah satu: Load Balance (PCC) atau Failover.");
  }
  if (config.failoverEnabled && !DURATION_OK.test(config.checkInterval.trim())) {
    err("options", "Interval cek harus format durasi RouterOS, misal 10s atau 1m.");
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
  if (needLan && config.lanIface.trim() && ifaces.includes(config.lanIface.trim())) {
    err("isp", "Interface ISP tidak boleh sama dengan interface LAN.");
  }

  if (config.failoverEnabled) {
    const targets = filled.map((i) => i.checkTarget.trim()).filter(Boolean);
    if (new Set(targets).size !== targets.length) {
      err("isp", "Target cek jalur tidak boleh sama antar-ISP — masing-masing butuh host route sendiri.");
    }
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
    if (config.failoverEnabled && !isIpv4(isp.checkTarget)) {
      err("isp", `${tag}: target cek jalur bukan alamat IPv4 yang valid.`);
    }
    if (config.pccEnabled && config.ratioEnabled && !(Number(isp.speed) > 0)) {
      err("isp", `${tag}: kecepatan (Mbps) wajib diisi angka lebih dari 0 karena rasio bandwidth aktif.`);
    }
    if (!/^\d+$/.test(isp.distance) || Number(isp.distance) < 1 || Number(isp.distance) > 255) {
      err("isp", `${tag}: distance harus angka 1–255.`);
    }
  });

  if (config.pccEnabled && config.ratioEnabled) {
    const speeds = filled.map((i) => Number(i.speed)).filter((n) => n > 0);
    if (speeds.length > 1 && Math.max(...speeds) / Math.min(...speeds) > 10) {
      warn("isp", "Selisih kecepatan lebih dari 10×: jatah ISP terlambat dibatasi 10 bagian agar rule mangle tidak membengkak.");
    }
  }

  return issues;
}
