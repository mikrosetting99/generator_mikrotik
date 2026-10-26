import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminTemplates } from "@/components/admin/AdminTemplates";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminBackgrounds } from "@/components/admin/AdminBackgrounds";
import { AdminSiteSettings } from "@/components/admin/AdminSiteSettings";
import { ArrowLeft, ArrowRight, Database, FileText, Shield, Users } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { APP_VERSION, CHANGE_TYPE_LABEL, CHANGELOG } from "@/lib/changelog";
import { getMenuUsage, getSiteSettings } from "@/lib/site-settings-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin",
};

export default async function AdminDashboardPage() {
  // Middleware sudah menolak non-admin; dicek lagi di sini sebagai lapis kedua.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  const [settings, usage, users, configs, loginPages] = await Promise.all([
    getSiteSettings(),
    getMenuUsage(),
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
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 lg:px-8 py-3">
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

      <div className="w-full space-y-5 px-5 lg:px-8 py-6">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((item) => {
            const Glyph = item.icon;
            return (
              <div key={item.label} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xl font-semibold text-ink">{item.value}</p>
                  <Glyph className="h-4 w-4 text-brand" />
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-muted">{item.label}</p>
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

        <AdminSiteSettings initial={settings} usage={usage} />

        <AdminTemplates />
        <AdminBackgrounds kind="logo" />
        <AdminBackgrounds kind="background" />

        <AdminSection
          title="Versi aplikasi & changelog"
          description="Mengikuti entri teratas di lib/changelog.ts."
          badge={
            <span className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-medium text-brand">
              v{APP_VERSION}
            </span>
          }
        >
          <div className="space-y-5 px-5 py-4">
            {CHANGELOG.slice(0, 2).map((release) => (
              <div key={release.version}>
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">v{release.version}</span>
                  <span className="text-sm text-ink">{release.title}</span>
                  <span className="font-mono text-[11px] text-faint">{release.date}</span>
                </p>
                <div className="mt-2 space-y-2">
                  {release.changes.map((group) => (
                    <div key={group.type}>
                      <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                        {CHANGE_TYPE_LABEL[group.type]}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {group.items.map((item) => (
                          <li key={item} className="flex gap-2 text-xs leading-relaxed text-muted">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Link
              href="/changelog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            >
              Lihat seluruh changelog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AdminSection>
      </div>
    </main>
  );
}
