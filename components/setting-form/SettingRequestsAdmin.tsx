"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Cpu,
  Download,
  FileText,
  Plus,
  Rotate,
  Terminal,
  Trash,
} from "@/components/icons";
import { loadConfig } from "@/components/hotspot-login/TemplateGallery";
import { Button, cn, controlBase, EmptyState, Modal, Note } from "@/components/ui";
import { createDefaultHotspotLoginConfig } from "@/lib/defaults-hotspot-login";
import { downloadBlob } from "@/lib/download";
import { generateSetupScript } from "@/lib/generator/setup";
import { buildHotspotPackage } from "@/lib/hotspot-page";
import { getModel } from "@/lib/models";
import { formatPhone } from "@/lib/phone";
import { highlightScriptLine } from "@/lib/script-highlight";
import {
  applyToLoginPage,
  buildSetupConfig,
  PURPOSE_LABEL,
  shareMessage,
  slugName,
  STATUS_LABEL,
  usesLoginPage,
  type RequestStatus,
  type SettingRequestData,
  type SettingRequestView,
} from "@/lib/setting-request";
import { validateConfig } from "@/lib/validate";
import { createZip } from "@/lib/zip";
import { RequestForm, type SubmitResult } from "./RequestForm";

const STATUS_TONE: Record<RequestStatus, string> = {
  menunggu: "border-line bg-raised text-muted",
  masuk: "border-brand/35 bg-brand/[0.09] text-brand",
  selesai: "border-accent/35 bg-accent/[0.09] text-accent",
};

const FILTERS: { id: "all" | RequestStatus; label: string }[] = [
  { id: "all", label: "Semua" },
  { id: "masuk", label: "Masuk" },
  { id: "menunggu", label: "Menunggu" },
  { id: "selesai", label: "Selesai" },
];

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function when(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formUrl(token: string) {
  return `${window.location.origin}/form/${token}`;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      // clipboard diblokir: admin bisa menyalin manual
    }
  };
  return { copied, copy };
}

function title(r: SettingRequestView) {
  return r.label || r.businessName || (r.purpose === "kantor" ? "Kantor" : "") || "Tanpa nama";
}

/* ------------------------------------------------------------------ halaman */

