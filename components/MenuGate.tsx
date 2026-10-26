import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Lock } from "@/components/icons";
import { MenuHit } from "@/components/MenuHit";
import { authOptions } from "@/lib/auth";
import { getSiteSettings } from "@/lib/site-settings-server";

/**
 * Penjaga halaman sebuah menu bawaan, mengikuti pengaturan di /admin:
 * wajib login → dialihkan ke /login; mode pengembangan → hanya admin yang lolos.
 */
export async function MenuGate({ id, children }: { id: string; children: ReactNode }) {
  const [settings, session] = await Promise.all([getSiteSettings(), getServerSession(authOptions)]);
  const menu = settings.menus.find((m) => m.id === id);
  if (!menu) return <>{children}</>;

  // Menu yang disembunyikan dari user biasa: hanya admin yang boleh membukanya.
  if (!menu.userVisible && session?.user?.role !== "ADMIN") {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-muted">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="mt-5 text-lg font-semibold text-ink">Menu tidak tersedia</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Menu ini tidak ditampilkan untuk pengguna. Hubungi admin bila Anda memerlukannya.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm text-ink transition-colors hover:border-brand/50"
          >
            Kembali ke beranda
          </Link>
        </div>
      </main>
    );
  }

  if (menu.requireLogin && !session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(menu.href)}`);
  }

  if (menu.devMode && session?.user?.role !== "ADMIN") {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-muted">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="mt-5 text-lg font-semibold text-ink">{menu.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Menu ini sedang dalam pengembangan dan belum bisa dibuka. Silakan coba lagi nanti.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-line px-4 text-sm text-ink transition-colors hover:border-brand/50"
          >
            Kembali ke beranda
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      {menu.devMode && (
        <div className="pointer-events-none fixed bottom-3 left-3 z-[60] rounded-full border border-warn/40 bg-warn/15 px-3 py-1 text-[11px] font-medium text-warn backdrop-blur">
          Mode pengembangan — hanya admin yang bisa melihat halaman ini
        </div>
      )}
      <MenuHit id={id} />
      {children}
    </>
  );
}
