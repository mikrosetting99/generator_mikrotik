import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AppSwitcher } from "@/components/AppSwitcher";
import { FileText } from "@/components/icons";
import { SettingRequestsAdmin } from "@/components/setting-form/SettingRequestsAdmin";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Form Setting Mikrotik",
};

export default async function FormSettingPage() {
  // Data link milik akun yang login; tamu diarahkan login walau menu dibuat terbuka.
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/form-setting");

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <AppSwitcher />
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Form Setting Mikrotik</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full px-5 py-6 lg:px-8">
        <SettingRequestsAdmin />
      </div>
    </main>
  );
}
