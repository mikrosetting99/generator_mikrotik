"use client";

import { useEffect, useRef, useState } from "react";
import { Rotate } from "@/components/icons";
import { Button, cn } from "@/components/ui";

/**
 * Lebar yang diuji. Sama dengan tiga tingkat yang dipakai template:
 * di bawah 600 dianggap HP, 600–1023 tablet, 1024 ke atas laptop.
 * Tingginya ikut perangkat nyata supaya aturan "muat satu layar" benar-benar
 * teruji — panel yang tingginya bebas tidak akan pernah menunjukkan masalah.
 */
const PERANGKAT = [
  { id: "hp", label: "HP", w: 390, h: 780 },
  { id: "tablet", label: "Tablet", w: 768, h: 1024 },
  { id: "laptop", label: "Laptop", w: 1280, h: 720 },
] as const;

export function Pratinjau() {
  const [perangkat, setPerangkat] = useState<(typeof PERANGKAT)[number]>(PERANGKAT[0]);
  const [url, setUrl] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [salah, setSalah] = useState<string | null>(null);
  /* Komponen Button proyek ini tidak meneruskan ref, jadi elemen form dicari
     lewat wadah terluar. Sekaligus membuat komponen ini bisa ditaruh di mana
     saja di dalam form tanpa perlu dioper prop apa pun. */
  const akar = useRef<HTMLDivElement>(null);
  const bingkai = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);

  /* Iframe dirender pada lebar perangkat yang sebenarnya lalu diperkecil
     secara visual. Mengecilkan lebar iframe-nya sendiri akan mengubah hasil
     media query, dan pratinjaunya jadi bohong. */
  useEffect(() => {
    const hitung = () => {
      const lebarPanel = bingkai.current?.clientWidth ?? perangkat.w;
      setSkala(Math.min(1, lebarPanel / perangkat.w));
    };
    hitung();
    window.addEventListener("resize", hitung);
    return () => window.removeEventListener("resize", hitung);
  }, [perangkat]);

  /* Blob URL yang lama dilepas supaya tidak menumpuk di memori tab. */
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const muat = async () => {
    const form = akar.current?.closest("form");
    if (!form) return;

    setSibuk(true);
    setSalah(null);
    try {
      const res = await fetch("/login-page-hotspot/pratinjau", { method: "POST", body: new FormData(form) });
      if (!res.ok) throw new Error(`Server menjawab ${res.status}`);
      const html = await res.text();
      const baru = URL.createObjectURL(new Blob([html], { type: "text/html" }));
      setUrl((lama) => {
        if (lama) URL.revokeObjectURL(lama);
        return baru;
      });
    } catch (e) {
      setSalah((e as Error).message);
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div ref={akar} className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={muat} disabled={sibuk} variant={url ? "default" : "primary"}>
          <Rotate className={cn("h-4 w-4", sibuk && "animate-spin")} />
          {sibuk ? "Membuat…" : url ? "Perbarui Pratinjau" : "Lihat Pratinjau"}
        </Button>

        <div className="ml-auto flex gap-1 rounded-lg border border-line bg-canvas p-1">
          {PERANGKAT.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPerangkat(p)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                p.id === perangkat.id
                  ? "bg-brand text-[color:var(--color-brand-ink)]"
                  : "text-muted hover:text-ink"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {salah && <p className="text-xs text-bad">Pratinjau gagal: {salah}</p>}

      <div
        ref={bingkai}
        className="overflow-hidden rounded-xl border border-line bg-surface"
        style={{ height: url ? perangkat.h * skala + 2 : undefined }}
      >
        {url ? (
          <iframe
            key={`${url}-${perangkat.id}`}
            src={url}
            title="Pratinjau halaman login"
            className="border-0 bg-black"
            style={{
              width: perangkat.w,
              height: perangkat.h,
              transform: `scale(${skala})`,
              transformOrigin: "top left",
            }}
          />
        ) : (
          <p className="px-4 py-10 text-center text-xs text-faint">
            Tekan <b className="text-muted">Lihat Pratinjau</b> untuk melihat hasilnya. Isian tidak perlu
            disimpan dulu, dan yang ditampilkan dicetak dengan mesin yang sama dengan hasil unduhan.
          </p>
        )}
      </div>

      {url && (
        <p className="text-xs text-faint">
          {perangkat.w} × {perangkat.h} px
          {skala < 1 && ` · diperkecil ${Math.round(skala * 100)}% agar muat di panel`}
          {" · layar lisensi tidak muncul karena ID router hanya ada di router sungguhan."}
        </p>
      )}
    </div>
  );
}
