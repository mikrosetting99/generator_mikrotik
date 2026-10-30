import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowRight, Lock, LogIn, Shield, User } from "@/components/icons";
import { MenuIcon } from "@/components/MenuIcon";
import { SignOutButton } from "@/components/login-page-hotspot/SignOutButton";
import { TrackedLink } from "@/components/TrackedLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authOptions } from "@/lib/auth";
import { isExternalHref, waLink } from "@/lib/site-settings";
import { getMenuUsage, getSiteSettings } from "@/lib/site-settings-server";

/** Logo WhatsApp (glyph sederhana, mengikuti warna teks). */
function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.45 15.07L2 22l5.06-1.55A9.9 9.9 0 1 0 12.04 2Zm0 18.1c-1.5 0-2.9-.42-4.1-1.15l-.3-.18-3 .92.96-2.92-.2-.31a8.1 8.1 0 1 1 6.64 3.64Zm4.45-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06a6.6 6.6 0 0 1-1.94-1.2 7.3 7.3 0 0 1-1.34-1.67c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.1 3.64.58.25 1.03.4 1.38.5.58.18 1.1.16 1.52.1.46-.07 1.43-.58 1.63-1.15.2-.57.2-1.05.14-1.15-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

/** Warna ikon aplikasi di beranda (palet ala Odoo); dipilih stabil dari id menu. */
const APP_COLORS = ["#71639e", "#0180a5", "#e0902b", "#5b7fa6", "#c4567f", "#4e9f6e", "#8a6fc9", "#d9644a"];
function appColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return APP_COLORS[h % APP_COLORS.length];
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, session, usage] = await Promise.all([
    getSiteSettings(),
    getServerSession(authOptions),
    getMenuUsage(),
  ]);
  // Menu yang dimatikan untuk user hanya tampil bagi admin.
  const isAdminViewer = session?.user?.role === "ADMIN";
  const menus = settings.menus.filter((m) => m.visible && (m.userVisible || isAdminViewer));
  // Kelompokkan menu sesuai grup; yang tidak punya grup masuk "Lainnya"
  // (atau tanpa judul bila memang tidak ada grup sama sekali).
  const sections = [
    ...settings.groups.map((name) => ({ name, menus: menus.filter((m) => m.group === name) })),
    {
      name: settings.groups.length > 0 ? "Lainnya" : "",
      menus: menus.filter((m) => !settings.groups.includes(m.group)),
    },
  ].filter((s) => s.menus.length > 0);
  // Penghitung urutan kartu menu (untuk animasi muncul bertahap).
  let cardOrder = 0;
  const isAdmin = session?.user?.role === "ADMIN";
  const loggedIn = Boolean(session?.user);
  const username = session?.user?.username ?? session?.user?.name ?? "";
  const waUrl = settings.waEnabled ? waLink(settings.waNumber, settings.waMessage) : "";

  return (
    <main className="o-launcher-page relative">
      {/* Bilah navigasi ungu seperti wyn (gayanya dari header.sticky di globals.css). */}
      <header className="sticky top-0 z-30">
        <div className="flex min-h-[46px] w-full flex-wrap items-center justify-between gap-3 px-3 lg:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-white/15 text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
              </svg>
            </span>
            {settings.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/site-logo?v=${settings.logoVersion}`}
                alt={settings.siteName}
                className="h-7 w-auto max-w-[140px] rounded-sm bg-white/90 object-contain p-0.5"
              />
            )}
            <span className="truncate text-[1.1rem] text-ink">{settings.siteName}</span>
          </Link>
          <div className="flex items-center gap-2 py-1.5">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex min-h-8 items-center gap-1.5 rounded border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-raised"
              >
                <Shield className="h-3.5 w-3.5" />
                Dashboard Admin
              </Link>
            )}
            {loggedIn ? (
              <span className="inline-flex min-h-8 items-center gap-1 rounded border border-line bg-surface pl-3 pr-1 text-xs text-muted">
                <User className="h-3.5 w-3.5 text-brand" />
                <span className="font-medium text-ink">{username}</span>
                {isAdmin && (
                  <span className="rounded-full border border-line px-1.5 text-[10px] uppercase tracking-wide text-ink">admin</span>
                )}
                <SignOutButton />
              </span>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-8 items-center gap-1.5 rounded border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-raised"
              >
                <LogIn className="h-3.5 w-3.5" />
                Masuk
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="o-launcher">
        {/* ----------------------------------------------------- sapaan */}
        <div className="animate-rise mb-9 text-center">
          <h1 className="mb-1 text-[1.35rem] font-semibold text-ink">
            {settings.heroTitle} <span className="text-brand">{settings.heroAccent}</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-muted">{settings.heroText}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/setup"
              className="inline-flex min-h-9 items-center gap-2 rounded border border-brand bg-brand px-4 text-sm font-medium text-[color:var(--color-brand-ink)] transition-colors hover:brightness-90"
            >
              {settings.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-2 rounded border border-[#25D366]/50 bg-[#25D366]/10 px-4 text-sm font-medium text-[#128c4a] transition-colors hover:bg-[#25D366]/20"
              >
                <WhatsappIcon className="h-4 w-4" />
                {settings.waLabel}
              </a>
            )}
          </div>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-faint">
            <Lock className="h-3.5 w-3.5" />
            Diproses di browser, tanpa kirim data
          </p>
        </div>

        {/* ------------------------------------------------ menu aplikasi */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.name || "menu"}>
              <div className="o-launcher-grid">
                {section.menus.map((menu) => {
                  // Urutan tile di seluruh grup: dipakai sebagai jeda animasi muncul bertahap.
                  const order = cardOrder++;
                  const external = isExternalHref(menu.href);
                  // Menu pengembangan hanya bisa dibuka admin; yang lain melihat tile nonaktif.
                  const locked = menu.devMode && !isAdmin;
                  // Menu yang wajib login mengarahkan tamu ke halaman login dulu.
                  const href =
                    menu.requireLogin && !loggedIn
                      ? `/login?callbackUrl=${encodeURIComponent(external ? "/" : menu.href)}`
                      : menu.href;
                  const note = [
                    menu.description,
                    `${(usage[menu.id] ?? 0).toLocaleString("id-ID")}× dipakai`,
                    menu.requireLogin ? "perlu login" : "",
                    !menu.userVisible ? "disembunyikan dari user" : "",
                    menu.devMode ? (locked ? "dalam pengembangan" : "pengembangan · hanya admin") : "",
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  const body = (
                    <>
                      <span className="o-app-icon relative" style={{ "--app-color": appColor(menu.id) } as React.CSSProperties}>
                        <MenuIcon name={menu.icon} className="h-8 w-8" />
                        {(menu.requireLogin || locked) && (
                          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm" aria-hidden>
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 w-full min-w-0 text-sm font-medium leading-tight text-ink">{menu.title}</span>
                      {(!menu.userVisible || menu.devMode) && (
                        <span className="-mt-1 rounded-full bg-raised px-2 py-px text-[10px] font-medium uppercase tracking-wide text-muted">
                          {menu.devMode ? (locked ? "dev" : "dev · admin") : "admin"}
                        </span>
                      )}
                    </>
                  );

                  const props = {
                    href,
                    title: note,
                    className: "o-app-tile",
                    ...(external && href === menu.href ? { target: "_blank", rel: "noopener noreferrer" } : {}),
                  };
                  const tile = locked ? (
                    <div className="o-app-tile opacity-60" title={note}>
                      {body}
                    </div>
                  ) : menu.builtin ? (
                    // Menu bawaan dihitung di halamannya sendiri; menu tambahan dihitung saat diklik.
                    <Link {...props}>{body}</Link>
                  ) : (
                    <TrackedLink menuId={menu.id} {...props}>
                      {body}
                    </TrackedLink>
                  );

                  return (
                    <div key={menu.id} className="animate-card w-full" style={{ "--i": Math.min(order, 14) } as React.CSSProperties}>
                      {tile}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {waUrl && settings.waFloating && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={settings.waLabel}
          title={settings.waLabel}
          className="fixed bottom-5 right-5 z-40 grid h-13 w-13 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.7)] transition-transform hover:scale-105 active:scale-95"
          style={{ width: 52, height: 52 }}
        >
          <WhatsappIcon className="h-6 w-6" />
        </a>
      )}
    </main>
  );
}
