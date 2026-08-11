"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Download, FileText } from "@/components/icons";
import { LoginPageEditor } from "@/components/hotspot-login/LoginPageEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Note, Panel } from "@/components/ui";
import { createDefaultHotspotLoginConfig } from "@/lib/defaults-hotspot-login";
import { buildHotspotPackage } from "@/lib/hotspot-page";
import type { HotspotPageConfig } from "@/lib/types-hotspot-login";
import { createZip } from "@/lib/zip";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function HotspotLoginBuilder() {
  const [page, setPageState] = useState<HotspotPageConfig>(createDefaultHotspotLoginConfig);
  const [buildingZip, setBuildingZip] = useState(false);
  const [zipError, setZipError] = useState("");

  const setPage = (partial: Partial<HotspotPageConfig>) =>
    setPageState((prev) => ({ ...prev, ...partial }));

  const downloadLoginPage = async () => {
    setBuildingZip(true);
    setZipError("");
    try {
      const entries = await buildHotspotPackage(page);
      download(createZip(entries), "hotspot.zip");
    } catch (error) {
      setZipError(error instanceof Error ? error.message : "Gagal menyiapkan paket halaman login.");
    } finally {
      setBuildingZip(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>
            <span className="h-5 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Halaman Login Hotspot</h1>
              <span className="hidden text-xs text-faint lg:inline">by Mikrosetting.com</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="primary" onClick={downloadLoginPage} disabled={buildingZip}>
              <Download className="h-4 w-4" />
              {buildingZip ? "Menyiapkan…" : "Unduh hotspot.zip"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-5 py-6">
        {zipError && <Note tone="bad">{zipError}</Note>}
        <Panel
          title="Halaman Login"
          description="Pilih desain lalu sesuaikan. Hasilnya diunduh sebagai hotspot.zip, untuk di-upload ke folder hotspot pada menu Files Winbox — router perlu punya IP Hotspot yang sudah dikonfigurasi (menu Setup Mikrotik Baru)."
        >
          <LoginPageEditor page={page} setPage={setPage} />
        </Panel>
      </div>
    </main>
  );
}
