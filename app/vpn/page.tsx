import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowLeft, Lock } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VpnAdmin } from "@/components/vpn/VpnAdmin";
import { VersionBadge } from "@/components/VersionBadge";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Script VPN & Mikhmon Online",
};

export default async function VpnPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";

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
              <Lock className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Script VPN & Mikhmon Online</h1>
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
          <VpnAdmin />
        ) : (
          <section className="mx-auto max-w-lg overflow-hidden rounded-md border border-line bg-surface shadow-sm">
            <div className="border-b border-line bg-raised px-5 py-3">
              <h2 className="text-sm font-bold text-ink">Script VPN & Mikhmon Online</h2>
            </div>
            <div className="space-y-3 p-5 text-sm leading-relaxed text-muted">
              <p>
                Script Anda dikirim admin lewat sebuah <b className="font-semibold text-ink">link pribadi</b>. Buka link
                itu, lalu masukkan nomor HP Anda untuk melihat username, password, dan script yang tinggal disalin.
              </p>
              <p>Belum menerima link? Hubungi admin.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}