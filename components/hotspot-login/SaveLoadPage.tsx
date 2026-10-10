"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Check, Database, Save, Trash } from "@/components/icons";
import { Button, EmptyState, Field, Note, TextInput } from "@/components/ui";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import type { HotspotPageConfig } from "@/lib/types-hotspot-login";

interface Entry {
  id: string;
  name: string;
  savedAt: string;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Simpan desain halaman login ke database, atau muat lagi yang pernah disimpan. */
export function SaveLoadPage({
  page,
  loaded,
  onLoad,
  onSaved,
  onClose,
}: {
  page: HotspotPageConfig;
  /** Desain yang sedang terbuka dari database, bila ada — bisa ditimpa. */
  loaded: { id: string; name: string } | null;
  onLoad: (page: HotspotPageConfig, entry: { id: string; name: string }) => void;
  onSaved: (entry: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const { status } = useSession();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [name, setName] = useState(loaded?.name ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/hotspot-pages")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setEntries(data.entries))
      .catch(() => setFlash({ tone: "bad", text: "Gagal memuat daftar dari server." }));
  }, []);

  useEffect(() => {
    if (status === "authenticated") refresh();
  }, [status, refresh]);

  if (status === "loading") return <p className="py-6 text-center text-xs text-faint">Memuat…</p>;

  if (status !== "authenticated") {
    return (
      <Note>
        Menyimpan ke database memerlukan akun.{" "}
        <Link href="/login?callbackUrl=/hotspot-login" className="text-brand underline">
          Masuk dulu
        </Link>
        , lalu buka kembali menu ini. Tanpa akun, desain tetap bisa diunduh sebagai hotspot.zip.
      </Note>
    );
  }

  const save = async (overwrite: boolean) => {
    setBusy("save");
    setFlash(null);
    try {
      const res = await fetch("/api/hotspot-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: overwrite ? loaded?.id : undefined, name, config: page }),
      });
      // Penolakan dari proxy (mis. 413) berupa HTML, bukan JSON.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.entry) {
        setFlash({
          tone: "bad",
          text:
            data?.error ??
            (res.status === 413
              ? "Ukuran desain terlalu besar untuk server (gambar). Perkecil gambar, atau naikkan client_max_body_size di nginx."
              : `Gagal menyimpan (kode ${res.status}).`),
        });
        return;
      }
      const saved: Entry = data.entry;
      // Langsung tampil di daftar tanpa menunggu muat ulang dari server.
      setEntries((prev) => [saved, ...(prev ?? []).filter((e) => e.id !== saved.id)]);
      onSaved({ id: saved.id, name: saved.name });
      setFlash({ tone: "info", text: `"${saved.name}" tersimpan di database.` });
      refresh();
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(null);
    }
  };

  const load = async (entry: Entry) => {
    setBusy(entry.id);
    try {
      const res = await fetch(`/api/hotspot-pages/${entry.id}`);
      const data = await res.json();
      if (!res.ok) {
        setFlash({ tone: "bad", text: data.error ?? "Gagal memuat." });
        return;
      }
      onLoad(normalizeHotspotPage(data.config), { id: entry.id, name: entry.name });
      onClose();
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (entry: Entry) => {
    if (!confirm(`Hapus desain "${entry.name}" dari server?`)) return;
    setBusy(entry.id);
    try {
      const res = await fetch(`/api/hotspot-pages/${entry.id}`, { method: "DELETE" });
      if (!res.ok) setFlash({ tone: "bad", text: "Gagal menghapus." });
      else refresh();
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {flash && <Note tone={flash.tone}>{flash.text}</Note>}

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Save className="h-4 w-4 text-brand" />
          Simpan desain saat ini
        </h3>
        <div className="mt-3 space-y-3">
          <Field label="Nama desain" hint="Termasuk logo dan gambar yang sudah diunggah.">
            <TextInput value={name} onChange={setName} placeholder="Warnet Kita — biru" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => save(false)} disabled={busy === "save"}>
              <Database className="h-4 w-4" />
              {busy === "save" ? "Menyimpan…" : "Simpan sebagai baru"}
            </Button>
            {loaded && (
              <Button onClick={() => save(true)} disabled={busy === "save"}>
                <Save className="h-4 w-4" />
                Timpa &ldquo;{loaded.name}&rdquo;
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-line-soft pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Database className="h-4 w-4 text-brand" />
          Tersimpan di server
          {entries && entries.length > 0 && (
            <span className="font-mono text-[11px] font-normal text-faint">({entries.length})</span>
          )}
        </h3>
        <div className="mt-3 space-y-2">
          {entries === null ? (
            <p className="py-4 text-center text-xs text-faint">Memuat…</p>
          ) : entries.length === 0 ? (
            <EmptyState>Belum ada desain tersimpan.</EmptyState>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-raised/50 p-3 transition-colors hover:border-line"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{entry.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint/80">{formatDate(entry.savedAt)}</p>
                </div>
                <Button size="sm" disabled={busy === entry.id} onClick={() => load(entry)}>
                  <Check className="h-3.5 w-3.5" />
                  Muat
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="px-2"
                  disabled={busy === entry.id}
                  title={`Hapus ${entry.name}`}
                  ariaLabel={`Hapus ${entry.name}`}
                  onClick={() => remove(entry)}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
