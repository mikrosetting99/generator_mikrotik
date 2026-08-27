"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Coin, Lock } from "@/components/icons";
import { Button, Note } from "@/components/ui";
import { bukaFitur } from "@/lib/actions/fitur";

/**
 * Penutup tombol pengambilan hasil pada fitur berbayar.
 *
 * Yang ditutup hanya pengambilan hasilnya — form dan pratinjau tetap terbuka,
 * supaya pelanggan tahu persis apa yang dibelinya sebelum membayar.
 *
 * Ini gerbang lunak: script tetap disusun di browser, sesuai janji aplikasi
 * bahwa IP dan password tidak pernah dikirim ke server. Konsekuensinya, orang
 * yang paham bisa mengambil isinya langsung dari halaman. Menutupnya rapat
 * berarti memindahkan penyusunan script ke server, dan itu menggugurkan janji
 * tersebut.
 */

export function GerbangFitur({
  kunci,
  harga,
  keterangan,
  children,
}: {
  kunci: string;
  /** 0 berarti gratis — gerbangnya tidak tampil sama sekali. */
  harga: number;
  keterangan?: string;
  children: ReactNode;
}) {
  const [terbuka, setTerbuka] = useState(harga <= 0);
  const [pending, mulai] = useTransition();
  const [galat, setGalat] = useState<{ alasan: string; pesan: string } | null>(null);

  if (terbuka) return <>{children}</>;

  const bayar = () => {
    setGalat(null);
    mulai(async () => {
      const hasil = await bukaFitur(kunci, keterangan);
      if (hasil.ok) {
        setTerbuka(true);
        return;
      }
      setGalat({ alasan: hasil.alasan, pesan: hasil.pesan });
    });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-raised">
          <Lock className="h-4 w-4 text-faint" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            Salin & unduh script perlu {harga.toLocaleString("id-ID")} koin
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Dipotong sekali. Setelah terbuka, script boleh disalin dan diunduh sepuasnya selama
            halaman ini tidak ditutup.
          </p>
        </div>
      </div>

      <Button variant="brand" onClick={bayar} disabled={pending} className="mt-3 w-full">
        <Coin className="h-4 w-4" />
        {pending ? "Memproses…" : `Buka dengan ${harga.toLocaleString("id-ID")} koin`}
      </Button>

      {galat && (
        <div className="mt-3">
          <Note tone={galat.alasan === "lain" ? "bad" : "warn"}>
            {galat.pesan}{" "}
            {galat.alasan === "masuk" && (
              <Link
                href="/login-page-hotspot/login"
                className="font-medium text-brand hover:underline"
              >
                Masuk
              </Link>
            )}
            {galat.alasan === "kurang" && (
              <Link
                href="/login-page-hotspot/koin"
                className="font-medium text-brand hover:underline"
              >
                Isi koin
              </Link>
            )}
          </Note>
        </div>
      )}
    </div>
  );
}
