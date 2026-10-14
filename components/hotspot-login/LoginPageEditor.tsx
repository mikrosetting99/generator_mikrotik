"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash, Upload } from "@/components/icons";
import { Button, EmptyState, Field, Note, Select, TextInput, Toggle } from "@/components/ui";
import { newPackage } from "@/lib/defaults-hotspot-login";
import {
  buildPreviewHtml,
  textDefaults,
  isHexColor,
  whatsappLink,
} from "@/lib/hotspot-page";
import { IPHONE_PAD, IphoneFrame } from "@/components/hotspot-login/IphoneFrame";
import { adjustBrightness } from "@/lib/color";
import { PRESET_LIMITS, type PresetKind } from "@/lib/preset-kinds";
import { BG_FITS, BG_POSITIONS, type HotspotPageConfig, type LoginMode } from "@/lib/types-hotspot-login";

const grid2 = "grid gap-4";

/**
 * Ukuran perangkat untuk pratinjau. Iframe dirender pada ukuran aslinya lalu
 * diperkecil secara visual, supaya media query halaman login bereaksi sama
 * seperti di perangkat sungguhan.
 */
const DEVICES = [
  { id: "hp", label: "HP", name: "iPhone 13", w: 390, h: 844 },
  { id: "tablet", label: "Tablet", name: "iPad", w: 768, h: 1024 },
  { id: "laptop", label: "Laptop", name: "Laptop", w: 1280, h: 720 },
] as const;

const PRIMARY_PRESETS = ["#38bdf8", "#22c55e", "#f59e0b", "#2563eb", "#a78bfa", "#f43f5e", "#14b8a6"];
const TITLE_PRESETS = ["#0f172a", "#ffffff", "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed"];
const MARQUEE_PRESETS = ["#1e293b", "#0f172a", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#2563eb"];
const BUTTON_TEXT_PRESETS = ["#ffffff", "#0f172a", "#fef08a", "#dc2626", "#16a34a", "#2563eb"];
const WA_PRESETS = ["#25d366", "#128c7e", "#075e54", "#16a34a", "#0f172a", "#ffffff"];
const BORDER_PRESETS = ["#e2e8f0", "#94a3b8", "#334155", "#0f172a", "#ffffff"];
const FORM_PRESETS = ["#ffffff", "#f1f5f9", "#fef3c7", "#e0f2fe", "#1e293b", "#0f172a"];
const BG_PRESETS = ["#0b1220", "#07070d", "#141a2c", "#1c1917", "#eef2f7", "#ffffff", "#fdf4e3"];
/**
 * Batas ukuran berkas gambar. Penyimpanan flash router terbatas — hAP lite
 * hanya punya 16 MB — jadi paket halaman login harus tetap ringan.
 */
const IMAGE_LIMITS = {
  logo: {
    maxBytes: 300 * 1024,
    idealWidth: 400,
    idealHeight: 160,
    hint: "Ideal 400 × 160 px (rasio 5:2), PNG latar transparan, maksimal 300 KB.",
  },
  form: {
    maxBytes: 300 * 1024,
    idealWidth: 700,
    idealHeight: 1080,
    hint: "Ideal sekitar 700 × 900 px, JPG, maksimal 300 KB. Tampil di dalam kartu form.",
  },
  background: {
    maxBytes: 300 * 1024,
    idealWidth: 1920,
    idealHeight: 1080,
    hint: "Ideal 1920 × 1080 px (rasio 16:9), JPG, maksimal 300 KB.",
  },
} as const;

interface ImageInfo {
  width: number;
  height: number;
  bytes: number;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** Kelompok menu yang bisa dibuka-tutup (dropdown). */
function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-line-soft bg-raised/50">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">{title}</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 text-muted transition-transform group-open:rotate-180"
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="space-y-4 border-t border-line-soft p-4">{children}</div>
    </details>
  );
}

