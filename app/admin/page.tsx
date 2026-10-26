import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminBackgrounds } from "@/components/admin/AdminBackgrounds";
import { AdminFrame, type AdminTab } from "@/components/admin/AdminFrame";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminSiteSettings } from "@/components/admin/AdminSiteSettings";
import { AdminTemplates } from "@/components/admin/AdminTemplates";
import { ArrowRight, Database, FileText, Users } from "@/components/icons";
import { authOptions } from "@/lib/auth";
import { APP_VERSION, CHANGE_TYPE_LABEL, CHANGELOG } from "@/lib/changelog";
import { prisma } from "@/lib/prisma";
import { getMenuUsage, getSiteSettings } from "@/lib/site-settings-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard Admin",
};

const TABS: AdminTab[] = ["ringkasan", "situs", "tema", "template", "galeri", "versi"];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Middleware sudah menolak non-admin; dicek lagi di sini sebagai lapis kedua.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t === rawTab) ?? "ringkasan";

  const [settings, usage, users, configs, loginPages] = await Promise.all([
    getSiteSettings(),
    getMenuUsage(),
    prisma.user.count(),
    prisma.savedConfig.count(),
    prisma.savedLoginPage.count(),
  ]);

  const stats = [
    { label: "Pengguna", value: users, icon: Users, color: "#714b67" },
    { label: "Konfigurasi Setup tersimpan", value: configs, icon: Database, color: "#017e84" },
    { label: "Desain login hotspot tersimpan", value: loginPages, icon: FileText, color: "#e0902b" },
  ];

  const ranked = [...settings.menus].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0));
  const maxUsage = Math.max(1, ...ranked.map((m) => usage[m.id] ?? 0));

  return (
    <AdminFrame active={tab}>
      {tab === "ringkasan" && (
        <>
          <AdminSection title="Ringkasan" description="Gambaran singkat isi dan pemakaian aplikasi.">
            <div className="grid gap-4 p-5 sm:grid-cols-3">
              {stats.map((item) => {
                const Glyph = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-4 rounded-md border border-line bg-surface p-4">
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-md text-white"
                      style={{ background: item.color }}
                    >
                      <Glyph className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-2xl font-semibold leading-none text-ink">{item.value}</p>
                      <p className="mt-1 text-xs leading-tight text-muted">{item.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </AdminSection>

          <AdminSection title="Pemakaian menu" description="Berapa kali tiap menu dibuka.">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-raised/60 text-[11px] uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Menu</th>
                  <th className="px-5 py-2.5 font-semibold">Grup</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Dipakai</th>
                  <th className="hidden w-1/3 px-5 py-2.5 sm:table-cell" />
                </tr>
              </thead>
              <tbody>
                {ranked.map((menu) => {
                  const count = usage[menu.id] ?? 0;
                  return (
                    <tr key={menu.id} className="border-b border-line-soft last:border-0 hover:bg-brand/[0.05]">
                      <td className="px-5 py-2.5 font-medium text-ink">{menu.title}</td>
                      <td className="px-5 py-2.5 text-muted">{menu.group || "—"}</td>
                      <td className="px-5 py-2.5 text-right font-mono text-ink">{count.toLocaleString("id-ID")}×</td>
                      <td className="hidden px-5 py-2.5 sm:table-cell">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-line-soft">
                          <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${(count / maxUsage) * 100}%` }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </AdminSection>

          <AdminSection title="Pintasan">
            <ul className="divide-y divide-line-soft">
              {[
                { href: "/admin/users", title: "Kelola Pengguna", body: "Tambah akun dan lihat daftar pengguna." },
                { href: "/admin?tab=situs", title: "Situs & Menu", body: "Logo, WhatsApp, teks beranda, serta tampil/sembunyi menu untuk user." },
                { href: "/admin?tab=tema", title: "Tema & Tampilan", body: "Warna tema aplikasi dan background aplikasi." },
                { href: "/admin?tab=template", title: "Template Login", body: "Template halaman login hotspot untuk semua pengguna." },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-brand/[0.05]"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-ink">{item.title}</span>
                      <span className="block text-xs text-muted">{item.body}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                  </Link>
                </li>
              ))}
            </ul>
          </AdminSection>
        </>
      )}

      {tab === "situs" && <AdminSiteSettings initial={settings} usage={usage} view="situs" />}
      {tab === "tema" && <AdminSiteSettings initial={settings} usage={usage} view="tema" />}

      {tab === "template" && <AdminTemplates />}

      {tab === "galeri" && (
        <>
          <AdminBackgrounds kind="logo" />
          <AdminBackgrounds kind="background" />
        </>
      )}

      {tab === "versi" && (
        <AdminSection
          title="Versi aplikasi & changelog"
          description="Mengikuti entri teratas di lib/changelog.ts."
          badge={
            <span className="rounded-md border border-brand/30 bg-brand/10 px-2.5 py-0.5 font-mono text-xs font-medium text-brand">
              v{APP_VERSION}
            </span>
          }
        >
          <div className="space-y-5 px-5 py-4">
            {CHANGELOG.slice(0, 3).map((release) => (
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
            <Link href="/changelog" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
              Lihat seluruh changelog
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </AdminSection>
      )}
    </AdminFrame>
  );
}