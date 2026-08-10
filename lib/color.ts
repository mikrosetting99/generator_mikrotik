/**
 * Helper warna untuk halaman login hotspot.
 *
 * Pengguna bebas memilih warna latar, jadi warna teks, permukaan, dan garis
 * diturunkan otomatis dari kecerahannya — supaya tidak pernah muncul tulisan
 * gelap di atas latar gelap.
 */

export interface DerivedPalette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  onPrimary: string;
  isDark: boolean;
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function toRgb(hex: string): [number, number, number] {
  const v = hex.trim().replace("#", "");
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, "0")).join("")}`;
}

/** Luminansi relatif menurut WCAG, 0 (hitam) sampai 1 (putih). */
export function luminance(hex: string): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Campur warna menuju putih (amount > 0) atau hitam (amount < 0). */
export function mix(hex: string, amount: number): string {
  const [r, g, b] = toRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(r + (target - r) * t, g + (target - g) * t, b + (target - b) * t);
}

/** Bentuk rgba() dari sebuah warna hex, untuk lapisan transparan. */
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(isHexColor(hex) ? hex : "#000000");
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(2)})`;
}

/** Campur dua warna: t=0 menghasilkan `a`, t=1 menghasilkan `b`. */
export function blend(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

const LIGHT_INK = "#f4f7fb";
const DARK_INK = "#101722";

/** Rasio kontras WCAG antara dua warna, 1 sampai 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Warna teks yang paling terbaca di atas sebuah latar.
 *
 * Memilih berdasarkan kontras nyata, bukan ambang kecerahan — warna mid-tone
 * seperti hijau #22c55e justru lebih terbaca dengan teks gelap meski
 * luminansinya di bawah setengah.
 */
export function readableOn(hex: string): string {
  return contrastRatio(LIGHT_INK, hex) >= contrastRatio(DARK_INK, hex) ? LIGHT_INK : DARK_INK;
}

/**
 * Warna teks sekunder: diredupkan ke arah latar sejauh mungkin, tetapi
 * berhenti sebelum kontrasnya turun di bawah 3:1. Untuk latar mid-tone yang
 * memang sempit ruangnya, hasilnya nyaris sama dengan warna teks utama.
 */
function dimmed(text: string, bg: string, maxAmount = 0.34, minRatio = 3): string {
  let result = text;
  for (let t = 0.04; t <= maxAmount; t += 0.04) {
    const candidate = blend(text, bg, t);
    if (contrastRatio(candidate, bg) < minRatio) break;
    result = candidate;
  }
  return result;
}

/** Warna teks sekunder yang masih terbaca di atas sebuah latar. */
export function mutedOn(bg: string): string {
  return dimmed(readableOn(bg), bg);
}

/** Menurunkan seluruh palet dari satu warna latar. */
export function derivePalette(bg: string, primary: string): DerivedPalette {
  const safeBg = isHexColor(bg) ? bg.trim() : "#0b1220";
  const safePrimary = isHexColor(primary) ? primary.trim() : "#38bdf8";
  const isDark = luminance(safeBg) < 0.42;
  const text = readableOn(safeBg);

  return {
    bg: safeBg,
    // Permukaan kartu sedikit terangkat dari latar agar tepinya terbaca.
    surface: isDark ? mix(safeBg, 0.08) : mix(safeBg, 0.55),
    text,
    muted: dimmed(text, safeBg),
    border: isDark ? mix(safeBg, 0.18) : mix(safeBg, -0.12),
    onPrimary: readableOn(safePrimary),
    isDark,
  };
}
