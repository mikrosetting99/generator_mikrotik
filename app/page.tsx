import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowRight, Lock, LogIn, Shield, Terminal, User } from "@/components/icons";
import { MenuIcon } from "@/components/MenuIcon";
import { SignOutButton } from "@/components/login-page-hotspot/SignOutButton";
import { TrackedLink } from "@/components/TrackedLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
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

const SAMPLE = [
  { text: "# NAT untuk semua WAN", kind: "comment" },
  { text: "/ip firewall nat", kind: "path" },
  { text: "add chain=srcnat action=masquerade \\", kind: "cmd" },
  { text: "    out-interface-list=WAN", kind: "cmd" },
  { text: "", kind: "blank" },
  { text: "# Tolak akses dari internet ke router", kind: "comment" },
  { text: "/ip firewall filter", kind: "path" },
  { text: "add chain=input action=drop \\", kind: "cmd" },
  { text: "    in-interface-list=WAN", kind: "cmd" },
];

/** Warna ikon aplikasi di beranda (palet ala Odoo); dipilih stabil dari id menu. */
const APP_COLORS = ["#714b67", "#017e84", "#e0902b", "#5b7fa6", "#c4567f", "#4e9f6e", "#8a6fc9", "#d9644a"];
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
    <main className={`o-home relative min-h-screen ${settings.appBgId ? "o-home-photo" : ""}`}>
      {/* Bilah navigasi Odoo Enterprise: transparan di atas menu aplikasi (gayanya dari .o-home di globals.css). */}
      <header className="sticky top-0 z-30">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand/10 text-brand" aria-hidden>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M4 4h4v4H4V4Zm6 0h4v4h-4V4Zm6 0h4v4h-4V4ZM4 10h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4ZM4 16h4v4H4v-4Zm6 0h4v4h-4v-4Zm6 0h4v4h-4v-4Z" />
              </svg>
            </span>
            {settings.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/site-logo?v=${settings.logoVersion}`}
                alt={settings.siteName}
                className="h-8 w-auto max-w-[140px] rounded-sm bg-white/90 object-contain p-0.5"
              />
            )}
            <span className="truncate text-sm font-semibold text-ink">{settings.siteName}</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-raised"
              >
                <Shield className="h-3.5 w-3.5" />
                Dashboard Admin
              </Link>
            )}
            {loggedIn ? (
              <span className="inline-flex min-h-9 items-center gap-1 rounded-md border border-line bg-surface pl-3 pr-1 text-xs text-muted">
                <User className="h-3.5 w-3.5 text-brand" />
                <span className="font-medium text-ink">{username}</span>
                {isAdmin && (
                  <span className="rounded-full border border-line px-1.5 text-[10px] uppercase tracking-wide text-ink">
                    admin
                  </span>
                )}
                <SignOutButton />
              </span>
            ) : (
              <Link
                href="/login"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-raised"
              >
                <LogIn className="h-3.5 w-3.5" />
                Masuk
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[1000px] px-5 pb-12 pt-6 sm:pt-10">
        {/* ----------------------------------------------------- sapaan */}
        <div className="animate-rise text-center">
          <h1 className="text-2xl font-medium leading-tight tracking-tight text-white sm:text-[2rem]">
            {settings.heroTitle} <span className="text-white/80">{settings.heroAccent}</span>
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">{settings.heroText}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/setup"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[color:var(--nav-bg)] shadow-sm transition-all duration-200 hover:bg-white/90 active:scale-[0.98]"
            >
              {settings.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/20 active:scale-[0.98]"
              >
                <WhatsappIcon className="h-4 w-4" />
                {settings.waLabel}
              </a>
            )}
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/60">
            <Lock className="h-3.5 w-3.5" />
            Diproses di browser, tanpa kirim data
          </p>
        </div>

        {/* ------------------------------------------------ menu aplikasi */}
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <div key={section.name || "menu"}>
              {section.name && (
                <h3 className="animate-rise mb-2 px-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">{section.name}</h3>
              )}
              <div className="flex flex-wrap justify-center gap-x-2 gap-y-3">
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
                  const color = appColor(menu.id);
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
                      <span
                        className="o-app-icon relative"
                        style={{ background: `linear-gradient(150deg, color-mix(in srgb, ${color} 82%, #fff), ${color} 55%, color-mix(in srgb, ${color} 72%, #000))` }}
                      >
                        <MenuIcon name={menu.icon} className="h-9 w-9" />
                        {(menu.requireLogin || locked) && (
                          <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[color:var(--nav-bg)] shadow" aria-hidden>
                            <Lock className="h-3 w-3" />
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2 w-full min-w-0 text-[13px] font-medium leading-snug text-white">{menu.title}</span>
                      {(!menu.userVisible || menu.devMode) && (
                        <span className="-mt-1 rounded-full bg-black/25 px-2 py-px text-[10px] font-medium uppercase tracking-wide text-white/80">
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
                    <div key={menu.id} className="animate-card w-[112px] sm:w-[128px]" style={{ "--i": Math.min(order, 14) } as React.CSSProperties}>
                      {tile}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ------------------------------------------- cuplikan & jaminan */}
        {settings.showSample && (
          <div className="animate-rise mt-12 overflow-hidden rounded-lg border border-white/20 bg-surface text-ink shadow-lg">
            <div className="flex items-center gap-3 border-b border-line-soft bg-raised px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                <Terminal className="h-3.5 w-3.5 text-faint" />
                setup-mikrotik-kantor.rsc
              </span>
            </div>
            <pre className="overflow-x-auto bg-code px-4 py-4 font-mono text-[11.5px] leading-[1.75]">
              {SAMPLE.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-4 shrink-0 select-none text-right text-faint/40">{i + 1}</span>
                  <span className={line.kind === "comment" ? "text-faint/80" : line.kind === "path" ? "text-brand" : "text-muted"}>
                    {line.text || " "}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        )}

        {settings.showFeatures && (
          <section className="mt-8 grid gap-6 rounded-lg border border-white/20 bg-surface p-6 text-ink shadow-lg sm:grid-cols-3 sm:p-8">
            {[
              {
                icon: Shield,
                title: "Validasi otomatis",
                body: "Format IP/CIDR, VLAN ID 1–4094, pool yang dirujuk, dan bentrok interface diperiksa sebelum script dibuat.",
              },
              {
                icon: Terminal,
                title: "Script berkomentar",
                body: "Setiap blok perintah diberi penjelasan bahasa Indonesia, plus daftar perintah untuk memverifikasi hasil.",
              },
              {
                icon: Lock,
                title: "Data tidak dikirim",
                body: "Seluruh proses generate berjalan di browser. IP, password, dan konfigurasi tidak pernah meninggalkan perangkat Anda.",
              },
            ].map((item) => {
              const Glyph = item.icon;
              return (
                <div key={item.title}>
                  <Glyph className="h-5 w-5 text-brand" />
                  <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
                </div>
              );
            })}
          </section>
        )}

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/20 pt-5 text-xs text-white/65">
          <span>{settings.footerNote}</span>
          <div className="flex items-center gap-3">
            <span>
              {settings.siteName} by{" "}
              <a href="https://mikrosetting.com" target="_blank" rel="noopener noreferrer" className="text-white/85 transition-colors hover:text-white">
                Mikrosetting.com
              </a>
            </span>
            <VersionBadge />
          </div>
        </footer>
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