"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Check, Trash, Upload } from "@/components/icons";
import { Button, EmptyState, Field, Note, TextInput } from "@/components/ui";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import type { HotspotPageConfig } from "@/lib/types-hotspot-login";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  design: string;
  primaryColor: string;
  bgColor: string;
}

/**
 * Template siap pakai. Semua orang bisa memuatnya ke editor; admin juga bisa
 * menerbitkan desain yang sedang dibuka sebagai template baru (atau menimpa
 * yang lama) dan menghapusnya.
 */
export function TemplateGallery({
  page,
  onLoad,
  onClose,
}: {
  page: HotspotPageConfig;
  onLoad: (page: HotspotPageConfig, name: string) => void;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const refresh = useCallback(() => {
    fetch("/api/hotspot-templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(refresh, [refresh]);

  const use = async (t: TemplateSummary) => {
    if (!confirm(`Pakai template "${t.name}"? Desain yang sedang dibuka akan diganti.`)) return;
    setBusy(t.id);
    try {
      const res = await fetch(`/api/hotspot-templates/${t.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.config) {
        setFlash({ tone: "bad", text: data?.error ?? "Gagal memuat template." });
        return;
      }
      onLoad(normalizeHotspotPage(data.config), t.name);
      onClose();
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (overwrite?: TemplateSummary) => {
    setBusy("publish");
    setFlash(null);
    try {
      const res = await fetch("/api/admin/hotspot-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: overwrite?.id,
          name: overwrite ? overwrite.name : name,
          description: overwrite ? overwrite.description : description,
          config: page,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.template) {
        setFlash({
          tone: "bad",
          text:
            data?.error ??
            (res.status === 413
              ? "Desain terlalu besar untuk server (gambar). Perkecil gambar, atau naikkan client_max_body_size di nginx."
              : `Gagal menerbitkan (kode ${res.status}).`),
        });
        return;
      }
      setFlash({
        tone: "info",
        text: `Template "${data.template.name}" ${data.updated ? "diperbarui" : "diterbitkan"} — sekarang bisa dipakai semua pengguna.`,
      });
      if (!overwrite) {
        setName("");
        setDescription("");
      }
      refresh();
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (t: TemplateSummary) => {
    if (!confirm(`Hapus template "${t.name}" untuk semua pengguna?`)) return;
    setBusy(t.id);
    const res = await fetch(`/api/admin/hotspot-templates/${t.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) refresh();
    else setFlash({ tone: "bad", text: "Gagal menghapus." });
  };

  return (
    <div className="space-y-5">
      {flash && <Note tone={flash.tone}>{flash.text}</Note>}

      {templates === null ? (
        <p className="py-6 text-center text-xs text-faint">Memuat…</p>
      ) : templates.length === 0 ? (
        <EmptyState>
          Belum ada template siap pakai.
          {isAdmin ? " Terbitkan desain Anda di bawah." : " Admin belum menerbitkan template."}
        </EmptyState>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col rounded-xl border border-line-soft bg-raised/50 p-3">
              <div className="flex items-center gap-2">
                <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
                  <span className="h-6 w-6" style={{ background: t.bgColor }} />
                  <span className="h-6 w-6" style={{ background: t.primaryColor }} />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.name}</p>
              </div>
              <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted">
                {t.description || (t.design === "poster" ? "Desain Poster" : "Desain Minimal")}
              </p>
              <div className="mt-2.5 flex items-center gap-1.5">
                <Button size="sm" variant="primary" className="flex-1" disabled={busy === t.id} onClick={() => use(t)}>
                  <Check className="h-3.5 w-3.5" /> Pakai
                </Button>
                {isAdmin && (
                  <>
                    <Button size="sm" title="Timpa isi template dengan desain yang sedang dibuka" disabled={busy !== null} onClick={() => {
                      if (confirm(`Timpa template "${t.name}" dengan desain yang sedang dibuka?`)) void publish(t);
                    }}>
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${t.name}`} title="Hapus template" disabled={busy !== null} onClick={() => remove(t)}>
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <section className="space-y-3 border-t border-line-soft pt-5">
          <h3 className="text-sm font-semibold text-ink">Terbitkan desain saat ini sebagai template</h3>
          <p className="text-xs leading-relaxed text-muted">
            Seluruh pengaturan di editor (warna, logo, latar, tabel, dan lainnya) disimpan sebagai template dan bisa
            dimuat oleh semua pengguna.
          </p>
          <Field label="Nama template">
            <TextInput value={name} onChange={setName} placeholder="Mis. Warnet Biru Minimalis" />
          </Field>
          <Field label="Keterangan singkat (opsional)">
            <TextInput value={description} onChange={setDescription} placeholder="Cocok untuk warnet dan RT/RW Net" />
          </Field>
          <Button variant="primary" onClick={() => publish()} disabled={busy === "publish" || !name.trim()}>
            <Upload className="h-4 w-4" />
            {busy === "publish" ? "Menerbitkan…" : "Terbitkan template"}
          </Button>
        </section>
      )}
    </div>
  );
}