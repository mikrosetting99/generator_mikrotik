import { createDefaultConfig, uid } from "./defaults";
import { isHexColor, TEMPLATES } from "./hotspot-page";
import { getModel } from "./models";
import type {
  AddressEntry,
  BridgeEntry,
  DhcpServerEntry,
  HotspotAuth,
  HotspotEntry,
  HotspotTemplateId,
  LoginMode,
  PoolEntry,
  PppoeSecret,
  RosVersion,
  RouterUser,
  SetupConfig,
  UserGroup,
  VlanEntry,
  VoucherPackage,
  WanEntry,
} from "./types";

const STORAGE_KEY = "generator-mikrotik/setup-configs";
export const FILE_KIND = "setup-config";
export const FILE_APP = "generator-script-mikrotik";
export const FILE_VERSION = 1;

export interface SavedConfig {
  id: string;
  name: string;
  savedAt: string;
  config: SetupConfig;
}

export interface ConfigFile {
  app: string;
  kind: string;
  version: number;
  name: string;
  savedAt: string;
  config: SetupConfig;
}

/* ------------------------------------------------------------ normalisasi */

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;
const asStringList = (value: unknown): string[] =>
  asArray(value).filter((item): item is string => typeof item === "string");

const HOTSPOT_AUTH_VALUES: HotspotAuth[] = ["http-pap", "http-chap", "mac-cookie", "cookie"];

/**
 * Membentuk ulang konfigurasi dari data mentah (file impor / localStorage).
 *
 * Field yang hilang diisi dari nilai default, field asing dibuang, dan setiap
 * baris list mendapat id baru — sehingga file lama tetap bisa dimuat meskipun
 * bentuk konfigurasi sudah berubah.
 */
