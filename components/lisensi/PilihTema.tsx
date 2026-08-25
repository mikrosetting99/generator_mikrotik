"use client";

import Image from "next/image";
import { Check } from "@/components/icons";
import { cn } from "@/components/ui";
import { TEMPLATES } from "@/lib/license/templates";

/**
 * Pemilih tema bergambar.
 *
 * Gambarnya dibuat skrip buat-thumbnail.mts dari hasil cetak yang sungguhan,
 * bukan gambar hias yang digambar terpisah — kalau template berubah, jalankan
 * ulang skripnya dan pilihan di sini ikut benar dengan sendirinya.
 */
export function PilihTema({
  nilai,
  onPilih,
}: {
  nilai: string;
  onPilih: (slug: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <input type="hidden" name="template_slug" value={nilai} readOnly />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TEMPLATES.map((t) => {
          const dipilih = t.slug === nilai;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onPilih(t.slug)}
              aria-pressed={dipilih}
              title={t.ringkas}
              className={cn(
                "group relative overflow-hidden rounded-xl border text-left transition-all duration-200",
                dipilih
                  ? "border-brand shadow-[0_0_0_3px_rgba(56,189,248,0.18)]"
                  : "border-line hover:border-brand/50"
              )}
            >
              <Image
                src={`/lisensi-thumb/${t.slug}.jpg`}
                alt=""
                width={320}
                height={640}
                className="block h-auto w-full"
              />

              {dipilih && (
                <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-[color:var(--color-brand-ink)]">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}

              <span
                className={cn(
                  "block px-2.5 py-2 text-xs font-medium transition-colors",
                  dipilih ? "bg-brand/[0.12] text-brand" : "bg-surface text-muted group-hover:text-ink"
                )}
              >
                {t.nama}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-faint">
        Gambar di atas memakai contoh &ldquo;WIFI DESA&rdquo; dengan empat paket. Nama, harga, warna, dan
        latar akan mengikuti isian di bawah.
      </p>
    </div>
  );
}
