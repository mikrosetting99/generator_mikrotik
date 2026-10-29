import { getServerSession } from "next-auth";
import Link from "next/link";
import { AppSwitcher } from "@/components/AppSwitcher";
import { Lock, Users } from "@/components/icons";
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
        <div className="flex items-center gap-3 px-4 lg:px-8 py-3">
          <AppSwitcher />
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Lock className="h-4 w-4 text-brand" />
            Login Page Hotspot
          </span>
          <span className="ml-auto" />

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

      <main className="px-4 lg:px-8 py-8">{children}</main>
    </div>
  );
}
