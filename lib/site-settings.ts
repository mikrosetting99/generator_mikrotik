/**
 * Pengaturan tampilan & menu halaman utama yang diubah admin lewat /admin.
 * Modul ini murni (tanpa database) supaya bisa dipakai di server maupun browser.
 */

export const MENU_ICONS = [
  "cpu",
  "split",
  "filetext",
  "shield",
  "terminal",
  "route",
  "wand",
  "database",
  "users",
  "lock",
] as const;
export type MenuIconName = (typeof MENU_ICONS)[number];

export const MENU_ICON_LABEL: Record<MenuIconName, string> = {
  cpu: "Perangkat",
  split: "Cabang",
  filetext: "Dokumen",
  shield: "Perisai",
  terminal: "Terminal",
  route: "Rute",
  wand: "Tongkat",
  database: "Database",
  users: "Pengguna",
  lock: "Gembok",
};

export interface MenuSetting {
  /** Menu bawaan memakai id tetap; menu tambahan berawalan "custom-". */
  id: string;
  /** Nama grup (salah satu dari SiteSettings.groups); kosong = tanpa grup. */
  group: string;
  builtin: boolean;
  title: string;
  description: string;
  /** Alamat tujuan. Menu bawaan tidak bisa diubah; menu tambahan boleh "/…" atau "https://…". */
  href: string;
  icon: MenuIconName;
  visible: boolean;
  /** Mode pengembangan: hanya admin yang bisa membuka, yang lain melihat "dalam pengembangan". */
  devMode: boolean;
  /** Wajib login untuk membuka menu ini. Mati = bebas diakses siapa saja; yang sudah login selalu lolos. */
  requireLogin: boolean;
}

export interface SiteSettings {
  /** Nama situs: tampil di pojok kiri atas beranda dan di footer. */
  siteName: string;
  /** Logo situs sebagai data URI (png/jpeg/webp/svg, maks ~200 KB). Kosong = tanpa logo. */
  logoDataUrl: string;
  /** Berubah tiap logo diganti, dipakai sebagai penanda cache pada alamat gambar. */
  logoVersion: number;
  /** Tombol WhatsApp di beranda. */
  waEnabled: boolean;
  waNumber: string;
  waLabel: string;
  /** Pesan awal yang terisi di WhatsApp pengunjung. */
  waMessage: string;
  /** Tambah tombol WhatsApp melayang di pojok kanan bawah. */
  waFloating: boolean;
  heroTitle: string;
  heroAccent: string;
  heroText: string;
  ctaLabel: string;
  showSample: boolean;
  showFeatures: boolean;
  footerNote: string;
  /** Daftar grup menu, sesuai urutan tampil di halaman utama. */
  groups: string[];
  /** Urutan array = urutan tampil di halaman utama (di dalam tiap grup). */
  menus: MenuSetting[];
}

export const MAX_CUSTOM_MENUS = 12;
export const MAX_GROUPS = 8;
export const DEFAULT_GROUPS = ["Konfigurasi", "Alat"];

export const BUILTIN_MENUS: MenuSetting[] = [
  {
    id: "setup",
    group: "Konfigurasi",
    builtin: true,
    title: "Setup Mikrotik Baru",
    description: "Router default sampai siap pakai: WAN, NAT, DHCP, hotspot, PPPoE, firewall.",
    href: "/setup",
    icon: "cpu",
    visible: true,
    devMode: false,
    requireLogin: true,
  },
  {
    id: "loadbalance",
    group: "Konfigurasi",
    builtin: true,
    title: "Load Balance & Fail Over",
    description: "Gabungkan beberapa ISP, dengan jalur cadangan otomatis.",
    href: "/loadbalance",
    icon: "split",
    visible: true,
    devMode: false,
    requireLogin: false,
  },
  {
    id: "hotspot-login",
    group: "Konfigurasi",
    builtin: true,
    title: "Halaman Login Hotspot",
    description: "Atur tampilan portal login dan tabel harga, unduh sebagai hotspot.zip.",
    href: "/hotspot-login",
    icon: "filetext",
    visible: true,
    devMode: false,
    requireLogin: false,
  },
  {
    id: "cek",
    group: "Alat",
    builtin: true,
    title: "Cek Mikrotik",
    description: "Periksa router bermasalah beserta saran perbaikannya.",
    href: "/cek",
    icon: "shield",
    visible: true,
    devMode: false,
    requireLogin: false,
  },
  {
    id: "ip-calc",
    group: "Alat",
    builtin: true,
    title: "Kalkulator IP",
    description: "Hitung subnet, rentang host, netmask, dan bagi jaringan jadi beberapa subnet.",
    href: "/kalkulator-ip",
    icon: "route",
    visible: true,
    devMode: false,
    requireLogin: false,
  },
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "Generator Script Mikrotik",
  logoDataUrl: "",
  logoVersion: 0,
  waEnabled: false,
  waNumber: "",
  waLabel: "Chat via WhatsApp",
  waMessage: "Halo, saya ingin bertanya tentang Generator Script Mikrotik.",
  waFloating: false,
  heroTitle: "Generator Script",
  heroAccent: "Mikrotik",
  heroText:
    "Isi form, salin script, tempel ke New Terminal Mikrotik — mendukung RouterOS v6 dan v7. Tidak perlu menghafal sintaks CLI.",
  ctaLabel: "Mulai Setup Mikrotik Baru",
  showSample: true,
  showFeatures: true,
  footerNote: "Backup router sebelum menjalankan script apa pun.",
  groups: DEFAULT_GROUPS,
  menus: BUILTIN_MENUS,
};

