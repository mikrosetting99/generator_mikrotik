/** Galeri bersama: dua jenis gambar yang diunggah admin untuk Halaman Login Hotspot. */
export type PresetKind = "background" | "logo";

export const PRESET_LIMITS: Record<
  PresetKind,
  { label: string; maxBytes: number; types: string[]; typeLabel: string; recommend: string }
> = {
  background: {
    label: "latar",
    maxBytes: 200 * 1024,
    types: ["image/jpeg", "image/png", "image/webp"],
    typeLabel: "JPG, PNG, atau WEBP",
    recommend: "1920 × 1080 px (16:9), JPG kualitas 60–75%, maksimal 200 KB (gambar yang lebih besar dikompres otomatis). Untuk latar khusus HP tegak: 1080 × 1920 px.",
  },
  logo: {
    label: "logo",
    maxBytes: 200 * 1024,
    types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
    typeLabel: "PNG, JPG, WEBP, atau SVG",
    recommend: "400 × 160 px (rasio 5:2), PNG atau SVG berlatar transparan, maksimal 200 KB. Logo persegi: 300 × 300 px.",
  },
};

export function parsePresetKind(value: unknown): PresetKind {
  return value === "logo" ? "logo" : "background";
}