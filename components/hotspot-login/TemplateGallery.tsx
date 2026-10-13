"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Trash, Upload } from "@/components/icons";
import { Button, EmptyState, Field, Note, TextInput } from "@/components/ui";
import { normalizeHotspotPage } from "@/lib/defaults-hotspot-login";
import { buildPreviewHtml } from "@/lib/hotspot-page";
import type { HotspotPageConfig } from "@/lib/types-hotspot-login";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  design: string;
  primaryColor: string;
  bgColor: string;
}

/* Isi template diambil sekali lalu diingat selama tab terbuka — dipakai kartu,
   pratinjau besar, dan tombol "Pakai" tanpa mengunduh gambarnya berulang. */
const configCache = new Map<string, Promise<HotspotPageConfig>>();
const htmlCache = new Map<string, Promise<string>>();

function loadConfig(id: string): Promise<HotspotPageConfig> {
  let p = configCache.get(id);
  if (!p) {
    p = fetch(`/api/hotspot-templates/${id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("gagal"))))
      .then((d) => normalizeHotspotPage(d.config));
    p.catch(() => configCache.delete(id));
    configCache.set(id, p);
  }
  return p;
}

function loadHtml(id: string): Promise<string> {
  let p = htmlCache.get(id);
  if (!p) {
    p = loadConfig(id).then(buildPreviewHtml);
    p.catch(() => htmlCache.delete(id));
    htmlCache.set(id, p);
  }
  return p;
}

/** Ukuran perangkat untuk pratinjau besar. */
const VIEWS = [
  { id: "hp", label: "HP", w: 390, h: 844 },
  { id: "laptop", label: "Laptop", w: 1280, h: 720 },
] as const;

/** Halaman login sungguhan dalam ukuran kecil, dimuat saat kartunya terlihat. */
function Thumb({ id, width, height, device }: { id: string; width: number; height: number; device: { w: number; h: number } }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    loadHtml(id)
      .then((h) => active && setHtml(h))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [visible, id]);

  const scale = Math.min(width / device.w, height / device.h);

  return (
    <div
      ref={box}
      className="relative shrink-0 overflow-hidden rounded-lg border border-line bg-canvas"
      style={{ width, height }}
    >
      {html ? (
        <iframe
          title="Pratinjau template"
          srcDoc={html}
          sandbox=""
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
          style={{ width: device.w, height: device.h, transform: `scale(${scale})` }}
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[10px] text-faint">
          {failed ? "gagal" : "…"}
        </span>
      )}
    </div>
  );
}

/**
 * Template siap pakai. Semua orang bisa melihat pratinjaunya dan memuatnya ke
 * editor; admin juga bisa menerbitkan desain yang sedang dibuka sebagai
 * template baru (atau menimpa yang lama) dan menghapusnya.
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
  const [viewing, setViewing] = useState<TemplateSummary | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number]>(VIEWS[0]);

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
      onLoad(await loadConfig(t.id), t.name);
      onClose();
    } catch {
      setFlash({ tone: "bad", text: "Gagal memuat template." });
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
      // Isi template berubah (ditimpa) atau baru: buang ingatan lamanya.
      configCache.delete(data.template.id);
      htmlCache.delete(data.template.id);
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
    if (res.ok) {
      configCache.delete(t.id);
      htmlCache.delete(t.id);
      refresh();
    } else setFlash({ tone: "bad", text: "Gagal menghapus." });
  };

  /* ------------------------------------------------------ pratinjau besar */
  if (viewing) {
    const boxW = view.id === "hp" ? 252 : 440;
    const boxH = view.id === "hp" ? Math.round((252 / 390) * 844) : Math.round((440 / 1280) * 720);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Semua template
          </button>
          <div className="flex gap-1 rounded-lg border border-line bg-canvas p-1">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={v.id === view.id}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  v.id === view.id ? "bg-brand text-[color:var(--color-brand-ink)]" : "text-muted hover:text-ink"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-ink">{viewing.name}</p>
          {viewing.description && <p className="mt-0.5 text-xs text-muted">{viewing.description}</p>}
        </div>

        <div className="grid place-items-center rounded-xl border border-line-soft bg-raised/60 p-4">
          <div className="relative overflow-hidden rounded-xl" style={{ width: boxW, height: boxH }}>
            <PreviewFrame id={viewing.id} device={view} width={boxW} height={boxH} />
          </div>
        </div>
        <p className="text-center font-mono text-[10px] text-faint">
          {view.id === "hp" ? "iPhone 13" : "Laptop"} · {view.w} × {view.h}
        </p>

        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" disabled={busy === viewing.id} onClick={() => use(viewing)}>
            <Check className="h-4 w-4" /> Pakai template ini
          </Button>
          <Button onClick={() => setViewing(null)}>Kembali</Button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- daftar */
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
        <div className="grid gap-2.5">
          {templates.map((t) => (
            <div key={t.id} className="flex gap-3 rounded-xl border border-line-soft bg-raised/50 p-3">
              <button
                type="button"
                onClick={() => setViewing(t)}
                title="Lihat pratinjau besar"
                className="shrink-0 rounded-lg transition-transform hover:scale-[1.02]"
              >
                <Thumb id={t.id} width={84} height={182} device={VIEWS[0]} />
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="flex shrink-0 overflow-hidden rounded-md border border-line">
                    <span className="h-4 w-4" style={{ background: t.bgColor }} />
                    <span className="h-4 w-4" style={{ background: t.primaryColor }} />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.name}</p>
                </div>
                <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-muted">
                  {t.description || (t.design === "poster" ? "Desain Poster" : "Desain Minimal")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Button size="sm" onClick={() => setViewing(t)}>
                    Pratinjau
                  </Button>
                  <Button size="sm" variant="primary" disabled={busy === t.id} onClick={() => use(t)}>
                    <Check className="h-3.5 w-3.5" /> Pakai
                  </Button>
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        className="px-2"
                        ariaLabel={`Timpa ${t.name}`}
                        title="Timpa isi template dengan desain yang sedang dibuka"
                        disabled={busy !== null}
                        onClick={() => {
                          if (confirm(`Timpa template "${t.name}" dengan desain yang sedang dibuka?`)) void publish(t);
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        className="px-2"
                        ariaLabel={`Hapus ${t.name}`}
                        title="Hapus template"
                        disabled={busy !== null}
                        onClick={() => remove(t)}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
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
            dimuat oleh semua pengguna. Desain yang sudah disimpan ke database juga bisa dijadikan template lewat
            tombol Template di Simpan / Muat.
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

/** Pratinjau besar: halaman login yang bisa dicoba (tombol Voucher/Member berfungsi). */
function PreviewFrame({
  id,
  device,
  width,
  height,
}: {
  id: string;
  device: { w: number; h: number };
  width: number;
  height: number;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setHtml(null);
    setFailed(false);
    loadHtml(id)
      .then((h) => active && setHtml(h))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [id]);

  if (!html) {
    return <span className="absolute inset-0 grid place-items-center text-xs text-faint">{failed ? "Gagal memuat" : "Memuat…"}</span>;
  }

  return (
    <iframe
      key={`${id}-${device.w}`}
      title="Pratinjau template"
      srcDoc={html}
      sandbox="allow-scripts"
      className="absolute left-0 top-0 origin-top-left border-0 bg-white"
      style={{ width: device.w, height: device.h, transform: `scale(${Math.min(width / device.w, height / device.h)})` }}
    />
  );
}