import type { Metadata } from "next";
import { LogIn } from "@/components/icons";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk — Generator Script Mikrotik",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.startsWith("/") ? params.callbackUrl : "/";

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="edge-light w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-[0_30px_80px_-50px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
            <LogIn className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-sm font-semibold text-ink">Masuk</h1>
            <p className="text-xs text-faint">Setup Mikrotik Baru — akses terbatas</p>
          </div>
        </div>

        <div className="mt-5">
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        <p className="mt-5 text-center text-xs text-faint">
          Belum punya akun? Minta admin mendaftarkan username Anda.
        </p>
      </div>
    </main>
  );
}
