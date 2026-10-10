"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Database, Download, FileText } from "@/components/icons";
import { SaveLoadPage } from "@/components/hotspot-login/SaveLoadPage";
import { LoginPageEditor } from "@/components/hotspot-login/LoginPageEditor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, Modal, Note, Panel } from "@/components/ui";
import { createDefaultHotspotLoginConfig } from "@/lib/defaults-hotspot-login";
import { downloadBlob } from "@/lib/download";
import { buildHotspotPackage } from "@/lib/hotspot-page";
import type { HotspotPageConfig } from "@/lib/types-hotspot-login";
import { createZip } from "@/lib/zip";

export function HotspotLoginBuilder() {
  const [page, setPageState] = useState<HotspotPageConfig>(createDefaultHotspotLoginConfig);
  const [buildingZip, setBuildingZip] = useState(false);
  const [zipError, setZipError] = useState("");
  const [storeOpen, setStoreOpen] = useState(false);
  const [loaded, setLoaded] = useState<{ id: string; name: string } | null>(null);

  const setPage = (partial: Partial<HotspotPageConfig>) =>
    setPageState((prev) => ({ ...prev, ...partial }));

  const downloadLoginPage = async () => {
    setBuildingZip(true);
    setZipError("");
    try {
      const entries = await buildHotspotPackage(page);
      downloadBlob(createZip(entries), "hotspot.zip");
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
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={() => setStoreOpen(true)}>
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Simpan / Muat</span>
            </Button>
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

      <Modal
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        title="Simpan / Muat Halaman Login"
        description="Simpan desain ke database agar bisa dibuka lagi dan diedit kapan saja."
      >
        <SaveLoadPage
          page={page}
          loaded={loaded}
          onLoad={(next, entry) => {
            setPageState(next);
            setLoaded(entry);
          }}
          onSaved={setLoaded}
          onClose={() => setStoreOpen(false)}
        />
      </Modal>
    </main>
  );
}