export function SettingRequestsAdmin() {
  const [requests, setRequests] = useState<SettingRequestView[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<{ tone: "info" | "bad"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/setting-requests", { cache: "no-store" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `kode ${res.status}`);
      setRequests(d.requests);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat.");
      setRequests((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Isian pelanggan bisa masuk kapan saja: segarkan saat tab kembali dibuka.
    const onFocus = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [refresh]);

  // Buka permintaan dari hash (#id) supaya bisa dibagikan/di-refresh.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) setSelectedId(id);
  }, []);
  useEffect(() => {
    const url = selectedId ? `#${selectedId}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [selectedId]);

  const replace = (next: SettingRequestView) => setRequests((prev) => (prev ?? []).map((r) => (r.id === next.id ? next : r)));

  const create = async () => {
    setCreating(true);
    setFlash(null);
    try {
      const res = await fetch("/api/setting-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.request) {
        setFlash({ tone: "bad", text: d?.error ?? `Gagal membuat link (kode ${res.status}).` });
        return;
      }
      setRequests((prev) => [d.request, ...(prev ?? [])]);
      setSelectedId(d.request.id);
      setNewLabel("");
      try {
        await navigator.clipboard.writeText(formUrl(d.request.token));
        setFlash({ tone: "info", text: "Link dibuat dan sudah tersalin. Kirim ke pelanggan." });
      } catch {
        setFlash({ tone: "info", text: "Link dibuat. Salin dan kirim ke pelanggan." });
      }
    } finally {
      setCreating(false);
    }
  };

  const counts = useMemo(() => {
    const c = { all: 0, menunggu: 0, masuk: 0, selesai: 0 };
    for (const r of requests ?? []) {
      c.all += 1;
      c[r.status] += 1;
    }
    return c;
  }, [requests]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (requests ?? []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return [r.label, r.businessName, r.email, r.phone, getModel(r.modelId)?.name ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [requests, filter, query]);

  const selected = requests?.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      {/* Daftar */}
      <aside className={cn("min-w-0 space-y-3", selected && "hidden lg:block")}>
        <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
          <p className="text-xs font-semibold text-ink">Buat link form baru</p>
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !creating && void create()}
              placeholder="Catatan, mis. nama pelanggan (opsional)"
              maxLength={120}
              className={cn(controlBase, "h-10 min-w-0 flex-1")}
            />
            <Button variant="primary" onClick={create} disabled={creating} title="Buat link baru">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{creating ? "Membuat…" : "Buat link"}</span>
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-faint">Satu link untuk satu pelanggan. Catatan hanya terlihat oleh Anda.</p>
        </div>

        {flash && <Note tone={flash.tone}>{flash.text}</Note>}
        {loadError && <Note tone="bad">Gagal memuat daftar: {loadError}</Note>}

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                filter === f.id ? "border-brand/60 bg-brand/15 text-brand" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {f.label}
              <span className="font-mono text-[10px] opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama, email, telepon, type…"
          className={cn(controlBase, "h-10")}
        />

        {requests === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl border border-line bg-surface" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState>
            {requests.length === 0 ? "Belum ada link. Buat link pertama di atas lalu kirim ke pelanggan." : "Tidak ada yang cocok dengan filter."}
          </EmptyState>
        ) : (
          <ul className="space-y-1.5">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  aria-current={r.id === selectedId ? "true" : undefined}
                  className={cn(
                    "w-full rounded-xl border px-3.5 py-3 text-left transition-colors",
                    r.id === selectedId ? "border-brand bg-brand/[0.07]" : "border-line bg-surface hover:border-brand/40",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink">{title(r)}</span>
                    <StatusBadge status={r.status} />
                  </span>
                  <span className="mt-1 block truncate text-xs text-faint">
                    {r.submittedAt
                      ? `${r.purpose ? PURPOSE_LABEL[r.purpose] : ""} · ${getModel(r.modelId)?.name ?? r.modelId} · ${when(r.submittedAt)}`
                      : `Link dibuat ${when(r.createdAt)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Detail */}
      <section className={cn("min-w-0", !selected && "hidden lg:block")}>
        {selected ? (
          <RequestDetail
            key={selected.id}
            request={selected}
            onBack={() => setSelectedId(null)}
            onChange={replace}
            onDeleted={(id) => {
              setRequests((prev) => (prev ?? []).filter((r) => r.id !== id));
              setSelectedId(null);
            }}
          />
        ) : (
          <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-line px-6 text-center">
            <div>
              <FileText className="mx-auto h-6 w-6 text-faint" />
              <p className="mt-3 text-sm text-muted">Pilih permintaan untuk melihat isian, script, dan login page.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------- detail */

function Card({ title: heading, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-raised/60 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-ink">{heading}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function RequestDetail({
  request: r,
  onBack,
  onChange,
  onDeleted,
}: {
  request: SettingRequestView;
  onBack: () => void;
  onChange: (r: SettingRequestView) => void;
  onDeleted: (id: string) => void;
}) {
  const { copied, copy } = useCopy();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [label, setLabel] = useState(r.label);
  const [showPass, setShowPass] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const url = formUrl(r.token);
  const submitted = Boolean(r.submittedAt);
  const model = getModel(r.modelId);

  const patch = async (body: Record<string, unknown>, key: string): Promise<SubmitResult> => {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/setting-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.request) {
        const msg = d?.error ?? `Gagal menyimpan (kode ${res.status}).`;
        setError(msg);
        return { ok: false, error: msg, errors: d?.errors };
      }
      onChange(d.request);
      return { ok: true };
    } catch {
      setError("Gagal menghubungi server.");
      return { ok: false, error: "Gagal menghubungi server." };
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Hapus permintaan "${title(r)}"? Link pelanggan ikut tidak berlaku.`)) return;
    setBusy("delete");
    const res = await fetch(`/api/setting-requests/${r.id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) onDeleted(r.id);
    else setError("Gagal menghapus.");
  };

  // Konfigurasi dibuat ulang hanya bila isian berubah (id baris acak di dalamnya tidak boleh berganti tiap render).
  const config = useMemo(
    () => (submitted ? buildSetupConfig(r, { routerPassword: r.routerPassword }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dibangun ulang hanya saat isian/password berubah
    [submitted, r.updatedAt, r.routerPassword],
  );
  const script = useMemo(() => (config ? generateSetupScript(config) : ""), [config]);
  const issues = useMemo(() => (config ? validateConfig(config) : []), [config]);
  const errors = issues.filter((i) => i.level === "error");
  const fileBase = slugName(r.businessName || r.label || "kantor").toLowerCase();

  const [zipBusy, setZipBusy] = useState(false);
  const downloadZip = async () => {
    setZipBusy(true);
    setError("");
    try {
      let page = createDefaultHotspotLoginConfig();
      if (r.templateId) {
        page = await loadConfig(r.templateId).catch(() => page);
      } else {
        const d = await fetch("/api/hotspot-templates/default", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
        if (d?.template?.id) page = await loadConfig(d.template.id).catch(() => page);
      }
      const entries = await buildHotspotPackage(applyToLoginPage(page, r));
      downloadBlob(createZip(entries), `hotspot-${fileBase}.zip`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyiapkan hotspot.zip.");
    } finally {
      setZipBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Kepala */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button size="sm" variant="ghost" onClick={onBack} ariaLabel="Kembali ke daftar" className="lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-tight text-ink">{title(r)}</h2>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-0.5 text-xs text-faint">
              Dibuat {when(r.createdAt)}
              {r.submittedAt && ` · diisi ${when(r.submittedAt)}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {submitted && r.status !== "selesai" && (
            <Button size="sm" variant="primary" disabled={busy !== null} onClick={() => patch({ status: "selesai" }, "status")}>
              <Check className="h-3.5 w-3.5" /> Tandai selesai
            </Button>
          )}
          {r.status === "selesai" && (
            <Button size="sm" disabled={busy !== null} onClick={() => patch({ status: "masuk" }, "status")} title="Pelanggan bisa mengubah isian lagi">
              Buka lagi
            </Button>
          )}
          <Button size="sm" variant="danger" disabled={busy !== null} onClick={remove} ariaLabel="Hapus permintaan" title="Hapus">
            <Trash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {error && <Note tone="bad">{error}</Note>}

      {/* Link */}
      <Card title="Link untuk pelanggan">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 basis-full break-all rounded-md sm:basis-0 border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink">{url}</code>
          <Button size="sm" onClick={() => copy("link", url)}>
            {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "link" ? "Tersalin" : "Salin"}
          </Button>
          <a
            href={`https://wa.me/${r.phone || ""}?text=${encodeURIComponent(shareMessage(url, r.label))}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-raised"
          >
            Kirim via WhatsApp
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="Catatan admin, mis. nama pelanggan"
            className={cn(controlBase, "h-9 min-w-0 flex-1 text-xs")}
          />
          <Button size="sm" disabled={busy !== null || label.trim() === r.label} onClick={() => patch({ label }, "label")}>
            Simpan catatan
          </Button>
        </div>
      </Card>

      {!submitted ? (
        <Card title="Isian pelanggan">
          <p className="text-sm leading-relaxed text-muted">
            Pelanggan belum mengisi form. Halaman ini diperbarui saat Anda kembali ke tab ini.
          </p>
          <Button size="sm" className="mt-3" onClick={() => setEditOpen(true)}>
            Isi sendiri
          </Button>
        </Card>
      ) : (
        <>
          <Card
            title="Isian pelanggan"
            right={
              <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
                Ubah isian
              </Button>
            }
          >
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item k="Peruntukan" v={r.purpose ? PURPOSE_LABEL[r.purpose] : "-"} />
              <Item k="Type MikroTik" v={model?.name ?? r.modelId} />
              {r.purpose !== "kantor" && <Item k="Nama usaha / voucher" v={r.businessName} />}
              {r.purpose !== "kantor" && (
                <Item
                  k="No. telepon admin"
                  v={
                    <a className="text-brand hover:underline" href={`https://wa.me/${r.phone}`} target="_blank" rel="noreferrer">
                      {formatPhone(r.phone)}
                    </a>
                  }
                />
              )}
              <Item
                k="Email"
                v={
                  <a className="break-all text-brand hover:underline" href={`mailto:${r.email}`}>
                    {r.email}
                  </a>
                }
              />
              {usesLoginPage(r.purpose) && <TemplateName id={r.templateId} />}
            </dl>
            {r.purpose === "kantor" && (
              <div className="mt-4 rounded-lg border border-line-soft bg-canvas/50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Kebutuhan</p>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{r.needs}</p>
              </div>
            )}
            {model?.id === "custom" && (
              <div className="mt-4">
                <Note tone="warn">Pelanggan belum tahu type MikroTik-nya. Script memakai 5 port ether standar; sesuaikan di Setup Mikrotik Baru.</Note>
              </div>
            )}
          </Card>

          {/* Script */}
          <Card
            title="Script Setup MikroTik"
            right={
              <span className="font-mono text-[11px] text-faint">
                {model?.name} · {config?.ros === "v7" ? "RouterOS v7" : "RouterOS v6"}
              </span>
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" disabled={errors.length > 0} onClick={() => copy("script", script)}>
                  {copied === "script" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === "script" ? "Tersalin" : "Salin script"}
                </Button>
                <Button size="sm" disabled={errors.length > 0} onClick={() => downloadBlob(new Blob([script], { type: "text/plain" }), `setup-${fileBase}.rsc`)}>
                  <Download className="h-3.5 w-3.5" /> Unduh .rsc
                </Button>
                <Link
                  href={`/setup?permintaan=${r.id}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-raised"
                >
                  <Cpu className="h-3.5 w-3.5" /> Sesuaikan di Setup Mikrotik Baru
                </Link>
                <Button size="sm" variant="ghost" onClick={() => setShowScript((v) => !v)}>
                  <Terminal className="h-3.5 w-3.5" /> {showScript ? "Sembunyikan" : "Lihat script"}
                </Button>
              </div>

              {errors.length > 0 && (
                <Note tone="bad">
                  {errors.map((e) => e.message).join(" ")} Perbaiki lewat “Sesuaikan di Setup Mikrotik Baru”.
                </Note>
              )}

              <div className="grid gap-2 rounded-lg border border-line-soft bg-canvas/50 p-3 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-muted">Login router</p>
                  <p className="mt-0.5 font-mono text-ink">{config?.system.adminUser}</p>
                </div>
                <div>
                  <p className="text-muted">Password admin router</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-ink">{showPass ? r.routerPassword : "•".repeat(12)}</span>
                    <button type="button" className="text-brand hover:underline" onClick={() => setShowPass((v) => !v)}>
                      {showPass ? "sembunyikan" : "tampilkan"}
                    </button>
                    <button type="button" className="text-brand hover:underline" onClick={() => copy("pass", r.routerPassword)}>
                      {copied === "pass" ? "tersalin" : "salin"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-muted hover:text-ink"
                      disabled={busy !== null}
                      onClick={() => confirm("Buat password router baru? Script ikut berubah.") && void patch({ resetPassword: true }, "pass")}
                    >
                      <Rotate className="h-3 w-3" /> ganti
                    </button>
                  </div>
                </div>
                <div className="sm:col-span-2 text-faint">
                  {summaryLine(config)}
                </div>
              </div>

              {showScript && (
                <pre className="max-h-[480px] overflow-auto rounded-lg border border-line bg-canvas p-3 font-mono text-[12px] leading-relaxed">
                  {script.split("\n").map((line, i) => (
                    <div key={i}>{highlightScriptLine(line) || " "}</div>
                  ))}
                </pre>
              )}
              <p className="text-[11px] leading-relaxed text-faint">
                Tempel di New Terminal pada router yang masih kondisi default (atau setelah reset tanpa konfigurasi bawaan).
              </p>
            </div>
          </Card>

          {usesLoginPage(r.purpose) && (
            <Card title="Login page hotspot">
              <p className="text-sm leading-relaxed text-muted">
                Template pilihan pelanggan dengan nama <b className="text-ink">{r.businessName}</b> dan tombol WhatsApp{" "}
                <b className="text-ink">{formatPhone(r.phone)}</b> sudah terpasang.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/hotspot-login?permintaan=${r.id}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-brand bg-brand px-3 text-xs font-medium text-[color:var(--color-brand-ink)] transition-all hover:brightness-90"
                >
                  <FileText className="h-3.5 w-3.5" /> Sesuaikan &amp; unduh
                </Link>
                <Button size="sm" onClick={downloadZip} disabled={zipBusy}>
                  <Download className="h-3.5 w-3.5" /> {zipBusy ? "Menyiapkan…" : "Unduh hotspot.zip langsung"}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={submitted ? "Ubah isian" : "Isi form untuk pelanggan"}
        description="Isian yang sama dengan form pelanggan."
      >
        <RequestForm
          initial={r}
          submitLabel="Simpan"
          onSubmit={async (data: SettingRequestData) => {
            const res = await patch({ data }, "data");
            if (res.ok) setEditOpen(false);
            return res;
          }}
        />
      </Modal>
    </div>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">{k}</dt>
      <dd className="mt-0.5 break-words text-ink">{v || "-"}</dd>
    </div>
  );
}

/** Nama template login page (diambil dari daftar publik). */
function TemplateName({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/hotspot-templates", { cache: "no-store" })
      .then((x) => x.json())
      .then((d: { templates?: { id: string; name: string; isDefault: boolean }[] }) => {
        if (!active) return;
        const list = d.templates ?? [];
        const t = id ? list.find((x) => x.id === id) : list.find((x) => x.isDefault);
        setName(t ? `${t.name}${id ? "" : " (default)"}` : id ? "Template sudah dihapus — memakai default" : "Tampilan standar");
      })
      .catch(() => active && setName("-"));
    return () => {
      active = false;
    };
  }, [id]);
  return <Item k="Template login page" v={name ?? "…"} />;
}

function summaryLine(config: ReturnType<typeof buildSetupConfig> | null) {
  if (!config) return "";
  const parts = [`WAN ${config.wans[0]?.iface}`];
  for (const b of config.bridges) parts.push(`${b.name}: ${b.ports.join(", ") || "tanpa port"}`);
  if (config.hotspots.length) parts.push("hotspot 10.10.0.0/24");
  if (config.pppoe.enabled) parts.push(`PPPoE ${config.pppoe.iface} (paket 10 Mbps)`);
  if (config.wireless.radios.length) parts.push(`WiFi ${config.wireless.radios.map((x) => x.ssid).join(" / ")}`);
  return parts.join(" · ");
}
