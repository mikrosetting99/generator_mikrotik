"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSection } from "@/components/admin/AdminSection";
import { Check, Copy, Plus, Save, Trash } from "@/components/icons";
import { Button, CheckPill, EmptyState, Field, Modal, Note, Select, TextInput, Toggle } from "@/components/ui";
import { speedLabel, VPN_ACCOUNT_STATUSES, type VpnAccountStatus } from "@/lib/vpn-radius";
import { VPN_PROTOCOLS, type VpnProtocol } from "@/lib/vpn-script";

/* ------------------------------------------------------------------ data */

interface Server {
  id: string;
  name: string;
  location: string;
  domain: string;
  publicIp: string;
  subnet: string;
  gatewayIp: string;
  protocols: VpnProtocol[];
  rosVersion: "v6" | "v7";
  capacity: number;
  active: boolean;
  accounts: number;
}

interface Pkg {
  id: string;
  name: string;
  priceIdr: number;
  durationDays: number;
  uploadKbps: number;
  downloadKbps: number;
  portForwards: number;
  maxAccounts: number;
  protocols: VpnProtocol[];
  serverIds: string[];
  active: boolean;
  accounts: number;
}

interface Account {
  id: string;
  userId: string;
  owner: string;
  serverId: string;
  server: string;
  domain: string;
  packageId: string;
  package: string;
  username: string;
  tunnelIp: string;
  status: VpnAccountStatus;
  expiresAt: string | null;
  note: string;
  online: { since: string } | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  username: string;
  name: string | null;
}

type Flash = { tone: "info" | "bad"; text: string } | null;

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; data: T & { error?: string } }> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, data };
}

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "tanpa batas";
/** Date → "YYYY-MM-DD" menurut WIB, untuk isian tanggal. */
const toDateInput = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
const STATUS_LABEL = Object.fromEntries(VPN_ACCOUNT_STATUSES.map((s) => [s.id, s.label])) as Record<VpnAccountStatus, string>;
const STATUS_TONE: Record<VpnAccountStatus, string> = {
  active: "bg-ok/15 text-ok",
  pending: "bg-warn/15 text-warn",
  suspended: "bg-bad/15 text-bad",
};

