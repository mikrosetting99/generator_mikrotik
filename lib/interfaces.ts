import { getModel } from "./models";
import type { SetupConfig } from "./types";

export interface IfaceOption {
  name: string;
  kind: "physical" | "bridge" | "vlan";
  /** Sudah menjadi member sebuah bridge — tidak boleh diberi IP langsung. */
  enslavedTo?: string;
}

function parseCustom(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Interface fisik bawaan perangkat (atau isian manual untuk model custom). */
export function physicalInterfaces(config: SetupConfig): string[] {
  if (config.modelId === "custom") return parseCustom(config.customInterfaces);
  return getModel(config.modelId)?.interfaces ?? [];
}

/** Semua interface yang bisa dipilih di dropdown, lengkap dengan asal-usulnya. */
export function allInterfaces(config: SetupConfig): IfaceOption[] {
  const enslaved = new Map<string, string>();
  for (const bridge of config.bridges) {
    for (const port of bridge.ports) {
      if (port) enslaved.set(port, bridge.name);
    }
  }

  const physical: IfaceOption[] = physicalInterfaces(config).map((name) => ({
    name,
    kind: "physical",
    enslavedTo: enslaved.get(name),
  }));

  const bridges: IfaceOption[] = config.bridges
    .filter((b) => b.name.trim())
    .map((b) => ({ name: b.name.trim(), kind: "bridge" as const }));

  const vlans: IfaceOption[] = config.vlans
    .filter((v) => v.name.trim())
    .map((v) => ({ name: v.name.trim(), kind: "vlan" as const }));

  return [...physical, ...bridges, ...vlans];
}

export function interfaceNames(config: SetupConfig): string[] {
  return allInterfaces(config).map((i) => i.name);
}

/** Interface yang layak dipakai sebagai sisi LAN (punya IP & bukan WAN). */
export function lanInterfaces(config: SetupConfig): string[] {
  const wan = new Set(config.wans.map((w) => w.iface).filter(Boolean));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const addr of config.addresses) {
    const name = addr.iface.trim();
    if (!name || wan.has(name) || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}

/** IP address (CIDR) pertama yang terpasang di sebuah interface. */
export function addressOfInterface(config: SetupConfig, iface: string): string {
  return config.addresses.find((a) => a.iface === iface && a.address.trim())?.address.trim() ?? "";
}
