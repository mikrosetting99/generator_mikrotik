import { isHexColor, mix, readableOn } from "./color";

/** Warna bawaan tampilan (ungu & teal ala Odoo). */
export const DEFAULT_THEME = { brand: "#714b67", accent: "#017e84" } as const;

/** Pilihan tema siap pakai di Dashboard Admin. */
export const THEME_PRESETS: Array<{ id: string; label: string; brand: string; accent: string }> = [
  { id: "odoo", label: "Odoo (ungu)", brand: "#714b67", accent: "#017e84" },
  { id: "biru", label: "Biru", brand: "#1d6fd8", accent: "#0f9d8a" },
  { id: "hijau", label: "Hijau", brand: "#2e7d32", accent: "#1565c0" },
  { id: "oranye", label: "Oranye", brand: "#c9531d", accent: "#3f6f8f" },
  { id: "anggur", label: "Merah anggur", brand: "#a3243b", accent: "#1f7a8c" },
  { id: "slate", label: "Abu gelap", brand: "#3b4552", accent: "#2f9e6b" },
];

/** Warna tema yang dipakai: pilihan admin bila valid, selain itu bawaan. */
export function resolveTheme(brand: string, accent: string): { brand: string; accent: string } {
  return {
    brand: isHexColor(brand) ? brand.trim().toLowerCase() : DEFAULT_THEME.brand,
    accent: isHexColor(accent) ? accent.trim().toLowerCase() : DEFAULT_THEME.accent,
  };
}

/**
 * CSS yang menimpa variabel warna tema. Tema terang memakai warna apa adanya;
 * tema gelap memakai versi yang dicerahkan agar terbaca di atas permukaan gelap,
 * sedangkan bilah navigasi digelapkan. Selektornya digandakan (:root:root) supaya
 * menang dari nilai bawaan di globals.css tanpa bergantung pada urutan muat.
 */
export function themeCss(brand: string, accent: string): string {
  const t = resolveTheme(brand, accent);
  const light = `--color-brand:${t.brand};--color-brand-dim:${mix(t.brand, 0.78)};--color-brand-ink:${readableOn(t.brand)};--color-accent:${t.accent};--color-accent-ink:${readableOn(t.accent)};--nav-bg:${t.brand};`;
  const darkBrand = mix(t.brand, 0.42);
  const darkAccent = mix(t.accent, 0.38);
  const dark = `--color-brand:${darkBrand};--color-brand-dim:${mix(t.brand, -0.35)};--color-brand-ink:${readableOn(darkBrand)};--color-accent:${darkAccent};--color-accent-ink:${readableOn(darkAccent)};--nav-bg:${mix(t.brand, -0.45)};`;
  return [
    `:root:root:not([data-theme]){${dark}}`,
    `@media (prefers-color-scheme: light){:root:root:not([data-theme]){${light}}}`,
    `:root:root[data-theme="dark"]{${dark}}`,
    `:root:root[data-theme="light"]{${light}}`,
  ].join("\n");
}