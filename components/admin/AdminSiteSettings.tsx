"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, ChevronDown, Plus, Save, Trash, Upload } from "@/components/icons";
import { MenuIcon } from "@/components/MenuIcon";
import { Button, CheckPill, Field, Note, Select, TextInput, Toggle } from "@/components/ui";
import {
  MAX_CUSTOM_MENUS,
  MENU_ICON_LABEL,
  MAX_LOGO_BYTES,
  MENU_ICONS,
  newCustomMenu,
  waLink,
  safeHref,
  type MenuIconName,
  type MenuSetting,
  type SiteSettings,
} from "@/lib/site-settings";

/** Saklar kecil untuk satu kolom pengaturan menu. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
        checked ? "bg-brand" : "bg-line"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

/** Kolom pengaturan: label di atas saklar, supaya sejajar di semua baris. */
const COLS = "sm:grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)_3.5rem_5.5rem]";

/** Atur halaman utama: menu (tampil, pengembangan, wajib login, urutan, tambah) dan teksnya. */
export function AdminSiteSettings({
  initial,
  usage,
}: {
  initial: SiteSettings;
  usage: Record<string, number>;
}) {
  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [saved, setSaved] = useState<SiteSettings>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState("");

  const pickLogo = (file: File) => {
    setLogoError("");
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      setLogoError("Logo harus PNG, JPG, WEBP, atau SVG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`Ukuran ${Math.round(file.size / 1024)} KB — maksimal ${MAX_LOGO_BYTES / 1024} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setSettings((s) => ({ ...s, logoDataUrl: String(reader.result), logoVersion: Date.now() }));
    reader.onerror = () => setLogoError("Gagal membaca berkas.");
    reader.readAsDataURL(file);
  };

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const patch = (partial: Partial<SiteSettings>) => setSettings((s) => ({ ...s, ...partial }));
  const customCount = settings.menus.filter((m) => !m.builtin).length;

  const patchMenu = (id: string, partial: Partial<MenuSetting>) =>
    patch({ menus: settings.menus.map((m) => (m.id === id ? { ...m, ...partial } : m)) });

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= settings.menus.length) return;
    const menus = [...settings.menus];
    [menus[index], menus[target]] = [menus[target], menus[index]];
    patch({ menus });
  };

  const addMenu = () => {
    const menu = newCustomMenu();
    patch({ menus: [...settings.menus, menu] });
    setOpen(menu.id);
  };

  const removeMenu = (menu: MenuSetting) => {
    if (!confirm(`Hapus menu "${menu.title}"?`)) return;
    patch({ menus: settings.menus.filter((m) => m.id !== menu.id) });
  };

  const save = async () => {
    const badLink = settings.menus.find((m) => !m.builtin && !safeHref(m.href));
    if (badLink) {
      setOpen(badLink.id);
      setFlash({
        tone: "bad",
        text: `Alamat menu "${badLink.title}" harus diawali "/" (halaman di situs ini) atau "https://".`,
      });
      return;
    }

    if (settings.waEnabled && !waLink(settings.waNumber, "")) {
      setFlash({ tone: "bad", text: "Nomor WhatsApp belum valid. Isi nomor yang benar atau matikan tombol WhatsApp." });
      return;
    }

    setBusy(true);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.settings) {
        setFlash({ tone: "bad", text: data?.error ?? `Gagal menyimpan (kode ${res.status}).` });
        return;
      }
      setSettings(data.settings);
      setSaved(data.settings);
      setFlash({ tone: "info", text: "Tersimpan. Halaman utama sudah memakai pengaturan ini." });
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {flash && <Note tone={flash.tone}>{flash.text}</Note>}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="border-b border-line-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Identitas situs</h2>
          <p className="mt-0.5 text-xs text-muted">Logo dan nama tampil di pojok kiri atas beranda dan di footer.</p>
        </header>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="flex items-center gap-3">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logoDataUrl} alt="Logo" className="h-full w-full object-contain p-1" />
              ) : (
                <span className="text-[10px] text-faint">tanpa logo</span>
              )}
            </span>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" onClick={() => logoInput.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {settings.logoDataUrl ? "Ganti logo" : "Unggah logo"}
              </Button>
              {settings.logoDataUrl && (
                <Button size="sm" variant="danger" onClick={() => patch({ logoDataUrl: "", logoVersion: 0 })}>
                  <Trash className="h-3.5 w-3.5" /> Hapus
                </Button>
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) pickLogo(file);
                }}
              />
            </div>
          </div>
          <div>
            <Field label="Nama situs">
              <TextInput value={settings.siteName} onChange={(siteName) => patch({ siteName })} />
            </Field>
            <p className="mt-1.5 text-xs text-faint">
              Logo PNG/SVG berlatar transparan, maksimal {MAX_LOGO_BYTES / 1024} KB.
            </p>
            {logoError && <p className="mt-1 text-xs text-bad">{logoError}</p>}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="border-b border-line-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Tombol WhatsApp</h2>
          <p className="mt-0.5 text-xs text-muted">Tombol ajakan (CTA) di beranda untuk menghubungi Anda.</p>
        </header>
        <div className="space-y-4 px-5 py-4">
          <Toggle
            checked={settings.waEnabled}
            onChange={(waEnabled) => patch({ waEnabled })}
            label="Tampilkan tombol WhatsApp"
            hint="Muncul di samping tombol utama di bagian atas beranda."
          />
          {settings.waEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nomor WhatsApp"
                hint={waLink(settings.waNumber, "") || "Isi nomor, mis. 081234567890 — otomatis jadi 62…"}
              >
                <TextInput
                  mono
                  value={settings.waNumber}
                  onChange={(waNumber) => patch({ waNumber })}
                  placeholder="081234567890"
                />
              </Field>
              <Field label="Teks tombol">
                <TextInput value={settings.waLabel} onChange={(waLabel) => patch({ waLabel })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Pesan awal" hint="Sudah terisi di kolom chat pengunjung saat WhatsApp terbuka.">
                  <TextInput value={settings.waMessage} onChange={(waMessage) => patch({ waMessage })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Toggle
                  checked={settings.waFloating}
                  onChange={(waFloating) => patch({ waFloating })}
                  label="Tombol melayang"
                  hint="Tambah tombol bulat WhatsApp di pojok kanan bawah yang selalu terlihat."
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Menu</h2>
          <Button size="sm" onClick={addMenu} disabled={customCount >= MAX_CUSTOM_MENUS}>
            <Plus className="h-3.5 w-3.5" /> Tambah menu
          </Button>
        </header>

        {/* Judul kolom — tersembunyi di layar sempit, tempatnya diganti label pada tiap saklar */}
        <div
          className={`hidden items-end gap-2 border-b border-line-soft bg-canvas/40 px-5 py-2 text-center text-[10px] font-medium uppercase tracking-[0.09em] text-faint sm:grid ${COLS}`}
        >
          <span className="text-left">Menu</span>
          <span title="Tampil di beranda">Tampil</span>
          <span title="Mode pengembangan: hanya admin yang bisa membuka">Dev</span>
          <span title="Wajib login. Mati = bebas diakses">Login</span>
          <span title="Berapa kali dibuka">Dipakai</span>
          <span />
        </div>

        <ul className="divide-y divide-line-soft">
          {settings.menus.map((menu, index) => {
            const expanded = open === menu.id;
            return (
              <li key={menu.id} className={menu.visible ? "" : "bg-canvas/40"}>
                <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-5 py-3 ${COLS}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                      <MenuIcon name={menu.icon} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${menu.visible ? "text-ink" : "text-faint"}`}>
                        {menu.title}
                      </p>
                      <p className="truncate font-mono text-[11px] text-faint">{menu.href}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 sm:order-last">
                    <Button size="sm" className="px-2" ariaLabel="Naikkan" title="Naikkan" onClick={() => move(index, -1)} disabled={index === 0}>
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      className="px-2"
                      ariaLabel="Turunkan"
                      title="Turunkan"
                      onClick={() => move(index, 1)}
                      disabled={index === settings.menus.length - 1}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      className="px-2"
                      ariaLabel="Edit"
                      title="Edit teks menu"
                      onClick={() => setOpen(expanded ? null : menu.id)}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </Button>
                  </div>

                  {/* Saklar: sejajar kolom di layar lebar, baris sendiri di HP */}
                  <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 sm:contents">
                    <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
                      <span className="sm:hidden">Tampil</span>
                      <Switch label="Tampil di beranda" checked={menu.visible} onChange={(visible) => patchMenu(menu.id, { visible })} />
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
                      <span className="sm:hidden">Dev</span>
                      <Switch label="Mode pengembangan" checked={menu.devMode} onChange={(devMode) => patchMenu(menu.id, { devMode })} />
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
                      <span className="sm:hidden">Login</span>
                      <Switch label="Wajib login" checked={menu.requireLogin} onChange={(requireLogin) => patchMenu(menu.id, { requireLogin })} />
                    </label>
                    <span className="font-mono text-xs text-muted sm:text-center">
                      {(usage[menu.id] ?? 0).toLocaleString("id-ID")}
                      <span className="sm:hidden">× dipakai</span>
                    </span>
                  </div>
                </div>

                {expanded && (
                  <div className="grid gap-3 border-t border-line-soft bg-raised/40 px-5 py-4 sm:grid-cols-2">
                    <Field label="Judul">
                      <TextInput value={menu.title} onChange={(title) => patchMenu(menu.id, { title })} />
                    </Field>
                    <Field label="Deskripsi singkat">
                      <TextInput
                        value={menu.description}
                        onChange={(description) => patchMenu(menu.id, { description })}
                      />
                    </Field>
                    {!menu.builtin && (
                      <>
                        <Field label="Alamat tujuan" hint='Halaman di situs ini ("/halaman") atau tautan luar ("https://…").'>
                          <TextInput
                            mono
                            value={menu.href}
                            invalid={!safeHref(menu.href)}
                            onChange={(href) => patchMenu(menu.id, { href })}
                            placeholder="/halaman atau https://contoh.com"
                          />
                        </Field>
                        <Field label="Ikon">
                          <Select
                            value={menu.icon}
                            placeholder=""
                            onChange={(icon) => patchMenu(menu.id, { icon: icon as MenuIconName })}
                            options={MENU_ICONS.map((name) => ({ value: name, label: MENU_ICON_LABEL[name] }))}
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Button size="sm" variant="danger" onClick={() => removeMenu(menu)}>
                            <Trash className="h-3.5 w-3.5" /> Hapus menu ini
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <ul className="space-y-1 border-t border-line-soft px-5 py-3 text-xs leading-relaxed text-faint">
          <li>
            <b className="font-medium text-muted">Login</b> mati = menu bebas dibuka siapa saja. Yang sudah login
            selalu bisa membuka semua menu.
          </li>
          <li>
            <b className="font-medium text-muted">Dev</b> = hanya admin yang bisa membuka; pengunjung lain melihat
            &ldquo;dalam pengembangan&rdquo;.
          </li>
          <li>
            Pada menu tambahan, aturan Dev dan Login hanya berlaku di kartu beranda — halaman tujuannya sendiri
            tidak ikut dijaga.
          </li>
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="border-b border-line-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Halaman utama</h2>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Judul baris 1">
              <TextInput value={settings.heroTitle} onChange={(heroTitle) => patch({ heroTitle })} />
            </Field>
            <Field label="Judul baris 2 (berwarna)">
              <TextInput value={settings.heroAccent} onChange={(heroAccent) => patch({ heroAccent })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Kalimat pembuka">
                <TextInput value={settings.heroText} onChange={(heroText) => patch({ heroText })} />
              </Field>
            </div>
            <Field label="Teks tombol utama" hint="Mengarah ke Setup Mikrotik Baru.">
              <TextInput value={settings.ctaLabel} onChange={(ctaLabel) => patch({ ctaLabel })} />
            </Field>
            <Field label="Catatan di footer">
              <TextInput value={settings.footerNote} onChange={(footerNote) => patch({ footerNote })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <CheckPill active={settings.showSample} onClick={() => patch({ showSample: !settings.showSample })}>
              Cuplikan script
            </CheckPill>
            <CheckPill active={settings.showFeatures} onClick={() => patch({ showFeatures: !settings.showFeatures })}>
              Tiga jaminan
            </CheckPill>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
        <span className="text-xs text-muted">
          {dirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan sudah tersimpan."}
        </span>
        <div className="flex gap-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm text-muted transition-colors hover:text-ink"
          >
            Lihat beranda
            <ArrowRight className="h-4 w-4" />
          </a>
          <Button variant="primary" onClick={save} disabled={busy || !dirty}>
            {dirty ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
