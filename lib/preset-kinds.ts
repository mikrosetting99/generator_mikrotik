/** Galeri bersama: dua jenis gambar yang diunggah admin untuk Halaman Login Hotspot. */
export type PresetKind = "background" | "logo" | "app";

export const PRESET_LIMITS: Record<
  PresetKind,
  { label: string; maxBytes: number; types: string[]; typeLabel: string; recommend: string }
> = {
  background: {
    label: "latar",
    maxBytes: 300 * 1024,
    types: ["image/jpeg", "image/png", "image/webp"],
    typeLabel: "JPG, PNG, atau WEBP",
    recommend: "1920 × 1080 px (16:9), JPG kualitas 60–75%, maksimal 300 KB. Untuk latar khusus HP tegak: 1080 × 1920 px.",
  },
  app: {
    label: "background aplikasi",
    maxBytes: 400 * 1024,
    types: ["image/jpeg", "image/png", "image/webp"],
    typeLabel: "JPG, PNG, atau WEBP",
    recommend: "1920 × 1080 px (16:9), JPG kualitas 60–70%, maksimal 400 KB. Pilih gambar yang tidak terlalu ramai agar tulisan tetap terbaca.",
  },
  logo: {
    label: "logo",
    maxBytes: 300 * 1024,
    types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    typeLabel: "PNG, JPG, WEBP, atau SVG",
    recommend: "400 × 160 px (rasio 5:2), PNG atau SVG berlatar transparan, maksimal 300 KB. Logo persegi: 300 × 300 px.",
  },
};

export function parsePresetKind(value: unknown): PresetKind {
  return value === "logo" ? "logo" : value === "app" ? "app" : "background";
}