export function normalizeConfig(raw: unknown): SetupConfig {
  const base = createDefaultConfig();
  const input = asRecord(raw);

  const modelId = asString(input.modelId);
  const model = getModel(modelId);
  const rosRaw = asString(input.ros);
  const ros: RosVersion | "" =
    (rosRaw === "v6" || rosRaw === "v7") && (!model || model.supports.includes(rosRaw))
      ? rosRaw
      : "";

  const system = asRecord(input.system);
  const dns = asRecord(input.dns);
  const nat = asRecord(input.nat);
  const pppoe = asRecord(input.pppoe);
  const firewall = asRecord(input.firewall);

  const wans: WanEntry[] = asArray(input.wans).map((item) => {
    const w = asRecord(item);
    const mode = w.mode === "static" ? "static" : "dhcp";
    return {
      id: uid("wan"),
      iface: asString(w.iface),
      mode,
      addDefaultRoute: asBool(w.addDefaultRoute, true),
      dhcpDistance: asString(w.dhcpDistance, "1"),
      usePeerDns: asBool(w.usePeerDns, true),
      address: asString(w.address),
      gateway: asString(w.gateway),
      staticDistance: asString(w.staticDistance, "1"),
      comment: asString(w.comment),
    };
  });

  const bridges: BridgeEntry[] = asArray(input.bridges).map((item) => {
    const b = asRecord(item);
    return { id: uid("br"), name: asString(b.name), ports: asStringList(b.ports) };
  });

  const vlans: VlanEntry[] = asArray(input.vlans).map((item) => {
    const v = asRecord(item);
    return {
      id: uid("vlan"),
      name: asString(v.name),
      vlanId: asString(v.vlanId),
      parent: asString(v.parent),
    };
  });

  const addresses: AddressEntry[] = asArray(input.addresses).map((item) => {
    const a = asRecord(item);
    return {
      id: uid("addr"),
      iface: asString(a.iface),
      address: asString(a.address),
      comment: asString(a.comment),
    };
  });

  const pools: PoolEntry[] = asArray(input.pools).map((item) => {
    const p = asRecord(item);
    return {
      id: uid("pool"),
      name: asString(p.name),
      rangeStart: asString(p.rangeStart),
      rangeEnd: asString(p.rangeEnd),
    };
  });

  const dhcpServers: DhcpServerEntry[] = asArray(input.dhcpServers).map((item) => {
    const d = asRecord(item);
    return {
      id: uid("dhcp"),
      name: asString(d.name),
      iface: asString(d.iface),
      pool: asString(d.pool),
      network: asString(d.network),
      gateway: asString(d.gateway),
      dnsServers: asString(d.dnsServers),
      leaseTime: asString(d.leaseTime, "1d"),
    };
  });

  const hotspots: HotspotEntry[] = asArray(input.hotspots).map((item) => {
    const h = asRecord(item);
    const auth = asStringList(h.auth).filter((a): a is HotspotAuth =>
      HOTSPOT_AUTH_VALUES.includes(a as HotspotAuth),
    );
    return {
      id: uid("hs"),
      name: asString(h.name),
      iface: asString(h.iface),
      pool: asString(h.pool),
      dnsName: asString(h.dnsName),
      auth: auth.length > 0 ? auth : ["http-chap", "http-pap"],
      addressesPerMac: asString(h.addressesPerMac, "2"),
    };
  });

  const hotspotPage = asRecord(input.hotspotPage);
  const templateId = asString(hotspotPage.template, base.hotspotPage.template);
  const loginMode = asString(hotspotPage.loginMode, base.hotspotPage.loginMode);
  // Berkas lama menyimpan mode gelap/terang; petakan ke warna latar.
  const legacyMode = asString(hotspotPage.mode);
  const bgFallback =
    legacyMode === "terang" ? "#eef2f7" : legacyMode === "gelap" ? "#0b1220" : base.hotspotPage.bgColor;

  const packages: VoucherPackage[] = asArray(hotspotPage.packages).map((item) => {
    const p = asRecord(item);
    return {
      id: uid("pkg"),
      name: asString(p.name),
      duration: asString(p.duration),
      price: asString(p.price),
    };
  });

  const secrets: PppoeSecret[] = asArray(pppoe.secrets).map((item) => {
    const s = asRecord(item);
    return { id: uid("sec"), user: asString(s.user), password: asString(s.password) };
  });

  const users: RouterUser[] = asArray(input.users).map((item) => {
    const u = asRecord(item);
    const group = asString(u.group, "full");
    return {
      id: uid("user"),
      name: asString(u.name),
      password: asString(u.password),
      group: (["full", "write", "read"].includes(group) ? group : "full") as UserGroup,
      allowedAddress: asString(u.allowedAddress),
      comment: asString(u.comment),
    };
  });

  return {
    modelId: model ? modelId : "",
    customInterfaces: asString(input.customInterfaces),
    ros,
    system: {
      identity: asString(system.identity),
      adminUser: asString(system.adminUser, base.system.adminUser),
      adminPassword: asString(system.adminPassword),
      timezone: asString(system.timezone, base.system.timezone),
      ntp: asBool(system.ntp, base.system.ntp),
    },
    wans: wans.length > 0 ? wans : base.wans,
    dns: {
      servers: "servers" in dns ? asStringList(dns.servers) : base.dns.servers,
      allowRemoteRequests: asBool(dns.allowRemoteRequests, base.dns.allowRemoteRequests),
    },
    nat: {
      enabled: asBool(nat.enabled, base.nat.enabled),
      mode: nat.mode === "perInterface" ? "perInterface" : "global",
      interfaces: asStringList(nat.interfaces),
    },
    bridges,
    vlans,
    addresses,
    pools,
    dhcpServers,
    hotspots,
    hotspotPage: {
      template: (TEMPLATES.some((t) => t.id === templateId)
        ? templateId
        : base.hotspotPage.template) as HotspotTemplateId,
      primaryColor: isHexColor(asString(hotspotPage.primaryColor))
        ? asString(hotspotPage.primaryColor)
        : base.hotspotPage.primaryColor,
      bgColor: isHexColor(asString(hotspotPage.bgColor))
        ? asString(hotspotPage.bgColor)
        : bgFallback,
      title: asString(hotspotPage.title),
      subtitle: asString(hotspotPage.subtitle),
      // Terima hanya data URI gambar — menolak URL luar yang tidak akan
      // termuat di halaman login sebelum klien terhubung ke internet.
      logoDataUrl: /^data:image\//i.test(asString(hotspotPage.logoDataUrl))
        ? asString(hotspotPage.logoDataUrl)
        : "",
      logoName: asString(hotspotPage.logoName),
      logoHeight:
        typeof hotspotPage.logoHeight === "number" &&
        hotspotPage.logoHeight >= 40 &&
        hotspotPage.logoHeight <= 260
          ? hotspotPage.logoHeight
          : base.hotspotPage.logoHeight,
      bgImageDataUrl: /^data:image\//i.test(asString(hotspotPage.bgImageDataUrl))
        ? asString(hotspotPage.bgImageDataUrl)
        : "",
      bgImageName: asString(hotspotPage.bgImageName),
      bgOverlay:
        typeof hotspotPage.bgOverlay === "number" &&
        hotspotPage.bgOverlay >= 0 &&
        hotspotPage.bgOverlay <= 90
          ? hotspotPage.bgOverlay
          : base.hotspotPage.bgOverlay,
      loginMode: (loginMode === "member" ? "member" : "voucher") as LoginMode,
      showModeSwitch: asBool(hotspotPage.showModeSwitch, base.hotspotPage.showModeSwitch),
      marquee: asString(hotspotPage.marquee, base.hotspotPage.marquee),
      showTrial: asBool(hotspotPage.showTrial, base.hotspotPage.showTrial),
      packages,
      terms: asString(hotspotPage.terms),
      whatsapp: asString(hotspotPage.whatsapp),
      whatsappLabel: asString(hotspotPage.whatsappLabel, base.hotspotPage.whatsappLabel),
      footer: asString(hotspotPage.footer),
    },
    pppoe: {
      enabled: asBool(pppoe.enabled, false),
      iface: asString(pppoe.iface),
      serviceName: asString(pppoe.serviceName, base.pppoe.serviceName),
      profileName: asString(pppoe.profileName, base.pppoe.profileName),
      localAddress: asString(pppoe.localAddress),
      pool: asString(pppoe.pool),
      rateLimit: asString(pppoe.rateLimit),
      oneSessionPerHost: asBool(pppoe.oneSessionPerHost, true),
      secrets,
    },
    firewall: {
      enabled: asBool(firewall.enabled, base.firewall.enabled),
      dropInvalid: asBool(firewall.dropInvalid, base.firewall.dropInvalid),
      allowIcmp: asBool(firewall.allowIcmp, base.firewall.allowIcmp),
      protectInput: asBool(firewall.protectInput, base.firewall.protectInput),
      fasttrack: asBool(firewall.fasttrack, base.firewall.fasttrack),
      restrictServices: asBool(firewall.restrictServices, base.firewall.restrictServices),
      mgmtSubnet: asString(firewall.mgmtSubnet),
      disableUnusedServices: asBool(
        firewall.disableUnusedServices,
        base.firewall.disableUnusedServices,
      ),
      limitDiscovery: asBool(firewall.limitDiscovery, base.firewall.limitDiscovery),
      limitMacServer: asBool(firewall.limitMacServer, base.firewall.limitMacServer),
    },
    users,
  };
}

