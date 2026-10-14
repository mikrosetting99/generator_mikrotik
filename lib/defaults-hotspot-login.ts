import { uid } from "./defaults";
import type { HotspotPageConfig, VoucherPackage } from "./types-hotspot-login";

export function newPackage(): VoucherPackage {
  return { id: uid("pkg"), name: "", duration: "", validity: "", price: "" };
}

/** Melengkapi data tersimpan dengan bawaan — field baru tidak ada di simpanan lama. */
export function normalizeHotspotPage(raw: unknown): HotspotPageConfig {
  const base = createDefaultHotspotLoginConfig();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base) as (keyof HotspotPageConfig)[]) {
    if (typeof input[key] === typeof base[key] && input[key] !== null) merged[key] = input[key];
  }
  merged.packages = Array.isArray(input.packages)
    ? (input.packages as Partial<VoucherPackage>[]).map((p) => ({
        id: typeof p.id === "string" && p.id ? p.id : uid("pkg"),
        name: String(p.name ?? ""),
        duration: String(p.duration ?? ""),
        validity: String(p.validity ?? ""),
        price: String(p.price ?? ""),
      }))
    : base.packages;
  return merged as unknown as HotspotPageConfig;
}

export function createDefaultHotspotLoginConfig(): HotspotPageConfig {
  return {
    template: "minimal",
    primaryColor: "#38bdf8",
    primaryBrightness: 100,
    titleColor: "",
    subtitleColor: "",
    textColor: "",
    buttonColor: "",
    buttonTextColor: "",
    bgColor: "#eef2f7",
    formBgColor: "",
    formBgOpacity: 100,
    formWidth: 390,
    formBorderWidth: 1,
    formRadius: 16,
    formBorderColor: "",
    formImageDataUrl: "",
    formImageName: "",
    title: "",
    subtitle: "",
    logoDataUrl: "",
    logoName: "",
    logoHeight: 130,
    logoPosition: "inside",
    bgImageDataUrl: "",
    bgImageName: "",
    bgOverlay: 0,
    bgPosition: "center",
    bgFit: "cover",
    loginMode: "voucher",
    showModeSwitch: true,
    marquee: "Selamat datang di jaringan hotspot kami",
    marqueeEnabled: true,
    marqueePosition: "top",
    marqueeBgColor: "#1e293b",
    marqueeNoBg: false,
    marqueeTextColor: "",
    showTrial: false,
    packages: [],
    tableColor: "",
    terms: "",
    whatsapp: "",
    whatsappLabel: "Beli voucher via WhatsApp",
    whatsappEnabled: true,
    footer: "",
    footerPosition: "inside",
  };
}
