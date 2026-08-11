import { uid } from "./defaults";
import type { HotspotPageConfig, VoucherPackage } from "./types-hotspot-login";

export function newPackage(): VoucherPackage {
  return { id: uid("pkg"), name: "", duration: "", validity: "", price: "" };
}

export function createDefaultHotspotLoginConfig(): HotspotPageConfig {
  return {
    template: "minimal",
    primaryColor: "#38bdf8",
    bgColor: "#ffffff",
    title: "",
    subtitle: "",
    logoDataUrl: "",
    logoName: "",
    logoHeight: 130,
    bgImageDataUrl: "",
    bgImageName: "",
    bgOverlay: 55,
    loginMode: "voucher",
    showModeSwitch: true,
    marquee: "Selamat datang di jaringan hotspot kami",
    showTrial: false,
    packages: [],
    terms: "",
    whatsapp: "",
    whatsappLabel: "Beli voucher via WhatsApp",
    footer: "",
  };
}
