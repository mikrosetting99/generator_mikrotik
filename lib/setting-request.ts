/**
 * Form Setting Mikrotik: admin membuat link, pelanggan mengisi kebutuhannya,
 * lalu data itu diubah menjadi konfigurasi Setup Mikrotik Baru (script siap salin)
 * dan Halaman Login Hotspot (template + nama usaha).
 *
 * Berkas ini murni (tanpa database), dipakai di browser maupun server.
 */
import { createDefaultConfig, newAddress, newBridge, newDhcpServer, newHotspot, newPool, newPppoeProfile, newWan, newWireless } from "./defaults";
import { getModel, MIKROTIK_MODELS } from "./models";
import { isValidPhone, normalizePhone } from "./phone";
import type { HotspotPageConfig } from "./types-hotspot-login";
import type { SetupConfig } from "./types";

export type Purpose = "hotspot" | "pppoe" | "hotspot-pppoe" | "kantor";

export const PURPOSES: { id: Purpose; label: string; hint: string }[] = [
  { id: "hotspot", label: "Hotspot", hint: "Voucher WiFi untuk warung, kafe, kos, atau RT/RW Net." },
  { id: "pppoe", label: "PPPoE", hint: "Pelanggan berlangganan bulanan dengan akun PPPoE." },
  { id: "hotspot-pppoe", label: "Hotspot + PPPoE", hint: "Dua layanan sekaligus di satu router." },
  { id: "kantor", label: "Kantor", hint: "Jaringan kantor, toko, atau rumah tanpa voucher." },
];

export const PURPOSE_LABEL: Record<Purpose, string> = Object.fromEntries(PURPOSES.map((p) => [p.id, p.label])) as Record<Purpose, string>;

export function isPurpose(v: unknown): v is Purpose {
  return v === "hotspot" || v === "pppoe" || v === "hotspot-pppoe" || v === "kantor";
}

/** Peruntukan yang memakai halaman login hotspot. */
export function usesLoginPage(p: Purpose | ""): boolean {
  return p === "hotspot" || p === "hotspot-pppoe";
}

/** menunggu = link dibuat, belum diisi · masuk = sudah diisi pelanggan · selesai = dikerjakan admin. */
export type RequestStatus = "menunggu" | "masuk" | "selesai";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  menunggu: "Menunggu diisi",
  masuk: "Masuk",
  selesai: "Selesai",
};

export function parseStatus(v: unknown): RequestStatus {
  return v === "masuk" || v === "selesai" ? v : "menunggu";
}

/** Isian pelanggan. */
export interface SettingRequestData {
  purpose: Purpose | "";
  modelId: string;
  /** Hotspot/PPPoE: nama usaha atau nama voucher. */
  businessName: string;
  email: string;
  /** Hotspot/PPPoE: nomor telepon admin, disimpan dalam bentuk 62812… */
  phone: string;
  /** Hotspot: id HotspotTemplate yang dipilih; kosong = template default. */
  templateId: string;
  /** Kantor: penjelasan kebutuhan. */
  needs: string;
}

/** Satu permintaan seperti yang dikirim API ke halaman admin. */
export interface SettingRequestView extends SettingRequestData {
  id: string;
  token: string;
  label: string;
  status: RequestStatus;
  routerPassword: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_REQUEST: SettingRequestData = {
  purpose: "",
  modelId: "",
  businessName: "",
  email: "",
  phone: "",
  templateId: "",
  needs: "",
};

export const MAX_NEEDS = 2000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
}

/**
 * Periksa isian form. Mengembalikan data yang sudah dirapikan, atau pesan galat per kolom.
 * Kolom yang tidak dipakai peruntukannya dikosongkan supaya tidak ada sisa isian lama.
 */
export function validateRequest(input: unknown): { data: SettingRequestData; errors: Record<string, string> } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const purpose = isPurpose(o.purpose) ? o.purpose : "";
  const modelId = text(o.modelId, 40);
  const email = text(o.email, 120).toLowerCase();
  const office = purpose === "kantor";

  if (!purpose) errors.purpose = "Pilih peruntukan.";
  if (!modelId || !getModel(modelId)) errors.modelId = "Pilih type MikroTik.";
  if (!email) errors.email = "Isi email aktif.";
  else if (!EMAIL.test(email)) errors.email = "Format email tidak valid.";

  const data: SettingRequestData = { ...EMPTY_REQUEST, purpose, modelId, email };

  if (office) {
    data.needs = text(o.needs, MAX_NEEDS);
    if (data.needs.length < 10) errors.needs = "Jelaskan kebutuhan Anda (minimal 10 karakter).";
  } else if (purpose) {
    data.businessName = text(o.businessName, 60);
    if (data.businessName.length < 2) errors.businessName = "Isi nama usaha / nama voucher.";
    const rawPhone = text(o.phone, 24);
    data.phone = rawPhone ? normalizePhone(rawPhone) : "";
    if (!rawPhone) errors.phone = "Isi nomor telepon admin.";
    else if (!isValidPhone(data.phone)) errors.phone = "Nomor telepon tidak valid (contoh 0812xxxxxxx).";
    if (usesLoginPage(purpose)) data.templateId = /^[a-z0-9]{8,40}$/i.test(String(o.templateId ?? "")) ? String(o.templateId) : "";
  }
  return { data, errors };
}

