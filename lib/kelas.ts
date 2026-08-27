/**
 * Helper kelas CSS yang netral — bukan komponen, jadi tidak ikut "use client".
 *
 * Sebelumnya keduanya tinggal di components/ui.tsx. Berkas itu bertanda
 * "use client", dan memanggil fungsi dari sana di dalam server component
 * membuat build gagal dengan pesan yang tidak menyebut penyebabnya. Ditaruh di
 * sini supaya server maupun klien sama-sama boleh memakainya.
 */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const controlBase =
  "w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow,background-color] duration-200 " +
  "placeholder:text-faint/70 hover:border-line/80 " +
  "focus:border-brand focus:shadow-[0_0_0_3px_rgba(56,189,248,0.14)] focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";
