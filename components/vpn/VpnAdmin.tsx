"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSection } from "@/components/admin/AdminSection";
import { Check, Copy, Plus, Save, Trash } from "@/components/icons";
import { Button, CheckPill, EmptyState, Field, Note, Select, TextInput } from "@/components/ui";
import { formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";
import {
  checkVpnParams,
  DEFAULT_VPN_GATEWAY,
  DEFAULT_VPN_SERVER,
  defaultTunnelName,
  generateVpnScript,
  VPN_PROTOCOLS,
  type VpnProtocol,
} from "@/lib/vpn-script";

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
  protocol: string;
  hasMikhmon: boolean;
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
  /** "" = script manual; selain itu tipe pertama yang ditawarkan (pilihan awal pelanggan). */
  protocol: "" | VpnProtocol;
  /** Tipe yang boleh dipilih pelanggan; kosong = mode manual. */
  offered: VpnProtocol[];
  rosVersion: "v6" | "v7";
  vpnServer: string;
  gatewayIp: string;
  tunnelName: string;
  vpnPort: string;
  ipsecSecret: string;
  script: string;
  winbox: string;
  api: string;
  mikhmonUrl: string;
  note: string;
}

const EMPTY: FormState = {
  id: null,
  phone: "",
  customer: "",
  categoryId: "",
  title: "",
  username: "",
  password: "",
  protocol: "sstp",
  offered: ["sstp", "l2tp", "ovpn"],
  rosVersion: "v6",
  vpnServer: "",
  gatewayIp: "",
  tunnelName: "",
  vpnPort: "",
  ipsecSecret: "",
  script: "",
  winbox: "",
  api: "",
  mikhmonUrl: "",
  note: "",
};

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
  const [previewProto, setPreviewProto] = useState<VpnProtocol>("sstp");

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

  // Pratinjau script VPN yang akan dilihat pelanggan (dibuat di browser dengan fungsi yang sama dengan server).
  const shownProto: VpnProtocol | "" = form.offered.includes(previewProto) ? previewProto : (form.offered[0] ?? "");
  const vpnPreview = useMemo(() => {
    if (!shownProto) return { error: "", script: "" };
    const params = {
      protocol: shownProto,
      ros: form.rosVersion,
      server: form.vpnServer,
      tunnel: form.tunnelName,
      gateway: form.gatewayIp,
      user: form.username,
      password: form.password,
      ipsecSecret: form.ipsecSecret,
      port: Number(form.vpnPort) || 0,
    };
    const error = checkVpnParams(params);
    return { error, script: error ? "" : generateVpnScript(params) };
  }, [form, shownProto]);

  /** Menyalakan/mematikan satu tipe yang ditawarkan; urutannya selalu SSTP, L2TP, OVPN. */
  const toggleOffered = (id: VpnProtocol) => {
    const next = VPN_PROTOCOLS.map((p) => p.id).filter((p) => (p === id ? !form.offered.includes(p) : form.offered.includes(p)));
    patch({ offered: next, protocol: next[0] ?? "" });
  };

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
        protocol: form.protocol,
        offered: form.offered,
        rosVersion: form.rosVersion,
        vpnServer: form.vpnServer,
        gatewayIp: form.gatewayIp,
        tunnelName: form.tunnelName,
        vpnPort: Number(form.vpnPort) || 0,
        ipsecSecret: form.ipsecSecret,
        script: form.script,
        winbox: form.winbox,
        api: form.api,
        mikhmonUrl: form.mikhmonUrl,
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
    const r = await api<{ script: Omit<FormState, "id" | "vpnPort"> & { vpnPort: number } }>(`/api/admin/vpn/scripts/${row.id}`);
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat data." });
    const s = r.data.script;
    setForm({
      id: row.id,
      phone: s.phone,
      customer: s.customer,
      categoryId: s.categoryId,
      title: s.title,
      username: s.username,
      password: s.password,
      protocol: s.protocol,
      offered: s.offered ?? [],
      rosVersion: s.rosVersion,
      vpnServer: s.vpnServer,
      gatewayIp: s.gatewayIp,
      tunnelName: s.tunnelName,
      vpnPort: s.vpnPort ? String(s.vpnPort) : "",
      ipsecSecret: s.ipsecSecret,
      // Mode otomatis: script dibuat ulang dari isian, jadi kolom manual dikosongkan.
      script: s.protocol ? "" : s.script,
      winbox: s.winbox,
      api: s.api,
      mikhmonUrl: s.mikhmonUrl,
      note: s.note,
    });
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
        description="Pilih tipe VPN lalu isi username dan password VPN dari app.mikrosetting.com. Password disimpan terenkripsi di database."
        badge={form.id ? <span className="rounded-md bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">sedang mengubah</span> : undefined}
      >
        <div className="space-y-3 p-4 sm:p-5">
          <Group title="Pelanggan">
            <FormRow label="Nomor HP" required hint={isValidPhone(normalizePhone(form.phone)) ? `Disimpan sebagai ${formatPhone(normalizePhone(form.phone))}` : "Dipakai pelanggan untuk membuka link. Boleh 08…, +62…, atau 62…"}>
              <TextInput mono value={form.phone} onChange={(phone) => patch({ phone })} placeholder="081234567890" />
            </FormRow>
            <FormRow label="Nama pelanggan">
              <TextInput value={form.customer} onChange={(customer) => patch({ customer })} placeholder="Budi Santoso (opsional)" />
            </FormRow>
            <FormRow label="Kategori" required>
              <Select value={form.categoryId} placeholder="— pilih kategori —" onChange={(categoryId) => patch({ categoryId })} options={categoryOptions} />
            </FormRow>
            <FormRow label="Judul" required hint="Tampil di halaman pelanggan.">
              <TextInput value={form.title} onChange={(title) => patch({ title })} placeholder="VPN Remote - Router Kantor" />
            </FormRow>
          </Group>

          <Group title="Script VPN">
            <FormRow label="Tipe VPN" hint={form.protocol ? `Pelanggan memilih sendiri tipe di halaman link-nya. Pilihan awal: ${form.offered[0]?.toUpperCase()}.` : "Pilih satu atau lebih tipe, atau isi manual."}>
              <div className="flex flex-wrap items-center gap-2">
                {VPN_PROTOCOLS.map((p) => (
                  <CheckPill key={p.id} active={form.offered.includes(p.id)} onClick={() => toggleOffered(p.id)}>
                    {p.label}
                  </CheckPill>
                ))}
                <CheckPill active={form.offered.length === 0} onClick={() => patch({ offered: [], protocol: "" })}>
                  Manual / tanpa VPN
                </CheckPill>
              </div>
            </FormRow>

            {form.protocol ? (
              <>
                <FormRow label="Username VPN" required>
                  <TextInput mono value={form.username} onChange={(username) => patch({ username })} placeholder="test33" />
                </FormRow>
                <FormRow label="Password VPN" required>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <TextInput mono type={showPassword ? "text" : "password"} value={form.password} onChange={(password) => patch({ password })} placeholder="password" />
                    </div>
                    <Button onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Sembunyikan" : "Tampilkan"}</Button>
                  </div>
                </FormRow>
                <details className="border-t border-line-soft">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-muted hover:text-ink">
                    Pengaturan lanjutan (bawaan sudah sesuai)
                  </summary>
                  <div className="border-t border-line-soft">
                    <FormRow label="Versi RouterOS">
                      <Select
                        value={form.rosVersion}
                        placeholder=""
                        onChange={(rosVersion) => patch({ rosVersion: rosVersion as "v6" | "v7" })}
                        options={[
                          { value: "v6", label: "RouterOS 6.x" },
                          { value: "v7", label: "RouterOS 7.x" },
                        ]}
                      />
                    </FormRow>
                    <FormRow label="Server VPN" hint={`Bawaan ${DEFAULT_VPN_SERVER}`}>
                      <TextInput mono value={form.vpnServer} onChange={(vpnServer) => patch({ vpnServer })} placeholder={DEFAULT_VPN_SERVER} />
                    </FormRow>
                    <FormRow label="Gateway tunnel" hint={`Dipantau Netwatch. Bawaan ${DEFAULT_VPN_GATEWAY}`}>
                      <TextInput mono value={form.gatewayIp} onChange={(gatewayIp) => patch({ gatewayIp })} placeholder={DEFAULT_VPN_GATEWAY} />
                    </FormRow>
                    <FormRow label="Nama tunnel" hint="Kosong = dibuat dari username.">
                      <TextInput mono value={form.tunnelName} onChange={(tunnelName) => patch({ tunnelName })} placeholder={defaultTunnelName(form.username)} />
                    </FormRow>
                    {form.protocol === "ovpn" && (
                      <FormRow label="Port OVPN" hint="Kosong = 1194.">
                        <TextInput mono value={form.vpnPort} onChange={(vpnPort) => patch({ vpnPort: vpnPort.replace(/\D/g, "") })} placeholder="1194" />
                      </FormRow>
                    )}
                    {form.protocol === "l2tp" && (
                      <FormRow label="IPsec secret" hint="Kosong = tanpa IPsec.">
                        <TextInput mono value={form.ipsecSecret} onChange={(ipsecSecret) => patch({ ipsecSecret })} placeholder="opsional" />
                      </FormRow>
                    )}
                  </div>
                </details>
                <FormRow
                  label="Pratinjau script"
                  hint="Script dibuat otomatis (interface client, Netwatch, scheduler)."
                >
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        {form.offered.length > 1 &&
                          form.offered.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setPreviewProto(p)}
                              className={`rounded-md px-2 py-0.5 font-mono text-[11px] ${
                                shownProto === p ? "bg-brand/15 text-brand" : "text-muted hover:text-ink"
                              }`}
                            >
                              {p.toUpperCase()}
                            </button>
                          ))}
                      </span>
                      {vpnPreview.script && (
                        <Button size="sm" onClick={() => copy("preview", vpnPreview.script)}>
                          {copied === "preview" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied === "preview" ? "Tersalin" : "Salin"}
                        </Button>
                      )}
                    </div>
                    {vpnPreview.error ? (
                      <p className="rounded-md border border-dashed border-line px-3 py-3 text-xs text-faint">{vpnPreview.error}</p>
                    ) : (
                      <pre className="max-h-64 overflow-auto rounded-md border border-line-soft bg-code px-3 py-3 font-mono text-[11.5px] leading-relaxed text-ink">
                        {vpnPreview.script}
                      </pre>
                    )}
                  </div>
                </FormRow>
              </>
            ) : (
              <>
                <FormRow label="Username">
                  <TextInput mono value={form.username} onChange={(username) => patch({ username })} placeholder="username (opsional)" />
                </FormRow>
                <FormRow label="Password">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <TextInput mono type={showPassword ? "text" : "password"} value={form.password} onChange={(password) => patch({ password })} placeholder="password (opsional)" />
                    </div>
                    <Button onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Sembunyikan" : "Tampilkan"}</Button>
                  </div>
                </FormRow>
                <FormRow label="Script manual" hint="Tempel script apa adanya (opsional).">
                  <textarea
                    value={form.script}
                    onChange={(e) => patch({ script: e.target.value })}
                    rows={7}
                    spellCheck={false}
                    placeholder="/interface ovpn-client add ..."
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-brand"
                  />
                </FormRow>
              </>
            )}
          </Group>

          <Group title="Akses router untuk pelanggan" note="Opsional. Ditampilkan di halaman pelanggan dengan tombol salin.">
            <FormRow label="IP Winbox" hint="Alamat:port untuk Winbox, mis. 103.1.2.3:8291.">
              <TextInput mono value={form.winbox} onChange={(winbox) => patch({ winbox: winbox.replace(/\s+/g, "") })} placeholder="vpn-id1.mikrosetting.com:20575" />
            </FormRow>
            <FormRow label="IP API" hint="Alamat:port untuk API, mis. 103.1.2.3:8728.">
              <TextInput mono value={form.api} onChange={(api) => patch({ api: api.replace(/\s+/g, "") })} placeholder="vpn-id1.mikrosetting.com:28575" />
            </FormRow>
            <FormRow label="Link Mikhmon" hint="Harus diawali https:// atau http://.">
              <TextInput mono value={form.mikhmonUrl} onChange={(mikhmonUrl) => patch({ mikhmonUrl: mikhmonUrl.trim() })} placeholder="https://mikhmon.mikrosetting.com/..." />
            </FormRow>
          </Group>

          <Group title="Catatan">
            <FormRow label="Catatan pelanggan">
              <TextInput value={form.note} onChange={(note) => patch({ note })} placeholder="mis. Berlaku sampai 30 November 2026 (opsional)" />
            </FormRow>
          </Group>

          <div className="flex flex-wrap gap-2 sm:pl-[202px]">
            <Button variant="primary" onClick={save} disabled={busy}>
              <Save className="h-4 w-4" />
              {busy ? "Menyimpan…" : form.id ? "Simpan perubahan" : "Simpan & buat link"}
            </Button>
            {form.id && <Button onClick={() => setForm({ ...EMPTY, categoryId: form.categoryId })}>Batal ubah</Button>}
          </div>

          {lastLink && (
            <div className="space-y-3 rounded-md border border-brand/40 bg-brand/[0.06] p-4">
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
                      <td className="px-4 py-2.5 text-ink">
                        {row.title}
                        {row.protocol && (
                          <span className="ml-2 rounded-md bg-raised px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">{row.protocol}</span>
                        )}
                        {row.hasMikhmon && <span className="ml-1 rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">mikhmon</span>}
                      </td>
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
/** Satu baris ala jendela Winbox: label di kiri, kontrol di kanan. */
function FormRow({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line-soft px-4 py-2 last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <label className="text-[12.5px] font-medium text-muted sm:pt-[10px] sm:text-right">
        {label}
        {required && <span className="text-bad"> *</span>}
        <span className="hidden sm:inline">:</span>
      </label>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
      </div>
    </div>
  );
}

/** Kotak bergaris dengan judul, seperti tab/grup pengaturan Mikrotik. */
function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="max-w-3xl overflow-hidden rounded-md border border-line bg-surface">
      <header className="border-b border-line-soft bg-raised/60 px-4 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-brand">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-faint">{note}</p>}
      </header>
      {children}
    </section>
  );
}