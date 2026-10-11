import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSiteSettings } from "@/components/admin/AdminSiteSettings";
import { ArrowLeft, ArrowRight, Database, FileText, Shield, Users } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin — Generator Script Mikrotik",
};

export default async function AdminDashboardPage() {
  // Middleware sudah menolak non-admin; dicek lagi di sini sebagai lapis kedua.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  const [settings, users, configs, loginPages] = await Promise.all([
    getSiteSettings(),
    prisma.user.count(),
    prisma.savedConfig.count(),
    prisma.savedLoginPage.count(),
  ]);

  const stats = [
    { label: "Pengguna", value: users, icon: Users },
    { label: "Konfigurasi Setup tersimpan", value: configs, icon: Database },
    { label: "Desain login hotspot tersimpan", value: loginPages, icon: FileText },
  ];

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Beranda</span>
            </Link>
            <span className="h-5 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2">
              <Shield className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Dashboard Admin</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-5 px-5 py-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((item) => {
            const Glyph = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-line bg-surface p-4">
                <Glyph className="h-4 w-4 text-brand" />
                <p className="mt-3 text-2xl font-semibold text-ink">{item.value}</p>
                <p className="mt-0.5 text-xs text-muted">{item.label}</p>
              </div>
            );
          })}
        </div>

        <Link
          href="/admin/users"
          className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand/50"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
              <Users className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-ink">Kelola Pengguna</span>
              <span className="block text-xs text-muted">Tambah akun dan lihat daftar pengguna.</span>
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>

        <AdminSiteSettings initial={settings} />
      </div>
    </main>
  );
}
