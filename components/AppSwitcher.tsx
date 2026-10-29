import Link from "next/link";

/**
 * Pengalih aplikasi ala Odoo: ikon grid di kiri bilah atas yang membawa ke peluncur
 * (daftar semua aplikasi). Dipakai di header setiap aplikasi/modul.
 */
export function AppSwitcher() {
  return (
    <Link
      href="/"
      aria-label="Semua aplikasi"
      title="Semua aplikasi"
      className="grid h-8 w-8 shrink-0 place-items-center rounded bg-brand/10 text-brand transition-colors hover:bg-brand/20"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
        <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
      </svg>
    </Link>
  );
}