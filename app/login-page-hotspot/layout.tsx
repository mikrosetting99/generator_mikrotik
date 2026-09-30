import { getServerSession } from "next-auth";
import Link from "next/link";
import { ArrowLeft, Lock, Users } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/login-page-hotspot/SignOutButton";

export const metadata = {
  title: "Login Page Hotspot — Mikrosetting.com",
  robots: { index: false, follow: false },
};

export default async function LoginPageHotspotLayout({ children }: { children: React.ReactNode }) {
  /* Middleware sudah memastikan ada sesi untuk seluruh /login-page-hotspot,
     jadi di sini cukup dibaca untuk keperluan tampilan (nama pengguna). */
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>

          <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-ink">
            <Lock className="h-4 w-4 text-brand" />
            Login Page Hotspot
          </span>

          <ThemeToggle />

          {session?.user && (
            <>
              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin/users"
                  title="Kelola pengguna"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-line bg-raised text-muted transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <Users className="h-4 w-4" />
                </Link>
              )}
              <span className="hidden max-w-[140px] truncate font-mono text-xs text-faint sm:inline">
                {session.user.username}
              </span>
              <SignOutButton />
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