function str(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** 08123… / +62812… / 62812… → 62812… (hanya digit). */
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

/** Tautan wa.me lengkap dengan pesan awal; kosong bila nomor belum valid. */
export function waLink(number: string, message: string): string {
  const n = normalizeWhatsapp(number);
  if (n.length < 8) return "";
  return `https://wa.me/${n}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}`;
}

/** Batas ukuran logo (panjang string data URI ≈ 1,37× ukuran berkas). */
export const MAX_LOGO_BYTES = 200 * 1024;
const LOGO_PATTERN = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

/** Hanya alamat dalam situs ("/…") atau http(s) — skema lain (javascript:) ditolak. */
export function safeHref(value: string): string {
  const v = value.trim();
  if (/^\/(?!\/)/.test(v)) return v;
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v;
  return "";
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function newCustomMenu(group = ""): MenuSetting {
  return {
    group,
    id: `custom-${Math.random().toString(36).slice(2, 8)}`,
    builtin: false,
    title: "Menu baru",
    description: "",
    href: "/",
    icon: "terminal",
    visible: true,
    devMode: false,
    requireLogin: false,
  };
}

/** Melengkapi data tersimpan dengan bawaan; field yang rusak/hilang dipulihkan. */
export function normalizeSiteSettings(raw: unknown): SiteSettings {
  const base = DEFAULT_SITE_SETTINGS;
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  // Grup: nama unik, tidak kosong. Simpanan lama tanpa grup memakai bawaan.
  const rawGroups = Array.isArray(input.groups) ? input.groups : base.groups;
  const groups: string[] = [];
  for (const g of rawGroups) {
    const name = typeof g === "string" ? g.trim().slice(0, 30) : "";
    if (name && !groups.includes(name) && groups.length < MAX_GROUPS) groups.push(name);
  }
  const pickGroup = (value: unknown, fallback: string) => {
    const g = typeof value === "string" ? value.trim() : fallback;
    return groups.includes(g) ? g : "";
  };

  const saved = Array.isArray(input.menus) ? (input.menus as Record<string, unknown>[]) : [];
  const builtinById = new Map(BUILTIN_MENUS.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const menus: MenuSetting[] = [];
  let customCount = 0;

  for (const item of saved) {
    if (!item || typeof item !== "object" || typeof item.id !== "string") continue;
    const id = item.id;
    if (seen.has(id)) continue;

    const def = builtinById.get(id);
    if (def) {
      seen.add(id);
      menus.push({
        ...def,
        group: pickGroup(item.group, def.group),
        title: str(item.title, def.title, 60) || def.title,
        description: str(item.description, def.description, 200),
        visible: bool(item.visible, true),
        devMode: bool(item.devMode, false),
        requireLogin: bool(item.requireLogin, def.requireLogin),
      });
      continue;
    }

    if (!/^custom-[a-z0-9]{3,12}$/.test(id) || customCount >= MAX_CUSTOM_MENUS) continue;
    const href = safeHref(typeof item.href === "string" ? item.href : "") || "/";
    const icon = MENU_ICONS.includes(item.icon as MenuIconName) ? (item.icon as MenuIconName) : "terminal";
    seen.add(id);
    customCount += 1;
    menus.push({
      id,
      group: pickGroup(item.group, ""),
      builtin: false,
      title: str(item.title, "Menu baru", 60) || "Menu baru",
      description: str(item.description, "", 200),
      href,
      icon,
      visible: bool(item.visible, true),
      devMode: bool(item.devMode, false),
      requireLogin: bool(item.requireLogin, false),
    });
  }
  // Menu bawaan yang belum ada di simpanan lama tetap muncul, di urutan paling bawah.
  for (const def of BUILTIN_MENUS) {
    if (!seen.has(def.id)) menus.push({ ...def, group: pickGroup(def.group, def.group) });
  }

  const logo = typeof input.logoDataUrl === "string" ? input.logoDataUrl : "";
  const logoOk = LOGO_PATTERN.test(logo) && logo.length <= Math.ceil(MAX_LOGO_BYTES * 1.4);

  return {
    siteName: str(input.siteName, base.siteName, 60) || base.siteName,
    logoDataUrl: logoOk ? logo : "",
    logoVersion: logoOk && typeof input.logoVersion === "number" ? input.logoVersion : 0,
    waEnabled: bool(input.waEnabled, base.waEnabled),
    waNumber: str(input.waNumber, base.waNumber, 24),
    waLabel: str(input.waLabel, base.waLabel, 40) || base.waLabel,
    waMessage: str(input.waMessage, base.waMessage, 300),
    waFloating: bool(input.waFloating, base.waFloating),
    heroTitle: str(input.heroTitle, base.heroTitle, 60),
    heroAccent: str(input.heroAccent, base.heroAccent, 40),
    heroText: str(input.heroText, base.heroText, 300),
    ctaLabel: str(input.ctaLabel, base.ctaLabel, 60) || base.ctaLabel,
    showSample: bool(input.showSample, base.showSample),
    showFeatures: bool(input.showFeatures, base.showFeatures),
    footerNote: str(input.footerNote, base.footerNote, 160),
    groups,
    menus,
  };
}
