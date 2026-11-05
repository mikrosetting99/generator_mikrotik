import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { AppSwitcher } from "@/components/AppSwitcher";
import { Shield } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { VpnRadiusTabs } from "@/components/vpn/VpnRadiusTabs";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manajemen VPN",
};

export default async function VpnRadiusPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <AppSwitcher />
            <div className="flex min-w-0 items-center gap-2">
              <Shield className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Manajemen VPN</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full px-5 py-6 lg:px-8">
        {isAdmin ? (
          <VpnRadiusTabs />
        ) : (
          <section className="mx-auto max-w-lg overflow-hidden rounded-md border border-line bg-surface shadow-sm">
            <div className="border-b border-line bg-raised px-5 py-3">
              <h2 className="text-sm font-bold text-ink">Manajemen VPN</h2>
            </div>
            <p className="p-5 text-sm leading-relaxed text-muted">Akun VPN saat ini didaftarkan oleh admin. Hubungi admin untuk membuat atau memperpanjang akun.</p>
          </section>
        )}
      </div>
    </main>
  );
}
