import Link from "next/link";
import type { ReactNode } from "react";
import { Cpu, Database, FileText, Lock, Shield, Terminal, Users, Wand } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";

export const ADMIN_NAV = [
  { id: "ringkasan", label: "Ringkasan", href: "/admin", icon: Shield },
  { id: "situs", label: "Situs & Menu", href: "/admin?tab=situs", icon: Cpu },
  { id: "tema", label: "Tema & Tampilan", href: "/admin?tab=tema", icon: Wand },
  { id: "template", label: "Template Login", href: "/admin?tab=template", icon: FileText },
  { id: "galeri", label: "Galeri Gambar", href: "/admin?tab=galeri", icon: Database },
  { id: "pengguna", label: "Pengguna", href: "/admin/users", icon: Users },
  { id: "vpn", label: "Script VPN & Mikhmon", href: "/vpn", icon: Lock },
  { id: "versi", label: "Versi & Changelog", href: "/admin?tab=versi", icon: Terminal },
] as const;

/** Warna ikon tiap menu pengaturan (palet aplikasi Odoo). */
const NAV_COLORS = ["#714b67", "#017e84", "#e0902b", "#5b7fa6", "#c4567f", "#4e9f6e", "#8a6fc9", "#d9644a"];

export type AdminTab = (typeof ADMIN_NAV)[number]["id"];

/**
 * Kerangka Dashboard Admin ala aplikasi Pengaturan Odoo: bilah ungu di atas,
 * panel kontrol berisi breadcrumb, sidebar menu di kiri, dan isi di kanan.
 */
export function AdminFrame({ active, children }: { active: AdminTab; children: ReactNode }) {
  const current = ADMIN_NAV.find((n) => n.id === active) ?? ADMIN_NAV[0];

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Kembali ke beranda"
              title="Beranda"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand/10 text-brand transition-colors hover:bg-brand/20"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
              </svg>
            </Link>
            <h1 className="truncate text-sm font-semibold text-ink">Dashboard Admin</h1>
            <nav aria-label="Bagian admin" className="ml-2 hidden items-center gap-0.5 xl:flex">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`rounded px-2.5 py-1.5 text-[13px] transition-colors ${item.id === active ? "bg-brand/10 font-semibold text-brand" : "text-muted hover:bg-raised hover:text-ink"}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Panel kontrol: breadcrumb di kiri, aksi cepat di kanan */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 lg:px-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-base">
          <Link href="/admin" className="font-medium text-brand hover:underline">
            Dashboard Admin
          </Link>
          <span className="text-faint">/</span>
          <span className="font-semibold text-ink">{current.label}</span>
        </nav>
        <div className="flex items-center gap-3">
          <VersionBadge />
          <Link
            href="/"
            className="inline-flex min-h-8 items-center rounded-md border border-line px-3 text-xs font-medium text-ink transition-colors hover:border-brand/60 hover:bg-raised hover:text-brand"
          >
            Lihat beranda
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sidebar menu (di layar kecil menjadi deretan tab yang bisa digeser) */}
        <aside className="border-b border-line bg-raised lg:min-h-[calc(100vh-7rem)] lg:border-b-0 lg:border-r">
          <p className="hidden px-4 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint lg:block">Pengaturan</p>
          <nav
            aria-label="Menu admin"
            className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0 lg:overflow-visible lg:p-0 lg:py-2"
          >
            {ADMIN_NAV.map((item, idx) => {
              const Glyph = item.icon;
              const on = item.id === active;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 whitespace-nowrap px-4 py-2 text-sm transition-colors lg:border-l-[3px] ${
                    on
                      ? "bg-surface font-semibold text-ink shadow-[inset_0_0_0_1px_var(--color-line-soft)] lg:border-brand"
                      : "text-muted hover:bg-surface hover:text-ink lg:border-transparent"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white" style={{ background: NAV_COLORS[idx % NAV_COLORS.length] }}>
                    <Glyph className="h-4 w-4" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 px-4 py-5 lg:px-8">{children}</div>
      </div>
    </main>
  );
}