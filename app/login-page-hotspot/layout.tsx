import Link from "next/link";
import { ArrowLeft, Lock } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = {
  title: "Login Page Hotspot — Mikrosetting.com",
  robots: { index: false, follow: false },
};

export default async function LoginPageHotspotLayout({ children }: { children: React.ReactNode }) {
  /* Halaman masuk memakai layout ini juga, jadi tombol keluar hanya tampil
     kalau memang ada sesi. Middleware yang mengurus pengalihannya. */
  let masuk = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    masuk = Boolean(user);
  }

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

          {masuk && (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-faint transition-colors hover:bg-bad/10 hover:text-bad"
              >
                Keluar
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