/** Kelompok tipe MikroTik untuk pilihan bercari (tanpa "isi manual": pelanggan memilih perangkat nyata). */
export function modelOptions() {
  const groups: Array<{ label: string; options: { value: string; label: string }[] }> = [];
  for (const m of MIKROTIK_MODELS) {
    if (m.id === "custom") continue;
    let g = groups.find((x) => x.label === m.series);
    if (!g) groups.push((g = { label: m.series, options: [] }));
    g.options.push({ value: m.id, label: m.name });
  }
  groups.push({ label: "Lainnya", options: [{ value: "custom", label: "Tidak ada di daftar / belum tahu" }] });
  return groups;
}

/** "Warung Kopi Bu Sri" → "Warung-Kopi-Bu-Sri" (aman untuk identity dan nama berkas). */
export function slugName(name: string, max = 24): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, max)
      .replace(/-$/, "") || "Pelanggan"
  );
}

/** Password acak tanpa karakter yang mudah tertukar (0/O, 1/l) dan tanpa simbol yang merepotkan di terminal. */
export function randomPassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Token link pelanggan: 32 karakter hex acak (128 bit). */
export function randomToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isToken(v: string): boolean {
  return /^[a-f0-9]{32}$/.test(v);
}

/**
 * Susun konfigurasi Setup Mikrotik Baru dari isian pelanggan.
 *
 * Port mengikuti perangkat yang dipilih: port ethernet/SFP pertama menjadi WAN,
 * sisanya dibagi sesuai peruntukan. Radio WiFi (bila ada) ikut ke segmen hotspot,
 * atau menjadi WiFi kantor ber-WPA2.
 */
