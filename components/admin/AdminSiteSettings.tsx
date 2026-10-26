"use client";

import { useRef, useState } from "react";
import { AdminSection } from "@/components/admin/AdminSection";
import { ArrowRight, Check, ChevronDown, Plus, Save, Trash, Upload, X } from "@/components/icons";
import { AdminBackgrounds } from "@/components/admin/AdminBackgrounds";
import { MenuIcon } from "@/components/MenuIcon";
import { mix, readableOn } from "@/lib/color";
import { DEFAULT_THEME, resolveTheme, THEME_PRESETS } from "@/lib/theme";
import { Button, CheckPill, Field, Note, Select, TextInput, Toggle } from "@/components/ui";
import {
  MAX_CUSTOM_MENUS,
  MAX_GROUPS,
  MAX_LOGO_BYTES,
  MENU_ICON_LABEL,
  MENU_ICONS,
  newCustomMenu,
  safeHref,
  waLink,
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

/**
 * Isian nama grup. Teks yang diketik disimpan sementara di sini dan baru
 * diterapkan saat selesai (Enter / pindah fokus) — kalau tiap ketikan langsung
 * mengubah daftar, elemennya dibuat ulang dan kursor terlepas.
 */
function GroupNameInput({
  value,
  others,
  onCommit,
  label,
}: {
  value: string;
  others: string[];
  onCommit: (name: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const name = draft.trim();
    if (!name || others.includes(name)) {
      setDraft(value); // kosong atau kembar dengan grup lain: batalkan
      return;
    }
    if (name !== value) onCommit(name);
    else setDraft(value);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      maxLength={30}
      aria-label={label}
      className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-ink outline-none transition-colors hover:bg-canvas focus:bg-canvas focus:ring-1 focus:ring-brand/50"
    />
  );
}

/** Kartu kelompok pengaturan di dalam satu bagian dashboard. */
function Card({
  title,
  description,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-line-soft bg-raised/40 p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Kolom pengaturan: label di atas saklar, supaya sejajar di semua baris. */
const COLS = "sm:grid-cols-[minmax(0,1fr)_repeat(4,2.75rem)_7.75rem]";

/** Pengaturan umum (identitas, WhatsApp, teks beranda) dan menu beranda dengan grup. */
export function AdminSiteSettings({
  initial,
  usage,
  view = "situs",
}: {
  initial: SiteSettings;
  usage: Record<string, number>;
  /** situs = identitas, teks beranda, menu; tema = warna tema dan background aplikasi. */
  view?: "situs" | "tema";
}) {
  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [saved, setSaved] = useState<SiteSettings>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState("");

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
  const theme = resolveTheme(settings.themeBrand, settings.themeAccent);
  const patch = (partial: Partial<SiteSettings>) => setSettings((s) => ({ ...s, ...partial }));
  const customCount = settings.menus.filter((m) => !m.builtin).length;

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

  /* ------------------------------------------------------------- grup */

  const addGroup = () => {
    if (settings.groups.length >= MAX_GROUPS) return;
    let n = settings.groups.length + 1;
    while (settings.groups.includes(`Grup ${n}`)) n += 1;
    patch({ groups: [...settings.groups, `Grup ${n}`] });
  };

  const renameGroup = (index: number, name: string) => {
    const old = settings.groups[index];
    setSettings((s) => ({
      ...s,
      groups: s.groups.map((g, i) => (i === index ? name : g)),
      menus: s.menus.map((m) => (m.group === old ? { ...m, group: name } : m)),
    }));
  };

  const removeGroup = (index: number) => {
    const name = settings.groups[index];
    if (!confirm(`Hapus grup "${name}"? Menu di dalamnya jadi tanpa grup.`)) return;
    setSettings((s) => ({
      ...s,
      groups: s.groups.filter((_, i) => i !== index),
      menus: s.menus.map((m) => (m.group === name ? { ...m, group: "" } : m)),
    }));
  };

  const moveGroup = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= settings.groups.length) return;
    const groups = [...settings.groups];
    [groups[index], groups[target]] = [groups[target], groups[index]];
    patch({ groups });
  };

  /* ------------------------------------------------------------- menu */

  const patchMenu = (id: string, partial: Partial<MenuSetting>) =>
    patch({ menus: settings.menus.map((m) => (m.id === id ? { ...m, ...partial } : m)) });

  /**
   * Geser menu satu langkah. Di ujung sebuah grup, menu pindah ke grup
   * tetangga (naik → ujung bawah grup di atasnya, turun → ujung atas grup
   * di bawahnya), jadi satu pasang panah cukup untuk mengatur semuanya.
   */
  const move = (id: string, delta: -1 | 1) => {
    const lists = sections.map((s) => ({ name: s.name, items: [...s.menus] }));
    const si = lists.findIndex((l) => l.items.some((m) => m.id === id));
    if (si < 0) return;
    const pi = lists[si].items.findIndex((m) => m.id === id);
    const target = pi + delta;

    if (target >= 0 && target < lists[si].items.length) {
      const items = lists[si].items;
      [items[pi], items[target]] = [items[target], items[pi]];
    } else {
      const ni = si + delta;
      if (ni < 0 || ni >= lists.length) return;
      const [item] = lists[si].items.splice(pi, 1);
      const moved = { ...item, group: lists[ni].name };
      if (delta === -1) lists[ni].items.push(moved);
      else lists[ni].items.unshift(moved);
    }
    patch({ menus: lists.flatMap((l) => l.items) });
  };

  const canMove = (id: string, delta: -1 | 1) => {
    const si = sections.findIndex((s) => s.menus.some((m) => m.id === id));
    if (si < 0) return false;
    const pi = sections[si].menus.findIndex((m) => m.id === id);
    const inside = pi + delta >= 0 && pi + delta < sections[si].menus.length;
    return inside || (si + delta >= 0 && si + delta < sections.length);
  };
  const addMenu = (group = "") => {
    const menu = newCustomMenu(group);
    patch({ menus: [...settings.menus, menu] });
    setOpen(menu.id);
  };

  const removeMenu = (menu: MenuSetting) => {
    if (!confirm(`Hapus menu "${menu.title}"?`)) return;
    patch({ menus: settings.menus.filter((m) => m.id !== menu.id) });
  };

  /** Menu dikelompokkan sesuai grup; yang tanpa grup (atau grupnya sudah hilang) di akhir. */
  const sections = [
    ...settings.groups.map((name, index) => ({
      index,
      name,
      menus: settings.menus.filter((m) => m.group === name),
    })),
    { index: -1, name: "", menus: settings.menus.filter((m) => !settings.groups.includes(m.group)) },
  ].filter((s) => s.menus.length > 0 || s.index >= 0);

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
    if (settings.groups.some((g) => !g.trim())) {
      setFlash({ tone: "bad", text: "Nama grup tidak boleh kosong." });
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
      const themeChanged =
        data.settings.themeBrand !== saved.themeBrand || data.settings.themeAccent !== saved.themeAccent;
      setSettings(data.settings);
      setSaved(data.settings);
      // Warna tema dipasang oleh server saat halaman dimuat, jadi muat ulang agar langsung terlihat.
      if (themeChanged) window.location.reload();
      setFlash({ tone: "info", text: "Tersimpan. Halaman utama sudah memakai pengaturan ini." });
    } catch {
      setFlash({ tone: "bad", text: "Gagal menghubungi server." });
    } finally {
      setBusy(false);
    }
  };

  const renderMenuRow = (menu: MenuSetting) => {
    const expanded = open === menu.id;
    return (
      <li key={menu.id} className={menu.visible ? "" : "bg-canvas/40"}>
        <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-2.5 ${COLS}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
              <MenuIcon name={menu.icon} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className={`truncate text-sm font-medium ${menu.visible ? "text-ink" : "text-faint"}`}>
                {menu.title}
              </p>
              <p className="truncate font-mono text-[11px] text-faint">
                {menu.href} · {(usage[menu.id] ?? 0).toLocaleString("id-ID")}× dipakai
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1 sm:order-last">
            <Button size="sm" className="px-2" ariaLabel="Naikkan" title="Naikkan" onClick={() => move(menu.id, -1)} disabled={!canMove(menu.id, -1)}>
              ↑
            </Button>
            <Button size="sm" className="px-2" ariaLabel="Turunkan" title="Turunkan" onClick={() => move(menu.id, 1)} disabled={!canMove(menu.id, 1)}>
              ↓
            </Button>
            <Button size="sm" className="px-2" ariaLabel="Edit" title="Edit menu" onClick={() => setOpen(expanded ? null : menu.id)}>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          </div>

          <div className="col-span-2 flex flex-wrap items-center gap-x-5 gap-y-2 sm:contents">
            <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
              <span className="sm:hidden">Tampil</span>
              <Switch label="Tampil di beranda" checked={menu.visible} onChange={(visible) => patchMenu(menu.id, { visible })} />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
              <span className="sm:hidden">User</span>
              <Switch label="Tampil untuk user (mati = hanya admin)" checked={menu.userVisible} onChange={(userVisible) => patchMenu(menu.id, { userVisible })} />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
              <span className="sm:hidden">Dev</span>
              <Switch label="Mode pengembangan" checked={menu.devMode} onChange={(devMode) => patchMenu(menu.id, { devMode })} />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-muted sm:justify-center">
              <span className="sm:hidden">Login</span>
              <Switch label="Wajib login" checked={menu.requireLogin} onChange={(requireLogin) => patchMenu(menu.id, { requireLogin })} />
            </label>
          </div>
        </div>

        {expanded && (
          <div className="grid gap-3 border-t border-line-soft bg-raised/40 px-4 py-4 sm:grid-cols-2">
            <Field label="Judul">
              <TextInput value={menu.title} onChange={(title) => patchMenu(menu.id, { title })} />
            </Field>
            <Field label="Deskripsi singkat">
              <TextInput value={menu.description} onChange={(description) => patchMenu(menu.id, { description })} />
            </Field>
            <Field label="Grup">
              <Select
                value={menu.group}
                placeholder="— tanpa grup —"
                onChange={(group) => patchMenu(menu.id, { group })}
                options={settings.groups.map((g) => ({ value: g, label: g }))}
              />
            </Field>
            {!menu.builtin && (
              <>
                <Field label="Ikon">
                  <Select
                    value={menu.icon}
                    placeholder=""
                    onChange={(icon) => patchMenu(menu.id, { icon: icon as MenuIconName })}
                    options={MENU_ICONS.map((name) => ({ value: name, label: MENU_ICON_LABEL[name] }))}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Alamat tujuan" hint='Halaman di situs ini ("/halaman") atau tautan luar ("https://…").'>
                    <TextInput
                      mono
                      value={menu.href}
                      invalid={!safeHref(menu.href)}
                      onChange={(href) => patchMenu(menu.id, { href })}
                      placeholder="/halaman atau https://contoh.com"
                    />
                  </Field>
                </div>
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
  };

  return (
    <div className="space-y-3">
      {flash && <Note tone={flash.tone}>{flash.text}</Note>}

      {view === "situs" && (
        <>
      {/* ------------------------------------------------ pengaturan umum */}
      <AdminSection
        title="Pengaturan umum"
        description="Logo & nama situs, tombol WhatsApp, dan teks halaman utama."
        badge={
          settings.waEnabled ? (
            <span className="rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-medium text-[#25D366]">
              WhatsApp aktif
            </span>
          ) : null
        }
      >
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
          {/* Identitas situs */}
          <Card
            title="Identitas situs"
            description="Logo dan nama yang tampil di pojok kiri atas beranda, footer, dan tab browser."
          >
            <div className="flex items-center gap-4">
              <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas">
                {settings.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.logoDataUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
                ) : (
                  <span className="px-1 text-center text-[10px] leading-tight text-faint">tanpa logo</span>
                )}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => logoInput.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />
                    {settings.logoDataUrl ? "Ganti logo" : "Unggah logo"}
                  </Button>
                  {settings.logoDataUrl && (
                    <Button size="sm" variant="danger" onClick={() => patch({ logoDataUrl: "", logoVersion: 0 })}>
                      <Trash className="h-3.5 w-3.5" /> Hapus
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-faint">PNG, JPG, WEBP, atau SVG — maksimal {MAX_LOGO_BYTES / 1024} KB.</p>
                {logoError && <p className="mt-1 text-xs text-bad">{logoError}</p>}
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
            <Field label="Nama situs">
              <TextInput value={settings.siteName} onChange={(siteName) => patch({ siteName })} />
            </Field>
          </Card>

          {/* WhatsApp */}
          <Card
            title="Tombol WhatsApp"
            description="Tombol chat di bagian atas beranda, dengan pesan awal yang sudah terisi."
          >
            <Toggle
              checked={settings.waEnabled}
              onChange={(waEnabled) => patch({ waEnabled })}
              label="Tampilkan tombol WhatsApp"
              hint="Matikan untuk menyembunyikannya tanpa menghapus nomornya."
            />
            {settings.waEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nomor WhatsApp"
                  hint={waLink(settings.waNumber, "") || "Isi nomor, mis. 081234567890 — otomatis jadi 62…"}
                >
                  <TextInput mono value={settings.waNumber} onChange={(waNumber) => patch({ waNumber })} placeholder="081234567890" />
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
          </Card>

          {/* Teks halaman utama */}
          <Card wide title="Teks halaman utama" description="Judul, kalimat pembuka, dan tombol utama di beranda.">
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
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Bagian yang ditampilkan</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CheckPill active={settings.showSample} onClick={() => patch({ showSample: !settings.showSample })}>
                  Cuplikan script
                </CheckPill>
                <CheckPill active={settings.showFeatures} onClick={() => patch({ showFeatures: !settings.showFeatures })}>
                  Tiga jaminan
                </CheckPill>
              </div>
            </div>
          </Card>
        </div>
      </AdminSection>

      {/* -------------------------------------------------------- menu */}
      <AdminSection
        title="Menu & grup"
        description="Atur grup dan menu di beranda: tampil, pengembangan, wajib login, urutan."
        defaultOpen
        badge={<span className="font-mono text-[11px] text-faint">{settings.menus.length} menu</span>}
      >
        <div className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-muted">
            Panah ↑↓ menggeser menu; di ujung grup, menu pindah ke grup tetangga. Ubah nama grup langsung di
            judulnya. <b className="font-medium text-ink">User</b>: mati = menu disembunyikan dari pengguna biasa dan tamu (hanya admin yang melihat dan bisa membukanya). <b className="font-medium text-ink">Dev</b>: hanya admin yang bisa membuka.{" "}
            <b className="font-medium text-ink">Login</b>: wajib masuk dulu (mati = bebas, yang sudah login selalu bisa).
          </p>

          {sections.map((section) => {
            const gi = section.index;
            return (
              <div key={gi >= 0 ? `grup-${gi}-${section.name}` : "tanpa-grup"} className="overflow-hidden rounded-xl border border-line-soft">
                <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-raised/60 px-3 py-2">
                  {gi >= 0 ? (
                    <GroupNameInput
                      value={section.name}
                      others={settings.groups.filter((_, i) => i !== gi)}
                      onCommit={(name) => renameGroup(gi, name)}
                      label={`Nama grup ${gi + 1}`}
                    />
                  ) : (
                    <span className="flex-1 px-1.5 text-sm font-semibold text-muted">Tanpa grup</span>
                  )}
                  <span className="font-mono text-[11px] text-faint">{section.menus.length}</span>
                  {gi >= 0 && (
                    <>
                      <Button size="sm" className="px-2" ariaLabel="Geser grup ke atas" title="Geser grup ke atas" onClick={() => moveGroup(gi, -1)} disabled={gi === 0}>
                        ↑
                      </Button>
                      <Button size="sm" className="px-2" ariaLabel="Geser grup ke bawah" title="Geser grup ke bawah" onClick={() => moveGroup(gi, 1)} disabled={gi === settings.groups.length - 1}>
                        ↓
                      </Button>
                      <Button size="sm" className="px-2" ariaLabel="Hapus grup" title="Hapus grup" onClick={() => removeGroup(gi)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {gi >= 0 && (
                    <Button size="sm" onClick={() => addMenu(section.name)} disabled={customCount >= MAX_CUSTOM_MENUS}>
                      <Plus className="h-3.5 w-3.5" /> Menu
                    </Button>
                  )}
                </div>

                {/* judul kolom, sekali per grup */}
                {section.menus.length > 0 && (
                  <div
                    className={`hidden items-end gap-2 border-b border-line-soft px-4 py-1.5 text-center text-[10px] font-medium uppercase tracking-[0.09em] text-faint sm:grid ${COLS}`}
                  >
                    <span className="text-left">Menu</span>
                    <span>Tampil</span>
                    <span>User</span>
                    <span>Dev</span>
                    <span>Login</span>
                    <span />
                  </div>
                )}

                <ul className="divide-y divide-line-soft">
                  {section.menus.length === 0 ? (
                    <li className="px-4 py-3 text-xs text-faint">
                      Grup kosong — tambah menu baru, atau geser menu dari grup lain dengan panah.
                    </li>
                  ) : (
                    section.menus.map(renderMenuRow)
                  )}
                </ul>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={addGroup} disabled={settings.groups.length >= MAX_GROUPS}>
              <Plus className="h-3.5 w-3.5" /> Tambah grup
            </Button>
            <Button size="sm" onClick={() => addMenu("")} disabled={customCount >= MAX_CUSTOM_MENUS}>
              <Plus className="h-3.5 w-3.5" /> Tambah menu
            </Button>
          </div>
        </div>
      </AdminSection>
        </>
      )}

      {view === "tema" && (
        <>
      {/* ----------------------------------------------------- tema warna */}
      <AdminSection title="Tema warna" description="Warna utama dan aksen untuk seluruh tampilan aplikasi.">
        <div className="space-y-5 p-5">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Tema siap pakai</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {THEME_PRESETS.map((preset) => {
                const active = theme.brand === preset.brand && theme.accent === preset.accent;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      patch(
                        preset.brand === DEFAULT_THEME.brand && preset.accent === DEFAULT_THEME.accent
                          ? { themeBrand: "", themeAccent: "" }
                          : { themeBrand: preset.brand, themeAccent: preset.accent },
                      )
                    }
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                      active ? "border-brand bg-brand/10 text-ink" : "border-line bg-surface text-muted hover:border-brand/50 hover:text-ink"
                    }`}
                  >
                    <span className="flex overflow-hidden rounded-sm border border-line">
                      <span className="h-5 w-5" style={{ background: preset.brand }} />
                      <span className="h-5 w-5" style={{ background: preset.accent }} />
                    </span>
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["themeBrand", "Warna utama", "Bilah navigasi, tombol utama, tautan, dan judul."] as const,
                ["themeAccent", "Warna aksen", "Tombol aksi sekunder dan penanda keberhasilan."] as const,
              ]
            ).map(([key, label, hint]) => {
              const value = key === "themeBrand" ? theme.brand : theme.accent;
              return (
                <Field key={key} label={label} hint={hint}>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={value}
                      aria-label={label}
                      onChange={(e) => patch({ [key]: e.target.value.toLowerCase() } as Partial<SiteSettings>)}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-line bg-surface p-1"
                    />
                    <TextInput
                      mono
                      value={settings[key] || value}
                      onChange={(text) => {
                        const v = text.trim();
                        if (/^#[0-9a-f]{6}$/i.test(v)) patch({ [key]: v.toLowerCase() } as Partial<SiteSettings>);
                      }}
                      placeholder={key === "themeBrand" ? DEFAULT_THEME.brand : DEFAULT_THEME.accent}
                    />
                  </div>
                </Field>
              );
            })}
          </div>

          {(settings.themeBrand || settings.themeAccent) && (
            <button
              type="button"
              onClick={() => patch({ themeBrand: "", themeAccent: "" })}
              className="text-xs text-brand hover:underline"
            >
              Kembalikan ke warna bawaan (ungu Odoo)
            </button>
          )}

          {/* Pratinjau: bilah, tombol, dan tautan dalam tema terang dan gelap. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                { name: "Tema terang", nav: theme.brand, brand: theme.brand, accent: theme.accent, bg: "#eef0f3", card: "#ffffff", ink: "#1f2328", line: "#c3c8d0" },
                {
                  name: "Tema gelap",
                  nav: mix(theme.brand, -0.45),
                  brand: mix(theme.brand, 0.42),
                  accent: mix(theme.accent, 0.38),
                  bg: "#14161a",
                  card: "#1d2025",
                  ink: "#eceff3",
                  line: "#3d424c",
                },
              ] as const
            ).map((p) => (
              <div key={p.name} className="overflow-hidden rounded-md border" style={{ borderColor: p.line, background: p.bg }}>
                <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold" style={{ background: p.nav, color: readableOn(p.nav) }}>
                  <span>Dashboard Admin</span>
                  <span className="opacity-80">{p.name}</span>
                </div>
                <div className="space-y-2.5 p-3">
                  <div className="rounded-md border p-3" style={{ background: p.card, borderColor: p.line, color: p.ink }}>
                    <p className="text-sm font-semibold">Judul kartu</p>
                    <p className="mt-0.5 text-xs opacity-70">Teks keterangan dan <span style={{ color: p.brand, fontWeight: 600 }}>tautan</span>.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: p.brand, color: readableOn(p.brand) }}>
                        Tombol utama
                      </span>
                      <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: p.accent, color: readableOn(p.accent) }}>
                        Aksen
                      </span>
                      <span className="rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: p.line }}>
                        Sekunder
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-faint">
            Pilihan berlaku untuk semua pengguna setelah menekan Simpan; halaman dimuat ulang otomatis. Tampilan halaman
            login hotspot yang diunduh ke router memiliki warna sendiri dan tidak terpengaruh.
          </p>
        </div>
      </AdminSection>

      {/* ---------------------------------------------- background aplikasi */}
      <AdminBackgrounds
        kind="app"
        selectedId={settings.appBgId}
        onSelect={(appBgId) => patch({ appBgId })}
        extra={
          <div className="rounded-xl border border-line-soft bg-raised/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">
                {settings.appBgId ? "Background aktif" : "Belum ada background dipilih"}
              </span>
              {settings.appBgId && (
                <button type="button" onClick={() => patch({ appBgId: "" })} className="text-xs text-brand hover:underline">
                  Lepas background
                </button>
              )}
            </div>
            {settings.appBgId && (
              <>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                    Lapisan warna tema (agar tulisan terbaca)
                  </span>
                  <span className="font-mono text-[11px] text-brand">{settings.appBgOverlay}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={settings.appBgOverlay}
                  aria-label="Lapisan warna tema"
                  onChange={(e) => patch({ appBgOverlay: Number(e.target.value) })}
                  className="mt-2 w-full accent-[color:var(--color-brand)]"
                />
                <div className="mt-1 flex justify-between text-xs text-faint">
                  <span>Gambar lebih jelas</span>
                  <span>Lebih pudar</span>
                </div>
                <div
                  className="relative mt-3 h-28 overflow-hidden rounded-lg border border-line bg-cover bg-center"
                  style={{ backgroundImage: `url(/api/background-presets/${settings.appBgId}/image)` }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: `color-mix(in srgb, var(--color-canvas) ${settings.appBgOverlay}%, transparent)` }}
                  />
                  <span className="relative m-3 inline-block rounded-md bg-surface/90 px-2 py-1 text-xs text-ink">
                    Pratinjau tampilan
                  </span>
                </div>
              </>
            )}
            <p className="mt-3 text-xs leading-relaxed text-faint">
              Pilihan dan lapisan warna berlaku setelah menekan Simpan. Gambar yang diunggah atau dihapus langsung tersimpan di galeri.
            </p>
          </div>
        }
      />
        </>
      )}

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
