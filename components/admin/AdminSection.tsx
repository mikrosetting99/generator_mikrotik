import type { ReactNode } from "react";
import { ChevronDown } from "@/components/icons";

/** Bagian dashboard yang bisa dibuka-tutup (dropdown), supaya halaman tidak panjang. */
export function AdminSection({
  title,
  description,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group overflow-hidden rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-raised/40 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {badge}
          <ChevronDown className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180" />
        </span>
      </summary>
      <div className="border-t border-line-soft">{children}</div>
    </details>
  );
}