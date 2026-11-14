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
import { getMenuUsage, getSiteSettings, getUsageStats } from "@/lib/site-settings-server";
import { shortDate } from "@/lib/usage-stats";
import { DailyBars, Sparkline } from "@/components/admin/UsageCharts";

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

  const [settings, usage, trend, users, configs, loginPages] = await Promise.all([
    getSiteSettings(),
    getMenuUsage(),
    getUsageStats(),
    prisma.user.count(),
    prisma.savedConfig.count(),
    prisma.savedLoginPage.count(),
  ]);

  const stats = [
    { label: "Pengguna", value: users, icon: Users, color: "#714b67" },
    { label: "Konfigurasi Setup tersimpan", value: configs, icon: Database, color: "#017e84" },
    { label: "Desain login hotspot tersimpan", value: loginPages, icon: FileText, color: "#e0902b" },
  ];

  // urut menurut 30 hari terakhir, lalu total sepanjang masa
  const d30 = (id: string) => trend.perMenu[id]?.d30 ?? 0;
  const ranked = [...settings.menus].sort((a, b) => d30(b.id) - d30(a.id) || (usage[b.id] ?? 0) - (usage[a.id] ?? 0));
  const allTime = Object.values(usage).reduce((n, v) => n + v, 0);
  const usageTiles = [
    { label: "Hari ini", value: trend.today },
    { label: "7 hari terakhir", value: trend.d7 },
    { label: "30 hari terakhir", value: trend.d30 },
    { label: "Sepanjang masa", value: allTime },
  ];
  const activeModules = settings.menus.filter((m) => d30(m.id) > 0).length;

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

          <AdminSection
            title="Pemakaian modul"
            description="Berapa kali tiap modul dibuka (satu browser dihitung paling banyak sekali per 30 menit per modul; tanpa data pribadi). Tanggal memakai WIB."
          >
            <div className="grid grid-cols-2 gap-3 p-5 pb-0 lg:grid-cols-4">
              {usageTiles.map((t) => (
                <div key={t.label} className="rounded-md border border-line bg-surface px-4 py-3">
                  <p className="text-2xl font-semibold leading-none text-ink">{t.value.toLocaleString("id-ID")}×</p>
                  <p className="mt-1 text-xs text-muted">{t.label}</p>
                </div>
              ))}
            </div>

            <div className="px-5 pb-2 pt-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">Total modul dibuka per hari</p>
                <p className="text-xs text-muted">
                  30 hari terakhir · {activeModules} modul dipakai
                </p>
              </div>
              <DailyBars days={trend.days} values={trend.totals} label="Total modul dibuka per hari, 30 hari terakhir" />
              <p className="mt-1 text-[11px] text-faint">
                {trend.since
                  ? `Data harian tercatat sejak ${shortDate(trend.since)}; kolom Total menghitung sejak awal.`
                  : "Data harian mulai tercatat setelah update ini; kolom Total berisi hitungan sejak awal."}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-line bg-raised/60 text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Modul</th>
                    <th className="px-3 py-2.5 font-semibold">Grup</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Hari ini</th>
                    <th className="px-3 py-2.5 text-right font-semibold">7 hari</th>
                    <th className="px-3 py-2.5 text-right font-semibold">30 hari</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-5 py-2.5 font-semibold">Tren 30 hari</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((menu) => {
                    const t = trend.perMenu[menu.id];
                    const num = (n: number) => (n ? n.toLocaleString("id-ID") : <span className="text-faint">0</span>);
                    return (
                      <tr key={menu.id} className="border-b border-line-soft last:border-0 hover:bg-brand/[0.05]">
                        <td className="px-5 py-2.5 font-medium text-ink">
                          {menu.title}
                          {!menu.visible && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-faint">disembunyikan</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted">{menu.group || "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-ink">{num(t?.today ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-ink">{num(t?.d7 ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">{num(t?.d30 ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-muted">{(usage[menu.id] ?? 0).toLocaleString("id-ID")}</td>
                        <td className="px-5 py-2">
                          <Sparkline values={t?.series ?? []} label={`${menu.title}: ${(t?.d30 ?? 0).toLocaleString("id-ID")}× dalam 30 hari`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AdminSection>

          <AdminSection title="Pintasan">
            <ul className="divide-y divide-line-soft">
              {[
                { href: "/admin/users", title: "Kelola Pengguna", body: "Tambah akun dan lihat daftar pengguna." },
                { href: "/admin?tab=situs", title: "Situs & Aplikasi", body: "Logo, WhatsApp, teks beranda, serta tampil/sembunyi aplikasi untuk user." },
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