/** Menghapus seluruh kredensial dari salinan konfigurasi. */
export function stripSecrets(config: SetupConfig): SetupConfig {
  return {
    ...config,
    system: { ...config.system, adminPassword: "" },
    pppoe: {
      ...config.pppoe,
      secrets: config.pppoe.secrets.map((s) => ({ ...s, password: "" })),
    },
    users: config.users.map((u) => ({ ...u, password: "" })),
  };
}

export function hasSecrets(config: SetupConfig): boolean {
  return (
    Boolean(config.system.adminPassword) ||
    config.pppoe.secrets.some((s) => s.password) ||
    config.users.some((u) => u.password)
  );
}

/** Ringkasan satu baris untuk daftar konfigurasi tersimpan. */
export function describeConfig(config: SetupConfig): string {
  const parts: string[] = [];
  const model = getModel(config.modelId);
  parts.push(model ? model.name : "model belum dipilih");
  if (config.ros) parts.push(`RouterOS ${config.ros}`);
  const wanCount = config.wans.filter((w) => w.iface).length;
  if (wanCount > 0) parts.push(`${wanCount} WAN`);
  if (config.vlans.length > 0) parts.push(`${config.vlans.length} VLAN`);
  if (config.hotspots.length > 0) parts.push("hotspot");
  if (config.pppoe.enabled) parts.push("PPPoE");
  return parts.join(" · ");
}

