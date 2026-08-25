"use client";

import { useRef, useState } from "react";
import { Upload, X } from "@/components/icons";
import { Button, cn } from "@/components/ui";
import { BATAS_GAMBAR } from "@/lib/license/pesanan";

function ukuran(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * Pemilih gambar yang menyimpan hasilnya sebagai data URI di kolom tersembunyi.
 *
 * Mengikuti pola yang sudah dipakai halaman /setup: berkas dibaca di browser,
 * tidak diunggah ke mana pun, lalu ditulis jadi berkas di dalam zip. Ukurannya
 * hanya diperingatkan, tidak diperkecil otomatis — mengecilkan gambar tanpa
 * diminta bisa merusak logo bergaris tipis, dan yang paling tahu hasil yang
 * pantas adalah orang yang melihatnya.
 */
export function ImageField({
  name,
  label,
  jenis,
  defaultValue,
}: {
  name: string;
  label: string;
  jenis: "logo" | "latar";
  defaultValue?: string | null;
}) {
  const batas = BATAS_GAMBAR[jenis];
  const [dataUrl, setDataUrl] = useState(defaultValue ?? "");
  const [dimensi, setDimensi] = useState<{ w: number; h: number; b: number } | null>(null);
  const [salah, setSalah] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const pilih = (file: File | undefined) => {
    if (!file) return;
    setSalah(null);

    if (!file.type.startsWith("image/")) {
      setSalah("Berkas harus berupa gambar.");
      return;
    }
    if (file.size > batas.maxBytes) {
      setSalah(
        `Ukuran ${ukuran(file.size)} — maksimal ${ukuran(batas.maxBytes)}. ` +
          "Perkecil dulu di tinypng.com; berkas ini diunduh pelanggan sebelum mereka punya internet."
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const hasil = String(reader.result);
      setDataUrl(hasil);
      const img = new Image();
      img.onload = () => setDimensi({ w: img.naturalWidth, h: img.naturalHeight, b: file.size });
      img.src = hasil;
    };
    reader.onerror = () => setSalah("Gagal membaca berkas.");
    reader.readAsDataURL(file);
  };

  const jauhBeda =
    dimensi &&
    (dimensi.w > batas.idealWidth * 2 ||
      dimensi.h > batas.idealHeight * 2 ||
      dimensi.w < batas.idealWidth / 2.5);

  return (
    <div className="grid gap-2">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input type="hidden" name={name} value={dataUrl} readOnly />
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pilih(e.target.files?.[0])}
      />

      {dataUrl ? (
        <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-canvas/50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt=""
            className="h-16 w-16 rounded-lg border border-line bg-surface object-contain p-1"
          />
          <div className="min-w-0 flex-1">
            {dimensi && (
              <p className={cn("text-xs", jauhBeda ? "text-warn" : "text-faint")}>
                {dimensi.w} × {dimensi.h} px · {ukuran(dimensi.b)}
                {jauhBeda && ` — jauh dari ${batas.label}`}
              </p>
            )}
            <p className="mt-1 text-xs text-faint">Disarankan {batas.label}.</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            ariaLabel={`Hapus ${label}`}
            onClick={() => {
              setDataUrl("");
              setDimensi(null);
              if (input.current) input.current.value = "";
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted transition-colors hover:border-brand/50 hover:text-brand"
        >
          <Upload className="h-4 w-4" />
          Pilih gambar · {batas.label}
        </button>
      )}

      {salah && <p className="text-xs text-bad">{salah}</p>}
    </div>
  );
}
