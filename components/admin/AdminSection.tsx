import type { ReactNode } from "react";

/**
 * Blok pengaturan ala Odoo: kepala abu-abu berisi judul tebal (dan keterangan),
 * lalu isi di atas permukaan putih. Tidak lagi bisa dibuka-tutup — tiap bagian
 * punya halaman/tab sendiri di sidebar Dashboard Admin.
 */
export function AdminSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  /** Dipertahankan agar pemanggil lama tetap valid; blok selalu terbuka. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-md border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-raised px-5 py-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {badge}
      </div>
      <div>{children}</div>
    </section>
  );
}