/* -------------------------------------------------------------- localStorage */

function readStore(): SavedConfig[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return asArray(JSON.parse(raw))
      .map((item) => {
        const entry = asRecord(item);
        return {
          id: asString(entry.id) || uid("cfg"),
          name: asString(entry.name, "Tanpa nama"),
          savedAt: asString(entry.savedAt, new Date().toISOString()),
          config: normalizeConfig(entry.config),
        };
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  } catch {
    return [];
  }
}

function writeStore(entries: SavedConfig[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function listSaved(): SavedConfig[] {
  return readStore();
}

/** Menyimpan konfigurasi; nama yang sama akan menimpa entri sebelumnya. */
export function saveConfig(
  name: string,
  config: SetupConfig,
  includeSecrets: boolean,
): SavedConfig[] {
  const entries = readStore();
  const cleanName = name.trim() || "Tanpa nama";
  const payload = includeSecrets ? config : stripSecrets(config);
  const entry: SavedConfig = {
    id: uid("cfg"),
    name: cleanName,
    savedAt: new Date().toISOString(),
    config: payload,
  };
  const next = [entry, ...entries.filter((e) => e.name !== cleanName)];
  writeStore(next);
  return next;
}

export function deleteSaved(id: string): SavedConfig[] {
  const next = readStore().filter((e) => e.id !== id);
  writeStore(next);
  return next;
}

/* --------------------------------------------------------------- file .json */

export function toFilePayload(
  name: string,
  config: SetupConfig,
  includeSecrets: boolean,
): string {
  const file: ConfigFile = {
    app: FILE_APP,
    kind: FILE_KIND,
    version: FILE_VERSION,
    name: name.trim() || "Tanpa nama",
    savedAt: new Date().toISOString(),
    config: includeSecrets ? config : stripSecrets(config),
  };
  return JSON.stringify(file, null, 2);
}

export interface ParseResult {
  ok: boolean;
  name: string;
  config?: SetupConfig;
  error?: string;
}

/** Membaca file konfigurasi; menerima format berpembungkus maupun config polos. */
export function parseFilePayload(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, name: "", error: "File bukan JSON yang valid." };
  }

  const record = asRecord(parsed);
  const wrapped = record.kind === FILE_KIND || "config" in record;
  const rawConfig = wrapped ? record.config : parsed;
  const candidate = asRecord(rawConfig);

  if (Object.keys(candidate).length === 0) {
    return { ok: false, name: "", error: "Isi file tidak dikenali sebagai konfigurasi." };
  }
  if (!("wans" in candidate) && !("modelId" in candidate)) {
    return {
      ok: false,
      name: "",
      error: "File ini bukan konfigurasi Setup Mikrotik Baru.",
    };
  }

  return {
    ok: true,
    name: asString(record.name, "Konfigurasi impor"),
    config: normalizeConfig(candidate),
  };
}
