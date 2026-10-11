"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash, Upload } from "@/components/icons";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button, EmptyState, Field, Note, TextInput } from "@/components/ui";

interface Preset {
  id: string;
  name: string;
}

/** Galeri latar siap pakai untuk Halaman Login Hotspot — dikelola admin. */
export function AdminBackgrounds() {
  const [presets, setPresets] = useState<Preset[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch("/api/background-presets")
      .then((r) => r.json())
      .then((d) => setPresets(d.presets ?? []))
      .catch(() => setPresets([]));
  }, []);

  useEffect(load, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setFlash(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("name", name);
      const res = await fetch("/api/admin/background-presets", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setFlash({
          tone: "bad",
          text:
            data?.error ??
            (res.status === 413
              ? "Berkas ditolak server (terlalu besar). Naikkan client_max_body_size di nginx."
              : `Gagal mengunggah (kode ${res.status}).`),
        });
        return;
      }
      setName("");
      setFlash({ tone: "info", text: `"${data.preset.name}" ditambahkan ke galeri.` });
      load();
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (preset: Preset) => {
    if (!confirm(`Hapus latar "${preset.name}" dari galeri?`)) return;
    const res = await fetch(`/api/admin/background-presets/${preset.id}`, { method: "DELETE" });
    if (res.ok) load();
    else setFlash({ tone: "bad", text: "Gagal menghapus." });
  };

  return (
    <AdminSection
      title="Galeri latar Halaman Login Hotspot"
      description="Latar siap pakai yang bisa dipilih semua pengguna."
      badge={presets && <span className="font-mono text-[11px] text-faint">{presets.length} latar</span>}
    >
      <p className="px-5 pt-4 text-xs text-muted">
        Latar yang diunggah di sini bisa langsung dipilih semua pengguna. Mereka tetap bisa mengunggah latar sendiri.
      </p>
      <div className="space-y-4 px-5 py-4">
        {flash && <Note tone={flash.tone}>{flash.text}</Note>}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Field label="Nama latar (opsional)">
              <TextInput value={name} onChange={setName} placeholder="Mis. Biru Gelombang" />
            </Field>
          </div>
          <Button variant="primary" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" />
            {busy ? "Mengunggah…" : "Unggah latar"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
        <p className="text-xs text-faint">Ideal 1600 × 900 px, JPG, maksimal 600 KB.</p>

        {presets === null ? (
          <p className="py-4 text-center text-xs text-faint">Memuat…</p>
        ) : presets.length === 0 ? (
          <EmptyState>Belum ada latar di galeri.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {presets.map((p) => (
              <figure key={p.id} className="overflow-hidden rounded-xl border border-line-soft bg-raised/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/background-presets/${p.id}/image`}
                  alt={p.name}
                  loading="lazy"
                  className="h-24 w-full object-cover"
                />
                <figcaption className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <span className="truncate text-xs text-muted">{p.name}</span>
                  <Button
                    size="sm"
                    variant="danger"
                    className="px-2"
                    ariaLabel={`Hapus ${p.name}`}
                    title="Hapus"
                    onClick={() => remove(p)}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </AdminSection>
  );
}