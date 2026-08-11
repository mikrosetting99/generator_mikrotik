"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Trash, Upload } from "@/components/icons";
import { Button, EmptyState, Field, Note, Select, TextInput, Toggle } from "@/components/ui";
import { newPackage } from "@/lib/defaults-hotspot-login";
import {
  fetchLoginTemplate,
  fetchStyle,
  isHexColor,
  renderTemplate,
  templateVars,
  TEMPLATES,
  whatsappLink,
} from "@/lib/hotspot-page";
import type { HotspotPageConfig, LoginMode } from "@/lib/types-hotspot-login";

const grid2 = "grid gap-4 sm:grid-cols-2";

const PRIMARY_PRESETS = ["#38bdf8", "#22c55e", "#f59e0b", "#2563eb", "#a78bfa", "#f43f5e", "#14b8a6"];
const BG_PRESETS = ["#0b1220", "#07070d", "#141a2c", "#1c1917", "#eef2f7", "#ffffff", "#fdf4e3"];
/**
 * Batas ukuran berkas gambar. Penyimpanan flash router terbatas — hAP lite
 * hanya punya 16 MB — jadi paket halaman login harus tetap ringan.
 */
const IMAGE_LIMITS = {
  logo: {
    maxBytes: 200 * 1024,
    idealWidth: 400,
    idealHeight: 160,
    hint: "Ideal 400 × 160 px (rasio 5:2), PNG latar transparan, maksimal 200 KB.",
  },
  background: {
    maxBytes: 600 * 1024,
    idealWidth: 1600,
    idealHeight: 900,
    hint: "Ideal 1600 × 900 px (rasio 16:9), JPG, maksimal 600 KB.",
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
  const [logoInfo, setLogoInfo] = useState<ImageInfo | null>(null);
  const [bgInfo, setBgInfo] = useState<ImageInfo | null>(null);
  const [preview, setPreview] = useState("");

  // Pratinjau: gabungkan login.html + style.css milik desain terpilih, lalu
  // ganti variabel RouterOS dengan contoh nilai supaya terbaca wajar.
  //
  // Dirender ulang setelah pengetikan berhenti sejenak. Tanpa jeda ini iframe
  // dimuat ulang di setiap ketikan — boros dan membuat tampilan berkedip.
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      Promise.all([fetchLoginTemplate(page.template), fetchStyle(page.template)])
        .then(([source, style]) => {
          if (!active) return;
          // Di pratinjau, berkas gambar diganti data URI-nya langsung.
          const vars = {
            ...templateVars(page),
            LOGO: page.logoDataUrl,
            BG_IMAGE: page.bgImageDataUrl,
          };
          const html = renderTemplate(source, vars)
            // Sisipkan CSS langsung, karena iframe tidak bisa memuat style.css.
            .replace(
              /<link rel="stylesheet" href="style\.css">/,
              `<style>${renderTemplate(style, vars)}</style>`,
            )
            // Halaman asli memindahkan kursor ke kolom username saat dimuat.
            // Di dalam iframe, fokus itu membuat browser menggulung halaman ke
            // posisi pratinjau — form di atasnya jadi tersentak setiap render.
            .replace(/^\s*username\.focus\(\);\s*$/gm, "")
            .replace(/\$\(if error\)[\s\S]*?\$\(endif\)/g, "")
            .replace(/\$\(if chap-id\)[\s\S]*?\$\(endif\)/g, "")
            .replace(/\$\(if trial == 'yes'\)/g, "")
            .replace(/\$\(endif\)/g, "")
            .replace(/\$\(ip-address\)/g, "192.168.20.25")
            .replace(/\$\([^)]*\)/g, "");
          setPreview(html);
        })
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
  }, [page.logoDataUrl, page.bgImageDataUrl]);

  const pickImage = (
    file: File,
    kind: "logo" | "background",
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
      else setPage({ bgImageDataUrl: dataUrl, bgImageName: file.name });
    };
    reader.onerror = () => onError("Gagal membaca berkas.");
    reader.readAsDataURL(file);
  };

  /** Catatan bila dimensi gambar jauh dari ukuran yang disarankan. */
  const dimensionNote = (info: ImageInfo | null, kind: "logo" | "background") => {
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

  const totalImageBytes = (logoInfo?.bytes ?? 0) + (bgInfo?.bytes ?? 0);

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
      <p className="text-[13px] leading-relaxed text-muted">
        Paket berisi satu folder <span className="font-mono text-ink">hotspot</span> lengkap —
        seluruh halaman, <span className="font-mono text-ink">style.css</span>,{" "}
        <span className="font-mono text-ink">md5.js</span>, dan{" "}
        <span className="font-mono text-ink">errors.txt</span> berbahasa Indonesia.
      </p>

      {/* Pilihan desain */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {TEMPLATES.map((template) => {
          const active = page.template === template.id;
          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setPage({
                  template: template.id,
                  primaryColor: template.defaultPrimary,
                  bgColor: template.defaultBg,
                })
              }
              className={`rounded-xl border p-3.5 text-left transition-all duration-200 ${
                active ? "border-brand bg-brand/[0.08]" : "border-line-soft bg-canvas/50 hover:border-line"
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full ring-2"
                  style={{ background: template.defaultPrimary, color: template.defaultBg }}
                />
                <span className={`text-sm font-medium ${active ? "text-ink" : "text-muted"}`}>
                  {template.name}
                </span>
                {active && <Check className="ml-auto h-3.5 w-3.5 text-brand" />}
              </span>
              <span className="mt-1.5 block text-xs leading-relaxed text-faint">
                {template.description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className={grid2}>
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
            <Field label="Teks sambutan" hint="Tampil di bawah nama hotspot.">
              <TextInput
                value={page.subtitle}
                onChange={(subtitle) => setPage({ subtitle })}
                placeholder="Internet cepat untuk semua"
              />
            </Field>
          </div>

          {swatches(PRIMARY_PRESETS, page.primaryColor, (c) => setPage({ primaryColor: c }), "Warna tema")}
          {swatches(BG_PRESETS, page.bgColor, (c) => setPage({ bgColor: c }), "Warna latar")}
          <p className="-mt-1 text-xs leading-relaxed text-faint">
            Warna teks, permukaan kartu, dan garis dihitung otomatis dari kecerahan latar, jadi
            halaman tetap terbaca meski Anda memilih latar terang maupun gelap.
          </p>

          {/* Logo & gambar latar */}
          <div className="rounded-xl border border-line-soft bg-raised/50 p-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
              Gambar
            </span>

            <div className="mt-3.5 grid gap-5 sm:grid-cols-2">
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
                <p className="mt-2 text-xs leading-relaxed text-faint">{IMAGE_LIMITS.logo.hint}</p>
                {dimensionNote(logoInfo, "logo")}
                {logoError && <p className="mt-1.5 text-xs text-bad">{logoError}</p>}
              </div>

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
                {page.bgImageDataUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={page.bgImageDataUrl}
                    alt="Pratinjau gambar latar"
                    className="mt-3 h-16 w-full rounded-md border border-line-soft object-cover"
                  />
                )}
                <p className="mt-2 text-xs leading-relaxed text-faint">
                  {IMAGE_LIMITS.background.hint}
                </p>
                {dimensionNote(bgInfo, "background")}
                {bgError && <p className="mt-1.5 text-xs text-bad">{bgError}</p>}
              </div>
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
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-faint">
              Kedua gambar ikut masuk ke paket dan di-upload ke router — tidak boleh diambil dari
              internet, karena klien belum punya akses sebelum login.
              {totalImageBytes > 0 && (
                <>
                  {" "}
                  Total gambar saat ini <span className="text-muted">{formatSize(totalImageBytes)}</span>.
                </>
              )}
            </p>
          </div>

          {/* Mode login */}
          <div className="rounded-xl border border-line-soft bg-raised/50 p-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
              Mode login
            </span>
            <div className={`mt-3.5 ${grid2}`}>
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
          </div>

          <Field label="Teks berjalan" hint="Muncul sebagai marquee di atas form. Kosongkan bila tidak perlu.">
            <TextInput
              value={page.marquee}
              onChange={(marquee) => setPage({ marquee })}
              placeholder="Selamat datang di jaringan hotspot kami"
            />
          </Field>

          {/* Tabel paket */}
          <div className="rounded-xl border border-line-soft bg-raised/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
                Tabel harga paket
              </span>
              <Button size="sm" onClick={() => setPage({ packages: [...page.packages, newPackage()] })}>
                <Plus className="h-3.5 w-3.5" /> Tambah paket
              </Button>
            </div>
            {page.packages.length === 0 ? (
              <EmptyState>Belum ada paket. Tabel tidak akan tampil di halaman login.</EmptyState>
            ) : (
              <div className="space-y-3">
                {page.packages.map((pkg, index) => (
                  <div key={pkg.id} className="flex items-end gap-2">
                    <Field label={index === 0 ? "Nama paket" : ""} className="flex-1">
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
                    <Field label={index === 0 ? "Durasi" : ""} className="flex-1">
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
                    <Field label={index === 0 ? "Masa aktif" : ""} className="flex-1">
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
                    <Field label={index === 0 ? "Harga" : ""} className="flex-1">
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
                      className="px-3"
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
          </div>

          {/* WhatsApp & teks penutup */}
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

          {whatsappLink(page.whatsapp) && (
            <Note>
              Supaya tombol WhatsApp bisa dibuka sebelum klien login, aktifkan toggle{" "}
              &ldquo;Walled-garden WhatsApp (wa.me)&rdquo; pada hotspot terkait di menu Setup
              Mikrotik Baru → IP Hotspot.
            </Note>
          )}
        </div>

        {/* Pratinjau */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
            Pratinjau
          </span>
          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-canvas">
            <div className="flex items-center gap-1.5 border-b border-line-soft px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-line" />
              <span className="h-2 w-2 rounded-full bg-line" />
              <span className="ml-1 font-mono text-[10px] text-faint">login.html</span>
            </div>
            {preview ? (
              <iframe
                title="Pratinjau halaman login hotspot"
                srcDoc={preview}
                sandbox="allow-scripts"
                className="block h-[480px] w-full border-0 bg-white"
              />
            ) : (
              <div className="grid h-[480px] place-items-center text-xs text-faint">
                Memuat pratinjau…
              </div>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-faint">
            Tombol Voucher/Member berfungsi di pratinjau ini. Kolom login tidak mengirim apa pun.
          </p>
        </div>
      </div>
    </div>
  );
}
