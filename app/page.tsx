import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Lock, Shield, Terminal } from "@/components/icons";
import { MenuIcon } from "@/components/MenuIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { authOptions } from "@/lib/auth";
import { isExternalHref } from "@/lib/site-settings";
import { getSiteSettings } from "@/lib/site-settings-server";

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
  const [settings, session] = await Promise.all([getSiteSettings(), getServerSession(authOptions)]);
  if (settings.homeRequiresLogin && !session?.user) redirect("/login?callbackUrl=%2F");

  const menus = settings.menus.filter((m) => m.visible);
  const isAdmin = session?.user?.role === "ADMIN";
  const loggedIn = Boolean(session?.user);

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
        <div className="mb-6 flex items-center justify-end gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium text-muted transition-colors hover:border-brand/50 hover:text-ink"
            >
              <Shield className="h-3.5 w-3.5" />
              Dashboard Admin
            </Link>
          )}
          <ThemeToggle />
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
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {menus.map((menu) => {
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
                  {menu.devMode && (
                    <span className="mt-2 inline-block rounded-full border border-warn/40 bg-warn/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-warn">
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
              <Link
                key={menu.id}
                href={href}
                {...(external && href === menu.href
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className={`${cardClass} hover:-translate-y-0.5 hover:border-brand/50`}
              >
                {body}
              </Link>
            );
          })}
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
              Generator Script Mikrotik by{" "}
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
    </main>
  );
}
