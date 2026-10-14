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

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, session, usage] = await Promise.all([
    getSiteSettings(),
    getServerSession(authOptions),
    getMenuUsage(),
  ]);
  const menus = settings.menus.filter((m) => m.visible);
  // Kelompokkan menu sesuai grup; yang tidak punya grup masuk "Lainnya"
  // (atau tanpa judul bila memang tidak ada grup sama sekali).
  const sections = [
    ...settings.groups.map((name) => ({ name, menus: menus.filter((m) => m.group === name) })),
    {
      name: settings.groups.length > 0 ? "Lainnya" : "",
      menus: menus.filter((m) => !settings.groups.includes(m.group)),
    },
  ].filter((s) => s.menus.length > 0);
  const isAdmin = session?.user?.role === "ADMIN";
  const loggedIn = Boolean(session?.user);
  const username = session?.user?.username ?? session?.user?.name ?? "";
  const waUrl = settings.waEnabled ? waLink(settings.waNumber, settings.waMessage) : "";

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Cahaya ambien di belakang hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 0%, rgba(56,189,248,0.16), transparent 70%), radial-gradient(45% 55% at 78% 8%, rgba(34,197,94,0.12), transparent 70%)",
        }}
      />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[560px]" />

      <div className="relative mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {settings.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/site-logo?v=${settings.logoVersion}`}
                alt={settings.siteName}
                className="h-9 w-auto max-w-[140px] object-contain"
              />
            )}
            <span className="truncate text-sm font-semibold text-ink">{settings.siteName}</span>
          </Link>
          <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-ink"
            >
              <Shield className="h-3.5 w-3.5" />
              Dashboard Admin
            </Link>
          )}
          {loggedIn ? (
            <span className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line bg-surface pl-3 pr-1 text-xs text-muted">
              <User className="h-3.5 w-3.5 text-brand" />
              <span className="font-medium text-ink">{username}</span>
              {isAdmin && (
                <span className="rounded-full border border-brand/30 bg-brand/10 px-1.5 text-[10px] uppercase tracking-wide text-brand">
                  admin
                </span>
              )}
              <SignOutButton />
            </span>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-ink"
            >
              <LogIn className="h-3.5 w-3.5" />
              Masuk
            </Link>
          )}
          <ThemeToggle />
          </div>
        </div>

        {/* ---------------------------------------------------------- hero */}
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <header className="animate-rise">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[3.25rem]">
              {settings.heroTitle}
              <span className="block text-brand">{settings.heroAccent}</span>
            </h1>
            <p className="mt-2.5 text-sm text-faint">
              by{" "}
              <a
                href="https://mikrosetting.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline decoration-line underline-offset-4 transition-colors hover:text-brand hover:decoration-brand/50"
              >
                Mikrosetting.com
              </a>
            </p>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              {settings.heroText}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/setup"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-[color:var(--color-accent-ink)] shadow-[0_14px_40px_-16px_rgba(34,197,94,0.85)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                {settings.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#25D366]/50 bg-[#25D366]/10 px-5 text-sm font-semibold text-[#25D366] transition-all duration-200 hover:bg-[#25D366]/20 active:scale-[0.98]"
                >
                  <WhatsappIcon className="h-4 w-4" />
                  {settings.waLabel}
                </a>
              )}
              <span className="inline-flex items-center gap-2 text-xs text-faint">
                <Lock className="h-3.5 w-3.5" />
                Diproses di browser, tanpa kirim data
              </span>
            </div>
          </header>

          {/* Cuplikan hasil */}
          {settings.showSample && (
          <div className="animate-rise edge-light overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-50px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b border-line-soft bg-canvas/60 px-4 py-2.5">
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
                  <span
                    className={
                      line.kind === "comment"
                        ? "text-faint/80"
                        : line.kind === "path"
                          ? "text-brand"
                          : "text-muted"
                    }
                  >
                    {line.text || " "}
                  </span>
                </div>
              ))}
            </pre>
          </div>
          )}
        </div>

        {/* --------------------------------------------------------- menu */}
        <h2 className="mt-20 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Pilih menu
        </h2>
        <div className="mt-5 space-y-7">
          {sections.map((section) => (
            <div key={section.name || "menu"}>
              {section.name && (
                <h3 className="mb-3 text-xs font-semibold text-muted">{section.name}</h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {section.menus.map((menu) => {
            const external = isExternalHref(menu.href);
            // Menu pengembangan hanya bisa dibuka admin; yang lain melihat kartu nonaktif.
            const locked = menu.devMode && !isAdmin;
            // Menu yang wajib login mengarahkan tamu ke halaman login dulu.
            const href =
              menu.requireLogin && !loggedIn
                ? `/login?callbackUrl=${encodeURIComponent(external ? "/" : menu.href)}`
                : menu.href;

            const body = (
              <>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand transition-colors group-hover:border-brand/50">
                  <MenuIcon name={menu.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{menu.title}</span>
                    {locked ? (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-faint" />
                    ) : (
                      <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" />
                    )}
                  </span>
                  {menu.description && (
                    <span className="mt-1 block text-xs leading-relaxed text-muted">
                      {menu.description}
                    </span>
                  )}
                  <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-[10px] text-faint">
                      {(usage[menu.id] ?? 0).toLocaleString("id-ID")}× dipakai
                    </span>
                    {menu.requireLogin && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          loggedIn
                            ? "border-line text-faint"
                            : "border-brand/40 bg-brand/10 text-brand"
                        }`}
                        title={loggedIn ? "Menu ini perlu login — Anda sudah masuk" : "Menu ini perlu login"}
                      >
                        <Lock className="h-2.5 w-2.5" />
                        perlu login
                      </span>
                    )}
                  </span>
                  {menu.devMode && (
                    <span className="mt-1.5 inline-block rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn">
                      {locked ? "dalam pengembangan" : "pengembangan · hanya admin"}
                    </span>
                  )}
                </span>
              </>
            );

            const cardClass =
              "edge-light group flex items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 transition-all duration-200";

            return locked ? (
              <div key={menu.id} className={`${cardClass} opacity-60`}>
                {body}
              </div>
            ) : (
              (() => {
                const props = {
                  href,
                  className: `${cardClass} hover:-translate-y-0.5 hover:border-brand/50`,
                  ...(external && href === menu.href
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {}),
                };
                // Menu bawaan dihitung di halamannya sendiri; menu tambahan dihitung saat diklik.
                return menu.builtin ? (
                  <Link key={menu.id} {...props}>
                    {body}
                  </Link>
                ) : (
                  <TrackedLink key={menu.id} menuId={menu.id} {...props}>
                    {body}
                  </TrackedLink>
                );
              })()
            );
          })}
              </div>
            </div>
          ))}
        </div>
        {/* ------------------------------------------------------ jaminan */}
        {settings.showFeatures && (
        <section className="mt-16 grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3 sm:p-8">
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

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-6 text-xs text-faint">
          <span>{settings.footerNote}</span>
          <div className="flex items-center gap-3">
            <span>
              {settings.siteName} by{" "}
              <a
                href="https://mikrosetting.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted transition-colors hover:text-brand"
              >
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
