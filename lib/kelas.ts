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

/**
 * Kolom isian ala form Odoo: hanya garis bawah, latar transparan; saat fokus garisnya
 * menebal dan berwarna ungu.
 */
export const controlBase =
  "w-full rounded-none border-0 border-b border-line bg-transparent px-1 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow] duration-150 " +
  "placeholder:text-faint/70 hover:border-brand/50 " +
  "focus:border-brand focus:shadow-[0_1px_0_0_var(--color-brand)] focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted";
