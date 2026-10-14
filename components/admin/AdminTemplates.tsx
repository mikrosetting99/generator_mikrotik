"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Trash } from "@/components/icons";
import { AdminSection } from "@/components/admin/AdminSection";
import { Button, EmptyState, Note } from "@/components/ui";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  design: string;
  primaryColor: string;
  bgColor: string;
  isDefault: boolean;
}

/** Template Halaman Login Hotspot yang sudah diterbitkan admin — dilihat dan dihapus di sini. */
export function AdminTemplates() {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [flash, setFlash] = useState("");

  const load = useCallback(() => {
    fetch("/api/hotspot-templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, []);

  useEffect(load, [load]);

  const setDefault = async (t: TemplateSummary, on: boolean) => {
    const res = await fetch(`/api/admin/hotspot-templates/${t.id}/default`, { method: on ? "POST" : "DELETE" });
    if (res.ok) load();
    else setFlash("Gagal mengubah template default.");
  };

  const remove = async (t: TemplateSummary) => {
    if (!confirm(`Hapus template "${t.name}" untuk semua pengguna?`)) return;
    const res = await fetch(`/api/admin/hotspot-templates/${t.id}`, { method: "DELETE" });
    if (res.ok) load();
    else setFlash("Gagal menghapus template.");
  };

  return (
    <AdminSection
      title="Template Halaman Login Hotspot"
      description="Desain jadi yang bisa dimuat semua pengguna."
      badge={templates && <span className="font-mono text-[11px] text-faint">{templates.length} template</span>}
    >
      <div className="space-y-3 px-5 py-4">
        {flash && <Note tone="bad">{flash}</Note>}
        <p className="text-xs leading-relaxed text-muted">
          Cara membuat: rancang desain di Halaman Login Hotspot, buka tombol <b className="font-medium text-ink">Template</b>{" "}
          di bagian atas, lalu <b className="font-medium text-ink">Terbitkan template</b>.
        </p>
        <Link
          href="/hotspot-login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          Buka Halaman Login Hotspot
          <ArrowRight className="h-4 w-4" />
        </Link>

        {templates === null ? (
          <p className="py-4 text-center text-xs text-faint">Memuat…</p>
        ) : templates.length === 0 ? (
          <EmptyState>Belum ada template diterbitkan.</EmptyState>
        ) : (
          <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
                  <span className="h-6 w-6" style={{ background: t.bgColor }} />
                  <span className="h-6 w-6" style={{ background: t.primaryColor }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm text-ink">
                    {t.name}
                    {t.isDefault && (
                      <span className="rounded-full border border-brand/40 bg-brand/10 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-brand">
                        default
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-faint">
                    {t.design === "poster" ? "Poster" : "Minimal"}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </div>
                <Button size="sm" title="Dimuat otomatis saat siapa pun membuka Halaman Login Hotspot" onClick={() => setDefault(t, !t.isDefault)}>
                  {t.isDefault ? "Lepas default" : "Jadikan default"}
                </Button>
                <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${t.name}`} title="Hapus" onClick={() => remove(t)}>
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminSection>
  );
}