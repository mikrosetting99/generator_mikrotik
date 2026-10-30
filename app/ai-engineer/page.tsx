import type { Metadata } from "next";
import { AppSwitcher } from "@/components/AppSwitcher";
import { AiEngineer } from "@/components/ai-engineer/AiEngineer";
import { Wand } from "@/components/icons";
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
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-0">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AppSwitcher />
            <div className="flex min-w-0 items-center gap-2">
              <Wand className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">AI Mikrotik Engineer</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
            <nav id="ai-nav-slot" aria-label="Menu AI Mikrotik Engineer" className="ml-2 flex min-w-0 flex-1 items-center self-stretch overflow-x-auto" />
          </div>
          <ThemeToggle />
        </div>
      </header>

      <AiEngineer />
    </main>
  );
}