export function buildSetupConfig(req: SettingRequestData, opts: { routerPassword: string; wifiPassword?: string }): SetupConfig {
  const base = createDefaultConfig();
  const model = getModel(req.modelId) ?? getModel("custom")!;
  const ros = model.supports.includes("v7") ? "v7" : "v6";
  const wired = model.interfaces.filter((i) => /^(ether|sfp|combo|qsfp)/.test(i));
  const radios = model.interfaces.filter((i) => /^(wlan|wifi)\d/.test(i));
  const wanIf = wired[0] ?? "ether1";
  const lan = wired.slice(1);
  const purpose = req.purpose || "kantor";
  const name = req.businessName.trim();
  const slug = slugName(name || "Kantor");

  const config: SetupConfig = {
    ...base,
    modelId: model.id,
    // Type belum diketahui: anggap 5 port ether standar (bisa diubah di Setup Mikrotik Baru).
    customInterfaces: model.id === "custom" ? model.interfaces.join(", ") : "",
    ros,
    system: {
      ...base.system,
      identity: purpose === "kantor" ? "Router-Kantor" : `Router-${slug}`,
      adminPassword: opts.routerPassword,
    },
    wans: [{ ...newWan(wanIf), comment: "ISP" }],
    firewall: { ...base.firewall, enabled: true },
    handover: {
      ...base.handover,
      customerName: name,
      customerPhone: req.phone ? `0${req.phone.replace(/^62/, "")}` : "",
      scope:
        purpose === "kantor"
          ? "Instalasi dan konfigurasi router MikroTik untuk jaringan kantor."
          : `Instalasi dan konfigurasi router MikroTik untuk layanan ${PURPOSE_LABEL[purpose]}.`,
      notes: purpose === "kantor" ? req.needs : "",
    },
  };

  const hotspotOn = purpose === "hotspot" || purpose === "hotspot-pppoe";
  const pppoeOn = purpose === "pppoe" || purpose === "hotspot-pppoe";

  if (purpose === "kantor") {
    config.bridges = [{ ...newBridge("bridge-lan"), ports: [...lan, ...radios] }];
    config.addresses = [{ ...newAddress("bridge-lan"), address: "192.168.10.1/24", comment: "LAN kantor" }];
    config.pools = [{ ...newPool(), name: "pool-lan", rangeStart: "192.168.10.10", rangeEnd: "192.168.10.254" }];
    config.dhcpServers = [{ ...newDhcpServer(), name: "dhcp-lan", iface: "bridge-lan", pool: "pool-lan" }];
    config.wireless = {
      country: "Indonesia",
      radios: radios.map((r, i) => ({
        ...newWireless(r),
        ssid: i === 0 ? "WiFi-Kantor" : `WiFi-Kantor-${i + 1}`,
        security: "wpa2" as const,
        password: opts.wifiPassword ?? opts.routerPassword,
      })),
    };
    config.firewall.mgmtSubnet = "192.168.10.0/24";
    return config;
  }

  // Port manajemen sendiri bila port LAN cukup (≥ 3), supaya Winbox/SSH bisa dibatasi
  // ke jaringan pengelola, bukan ke klien hotspot/PPPoE.
  let free = [...lan];
  let mgmt: string | null = null;
  if (free.length >= 3) {
    mgmt = free[0];
    free = free.slice(1);
  }

  let hsPorts: string[] = [];
  let pppPorts: string[] = [];
  if (hotspotOn && pppoeOn) {
    if (free.length >= 2) {
      const half = Math.ceil(free.length / 2);
      hsPorts = free.slice(0, half);
      pppPorts = free.slice(half);
    } else {
      pppPorts = free;
    }
    hsPorts = [...hsPorts, ...radios];
  } else if (hotspotOn) {
    hsPorts = [...free, ...radios];
  } else {
    pppPorts = [...free, ...radios];
  }

  if (mgmt) {
    config.bridges.push({ ...newBridge("bridge-lan"), ports: [mgmt] });
    config.addresses.push({ ...newAddress("bridge-lan"), address: "192.168.10.1/24", comment: "LAN pengelola" });
    config.pools.push({ ...newPool(), name: "pool-lan", rangeStart: "192.168.10.10", rangeEnd: "192.168.10.254" });
    config.dhcpServers.push({ ...newDhcpServer(), name: "dhcp-lan", iface: "bridge-lan", pool: "pool-lan" });
    config.firewall.mgmtSubnet = "192.168.10.0/24";
  }

  if (hotspotOn) {
    config.bridges.push({ ...newBridge("bridge-hotspot"), ports: hsPorts });
    config.addresses.push({ ...newAddress("bridge-hotspot"), address: "10.10.0.1/24", comment: `hotspot ${name}`.trim() });
    config.pools.push({ ...newPool(), name: "pool-hotspot", rangeStart: "10.10.0.10", rangeEnd: "10.10.0.254" });
    config.dhcpServers.push({ ...newDhcpServer(), name: "dhcp-hotspot", iface: "bridge-hotspot", pool: "pool-hotspot", leaseTime: "1h" });
    config.hotspots = [
      {
        ...newHotspot(),
        name: "hotspot1",
        iface: "bridge-hotspot",
        pool: "pool-hotspot",
        dnsName: "wifi.lokal",
        auth: ["http-chap", "http-pap"],
        // Tombol WhatsApp admin di halaman login harus bisa dibuka sebelum login.
        whatsappWalledGarden: Boolean(req.phone),
      },
    ];
    // SSID terbuka: autentikasi lewat halaman login voucher.
    config.wireless = {
      country: "Indonesia",
      radios: radios.map((r, i) => ({
        ...newWireless(r),
        ssid: (i === 0 ? name : `${name} ${i + 1}`).slice(0, 32) || `Hotspot-${i + 1}`,
        security: "open" as const,
        clientIsolation: true,
      })),
    };
    config.firewall.fasttrack = false;
  }

  if (pppoeOn) {
    const iface = pppPorts.length ? "bridge-pppoe" : hotspotOn ? "bridge-hotspot" : "bridge-pppoe";
    if (pppPorts.length || !hotspotOn) config.bridges.push({ ...newBridge("bridge-pppoe"), ports: pppPorts });
    config.pools.push({ ...newPool(), name: "pool-pppoe", rangeStart: "10.20.0.2", rangeEnd: "10.20.0.254" });
    config.pppoe = {
      ...config.pppoe,
      enabled: true,
      iface,
      serviceName: slug.toLowerCase().slice(0, 30) || "pppoe",
      defaultProfile: "paket-10mbps",
      profiles: [{ ...newPppoeProfile(), name: "paket-10mbps", localAddress: "10.20.0.1", pool: "pool-pppoe", rateLimit: "10M/10M" }],
      secrets: [],
    };
    if (!mgmt) config.firewall.mgmtSubnet = "";
  }

  return config;
}

/** Terapkan isian pelanggan ke desain login page: nama usaha dan tombol WhatsApp admin. */
export function applyToLoginPage(page: HotspotPageConfig, req: SettingRequestData): HotspotPageConfig {
  const name = req.businessName.trim();
  return {
    ...page,
    title: name || page.title,
    whatsapp: req.phone || page.whatsapp,
    whatsappEnabled: req.phone ? true : page.whatsappEnabled,
  };
}

/** Teks pesan WhatsApp berisi link form untuk dikirim ke pelanggan. */
export function shareMessage(url: string, label: string): string {
  const who = label.trim() ? ` ${label.trim()}` : "";
  return `Halo${who}, silakan isi form setting MikroTik berikut supaya router Anda bisa kami siapkan:\n${url}`;
}
