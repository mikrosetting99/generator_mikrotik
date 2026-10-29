import type { Metadata } from "next";
import Link from "next/link";
import { AiEngineer } from "@/components/ai-engineer/AiEngineer";
import { ArrowLeft, Wand } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Mikrotik Engineer",
};

export default function AiEngineerPage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>
            <span className="h-5 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2">
              <Wand className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">AI Mikrotik Engineer</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full px-5 py-5 lg:px-8">
        <AiEngineer />
      </div>
    </main>
  );
}