export function LoginPageEditor({
  page,
  setPage,
}: {
  page: HotspotPageConfig;
  setPage: (partial: Partial<HotspotPageConfig>) => void;
}) {
  const logoInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState("");
  const [bgError, setBgError] = useState("");
  const [formError, setFormError] = useState("");
  const [gallery, setGallery] = useState<{ id: string; name: string }[]>([]);
  const [logoGallery, setLogoGallery] = useState<{ id: string; name: string }[]>([]);
  const [galleryBusy, setGalleryBusy] = useState<string | null>(null);

  // Galeri latar dan logo siap pakai dari admin.
  useEffect(() => {
    const load = (kind: PresetKind, set: (items: { id: string; name: string }[]) => void) =>
      fetch(`/api/background-presets?kind=${kind}`)
        .then((r) => r.json())
        .then((d) => set(d.presets ?? []))
        .catch(() => set([]));
    void load("background", setGallery);
    void load("logo", setLogoGallery);
  }, []);

  const pickGallery = async (kind: PresetKind, preset: { id: string; name: string }) => {
    const setError = kind === "logo" ? setLogoError : setBgError;
    setGalleryBusy(preset.id);
    setError("");
    try {
      const res = await fetch(`/api/background-presets/${preset.id}/image`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error());
        reader.readAsDataURL(blob);
      });
      if (kind === "logo") setPage({ logoDataUrl: dataUrl, logoName: `galeri:${preset.id}` });
      else setPage({ bgImageDataUrl: dataUrl, bgImageName: `galeri:${preset.id}` });
    } catch {
      setError(`Gagal memuat ${PRESET_LIMITS[kind].label} dari galeri.`);
    } finally {
      setGalleryBusy(null);
    }
  };

  /** Deretan gambar siap pakai dari admin; mengklik salah satu langsung memakainya. */
  const galleryPicker = (
    kind: PresetKind,
    items: { id: string; name: string }[],
    selectedName: string,
  ) =>
    items.length > 0 && (
      <div className="mt-3">
        <span className="text-[11px] text-faint">Atau pilih dari galeri:</span>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {items.map((g) => {
            const active = selectedName === `galeri:${g.id}`;
            return (
              <button
                key={g.id}
                type="button"
                title={g.name}
                aria-pressed={active}
                disabled={galleryBusy !== null}
                onClick={() => pickGallery(kind, g)}
                className={`overflow-hidden rounded-md border-2 transition-all ${
                  active ? "border-brand" : "border-line-soft hover:border-line"
                } ${galleryBusy === g.id ? "opacity-50" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/background-presets/${g.id}/image`}
                  alt={g.name}
                  loading="lazy"
                  className={`h-12 w-full ${kind === "logo" ? "bg-canvas object-contain p-1" : "object-cover"}`}
                />
              </button>
            );
          })}
        </div>
      </div>
    );

  /** Kotak rekomendasi ukuran, supaya hasilnya tajam tapi tetap ringan di router. */
  const recommendBox = (kind: PresetKind) => (
    <p className="mt-2.5 rounded-lg border border-brand/20 bg-brand/[0.06] px-2.5 py-2 text-xs leading-relaxed text-muted">
      <b className="font-medium text-ink">Rekomendasi:</b> {PRESET_LIMITS[kind].recommend}
    </p>
  );
  const formInput = useRef<HTMLInputElement>(null);
  const [logoInfo, setLogoInfo] = useState<ImageInfo | null>(null);
  const [bgInfo, setBgInfo] = useState<ImageInfo | null>(null);
  const [formInfo, setFormInfo] = useState<ImageInfo | null>(null);
  const [preview, setPreview] = useState("");
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0]);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const pad = device.id === "hp" ? IPHONE_PAD : 0;
      setScale(
        Math.min(1, (el.clientWidth - 24) / (device.w + pad * 2), (el.clientHeight - 24) / (device.h + pad * 2)),
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [device]);

  // Pratinjau: gabungkan login.html + style.css milik desain terpilih, lalu
  // ganti variabel RouterOS dengan contoh nilai supaya terbaca wajar.
  //
  // Dirender ulang setelah pengetikan berhenti sejenak. Tanpa jeda ini iframe
  // dimuat ulang di setiap ketikan — boros dan membuat tampilan berkedip.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      buildPreviewHtml(page)
        .then((html) => active && setPreview(html))
        .catch(() => active && setPreview(""));
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page]);

  // Baca dimensi gambar yang sudah tersimpan (mis. setelah memuat konfigurasi).
  useEffect(() => {
    const read = (dataUrl: string, set: (info: ImageInfo | null) => void) => {
      if (!dataUrl) return set(null);
      const img = new Image();
      img.onload = () =>
        set({
          width: img.naturalWidth,
          height: img.naturalHeight,
          // Perkiraan ukuran asli dari panjang base64.
          bytes: Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75),
        });
      img.onerror = () => set(null);
      img.src = dataUrl;
    };
    read(page.logoDataUrl, setLogoInfo);
    read(page.bgImageDataUrl, setBgInfo);
    read(page.formImageDataUrl, setFormInfo);
  }, [page.logoDataUrl, page.bgImageDataUrl, page.formImageDataUrl]);

  const pickImage = (
    file: File,
    kind: "logo" | "background" | "form",
    onError: (message: string) => void,
  ) => {
    const limit = IMAGE_LIMITS[kind];
    onError("");
    if (!file.type.startsWith("image/")) {
      onError("Berkas harus berupa gambar (PNG, JPG, WEBP, atau SVG).");
      return;
    }

    if (file.size > limit.maxBytes) {
      onError(
        `Ukuran berkas ${formatSize(file.size)} — maksimal ${formatSize(limit.maxBytes)}. ` +
          `Perkecil dulu agar tidak memenuhi penyimpanan router.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (kind === "logo") setPage({ logoDataUrl: dataUrl, logoName: file.name });
      // Gambar di dalam kartu baru terlihat bila kartunya agak tembus pandang.
      else if (kind === "form")
        setPage({
          formImageDataUrl: dataUrl,
          formImageName: file.name,
          formBgOpacity: Math.min(page.formBgOpacity ?? 100, 80),
        });
      else setPage({ bgImageDataUrl: dataUrl, bgImageName: file.name });
    };
    reader.onerror = () => onError("Gagal membaca berkas.");
    reader.readAsDataURL(file);
  };

  /** Catatan bila dimensi gambar jauh dari ukuran yang disarankan. */
  const dimensionNote = (info: ImageInfo | null, kind: "logo" | "background" | "form") => {
    if (!info) return null;
    const limit = IMAGE_LIMITS[kind];
    const tooBig = info.width > limit.idealWidth * 2 || info.height > limit.idealHeight * 2;
    const tooSmall = info.width < limit.idealWidth / 2.5;
    return (
      <p className={`mt-1.5 text-xs ${tooBig || tooSmall ? "text-warn" : "text-faint"}`}>
        {info.width} × {info.height} px · {formatSize(info.bytes)}
        {tooBig && " — jauh lebih besar dari yang diperlukan, perkecil agar halaman cepat terbuka."}
        {tooSmall && " — terlalu kecil, bisa terlihat pecah di layar besar."}
      </p>
    );
  };

  const totalImageBytes = (logoInfo?.bytes ?? 0) + (bgInfo?.bytes ?? 0) + (formInfo?.bytes ?? 0);

  const swatches = (
    presets: string[],
    value: string,
    onPick: (color: string) => void,
    label: string,
  ) => (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
        {label}
      </span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={`${label} ${color}`}
            aria-pressed={value.toLowerCase() === color}
            onClick={() => onPick(color)}
            className={`h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110 ${
              value.toLowerCase() === color ? "border-ink" : "border-line"
            }`}
            style={{ background: color }}
          />
        ))}
        <input
          type="color"
          aria-label={`${label} khusus`}
          value={isHexColor(value) ? value : "#38bdf8"}
          onChange={(e) => onPick(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded-lg border border-line bg-canvas p-1"
        />
      </div>
    </div>
  );

  return (
    <div>

      <div className="grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-3 lg:sticky lg:top-20 lg:h-[calc(100vh-10rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
          <Section title="Nama & sambutan" defaultOpen>
            <Field
              label="Nama hotspot"
              hint={
                page.template === "poster"
                  ? "Tanda | mewarnai kata sesudahnya, misalnya PRO|NET. Kosongkan bila cukup logo saja."
                  : "Kosongkan bila cukup logo saja. Nama/identity router tidak ikut ditampilkan."
              }
            >
              <TextInput
                value={page.title}
                onChange={(title) => setPage({ title })}
                placeholder={page.template === "poster" ? "PRO|NET" : "Warnet Kita"}
              />
            </Field>
          {swatches(TITLE_PRESETS, page.titleColor ?? "", (c) => setPage({ titleColor: c }), "Warna nama hotspot")}
          {page.titleColor && (
            <button
              type="button"
              onClick={() => setPage({ titleColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna nama otomatis
            </button>
          )}
            <Field label="Teks sambutan" hint="Tampil di bawah nama hotspot.">
              <TextInput
                value={page.subtitle}
                onChange={(subtitle) => setPage({ subtitle })}
                placeholder="Internet cepat untuk semua"
              />
            </Field>
          {swatches(TITLE_PRESETS, page.subtitleColor ?? "", (c) => setPage({ subtitleColor: c }), "Warna teks sambutan")}
          {page.subtitleColor && (
            <button
              type="button"
              onClick={() => setPage({ subtitleColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna sambutan otomatis
            </button>
          )}

          </Section>

          <Section title="Kartu form">
          {swatches(FORM_PRESETS, page.formBgColor ?? "", (c) => setPage({ formBgColor: c }), "Warna form")}
          {page.formBgColor && (
            <button
              type="button"
              onClick={() => setPage({ formBgColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna form otomatis
            </button>
          )}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                Lebar form
              </span>
              <span className="font-mono text-[11px] text-brand">{page.formWidth ?? 390} px</span>
            </div>
            <input
              type="range"
              min={300}
              max={720}
              step={10}
              value={page.formWidth ?? 390}
              aria-label="Lebar kartu form"
              onChange={(e) => setPage({ formWidth: Number(e.target.value) })}
              className="mt-2 w-full accent-[color:var(--color-brand)]"
            />
            <p className="mt-1 text-xs leading-relaxed text-faint">
              Lebar maksimal kartu login. Di HP kartunya tetap menyesuaikan lebar layar.
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                Garis tepi form
              </span>
              <span className="font-mono text-[11px] text-brand">
                {(page.formBorderWidth ?? 1) === 0 ? "tanpa garis" : `${page.formBorderWidth ?? 1} px`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={8}
              step={1}
              value={page.formBorderWidth ?? 1}
              aria-label="Tebal garis tepi form"
              onChange={(e) => setPage({ formBorderWidth: Number(e.target.value) })}
              className="mt-2 w-full accent-[color:var(--color-brand)]"
            />
            <p className="mt-1 text-xs leading-relaxed text-faint">
              Geser ke 0 untuk menghilangkan garis tepi kartu form.
            </p>
            {(page.formBorderWidth ?? 1) > 0 && (
              <div className="mt-3 space-y-2">
                {swatches(BORDER_PRESETS, page.formBorderColor ?? "", (c) => setPage({ formBorderColor: c }), "Warna garis")}
                {page.formBorderColor && (
                  <button
                    type="button"
                    onClick={() => setPage({ formBorderColor: "" })}
                    className="text-xs text-brand hover:underline"
                  >
                    Kembali ke warna garis otomatis
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                Sudut form (border radius)
              </span>
              <span className="font-mono text-[11px] text-brand">
                {(page.formRadius ?? 16) === 0 ? "siku-siku" : `${page.formRadius ?? 16} px`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={2}
              value={page.formRadius ?? 16}
              aria-label="Kelengkungan sudut kartu form"
              onChange={(e) => setPage({ formRadius: Number(e.target.value) })}
              className="mt-2 w-full accent-[color:var(--color-brand)]"
            />
            <p className="mt-1 text-xs leading-relaxed text-faint">
              0 membuat sudut kartu siku-siku; makin besar makin membulat.
            </p>
          </div>          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                Kepekatan form
              </span>
              <span className="font-mono text-[11px] text-brand">
                {page.formBgOpacity ?? 100}%{(page.formBgOpacity ?? 100) === 0 ? " · tembus pandang penuh" : (page.formBgOpacity ?? 100) < 100 ? " · transparan" : ""}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={page.formBgOpacity ?? 100}
              aria-label="Kepekatan latar kartu form"
              onChange={(e) => setPage({ formBgOpacity: Number(e.target.value) })}
              className="mt-2 w-full accent-[color:var(--color-brand)]"
            />
            <p className="mt-1 text-xs leading-relaxed text-faint">
              100% penuh. Turunkan agar kartu form tembus pandang dan latar halaman terlihat di baliknya.
            </p>
          </div>
          <div>
              {/* Gambar di dalam kartu form */}
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                  Gambar form
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => formInput.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />
                    {page.formImageDataUrl ? "Ganti" : "Unggah gambar form"}
                  </Button>
                  {page.formImageDataUrl && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="px-2"
                      ariaLabel="Hapus gambar form"
                      title="Hapus gambar form"
                      onClick={() => setPage({ formImageDataUrl: "", formImageName: "" })}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <input
                    ref={formInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) pickImage(file, "form", setFormError);
                    }}
                  />
                </div>
                {page.formImageDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={page.formImageDataUrl}
                    alt="Pratinjau gambar form"
                    className="mt-3 h-16 w-full rounded-md border border-line-soft object-cover"
                  />
                )}
                <p className="mt-2 text-xs leading-relaxed text-faint">
                  {IMAGE_LIMITS.form.hint} Turunkan &ldquo;Kepekatan form&rdquo; di bagian ini
                  agar gambarnya terlihat.
                </p>
                {dimensionNote(formInfo, "form")}
                {formError && <p className="mt-1.5 text-xs text-bad">{formError}</p>}
              </div>
          </div>
          <p className="-mt-1 text-xs leading-relaxed text-faint">
            Warna teks dan garis dihitung otomatis dari warna latar maupun warna form, jadi
            halaman tetap terbaca meski Anda memilih warna terang atau gelap.
          </p>

          </Section>

          {/* Logo */}
          <Section title="Logo">
          <div>
              {/* Logo */}
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                  Logo
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => logoInput.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />
                    {page.logoDataUrl ? "Ganti" : "Unggah logo"}
                  </Button>
                  {page.logoDataUrl && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="px-2"
                      ariaLabel="Hapus logo"
                      title="Hapus logo"
                      onClick={() => setPage({ logoDataUrl: "", logoName: "" })}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) pickImage(file, "logo", setLogoError);
                    }}
                  />
                </div>
                {galleryPicker("logo", logoGallery, page.logoName)}
                <div className="mt-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Letak logo</span>
                  <div className="mt-2 flex gap-1.5">
                    {(
                      [
                        { value: "inside", label: "Di dalam form" },
                        { value: "above", label: "Di atas form" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={(page.logoPosition ?? "inside") === o.value}
                        onClick={() => setPage({ logoPosition: o.value })}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          (page.logoPosition ?? "inside") === o.value
                            ? "border-brand bg-brand/10 text-ink"
                            : "border-line-soft text-muted hover:border-line hover:text-ink"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {page.template === "poster" && (
                    <p className="mt-1.5 text-xs text-faint">Desain Poster tidak punya kartu form, jadi pilihan ini hanya berlaku di desain Minimal.</p>
                  )}
                </div>
                {page.logoDataUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.logoDataUrl}
                      alt="Pratinjau logo"
                      className="mt-3 w-full rounded-md border border-line-soft bg-canvas object-contain p-1.5"
                      style={{ height: `${page.logoHeight}px` }}
                    />
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                          Tinggi logo
                        </span>
                        <span className="font-mono text-[11px] text-brand">
                          {page.logoHeight} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={40}
                        max={260}
                        step={5}
                        value={page.logoHeight}
                        aria-label="Tinggi tampil logo"
                        onChange={(e) => setPage({ logoHeight: Number(e.target.value) })}
                        className="mt-2 w-full accent-[color:var(--color-brand)]"
                      />
                      <p className="mt-1.5 text-xs leading-relaxed text-faint">
                        Lebar menyesuaikan sendiri mengikuti bentuk logo, maksimal selebar kartu.
                      </p>
                    </div>
                  </>
                )}
                {recommendBox("logo")}
                {dimensionNote(logoInfo, "logo")}
                {logoError && <p className="mt-1.5 text-xs text-bad">{logoError}</p>}
              </div>

          </div>
          </Section>

          {/* Background */}
          <Section title="Background">
          {swatches(BG_PRESETS, page.bgColor, (c) => setPage({ bgColor: c }), "Warna latar halaman")}
          <div>
              {/* Gambar latar */}
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                  Gambar latar
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => bgInput.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />
                    {page.bgImageDataUrl ? "Ganti" : "Unggah latar"}
                  </Button>
                  {page.bgImageDataUrl && (
                    <Button
                      size="sm"
                      variant="danger"
                      className="px-2"
                      ariaLabel="Hapus gambar latar"
                      title="Hapus gambar latar"
                      onClick={() => setPage({ bgImageDataUrl: "", bgImageName: "" })}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <input
                    ref={bgInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) pickImage(file, "background", setBgError);
                    }}
                  />
                </div>
                {galleryPicker("background", gallery, page.bgImageName)}
                {page.bgImageDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={page.bgImageDataUrl}
                    alt="Pratinjau gambar latar"
                    className="mt-3 h-16 w-full rounded-md border border-line-soft object-cover"
                  />
                )}
                {recommendBox("background")}
                {dimensionNote(bgInfo, "background")}
                {bgError && <p className="mt-1.5 text-xs text-bad">{bgError}</p>}
              </div>


            {page.bgImageDataUrl && (
              <div className="mt-4 border-t border-line-soft pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                    Kepekatan lapisan gelap
                  </span>
                  <span className="font-mono text-[11px] text-brand">{page.bgOverlay}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={page.bgOverlay}
                  aria-label="Kepekatan lapisan gelap di atas gambar latar"
                  onChange={(e) => setPage({ bgOverlay: Number(e.target.value) })}
                  className="mt-2 w-full accent-[color:var(--color-brand)]"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-faint">
                  Lapisan warna latar di atas foto. Naikkan bila teks jadi sulit dibaca karena
                  fotonya ramai.
                </p>

                <div className="mt-4">
                  <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                    Mode gambar
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {BG_FITS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        title={f.hint}
                        aria-pressed={(page.bgFit ?? "cover") === f.value}
                        onClick={() => setPage({ bgFit: f.value })}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          (page.bgFit ?? "cover") === f.value
                            ? "border-brand bg-brand/10 text-ink"
                            : "border-line-soft text-muted hover:border-line hover:text-ink"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-faint">
                    {BG_FITS.find((f) => f.value === (page.bgFit ?? "cover"))?.hint}
                  </p>
                </div>

                <div className="mt-4">
                  <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                    Fokus gambar
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {BG_POSITIONS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        aria-pressed={(page.bgPosition ?? "center") === p.value}
                        onClick={() => setPage({ bgPosition: p.value })}
                        className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          (page.bgPosition ?? "center") === p.value
                            ? "border-brand bg-brand/10 text-ink"
                            : "border-line-soft text-muted hover:border-line hover:text-ink"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-faint">
                    Gambar otomatis menutupi seluruh layar HP, tablet, maupun laptop. Bila ada bagian
                    yang terpotong, pilih sisi gambar yang ingin tetap terlihat.
                  </p>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-faint">
              Semua gambar ikut masuk ke paket dan di-upload ke router — tidak boleh diambil dari
              internet, karena klien belum punya akses sebelum login.
              {totalImageBytes > 0 && (
                <>
                  {" "}
                  Total gambar saat ini <span className="text-muted">{formatSize(totalImageBytes)}</span>.
                </>
              )}
            </p>
          </div>
          </Section>

          {/* Mode login */}
          <Section title="Mode login">
            <div className={grid2}>
              <Field
                label="Mode saat halaman dibuka"
                hint="Mode voucher menyembunyikan kolom password dan mengisinya otomatis dari kode."
              >
                <Select
                  value={page.loginMode}
                  placeholder=""
                  onChange={(loginMode) => setPage({ loginMode: loginMode as LoginMode })}
                  options={[
                    { value: "voucher", label: "Voucher — satu kolom kode" },
                    { value: "member", label: "Member — username + password" },
                  ]}
                />
              </Field>
              <div className="space-y-3">
                <Toggle
                  checked={page.showModeSwitch}
                  onChange={(showModeSwitch) => setPage({ showModeSwitch })}
                  label="Tampilkan tombol Voucher / Member"
                  hint="Pengguna bisa berpindah sendiri antara dua mode."
                />
                <Toggle
                  checked={page.showTrial}
                  onChange={(showTrial) => setPage({ showTrial })}
                  label="Tampilkan tautan coba gratis"
                  hint="Hanya muncul bila fitur trial diaktifkan di profil hotspot router."
                />
              </div>
            </div>
          </Section>

          <Section title="Tombol">
          {swatches(PRIMARY_PRESETS, page.primaryColor, (c) => setPage({ primaryColor: c }), "Warna tombol Voucher")}
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                Kecerahan warna tombol Voucher
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] text-brand">
                <span
                  aria-hidden
                  className="h-3.5 w-3.5 rounded border border-line"
                  style={{ background: adjustBrightness(page.primaryColor, page.primaryBrightness ?? 100) }}
                />
                {page.primaryBrightness ?? 100}%
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={150}
              step={5}
              value={page.primaryBrightness ?? 100}
              aria-label="Kecerahan warna tombol Voucher"
              onChange={(e) => setPage({ primaryBrightness: Number(e.target.value) })}
              className="mt-2 w-full accent-[color:var(--color-brand)]"
            />
            <div className="mt-1 flex items-center justify-between text-xs text-faint">
              <span>Lebih gelap</span>
              {(page.primaryBrightness ?? 100) !== 100 && (
                <button
                  type="button"
                  onClick={() => setPage({ primaryBrightness: 100 })}
                  className="text-brand hover:underline"
                >
                  Atur ulang 100%
                </button>
              )}
              <span>Lebih terang</span>
            </div>
          </div>
          {swatches(PRIMARY_PRESETS, page.buttonColor ?? "", (c) => setPage({ buttonColor: c }), "Warna tombol Login")}
          {page.buttonColor && (
            <button
              type="button"
              onClick={() => setPage({ buttonColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna tombol otomatis (sama dengan tombol Voucher)
            </button>
          )}
          {swatches(BUTTON_TEXT_PRESETS, page.buttonTextColor ?? "", (c) => setPage({ buttonTextColor: c }), "Warna font tombol")}
          {page.buttonTextColor && (
            <button
              type="button"
              onClick={() => setPage({ buttonTextColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna font otomatis (hitam/putih sesuai warna tombol)
            </button>
          )}
          </Section>

          <Section title="Petunjuk & placeholder">
          <Field label="Petunjuk mode Voucher" hint="Kalimat di atas kolom login saat mode Voucher.">
            <TextInput
              value={page.hintVoucher ?? ""}
              onChange={(hintVoucher) => setPage({ hintVoucher })}
              placeholder={textDefaults(page.template).hintVoucher}
            />
          </Field>
          <Field label="Petunjuk mode Member" hint="Kalimat di atas kolom login saat mode Member.">
            <TextInput
              value={page.hintMember ?? ""}
              onChange={(hintMember) => setPage({ hintMember })}
              placeholder={textDefaults(page.template).hintMember}
            />
          </Field>
          {swatches(TITLE_PRESETS, page.hintColor ?? "", (c) => setPage({ hintColor: c }), "Warna petunjuk")}
          {page.hintColor && (
            <button
              type="button"
              onClick={() => setPage({ hintColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna petunjuk otomatis
            </button>
          )}
          <Field label="Placeholder kode voucher" hint="Tulisan abu-abu di dalam kolom saat mode Voucher.">
            <TextInput
              value={page.placeholderVoucher ?? ""}
              onChange={(placeholderVoucher) => setPage({ placeholderVoucher })}
              placeholder={textDefaults(page.template).phVoucher}
            />
          </Field>
          <Field label="Placeholder username" hint="Kolom username saat mode Member.">
            <TextInput
              value={page.placeholderUsername ?? ""}
              onChange={(placeholderUsername) => setPage({ placeholderUsername })}
              placeholder="Username"
            />
          </Field>
          <Field label="Placeholder password" hint="Kolom password saat mode Member.">
            <TextInput
              value={page.placeholderPassword ?? ""}
              onChange={(placeholderPassword) => setPage({ placeholderPassword })}
              placeholder="Password"
            />
          </Field>
          </Section>
          <Section title="Teks berjalan">
          <Toggle
            checked={page.marqueeEnabled !== false}
            onChange={(marqueeEnabled) => setPage({ marqueeEnabled })}
            label="Tampilkan teks berjalan"
            hint="Matikan untuk menyembunyikannya tanpa menghapus teksnya."
          />
          {page.marqueeEnabled !== false && (
            <>
              <Field label="Teks" hint="Muncul sebagai teks bergerak (marquee). Kosongkan bila tidak perlu.">
                <TextInput
                  value={page.marquee}
                  onChange={(marquee) => setPage({ marquee })}
                  placeholder="Selamat datang di jaringan hotspot kami"
                />
              </Field>
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Letak</span>
                <div className="mt-2 flex gap-1.5">
                  {(
                    [
                      { value: "top", label: "Di atas form" },
                      { value: "bottom", label: "Di bawah form" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={(page.marqueePosition ?? "top") === o.value}
                      onClick={() => setPage({ marqueePosition: o.value })}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        (page.marqueePosition ?? "top") === o.value
                          ? "border-brand bg-brand/10 text-ink"
                          : "border-line-soft text-muted hover:border-line hover:text-ink"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Toggle
                  checked={page.marqueeNoBg === true}
                  onChange={(marqueeNoBg) => setPage({ marqueeNoBg })}
                  label="Tanpa warna latar"
                  hint="Hanya tulisan yang bergerak, tanpa bar berwarna di belakangnya."
                />
                {page.marqueeNoBg !== true &&
                  swatches(MARQUEE_PRESETS, page.marqueeBgColor ?? "", (c) => setPage({ marqueeBgColor: c }), "Warna latar bar")}
                {swatches(TITLE_PRESETS, page.marqueeTextColor ?? "", (c) => setPage({ marqueeTextColor: c }), "Warna font")}
                {page.marqueeTextColor && (
                  <button
                    type="button"
                    onClick={() => setPage({ marqueeTextColor: "" })}
                    className="text-xs text-brand hover:underline"
                  >
                    Kembali ke warna font otomatis
                  </button>
                )}
                <p className="text-xs leading-relaxed text-faint">
                  Warna teks berjalan berdiri sendiri — tidak ikut warna tombol Voucher.
                </p>
              </div>
            </>
          )}
          </Section>

          {/* Tabel paket */}
          <Section title="Tabel harga paket">
          <Field label="Desain daftar paket" hint="Berlaku di desain Minimal. Desain Poster selalu memakai kartu harga.">
            <Select
              value={page.packageStyle ?? "table"}
              placeholder=""
              onChange={(packageStyle) => setPage({ packageStyle: packageStyle as "table" | "cards" | "list" })}
              options={[
                { value: "table", label: "Tabel — kepala berwarna, baris selang-seling" },
                { value: "cards", label: "Kartu — kotak harga berdampingan" },
                { value: "list", label: "Daftar — baris dengan lencana harga" },
              ]}
            />
          </Field>
          <div className="space-y-2">
            {swatches(PRIMARY_PRESETS, page.tableColor ?? "", (c) => setPage({ tableColor: c }), "Warna tabel harga")}
            {page.tableColor && (
              <button
                type="button"
                onClick={() => setPage({ tableColor: "" })}
                className="text-xs text-brand hover:underline"
              >
                Kembali ke warna tabel otomatis (sama dengan tombol Voucher)
              </button>
            )}
            {swatches(BUTTON_TEXT_PRESETS, page.tableTextColor ?? "", (c) => setPage({ tableTextColor: c }), "Warna font tabel")}
            {page.tableTextColor && (
              <button
                type="button"
                onClick={() => setPage({ tableTextColor: "" })}
                className="text-xs text-brand hover:underline"
              >
                Kembali ke warna font otomatis
              </button>
            )}
            <p className="text-xs leading-relaxed text-faint">
              Warna kepala tabel (desain Minimal) atau kartu harga (desain Poster). Tulisannya menyesuaikan otomatis.
            </p>
          </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setPage({ packages: [...page.packages, newPackage()] })}>
                <Plus className="h-3.5 w-3.5" /> Tambah paket
              </Button>
            </div>
            {page.packages.length === 0 ? (
              <EmptyState>Belum ada paket. Tabel tidak akan tampil di halaman login.</EmptyState>
            ) : (
              <div className="space-y-3">
                {page.packages.map((pkg, index) => (
                  <div key={pkg.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-line-soft p-3">
                    <Field label="Nama paket" className="flex-1">
                      <TextInput
                        value={pkg.name}
                        onChange={(name) =>
                          setPage({
                            packages: page.packages.map((p) => (p.id === pkg.id ? { ...p, name } : p)),
                          })
                        }
                        placeholder="2 Jam"
                      />
                    </Field>
                    <Field label="Durasi" className="flex-1">
                      <TextInput
                        value={pkg.duration}
                        onChange={(duration) =>
                          setPage({
                            packages: page.packages.map((p) =>
                              p.id === pkg.id ? { ...p, duration } : p,
                            ),
                          })
                        }
                        placeholder="2 jam"
                      />
                    </Field>
                    <Field label="Masa aktif" className="flex-1">
                      <TextInput
                        value={pkg.validity}
                        onChange={(validity) =>
                          setPage({
                            packages: page.packages.map((p) =>
                              p.id === pkg.id ? { ...p, validity } : p,
                            ),
                          })
                        }
                        placeholder="opsional"
                      />
                    </Field>
                    <Field label="Harga" className="flex-1">
                      <TextInput
                        value={pkg.price}
                        onChange={(price) =>
                          setPage({
                            packages: page.packages.map((p) => (p.id === pkg.id ? { ...p, price } : p)),
                          })
                        }
                        placeholder="Rp 5.000"
                      />
                    </Field>
                    <Button
                      variant="danger"
                      className="col-span-2 px-3"
                      ariaLabel={`Hapus paket ${index + 1}`}
                      title={`Hapus paket ${index + 1}`}
                      onClick={() =>
                        setPage({ packages: page.packages.filter((p) => p.id !== pkg.id) })
                      }
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="WhatsApp">
          <Toggle
            checked={page.whatsappEnabled !== false}
            onChange={(whatsappEnabled) => setPage({ whatsappEnabled })}
            label="Tampilkan tombol WhatsApp"
            hint="Matikan untuk menyembunyikannya tanpa menghapus nomornya."
          />
          {page.whatsappEnabled !== false && (
            <>
              <div className={grid2}>
                <Field
                  label="Nomor WhatsApp"
                  hint={
                    whatsappLink(page.whatsapp)
                      ? whatsappLink(page.whatsapp)
                      : "Kosongkan bila tidak perlu tombol WhatsApp."
                  }
                >
                  <TextInput
                    mono
                    value={page.whatsapp}
                    onChange={(whatsapp) => setPage({ whatsapp })}
                    placeholder="081234567890"
                  />
                </Field>
                <Field label="Teks tombol WhatsApp">
                  <TextInput
                    value={page.whatsappLabel}
                    onChange={(whatsappLabel) => setPage({ whatsappLabel })}
                    placeholder="Beli voucher via WhatsApp"
                  />
                </Field>
              </div>

              {whatsappLink(page.whatsapp) && (
                <Note>
                  Supaya tombol WhatsApp bisa dibuka sebelum klien login, aktifkan toggle{" "}
                  &ldquo;Walled-garden WhatsApp (wa.me)&rdquo; pada hotspot terkait di menu Setup
                  Mikrotik Baru → IP Hotspot.
                </Note>
              )}

              {swatches(WA_PRESETS, page.whatsappColor ?? "", (c) => setPage({ whatsappColor: c }), "Warna tombol")}
              {swatches(BUTTON_TEXT_PRESETS, page.whatsappTextColor ?? "", (c) => setPage({ whatsappTextColor: c }), "Warna tulisan tombol")}
              {(page.whatsappColor || page.whatsappTextColor) && (
                <button
                  type="button"
                  onClick={() => setPage({ whatsappColor: "", whatsappTextColor: "" })}
                  className="-mt-1 text-xs text-brand hover:underline"
                >
                  Kembali ke warna bawaan (hijau WhatsApp)
                </button>
              )}
              <div className={grid2}>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Tinggi tombol</span>
                    <span className="font-mono text-[11px] text-brand">{page.whatsappHeight ?? 48} px</span>
                  </div>
                  <input
                    type="range"
                    min={32}
                    max={72}
                    step={2}
                    value={page.whatsappHeight ?? 48}
                    aria-label="Tinggi tombol WhatsApp"
                    onChange={(e) => setPage({ whatsappHeight: Number(e.target.value) })}
                    className="mt-2 w-full accent-[color:var(--color-brand)]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Ukuran tulisan</span>
                    <span className="font-mono text-[11px] text-brand">{page.whatsappFontSize ?? 15} px</span>
                  </div>
                  <input
                    type="range"
                    min={11}
                    max={24}
                    step={1}
                    value={page.whatsappFontSize ?? 15}
                    aria-label="Ukuran tulisan tombol WhatsApp"
                    onChange={(e) => setPage({ whatsappFontSize: Number(e.target.value) })}
                    className="mt-2 w-full accent-[color:var(--color-brand)]"
                  />
                </div>
              </div>
            </>
          )}
          </Section>

          <Section title="Catatan & footer">
          <div className={grid2}>
            <Field label="Catatan / syarat pemakaian">
              <TextInput
                value={page.terms}
                onChange={(terms) => setPage({ terms })}
                placeholder="Dilarang mengunduh berkas berukuran besar."
              />
            </Field>
            <Field label="Teks footer">
              <TextInput
                value={page.footer}
                onChange={(footer) => setPage({ footer })}
                placeholder="© 2026 Warnet Kita"
              />
            </Field>
          </div>
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Letak footer</span>
            <div className="mt-2 flex gap-1.5">
              {(
                [
                  { value: "inside", label: "Di dalam form" },
                  { value: "outside", label: "Di bawah form (di luar)" },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={(page.footerPosition ?? "inside") === o.value}
                  onClick={() => setPage({ footerPosition: o.value })}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    (page.footerPosition ?? "inside") === o.value
                      ? "border-brand bg-brand/10 text-ink"
                      : "border-line-soft text-muted hover:border-line hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {page.template === "poster" && (
              <p className="mt-1.5 text-xs text-faint">Pada desain Poster footer selalu di bawah halaman; pilihan ini berlaku di desain Minimal.</p>
            )}
          </div>
          </Section>

          <Section title="Warna font">
          {swatches(TITLE_PRESETS, page.textColor ?? "", (c) => setPage({ textColor: c }), "Warna font")}
          {page.textColor && (
            <button
              type="button"
              onClick={() => setPage({ textColor: "" })}
              className="-mt-1 text-xs text-brand hover:underline"
            >
              Kembali ke warna font otomatis
            </button>
          )}
          <p className="-mt-1 text-xs leading-relaxed text-faint">
            Warna font berlaku untuk seluruh tulisan di halaman login, kecuali nama hotspot dan teks sambutan
            (diatur di bagian &ldquo;Nama &amp; sambutan&rdquo;), teks berjalan, serta tulisan di dalam tombol berwarna.
          </p>
          </Section>
        </div>

        {/* Pratinjau — satu panel setinggi kolom menu di kiri, seperti studio */}
        <div className="flex h-[75vh] min-h-[480px] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:sticky lg:top-20 lg:h-[calc(100vh-10rem)] lg:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Pratinjau</span>
              <span className="font-mono text-[10px] text-faint">
                {device.name} · {device.w} × {device.h}
                {scale < 1 && ` · ${Math.round(scale * 100)}%`}
              </span>
            </div>
            <div className="flex gap-1 rounded-lg border border-line bg-canvas p-1">
              {DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={d.id === device.id}
                  onClick={() => setDevice(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    d.id === device.id
                      ? "bg-brand text-[color:var(--color-brand-ink)]"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div
            ref={stage}
            className="relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-raised/60"
          >
            {preview ? (
              (() => {
                const isHp = device.id === "hp";
                const pad = isHp ? IPHONE_PAD : 0;
                const fw = device.w + pad * 2;
                const fh = device.h + pad * 2;
                const frame = (
                  <iframe
                    key={device.id}
                    title="Pratinjau halaman login hotspot"
                    srcDoc={preview}
                    sandbox="allow-scripts"
                    className="block border-0 bg-white"
                    style={{
                      width: device.w,
                      height: device.h,
                      borderRadius: isHp ? 0 : device.id === "tablet" ? 18 : 6,
                      boxShadow: isHp ? undefined : "0 10px 30px -12px rgba(0,0,0,.35)",
                    }}
                  />
                );
                return (
                  <div style={{ width: fw * scale, height: fh * scale }}>
                    <div style={{ width: fw, height: fh, transform: `scale(${scale})`, transformOrigin: "top left" }}>
                      {isHp ? <IphoneFrame width={device.w} height={device.h}>{frame}</IphoneFrame> : frame}
                    </div>
                  </div>
                );
              })()
            ) : (
              <span className="text-xs text-faint">Memuat pratinjau…</span>
            )}
          </div>

          <p className="border-t border-line-soft px-3 py-1.5 text-[11px] leading-relaxed text-faint">
            Tombol Voucher/Member berfungsi di pratinjau ini. Kolom login tidak mengirim apa pun.
          </p>
        </div>      </div>
    </div>
  );
}
