"use client";

import { useRef, useState } from "react";
import { AdminSection } from "@/components/admin/AdminSection";
import { ArrowRight, Check, ChevronDown, Plus, Save, Trash, Upload, X } from "@/components/icons";
import { MenuIcon } from "@/components/MenuIcon";
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

/** Kolom pengaturan: label di atas saklar, supaya sejajar di semua baris. */
const COLS = "sm:grid-cols-[minmax(0,1fr)_repeat(3,2.75rem)_7.75rem]";

/** Pengaturan umum (identitas, WhatsApp, teks beranda) dan menu beranda dengan grup. */
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

  const dirty = JSON.stringify(settings) !== JSON.stringify(saved);
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
    ...settings.groups.map((name) => ({ name, menus: settings.menus.filter((m) => m.group === name) })),
    { name: "", menus: settings.menus.filter((m) => !settings.groups.includes(m.group)) },
  ].filter((s) => s.menus.length > 0 || s.name);

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
      setSettings(data.settings);
      setSaved(data.settings);
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
        <div className="divide-y divide-line-soft">
          {/* Identitas situs */}
          <div className="space-y-3 px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">Identitas situs</h3>
            <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
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
                  Tampil di pojok kiri atas beranda dan footer. Logo PNG/SVG, maksimal {MAX_LOGO_BYTES / 1024} KB.
                </p>
                {logoError && <p className="mt-1 text-xs text-bad">{logoError}</p>}
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-3 px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">Tombol WhatsApp</h3>
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
          </div>

          {/* Teks halaman utama */}
          <div className="space-y-3 px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.09em] text-muted">Teks halaman utama</h3>
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
            judulnya. <b className="font-medium text-ink">Dev</b>: hanya admin yang bisa membuka.{" "}
            <b className="font-medium text-ink">Login</b>: wajib masuk dulu (mati = bebas, yang sudah login selalu bisa).
          </p>

          {sections.map((section) => {
            const gi = settings.groups.indexOf(section.name);
            return (
              <div key={section.name || "tanpa-grup"} className="overflow-hidden rounded-xl border border-line-soft">
                <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-raised/60 px-3 py-2">
                  {section.name ? (
                    <input
                      value={section.name}
                      onChange={(e) => renameGroup(gi, e.target.value)}
                      aria-label={`Nama grup ${gi + 1}`}
                      className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-ink outline-none transition-colors hover:bg-canvas focus:bg-canvas focus:ring-1 focus:ring-brand/50"
                    />
                  ) : (
                    <span className="flex-1 px-1.5 text-sm font-semibold text-muted">Tanpa grup</span>
                  )}
                  <span className="font-mono text-[11px] text-faint">{section.menus.length}</span>
                  {section.name && (
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
                  {section.name && (
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
