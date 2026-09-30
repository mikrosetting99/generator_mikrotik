import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Clock } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_VERSION, CHANGE_TYPE_LABEL, CHANGELOG, type ChangeType } from "@/lib/changelog";

export const metadata: Metadata = {
  title: `Changelog v${APP_VERSION} — Generator Script Mikrotik`,
  description: "Riwayat perubahan Generator Script Mikrotik dari rilis ke rilis.",
};

const TYPE_DOT: Record<ChangeType, string> = {
  added: "bg-accent",
  changed: "bg-brand",
  fixed: "bg-warn",
};

const TYPE_TEXT: Record<ChangeType, string> = {
  added: "text-accent",
  changed: "text-brand",
  fixed: "text-warn",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>
            <span className="h-5 w-px bg-line" />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              <h1 className="text-sm font-semibold text-ink">Changelog</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <p className="text-sm text-muted">
          Riwayat perubahan Generator Script Mikrotik, versi terbaru di paling atas. Versi berjalan
          saat ini: <span className="font-mono text-ink">v{APP_VERSION}</span>.
        </p>

        <ol className="mt-8 space-y-8 border-l border-line-soft pl-6">
          {CHANGELOG.map((release) => (
            <li key={release.version} className="relative">
              <span
                aria-hidden
                className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-brand"
              />
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="font-mono text-sm font-semibold text-ink">v{release.version}</span>
                <span className="font-mono text-xs text-faint">{release.date}</span>
              </div>
              <h2 className="mt-0.5 text-sm text-muted">{release.title}</h2>

              <div className="mt-3 space-y-3">
                {release.changes.map((group) => (
                  <div key={group.type}>
                    <span
                      className={`text-[11px] font-medium uppercase tracking-[0.08em] ${TYPE_TEXT[group.type]}`}
                    >
                      {CHANGE_TYPE_LABEL[group.type]}
                    </span>
                    <ul className="mt-1.5 space-y-1.5">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                          <span
                            aria-hidden
                            className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${TYPE_DOT[group.type]}`}
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
