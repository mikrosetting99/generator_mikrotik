"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSection } from "@/components/admin/AdminSection";
import { Check, Copy, Plus, Save, Trash } from "@/components/icons";
import { Button, EmptyState, Field, Note, Select, TextInput } from "@/components/ui";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";

interface Category {
  id: string;
  name: string;
  scripts: number;
}

interface ScriptRow {
  id: string;
  token: string;
  phone: string;
  customer: string;
  categoryId: string;
  category: string;
  title: string;
  username: string;
  createdAt: string;
}

interface FormState {
  id: string | null;
  phone: string;
  customer: string;
  categoryId: string;
  title: string;
  username: string;
  password: string;
  script: string;
  note: string;
}

const EMPTY: FormState = { id: null, phone: "", customer: "", categoryId: "", title: "", username: "", password: "", script: "", note: "" };

const linkFor = (token: string) => `${window.location.origin}/script/${token}`;

const messageFor = (row: { customer: string; title: string; phone: string }, url: string) =>
  `Halo${row.customer ? ` ${row.customer}` : ""}, berikut link ${row.title} Anda:\n${url}\n\n` +
  `Buka link tersebut, lalu masukkan nomor HP Anda (${formatPhone(row.phone)}) untuk melihat username, password, dan script.`;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}

/** Pengelolaan link script VPN & Mikhmon online untuk admin: kategori, input, dan daftar. */
export function VpnAdmin() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [scripts, setScripts] = useState<ScriptRow[] | null>(null);
  const [filterCat, setFilterCat] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [lastLink, setLastLink] = useState<{ url: string; message: string; phone: string } | null>(null);
  const [copied, setCopied] = useState("");

  const loadCategories = useCallback(async () => {
    const r = await api<{ categories: Category[] }>("/api/admin/vpn/categories");
    if (r.ok) setCategories(r.data.categories);
    else setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat kategori." });
  }, []);

  const loadScripts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCat) params.set("category", filterCat);
    if (query.trim()) params.set("q", query.trim());
    const r = await api<{ scripts: ScriptRow[] }>(`/api/admin/vpn/scripts?${params}`);
    if (r.ok) setScripts(r.data.scripts);
    else setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat daftar." });
  }, [filterCat, query]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);
  useEffect(() => {
    const t = setTimeout(() => void loadScripts(), 250);
    return () => clearTimeout(t);
  }, [loadScripts]);

  // Kategori pertama jadi pilihan awal formulir.
  useEffect(() => {
    if (categories?.length && !form.categoryId) setForm((f) => ({ ...f, categoryId: categories[0].id }));
  }, [categories, form.categoryId]);

  const categoryOptions = useMemo(() => (categories ?? []).map((c) => ({ value: c.id, label: c.name })), [categories]);
  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  /* ------------------------------------------------------------ kategori */

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    const r = await api<{ category: Category }>("/api/admin/vpn/categories", { method: "POST", body: JSON.stringify({ name }) });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menambah kategori." });
    setNewCategory("");
    setFlash({ tone: "info", text: `Kategori "${name}" ditambahkan.` });
    void loadCategories();
  };

  const renameCategory = async (c: Category) => {
    const name = window.prompt("Nama kategori baru:", c.name)?.trim();
    if (!name || name === c.name) return;
    const r = await api(`/api/admin/vpn/categories/${c.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal mengganti nama." });
    void loadCategories();
    void loadScripts();
  };

  const removeCategory = async (c: Category) => {
    if (!window.confirm(`Hapus kategori "${c.name}"?`)) return;
    const r = await api(`/api/admin/vpn/categories/${c.id}`, { method: "DELETE" });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menghapus kategori." });
    if (form.categoryId === c.id) patch({ categoryId: "" });
    void loadCategories();
  };

  /* --------------------------------------------------------- link script */

  const save = async () => {
    setFlash(null);
    if (!isValidPhone(normalizePhone(form.phone))) return setFlash({ tone: "bad", text: "Nomor HP tidak valid. Contoh: 081234567890." });
    if (!form.title.trim()) return setFlash({ tone: "bad", text: "Judul belum diisi (mis. VPN Remote - Router Kantor)." });
    if (!form.categoryId) return setFlash({ tone: "bad", text: "Pilih kategori dulu." });
    setBusy(true);
    try {
      const body = JSON.stringify({
        phone: form.phone,
        customer: form.customer,
        categoryId: form.categoryId,
        title: form.title,
        username: form.username,
        password: form.password,
        script: form.script,
        note: form.note,
      });
      const r = form.id
        ? await api<{ ok: boolean }>(`/api/admin/vpn/scripts/${form.id}`, { method: "PUT", body })
        : await api<{ script: { id: string; token: string } }>("/api/admin/vpn/scripts", { method: "POST", body });
      if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? `Gagal menyimpan (kode ${r.status}).` });

      if (!form.id && "script" in r.data) {
        const url = linkFor((r.data as { script: { token: string } }).script.token);
        const phone = normalizePhone(form.phone);
        setLastLink({ url, phone, message: messageFor({ customer: form.customer, title: form.title, phone }, url) });
      } else {
        setLastLink(null);
      }
      setFlash({ tone: "info", text: form.id ? "Perubahan tersimpan. Link yang sudah dikirim tetap berlaku." : "Link script dibuat. Kirim link-nya ke pelanggan." });
      setForm({ ...EMPTY, categoryId: form.categoryId });
      void loadScripts();
      void loadCategories();
    } finally {
      setBusy(false);
    }
  };

  const edit = async (row: ScriptRow) => {
    const r = await api<{ script: FormState & { categoryId: string } }>(`/api/admin/vpn/scripts/${row.id}`);
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat data." });
    const s = r.data.script;
    setForm({ id: row.id, phone: s.phone, customer: s.customer, categoryId: s.categoryId, title: s.title, username: s.username, password: s.password, script: s.script, note: s.note });
    setLastLink(null);
    setFlash(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (row: ScriptRow) => {
    if (!window.confirm(`Hapus link "${row.title}" milik ${formatPhone(row.phone)}? Link yang sudah dikirim tidak akan bisa dibuka lagi.`)) return;
    const r = await api(`/api/admin/vpn/scripts/${row.id}`, { method: "DELETE" });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menghapus." });
    if (form.id === row.id) setForm({ ...EMPTY, categoryId: form.categoryId });
    void loadScripts();
    void loadCategories();
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      setFlash({ tone: "bad", text: "Clipboard diblokir browser — salin manual." });
    }
  };

  const waUrl = (phone: string, message: string) => `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <div>
      {flash && (
        <div className="mb-4">
          <Note tone={flash.tone}>{flash.text}</Note>
        </div>
      )}

      {/* ------------------------------------------------------ kategori */}
      <AdminSection title="Kategori" description="Pengelompokan link script. Hanya admin yang bisa menambah dan mengubahnya.">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {categories === null ? (
              <span className="text-xs text-faint">Memuat…</span>
            ) : (
              categories.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded-md border border-line bg-surface py-1 pl-3 pr-1 text-sm text-ink">
                  {c.name}
                  <span className="rounded bg-raised px-1.5 font-mono text-[11px] text-muted">{c.scripts}</span>
                  <Button size="sm" className="px-2" ariaLabel={`Ganti nama ${c.name}`} title="Ganti nama" onClick={() => renameCategory(c)}>
                    Ubah
                  </Button>
                  <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${c.name}`} title="Hapus" onClick={() => removeCategory(c)}>
                    <Trash className="h-3.5 w-3.5" />
                  </Button>
                </span>
              ))
            )}
          </div>
          <div className="flex max-w-md items-end gap-2">
            <div className="flex-1">
              <Field label="Kategori baru">
                <TextInput value={newCategory} onChange={setNewCategory} placeholder="mis. Hotspot Cloud" />
              </Field>
            </div>
            <Button onClick={addCategory} disabled={!newCategory.trim()}>
              <Plus className="h-4 w-4" /> Tambah
            </Button>
          </div>
        </div>
      </AdminSection>

      {/* ------------------------------------------------------ formulir */}
      <AdminSection
        title={form.id ? "Ubah link script" : "Tambah link script"}
        description="Isi data dari app.mikrosetting.com. Password dan script disimpan terenkripsi di database."
        badge={form.id ? <span className="rounded-md bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">sedang mengubah</span> : undefined}
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nomor HP pelanggan" required hint={isValidPhone(normalizePhone(form.phone)) ? `Disimpan sebagai ${formatPhone(normalizePhone(form.phone))}` : "Dipakai pelanggan untuk membuka link. Boleh 08…, +62…, atau 62…"}>
            <TextInput mono value={form.phone} onChange={(phone) => patch({ phone })} placeholder="081234567890" />
          </Field>
          <Field label="Nama pelanggan (opsional)">
            <TextInput value={form.customer} onChange={(customer) => patch({ customer })} placeholder="Budi Santoso" />
          </Field>
          <Field label="Kategori" required>
            <Select value={form.categoryId} placeholder="— pilih kategori —" onChange={(categoryId) => patch({ categoryId })} options={categoryOptions} />
          </Field>
          <Field label="Judul" required hint="Tampil di halaman pelanggan.">
            <TextInput value={form.title} onChange={(title) => patch({ title })} placeholder="VPN Remote - Router Kantor" />
          </Field>
          <Field label="Username">
            <TextInput mono value={form.username} onChange={(username) => patch({ username })} placeholder="username dari app.mikrosetting.com" />
          </Field>
          <Field label="Password">
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput mono type={showPassword ? "text" : "password"} value={form.password} onChange={(password) => patch({ password })} placeholder="password" />
              </div>
              <Button onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Sembunyikan" : "Tampilkan"}</Button>
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Script" hint="Tempel script dari app.mikrosetting.com apa adanya.">
              <textarea
                value={form.script}
                onChange={(e) => patch({ script: e.target.value })}
                rows={9}
                spellCheck={false}
                placeholder="/interface ovpn-client add ..."
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-brand"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Catatan untuk pelanggan (opsional)">
              <TextInput value={form.note} onChange={(note) => patch({ note })} placeholder="mis. Berlaku sampai 30 November 2026" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button variant="primary" onClick={save} disabled={busy}>
              <Save className="h-4 w-4" />
              {busy ? "Menyimpan…" : form.id ? "Simpan perubahan" : "Simpan & buat link"}
            </Button>
            {form.id && <Button onClick={() => setForm({ ...EMPTY, categoryId: form.categoryId })}>Batal ubah</Button>}
          </div>

          {lastLink && (
            <div className="space-y-3 rounded-md border border-brand/40 bg-brand/[0.06] p-4 sm:col-span-2">
              <p className="text-sm font-semibold text-ink">Link untuk pelanggan</p>
              <code className="block break-all rounded-md border border-line bg-surface px-3 py-2 font-mono text-[12.5px] text-ink">{lastLink.url}</code>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => copy("last-link", lastLink.url)}>
                  {copied === "last-link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "last-link" ? "Tersalin" : "Salin link"}
                </Button>
                <Button size="sm" onClick={() => copy("last-msg", lastLink.message)}>
                  {copied === "last-msg" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "last-msg" ? "Tersalin" : "Salin pesan"}
                </Button>
                <a
                  href={waUrl(lastLink.phone, lastLink.message)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 items-center rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 px-3 text-xs font-semibold text-[#128c4a] transition-colors hover:bg-[#25D366]/20"
                >
                  Kirim lewat WhatsApp
                </a>
              </div>
              <pre className="whitespace-pre-wrap rounded-md bg-raised px-3 py-2 font-sans text-xs leading-relaxed text-muted">{lastLink.message}</pre>
            </div>
          )}
        </div>
      </AdminSection>

      {/* -------------------------------------------------------- daftar */}
      <AdminSection
        title="Daftar link script"
        description="Satu nomor HP boleh punya banyak link; pelanggan melihat semuanya setelah memasukkan nomornya."
        badge={scripts && <span className="font-mono text-[11px] text-muted">{scripts.length} link</span>}
      >
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_1fr]">
            <Field label="Kategori">
              <Select
                value={filterCat}
                placeholder="Semua kategori"
                onChange={setFilterCat}
                options={categoryOptions}
              />
            </Field>
            <Field label="Cari">
              <TextInput value={query} onChange={setQuery} placeholder="nomor HP, nama, judul, atau username" />
            </Field>
          </div>

          {scripts === null ? (
            <p className="py-6 text-center text-xs text-faint">Memuat…</p>
          ) : scripts.length === 0 ? (
            <EmptyState>Belum ada link script{query || filterCat ? " yang cocok" : ""}.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-raised/60 text-[11px] uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Nomor HP</th>
                    <th className="px-4 py-2.5 font-semibold">Pelanggan</th>
                    <th className="px-4 py-2.5 font-semibold">Kategori</th>
                    <th className="px-4 py-2.5 font-semibold">Judul</th>
                    <th className="px-4 py-2.5 font-semibold">Dibuat</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {scripts.map((row) => (
                    <tr key={row.id} className="border-b border-line-soft last:border-0 hover:bg-brand/[0.05]">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-ink">{formatPhone(row.phone)}</td>
                      <td className="px-4 py-2.5 text-muted">{row.customer || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-md bg-brand/12 px-2 py-0.5 text-[11px] font-medium text-brand">{row.category}</span>
                      </td>
                      <td className="px-4 py-2.5 text-ink">{row.title}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(row.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" onClick={() => copy(row.id, linkFor(row.token))} title="Salin link pelanggan">
                            {copied === row.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied === row.id ? "Tersalin" : "Link"}
                          </Button>
                          <a
                            href={waUrl(row.phone, messageFor(row, linkFor(row.token)))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center rounded-lg border border-[#25D366]/50 bg-[#25D366]/10 px-2.5 text-xs font-semibold text-[#128c4a] hover:bg-[#25D366]/20"
                            title="Kirim link lewat WhatsApp"
                          >
                            WA
                          </a>
                          <Button size="sm" onClick={() => edit(row)}>
                            Ubah
                          </Button>
                          <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${row.title}`} title="Hapus" onClick={() => remove(row)}>
                            <Trash className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