function ProtocolPills({ value, onChange }: { value: VpnProtocol[]; onChange: (v: VpnProtocol[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {VPN_PROTOCOLS.map((p) => (
        <CheckPill
          key={p.id}
          active={value.includes(p.id)}
          onClick={() => onChange(value.includes(p.id) ? value.filter((x) => x !== p.id) : [...value, p.id])}
        >
          {p.label}
        </CheckPill>
      ))}
    </div>
  );
}

function ScriptBox({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Pilih teks lalu salin manual.
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Tersalin" : "Salin script"}
        </Button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre rounded-md border border-line bg-raised px-3 py-2 font-mono text-[12px] leading-relaxed text-ink">{script}</pre>
    </div>
  );
}

/* ------------------------------------------------------------------ utama */

/** Server VPN (CHR), paket, dan akun VPN pelanggan yang diperiksa FreeRADIUS. Khusus admin. */
export function VpnRadiusAdmin({ view }: { view: "servers" | "packages" | "accounts" }) {
  const [servers, setServers] = useState<Server[] | null>(null);
  const [radiusIpSet, setRadiusIpSet] = useState(true);
  const [packages, setPackages] = useState<Pkg[] | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const loadServers = useCallback(async () => {
    const r = await api<{ servers: Server[]; radiusIpSet: boolean }>("/api/admin/vpn-radius/servers");
    if (r.ok) {
      setServers(r.data.servers);
      setRadiusIpSet(r.data.radiusIpSet);
    } else setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat server VPN." });
  }, []);
  const loadPackages = useCallback(async () => {
    const r = await api<{ packages: Pkg[] }>("/api/admin/vpn-radius/packages");
    if (r.ok) setPackages(r.data.packages);
    else setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat paket." });
  }, []);

  useEffect(() => {
    void loadServers();
    void loadPackages();
  }, [loadServers, loadPackages]);

  return (
    <div>
      {flash && (
        <div className="mb-4">
          <Note tone={flash.tone}>{flash.text}</Note>
        </div>
      )}
      {view === "servers" && <ServersView servers={servers} radiusIpSet={radiusIpSet} reload={loadServers} setFlash={setFlash} />}
      {view === "packages" && <PackagesView packages={packages} servers={servers ?? []} reload={loadPackages} setFlash={setFlash} />}
      {view === "accounts" && <AccountsView servers={servers ?? []} packages={packages ?? []} setFlash={setFlash} />}
    </div>
  );
}

/* ------------------------------------------------------------------ server */

const BLANK_SERVER = {
  name: "",
  location: "",
  domain: "",
  publicIp: "",
  subnet: "",
  gatewayIp: "",
  protocols: ["sstp", "l2tp", "ovpn"] as VpnProtocol[],
  rosVersion: "v7" as "v6" | "v7",
  capacity: "250",
  active: true,
};

function ServersView({
  servers,
  radiusIpSet,
  reload,
  setFlash,
}: {
  servers: Server[] | null;
  radiusIpSet: boolean;
  reload: () => Promise<void>;
  setFlash: (f: Flash) => void;
}) {
  const [form, setForm] = useState(BLANK_SERVER);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState<{ name: string; text: string } | null>(null);
  const set = <K extends keyof typeof BLANK_SERVER>(k: K, v: (typeof BLANK_SERVER)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const edit = (s: Server) => {
    setEditId(s.id);
    setForm({ ...s, capacity: String(s.capacity) });
    setFlash(null);
  };
  const reset = () => {
    setEditId(null);
    setForm(BLANK_SERVER);
  };

  const save = async () => {
    setBusy(true);
    const r = await api<{ server: Server }>(editId ? `/api/admin/vpn-radius/servers/${editId}` : "/api/admin/vpn-radius/servers", {
      method: editId ? "PUT" : "POST",
      body: JSON.stringify({ ...form, capacity: Number(form.capacity) }),
    });
    setBusy(false);
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menyimpan server." });
    setFlash({
      tone: "info",
      text: editId
        ? `Server ${r.data.server.name} disimpan.`
        : `Server ${r.data.server.name} ditambahkan. Tempel script CHR-nya, lalu restart FreeRADIUS (docker restart mikrosetting-radius) agar server baru dikenali.`,
    });
    reset();
    await reload();
  };

  const showScript = async (s: Server) => {
    const r = await api<{ script: string }>(`/api/admin/vpn-radius/servers/${s.id}`);
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal membuat script." });
    setScript({ name: s.name, text: r.data.script });
  };

  const rotate = async (s: Server) => {
    if (!window.confirm(`Buat secret RADIUS baru untuk ${s.name}? Script CHR harus ditempel ulang dan FreeRADIUS di-restart; sampai itu dilakukan, login VPN di server ini gagal.`)) return;
    const r = await api(`/api/admin/vpn-radius/servers/${s.id}`, { method: "PUT", body: JSON.stringify({ ...s, rotateSecret: true }) });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal mengganti secret." });
    await showScript(s);
  };

  const remove = async (s: Server) => {
    if (!window.confirm(`Hapus server ${s.name}?`)) return;
    const r = await api(`/api/admin/vpn-radius/servers/${s.id}`, { method: "DELETE" });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menghapus server." });
    if (editId === s.id) reset();
    await reload();
  };

  return (
    <>
      {!radiusIpSet && (
        <div className="mb-4">
          <Note tone="warn">
            VPN_RADIUS_IP belum diisi di .env server. Isi dengan IP publik server FreeRADIUS (server ini), lalu restart aplikasi; tanpa itu script CHR tidak bisa dibuat.
          </Note>
        </div>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AdminSection
          title={editId ? "Ubah server VPN" : "Tambah server VPN"}
          description="Satu Mikrotik CHR = satu server. Setiap server punya subnet tunnel sendiri; IP pelanggan dibagikan otomatis dari subnet ini."
        >
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Field label="Nama" required>
              <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="VPN Indonesia 1" />
            </Field>
            <Field label="Lokasi">
              <TextInput value={form.location} onChange={(v) => set("location", v)} placeholder="Jakarta" />
            </Field>
            <Field label="Domain" required hint="Alamat yang dipakai pelanggan">
              <TextInput mono value={form.domain} onChange={(v) => set("domain", v)} placeholder="vpn1.mikrosetting.com" />
            </Field>
            <Field label="IP publik CHR" required>
              <TextInput mono value={form.publicIp} onChange={(v) => set("publicIp", v)} placeholder="103.181.143.233" />
            </Field>
            <Field label="Subnet tunnel" required>
              <TextInput mono value={form.subnet} onChange={(v) => set("subnet", v)} placeholder="10.202.0.0/16" />
            </Field>
            <Field label="IP gateway (local-address)" required>
              <TextInput mono value={form.gatewayIp} onChange={(v) => set("gatewayIp", v)} placeholder="10.202.0.1" />
            </Field>
            <Field label="Protokol aktif" className="sm:col-span-2">
              <ProtocolPills value={form.protocols} onChange={(v) => set("protocols", v)} />
            </Field>
            <Field label="RouterOS CHR">
              <Select
                value={form.rosVersion}
                onChange={(v) => set("rosVersion", v === "v6" ? "v6" : "v7")}
                options={[
                  { value: "v7", label: "RouterOS 7" },
                  { value: "v6", label: "RouterOS 6" },
                ]}
              />
            </Field>
            <Field label="Kapasitas akun" required>
              <TextInput type="number" value={form.capacity} onChange={(v) => set("capacity", v)} />
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Server aktif" hint="Nonaktif = semua akun di server ini ditolak RADIUS." />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button variant="brand" onClick={save} disabled={busy}>
                <Save className="h-4 w-4" /> {editId ? "Simpan perubahan" : "Tambah server"}
              </Button>
              {editId && <Button onClick={reset}>Batal</Button>}
            </div>
          </div>
        </AdminSection>

        <AdminSection title="Daftar server VPN" badge={servers && <span className="font-mono text-[11px] text-muted">{servers.length} server</span>}>
          <div className="p-5">
            {servers === null ? (
              <p className="py-6 text-center text-xs text-faint">Memuat…</p>
            ) : servers.length === 0 ? (
              <EmptyState>Belum ada server VPN.</EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {servers.map((s) => (
                  <li key={s.id} className={`space-y-2 px-3 py-2.5 ${editId === s.id ? "bg-brand/[0.08]" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                          {s.name}
                          {s.location && <span className="ml-1.5 text-xs font-normal text-muted">{s.location}</span>}
                          {!s.active && <span className="ml-2 rounded-md bg-bad/15 px-1.5 py-0.5 text-[10px] font-medium text-bad">nonaktif</span>}
                        </p>
                        <p className="font-mono text-xs text-muted">
                          {s.domain} · {s.publicIp} · {s.subnet}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-brand/12 px-2 py-0.5 font-mono text-[11px] text-brand">
                        {s.accounts}/{s.capacity} akun
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] uppercase text-faint">
                        {s.protocols.join(" · ")} · ros {s.rosVersion.slice(1)}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button size="sm" onClick={() => showScript(s)} disabled={!radiusIpSet}>
                          Script CHR
                        </Button>
                        <Button size="sm" onClick={() => edit(s)}>
                          Ubah
                        </Button>
                        <Button size="sm" onClick={() => rotate(s)} disabled={!radiusIpSet} title="Buat secret RADIUS baru">
                          Ganti secret
                        </Button>
                        <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${s.name}`} title="Hapus" onClick={() => remove(s)}>
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AdminSection>
      </div>

      <Modal
        open={script !== null}
        onClose={() => setScript(null)}
        title={`Script CHR: ${script?.name ?? ""}`}
        description="Tempel di terminal CHR (Winbox → New Terminal). Berisi secret RADIUS: jangan dibagikan."
        wide
      >
        {script && <ScriptBox script={script.text} />}
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ paket */

const BLANK_PKG = {
  name: "",
  priceIdr: "",
  durationDays: "30",
  uploadMbps: "",
  downloadMbps: "",
  portForwards: "0",
  maxAccounts: "1",
  protocols: ["sstp", "l2tp", "ovpn"] as VpnProtocol[],
  serverIds: [] as string[],
  active: true,
};

/** "10" Mbps → 10240 kbps; "0,5" → 512; kosong → 0 (tanpa batas). */
const mbpsToKbps = (v: string) => Math.round((Number(v.replace(",", ".")) || 0) * 1024);
const kbpsToMbps = (k: number) => (k ? String(Math.round((k / 1024) * 1000) / 1000) : "");

function PackagesView({
  packages,
  servers,
  reload,
  setFlash,
}: {
  packages: Pkg[] | null;
  servers: Server[];
  reload: () => Promise<void>;
  setFlash: (f: Flash) => void;
}) {
  const [form, setForm] = useState(BLANK_PKG);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof BLANK_PKG>(k: K, v: (typeof BLANK_PKG)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const serverName = (id: string) => servers.find((s) => s.id === id)?.name ?? "server terhapus";

  const edit = (p: Pkg) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      priceIdr: String(p.priceIdr),
      durationDays: String(p.durationDays),
      uploadMbps: kbpsToMbps(p.uploadKbps),
      downloadMbps: kbpsToMbps(p.downloadKbps),
      portForwards: String(p.portForwards),
      maxAccounts: String(p.maxAccounts),
      protocols: p.protocols,
      serverIds: p.serverIds,
      active: p.active,
    });
    setFlash(null);
  };
  const reset = () => {
    setEditId(null);
    setForm(BLANK_PKG);
  };

  const save = async () => {
    setBusy(true);
    const r = await api<{ package: Pkg }>(editId ? `/api/admin/vpn-radius/packages/${editId}` : "/api/admin/vpn-radius/packages", {
      method: editId ? "PUT" : "POST",
      body: JSON.stringify({
        name: form.name,
        priceIdr: Number(form.priceIdr.replace(/\D/g, "")) || 0,
        durationDays: Number(form.durationDays),
        uploadKbps: mbpsToKbps(form.uploadMbps),
        downloadKbps: mbpsToKbps(form.downloadMbps),
        portForwards: Number(form.portForwards),
        maxAccounts: Number(form.maxAccounts),
        protocols: form.protocols,
        serverIds: form.serverIds,
        active: form.active,
      }),
    });
    setBusy(false);
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menyimpan paket." });
    setFlash({
      tone: "info",
      text: editId
        ? `Paket ${r.data.package.name} disimpan. Kecepatan baru berlaku saat pelanggan tersambung ulang.`
        : `Paket ${r.data.package.name} ditambahkan.`,
    });
    reset();
    await reload();
  };

  const remove = async (p: Pkg) => {
    if (!window.confirm(`Hapus paket ${p.name}?`)) return;
    const r = await api(`/api/admin/vpn-radius/packages/${p.id}`, { method: "DELETE" });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menghapus paket." });
    if (editId === p.id) reset();
    await reload();
  };

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <AdminSection title={editId ? "Ubah paket" : "Tambah paket"} description="Harga, masa aktif, kecepatan, dan kuota yang dipilih pelanggan.">
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Nama paket" required className="sm:col-span-2">
            <TextInput value={form.name} onChange={(v) => set("name", v)} placeholder="Basic 10 Mbps" />
          </Field>
          <Field label="Harga (Rp)" required>
            <TextInput value={form.priceIdr} onChange={(v) => set("priceIdr", v)} placeholder="25000" />
          </Field>
          <Field label="Masa aktif (hari)" required>
            <TextInput type="number" value={form.durationDays} onChange={(v) => set("durationDays", v)} />
          </Field>
          <Field label="Upload pelanggan (Mbps)" hint="Kosong = tanpa batas">
            <TextInput value={form.uploadMbps} onChange={(v) => set("uploadMbps", v)} placeholder="5" />
          </Field>
          <Field label="Download pelanggan (Mbps)" hint="Kosong = tanpa batas">
            <TextInput value={form.downloadMbps} onChange={(v) => set("downloadMbps", v)} placeholder="10" />
          </Field>
          <Field label="Port-forward tambahan" hint="Di luar Winbox, API, Webfig bawaan">
            <TextInput type="number" value={form.portForwards} onChange={(v) => set("portForwards", v)} />
          </Field>
          <Field label="Maks. akun per pelanggan">
            <TextInput type="number" value={form.maxAccounts} onChange={(v) => set("maxAccounts", v)} />
          </Field>
          <Field label="Protokol" className="sm:col-span-2">
            <ProtocolPills value={form.protocols} onChange={(v) => set("protocols", v)} />
          </Field>
          <Field label="Server yang boleh dipilih" hint="Tidak memilih apa pun = semua server" className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {servers.length === 0 ? (
                <span className="text-xs text-faint">Belum ada server.</span>
              ) : (
                servers.map((s) => (
                  <CheckPill
                    key={s.id}
                    active={form.serverIds.includes(s.id)}
                    onClick={() => set("serverIds", form.serverIds.includes(s.id) ? form.serverIds.filter((x) => x !== s.id) : [...form.serverIds, s.id])}
                  >
                    {s.name}
                  </CheckPill>
                ))
              )}
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={form.active} onChange={(v) => set("active", v)} label="Paket aktif" hint="Nonaktif = tidak bisa dipilih untuk akun baru; akun lama tetap berjalan." />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button variant="brand" onClick={save} disabled={busy}>
              <Save className="h-4 w-4" /> {editId ? "Simpan perubahan" : "Tambah paket"}
            </Button>
            {editId && <Button onClick={reset}>Batal</Button>}
          </div>
        </div>
      </AdminSection>

      <AdminSection title="Daftar paket" badge={packages && <span className="font-mono text-[11px] text-muted">{packages.length} paket</span>}>
        <div className="p-5">
          {packages === null ? (
            <p className="py-6 text-center text-xs text-faint">Memuat…</p>
          ) : packages.length === 0 ? (
            <EmptyState>Belum ada paket.</EmptyState>
          ) : (
            <ul className="divide-y divide-line rounded-md border border-line">
              {packages.map((p) => (
                <li key={p.id} className={`space-y-1.5 px-3 py-2.5 ${editId === p.id ? "bg-brand/[0.08]" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-ink">
                      {p.name}
                      {!p.active && <span className="ml-2 rounded-md bg-bad/15 px-1.5 py-0.5 text-[10px] font-medium text-bad">nonaktif</span>}
                    </p>
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {rupiah(p.priceIdr)} <span className="text-xs font-normal text-muted">/ {p.durationDays} hari</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    ↑ {speedLabel(p.uploadKbps)} · ↓ {speedLabel(p.downloadKbps)} · {p.portForwards} port tambahan · maks {p.maxAccounts} akun ·{" "}
                    <span className="font-mono uppercase">{p.protocols.join("/")}</span>
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-faint">
                      {p.serverIds.length ? p.serverIds.map(serverName).join(", ") : "semua server"} · {p.accounts} akun
                    </span>
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => edit(p)}>
                        Ubah
                      </Button>
                      <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${p.name}`} title="Hapus" onClick={() => remove(p)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </AdminSection>
    </div>
  );
}

/* ------------------------------------------------------------------ akun */

const BLANK_ACCOUNT = {
  userId: "",
  serverId: "",
  packageId: "",
  username: "",
  password: "",
  status: "active" as VpnAccountStatus,
  expiresAt: "",
  note: "",
};

function AccountsView({ servers, packages, setFlash }: { servers: Server[]; packages: Pkg[]; setFlash: (f: Flash) => void }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState(BLANK_ACCOUNT);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [scriptFor, setScriptFor] = useState<Account | null>(null);
  const [scriptOpt, setScriptOpt] = useState<{ protocol: VpnProtocol; ros: "v6" | "v7" }>({ protocol: "sstp", ros: "v6" });
  const [scriptData, setScriptData] = useState<{ script: string; username: string; password: string } | { error: string } | null>(null);
  const set = <K extends keyof typeof BLANK_ACCOUNT>(k: K, v: (typeof BLANK_ACCOUNT)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    const r = await api<{ accounts: Account[] }>("/api/admin/vpn-radius/accounts");
    if (r.ok) setAccounts(r.data.accounts);
    else setFlash({ tone: "bad", text: r.data.error ?? "Gagal memuat akun VPN." });
  }, [setFlash]);

  useEffect(() => {
    void load();
    void api<{ users: UserRow[] }>("/api/admin/users").then((r) => r.ok && setUsers(r.data.users));
  }, [load]);

  const selectedPkg = packages.find((p) => p.id === form.packageId);
  const pkgOptions = packages
    .filter((p) => (p.active || p.id === form.packageId) && (!form.serverId || !p.serverIds.length || p.serverIds.includes(form.serverId)))
    .map((p) => ({ value: p.id, label: `${p.name} (${rupiah(p.priceIdr)} / ${p.durationDays} hari)` }));

  // Paket baru dipilih saat menambah akun: masa aktif bawaan = hari ini + masa aktif paket.
  const pickPackage = (id: string) => {
    const p = packages.find((x) => x.id === id);
    setForm((f) => ({ ...f, packageId: id, expiresAt: !editId && p ? toDateInput(new Date(Date.now() + p.durationDays * 86_400_000)) : f.expiresAt }));
  };

  const edit = (a: Account) => {
    setEditId(a.id);
    setForm({ ...BLANK_ACCOUNT, userId: a.userId, serverId: a.serverId, packageId: a.packageId, username: a.username, status: a.status, expiresAt: a.expiresAt ? toDateInput(new Date(a.expiresAt)) : "", note: a.note });
    setFlash(null);
  };
  const reset = () => {
    setEditId(null);
    setForm(BLANK_ACCOUNT);
  };

  const openScript = async (a: Account, opt = scriptOpt) => {
    setScriptFor(a);
    setScriptData(null);
    const r = await api<{ script: string; username: string; password: string }>(`/api/admin/vpn-radius/accounts/${a.id}?protocol=${opt.protocol}&ros=${opt.ros}`);
    setScriptData(r.ok ? r.data : { error: r.data.error ?? "Gagal membuat script." });
  };

  const save = async () => {
    setBusy(true);
    const body = editId
      ? { status: form.status, packageId: form.packageId, expiresAt: form.expiresAt, note: form.note, ...(form.password ? { password: form.password } : {}) }
      : form;
    const r = await api<{ account?: Account }>(editId ? `/api/admin/vpn-radius/accounts/${editId}` : "/api/admin/vpn-radius/accounts", {
      method: editId ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menyimpan akun." });
    setFlash({ tone: "info", text: editId ? "Akun disimpan. Berlaku pada login berikutnya." : `Akun ${r.data.account?.username} dibuat dengan IP tunnel ${r.data.account?.tunnelIp}.` });
    reset();
    await load();
    if (r.data.account) await openScript(r.data.account);
  };

  const resetPassword = async (a: Account) => {
    if (!window.confirm(`Buat password baru untuk ${a.username}? Pelanggan harus menempel ulang script client.`)) return;
    const r = await api(`/api/admin/vpn-radius/accounts/${a.id}`, { method: "PUT", body: JSON.stringify({ resetPassword: true }) });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal mengganti password." });
    await openScript(a);
  };

  const remove = async (a: Account) => {
    if (!window.confirm(`Hapus akun ${a.username}? IP ${a.tunnelIp} dilepas dan pelanggan tidak bisa login lagi.`)) return;
    const r = await api(`/api/admin/vpn-radius/accounts/${a.id}`, { method: "DELETE" });
    if (!r.ok) return setFlash({ tone: "bad", text: r.data.error ?? "Gagal menghapus akun." });
    if (editId === a.id) reset();
    await load();
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!accounts || !q) return accounts;
    return accounts.filter((a) => [a.username, a.owner, a.tunnelIp, a.server, a.package].some((v) => v.toLowerCase().includes(q)));
  }, [accounts, query]);

  const ready = servers.length > 0 && packages.length > 0;

  return (
    <>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <AdminSection
          title={editId ? `Ubah akun ${form.username}` : "Tambah akun VPN"}
          description="Akun didaftarkan admin untuk pelanggan. IP tunnel dibagikan otomatis dan tetap selama akun ada."
        >
          {!ready && !editId ? (
            <div className="p-5">
              <Note tone="warn">Tambahkan minimal satu server VPN dan satu paket dulu.</Note>
            </div>
          ) : (
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              <Field label="Pemilik" required className="sm:col-span-2">
                <Select
                  value={form.userId}
                  onChange={(v) => set("userId", v)}
                  disabled={Boolean(editId)}
                  options={users.map((u) => ({ value: u.id, label: u.name ? `${u.name} (${u.username})` : u.username }))}
                />
              </Field>
              <Field label="Server" required>
                <Select
                  value={form.serverId}
                  onChange={(v) => setForm((f) => ({ ...f, serverId: v, packageId: "" }))}
                  disabled={Boolean(editId)}
                  options={servers.filter((s) => s.active || s.id === form.serverId).map((s) => ({ value: s.id, label: `${s.name} (${s.accounts}/${s.capacity})`, disabled: s.accounts >= s.capacity }))}
                />
              </Field>
              <Field label="Paket" required>
                <Select value={form.packageId} onChange={pickPackage} options={pkgOptions} />
              </Field>
              {!editId && (
                <>
                  <Field label="Username VPN" hint="Kosong = dibuat otomatis">
                    <TextInput mono value={form.username} onChange={(v) => set("username", v.toLowerCase())} placeholder="budi-cabang1" />
                  </Field>
                  <Field label="Password VPN" hint="Kosong = acak">
                    <TextInput mono value={form.password} onChange={(v) => set("password", v)} />
                  </Field>
                </>
              )}
              {editId && (
                <Field label="Password baru" hint="Kosong = tidak diubah" className="sm:col-span-2">
                  <TextInput mono value={form.password} onChange={(v) => set("password", v)} />
                </Field>
              )}
              <Field label="Status">
                <Select value={form.status} onChange={(v) => set("status", v as VpnAccountStatus)} options={VPN_ACCOUNT_STATUSES.map((s) => ({ value: s.id, label: s.label }))} />
              </Field>
              <Field label="Aktif sampai" hint={selectedPkg && !editId ? `Bawaan paket: ${selectedPkg.durationDays} hari` : "Kosong = tanpa batas"}>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                  className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none"
                />
              </Field>
              <Field label="Catatan" className="sm:col-span-2">
                <TextInput value={form.note} onChange={(v) => set("note", v)} placeholder="mis. router cabang Bekasi" />
              </Field>
              <div className="flex gap-2 sm:col-span-2">
                <Button variant="brand" onClick={save} disabled={busy}>
                  {editId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {editId ? "Simpan perubahan" : "Buat akun"}
                </Button>
                {editId && <Button onClick={reset}>Batal</Button>}
              </div>
            </div>
          )}
        </AdminSection>

        <AdminSection
          title="Daftar akun VPN"
          description="Online = ada data accounting dari CHR dalam 15 menit terakhir."
          badge={accounts && <span className="font-mono text-[11px] text-muted">{accounts.length} akun · {accounts.filter((a) => a.online).length} online</span>}
        >
          <div className="space-y-3 p-5">
            <Field label="Cari">
              <TextInput value={query} onChange={setQuery} placeholder="username, pemilik, IP tunnel, server, atau paket" />
            </Field>
            {shown === null ? (
              <p className="py-6 text-center text-xs text-faint">Memuat…</p>
            ) : shown.length === 0 ? (
              <EmptyState>Belum ada akun VPN{query ? " yang cocok" : ""}.</EmptyState>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {shown.map((a) => (
                  <li key={a.id} className={`space-y-1.5 px-3 py-2.5 ${editId === a.id ? "bg-brand/[0.08]" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-mono text-sm font-medium text-ink">
                          <span
                            className={`inline-block h-2 w-2 shrink-0 rounded-full ${a.online ? "bg-ok" : "bg-line"}`}
                            title={a.online ? `Online sejak ${new Date(a.online.since).toLocaleString("id-ID")}` : "Offline"}
                          />
                          {a.username}
                        </p>
                        <p className="truncate text-xs text-muted">{a.owner}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[a.status] ?? "bg-raised text-muted"}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      <span className="font-mono">{a.tunnelIp}</span> · {a.server} · {a.package} · s/d {fmtDate(a.expiresAt)}
                    </p>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button size="sm" onClick={() => openScript(a)}>
                        Script
                      </Button>
                      <Button size="sm" onClick={() => edit(a)}>
                        Ubah
                      </Button>
                      <Button size="sm" onClick={() => resetPassword(a)}>
                        Reset password
                      </Button>
                      <Button size="sm" variant="danger" className="px-2" ariaLabel={`Hapus ${a.username}`} title="Hapus" onClick={() => remove(a)}>
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AdminSection>
      </div>

      <Modal
        open={scriptFor !== null}
        onClose={() => setScriptFor(null)}
        title={`Script client: ${scriptFor?.username ?? ""}`}
        description={scriptFor ? `Tempel di router pelanggan. Terhubung ke ${scriptFor.domain}, IP tunnel ${scriptFor.tunnelIp}.` : undefined}
        wide
      >
        {scriptFor && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Protokol">
                <Select
                  value={scriptOpt.protocol}
                  onChange={(v) => {
                    const opt = { ...scriptOpt, protocol: v as VpnProtocol };
                    setScriptOpt(opt);
                    void openScript(scriptFor, opt);
                  }}
                  options={(servers.find((s) => s.id === scriptFor.serverId)?.protocols ?? VPN_PROTOCOLS.map((p) => p.id)).map((id) => ({ value: id, label: id.toUpperCase() }))}
                />
              </Field>
              <Field label="RouterOS pelanggan">
                <Select
                  value={scriptOpt.ros}
                  onChange={(v) => {
                    const opt = { ...scriptOpt, ros: v === "v7" ? ("v7" as const) : ("v6" as const) };
                    setScriptOpt(opt);
                    void openScript(scriptFor, opt);
                  }}
                  options={[
                    { value: "v6", label: "RouterOS 6" },
                    { value: "v7", label: "RouterOS 7" },
                  ]}
                />
              </Field>
            </div>
            {scriptData === null ? (
              <p className="py-6 text-center text-xs text-faint">Membuat script…</p>
            ) : "error" in scriptData ? (
              <Note tone="bad">{scriptData.error}</Note>
            ) : (
              <>
                <p className="text-xs text-muted">
                  Username <b className="font-mono text-ink">{scriptData.username}</b> · Password <b className="font-mono text-ink">{scriptData.password}</b>
                </p>
                <ScriptBox script={scriptData.script} />
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
