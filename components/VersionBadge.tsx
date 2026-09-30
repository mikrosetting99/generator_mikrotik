import Link from "next/link";
import { APP_VERSION } from "@/lib/changelog";

export function VersionBadge({ className }: { className?: string }) {
  return (
    <Link
      href="/changelog"
      title="Lihat riwayat perubahan"
      className={
        "inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-faint " +
        "transition-colors hover:border-brand/40 hover:text-brand " +
        (className ?? "")
      }
    >
      v{APP_VERSION}
    </Link>
  );
}
