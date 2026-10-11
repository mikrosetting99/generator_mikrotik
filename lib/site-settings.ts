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
  builtin: boolean;
  title: string;
  description: string;
  /** Alamat tujuan. Menu bawaan tidak bisa diubah; menu tambahan boleh "/…" atau "https://…". */
  href: string;
  icon: MenuIconName;
  visible: boolean;
  /** Mode pengembangan: hanya admin yang bisa membuka, yang lain melihat "dalam pengembangan". */
  devMode: boolean;
  /** Wajib login untuk membuka menu ini. */
  requireLogin: boolean;
}

export interface SiteSettings {
  heroTitle: string;
  heroAccent: string;
  heroText: string;
  ctaLabel: string;
  showSample: boolean;
  showFeatures: boolean;
  footerNote: string;
  /** Halaman utama sendiri wajib login atau terbuka untuk umum. */
  homeRequiresLogin: boolean;
  /** Urutan array = urutan tampil di halaman utama. */
  menus: MenuSetting[];
}

export const MAX_CUSTOM_MENUS = 12;

export const BUILTIN_MENUS: MenuSetting[] = [
  {
    id: "setup",
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
    builtin: true,
    title: "Cek Mikrotik",
    description: "Periksa router bermasalah beserta saran perbaikannya.",
    href: "/cek",
    icon: "shield",
    visible: true,
    devMode: false,
    requireLogin: false,
  },
];

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  heroTitle: "Generator Script",
  heroAccent: "Mikrotik",
  heroText:
    "Isi form, salin script, tempel ke New Terminal Mikrotik — mendukung RouterOS v6 dan v7. Tidak perlu menghafal sintaks CLI.",
  ctaLabel: "Mulai Setup Mikrotik Baru",
  showSample: true,
  showFeatures: true,
  footerNote: "Backup router sebelum menjalankan script apa pun.",
  homeRequiresLogin: true,
  menus: BUILTIN_MENUS,
};

function str(value: unknown, fallback: string, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

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

export function newCustomMenu(): MenuSetting {
  return {
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
  for (const def of BUILTIN_MENUS) if (!seen.has(def.id)) menus.push({ ...def });

  return {
    heroTitle: str(input.heroTitle, base.heroTitle, 60),
    heroAccent: str(input.heroAccent, base.heroAccent, 40),
    heroText: str(input.heroText, base.heroText, 300),
    ctaLabel: str(input.ctaLabel, base.ctaLabel, 60) || base.ctaLabel,
    showSample: bool(input.showSample, base.showSample),
    showFeatures: bool(input.showFeatures, base.showFeatures),
    footerNote: str(input.footerNote, base.footerNote, 160),
    homeRequiresLogin: bool(input.homeRequiresLogin, base.homeRequiresLogin),
    menus,
  };
}
