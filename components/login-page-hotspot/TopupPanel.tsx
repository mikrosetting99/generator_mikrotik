"use client";

import { useState, useTransition } from "react";
import { mulaiTopup } from "@/lib/actions/koin";
import { Button, Note } from "@/components/ui";
import type { PaketKoin } from "@/lib/koin/saldo";

function rupiah(nilai: number): string {
  return `Rp ${nilai.toLocaleString("id-ID")}`;
}

export function TopupPanel({ paket }: { paket: PaketKoin[] }) {
  const [pending, mulai] = useTransition();
  const [galat, setGalat] = useState("");
  /* Id paket yang sedang diproses, supaya hanya tombol itu yang menunjukkan
     status menunggu — bukan seluruh baris tombol sekaligus. */
  const [diproses, setDiproses] = useState<string | null>(null);

  if (paket.length === 0) {
    return (
      <Note tone="warn">
        Belum ada paket topup. Jalankan migrasi <span className="font-mono">0002_koin.sql</span>{" "}
        terlebih dahulu, atau tambahkan paket dari tabel{" "}
        <span className="font-mono">coin_packages</span>.
      </Note>
    );
  }

  const bayar = (id: string) => {
    setGalat("");
    setDiproses(id);
    mulai(async () => {
      const hasil = await mulaiTopup(id);
      if (hasil.ok) {
        /* Diarahkan ke halaman pembayaran Duitku. Sengaja menimpa tab yang
           sama: membuka tab baru sering diblokir browser HP, dan pelanggan
           yang kehilangan halaman bayarnya akan mengira topupnya gagal. */
        window.location.href = hasil.url;
        return;
      }
      setDiproses(null);
      setGalat(hasil.pesan);
    });
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {paket.map((p) => (
          <div
            key={p.id}
            className="flex flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-brand/40"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
              {p.nama}
            </span>
            <span className="mt-1 text-2xl font-bold tracking-tight text-ink">
              {p.koin.toLocaleString("id-ID")}
              <span className="ml-1 text-sm font-medium text-muted">koin</span>
            </span>
            <span className="mt-0.5 text-sm text-muted">{rupiah(p.rupiah)}</span>

            <Button
              variant="brand"
              size="sm"
              className="mt-4"
              disabled={pending}
              onClick={() => bayar(p.id)}
            >
              {diproses === p.id ? "Menyiapkan…" : "Topup"}
            </Button>
          </div>
        ))}
      </div>

      {galat && (
        <div className="mt-4">
          <Note tone="bad">{galat}</Note>
        </div>
      )}
    </div>
  );
}
