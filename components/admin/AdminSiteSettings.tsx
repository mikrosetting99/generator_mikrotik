"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Plus, Save, Trash } from "@/components/icons";
import { MenuIcon } from "@/components/MenuIcon";
import { Button, CheckPill, Field, Note, Select, TextInput, Toggle } from "@/components/ui";
import {
  MAX_CUSTOM_MENUS,
  MENU_ICON_LABEL,
  MENU_ICONS,
  newCustomMenu,
  safeHref,
  type MenuIconName,
  type MenuSetting,
  type SiteSettings,
} from "@/lib/site-settings";

/** Atur halaman utama: menu (tampil, pengembangan, wajib login, urutan, tambah) dan teksnya. */
export function AdminSiteSettings({ initial }: { initial: SiteSettings }) {
  const [settings, setSettings] = useState<SiteSettings>(initial);
  const [saved, setSaved] = useState<SiteSettings>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);

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
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Menu</h2>
            <p className="mt-0.5 text-xs text-muted">
              <b className="font-medium text-ink">Tampil</b> di beranda ·{" "}
              <b className="font-medium text-ink">Dev</b> hanya admin yang bisa membuka ·{" "}
              <b className="font-medium text-ink">Login</b> wajib masuk dulu.
            </p>
          </div>
          <Button size="sm" onClick={addMenu} disabled={customCount >= MAX_CUSTOM_MENUS}>
            <Plus className="h-3.5 w-3.5" /> Tambah menu
          </Button>
        </header>

        <ul className="divide-y divide-line-soft">
          {settings.menus.map((menu, index) => {
            const expanded = open === menu.id;
            return (
              <li key={menu.id} className={menu.visible ? "" : "bg-canvas/40"}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                    <MenuIcon name={menu.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 basis-40">
                    <p className={`truncate text-sm font-medium ${menu.visible ? "text-ink" : "text-faint"}`}>
                      {menu.title}
                    </p>
                    <p className="truncate font-mono text-[11px] text-faint">{menu.href}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <CheckPill active={menu.visible} onClick={() => patchMenu(menu.id, { visible: !menu.visible })}>
                      Tampil
                    </CheckPill>
                    <CheckPill active={menu.devMode} onClick={() => patchMenu(menu.id, { devMode: !menu.devMode })}>
                      Dev
                    </CheckPill>
                    <CheckPill
                      active={menu.requireLogin}
                      onClick={() => patchMenu(menu.id, { requireLogin: !menu.requireLogin })}
                    >
                      Login
                    </CheckPill>
                  </div>

                  <div className="flex items-center gap-1">
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

        <p className="border-t border-line-soft px-5 py-3 text-xs leading-relaxed text-faint">
          Pengaturan Dev dan Login berlaku juga bila halamannya dibuka langsung lewat alamat, untuk menu
          bawaan. Pada menu tambahan, aturan ini hanya berlaku di kartu beranda — halaman tujuannya
          sendiri tidak ikut dijaga.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="border-b border-line-soft px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Halaman utama</h2>
        </header>
        <div className="space-y-4 px-5 py-4">
          <Toggle
            checked={settings.homeRequiresLogin}
            onChange={(homeRequiresLogin) => patch({ homeRequiresLogin })}
            label="Beranda wajib login"
            hint="Mati = beranda terbuka untuk umum, dan hanya menu bertanda Login yang meminta masuk."
          />
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
