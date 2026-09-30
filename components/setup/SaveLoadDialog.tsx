"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Database,
  Download,
  FolderOpen,
  Save,
  Trash,
  Upload,
} from "@/components/icons";
import { Button, CheckPill, EmptyState, Field, Note, TextInput, Toggle } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import {
  deleteSaved,
  describeConfig,
  hasSecrets,
  listSaved,
  normalizeConfig,
  parseFilePayload,
  saveConfig,
  toFilePayload,
  type SavedConfig,
} from "@/lib/storage";
import type { SetupConfig } from "@/lib/types";

interface ServerEntry {
  id: string;
  name: string;
  hasSecrets: boolean;
  savedAt: string;
  ownerUsername?: string;
  mine: boolean;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "konfigurasi"
  );
}

export function SaveLoadDialog({
  config,
  onLoad,
  onClose,
}: {
  config: SetupConfig;
  onLoad: (config: SetupConfig, name: string) => void;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [entries, setEntries] = useState<SavedConfig[]>([]);
  const [name, setName] = useState("");
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [serverEntries, setServerEntries] = useState<ServerEntry[] | null>(null);
  const [serverError, setServerError] = useState("");
  const [serverScope, setServerScope] = useState<"mine" | "all">("mine");
  const [savingServer, setSavingServer] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setEntries(listSaved());
  }, []);

  const notify = (tone: "ok" | "bad", text: string) => {
    setFlash({ tone, text });
    setTimeout(() => setFlash(null), 3500);
  };

  const loadServerEntries = useCallback((scope: "mine" | "all") => {
    setServerError("");
    fetch(`/api/configs?scope=${scope}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setServerEntries(data.entries))
      .catch(() => setServerError("Gagal memuat riwayat server."));
  }, []);

  useEffect(() => {
    loadServerEntries(serverScope);
  }, [serverScope, loadServerEntries]);

  const secretsPresent = hasSecrets(config);

  const handleSave = () => {
    setEntries(saveConfig(name, config, includeSecrets));
    notify("ok", `Konfigurasi "${name.trim() || "Tanpa nama"}" tersimpan di browser ini.`);
    setName("");
  };

  const handleSaveServer = async () => {
    setSavingServer(true);
    try {
      const res = await fetch("/api/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config, includeSecrets }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("bad", data.error ?? "Gagal menyimpan ke server.");
        return;
      }
      notify("ok", `Konfigurasi "${data.entry.name}" tersimpan ke server sebagai riwayat baru.`);
      setName("");
      loadServerEntries(serverScope);
    } catch {
      notify("bad", "Gagal menghubungi server.");
    } finally {
      setSavingServer(false);
    }
  };

  const handleLoadServer = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/configs/${id}`);
      const data = await res.json();
      if (!res.ok) {
        notify("bad", data.error ?? "Gagal memuat konfigurasi.");
        return;
      }
      onLoad(normalizeConfig(data.config), data.name);
      onClose();
    } catch {
      notify("bad", "Gagal menghubungi server.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteServer = async (id: string, label: string) => {
    if (!confirm(`Hapus konfigurasi "${label}" dari server?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/configs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify("bad", data.error ?? "Gagal menghapus.");
        return;
      }
      loadServerEntries(serverScope);
    } catch {
      notify("bad", "Gagal menghubungi server.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = () => {
    const label = name.trim() || "konfigurasi-mikrotik";
    const blob = new Blob([toFilePayload(label, config, includeSecrets)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, `${fileSlug(label)}.json`);
    notify("ok", "File konfigurasi diunduh.");
  };

  const handleImport = async (file: File) => {
    const result = parseFilePayload(await file.text());
    if (!result.ok || !result.config) {
      notify("bad", result.error ?? "File tidak bisa dibaca.");
      return;
    }
    onLoad(result.config, result.name);
    onClose();
  };

  return (
    <div className="space-y-6">
      {flash && <Note tone={flash.tone === "ok" ? "info" : "bad"}>{flash.text}</Note>}

      {/* ------------------------------------------------------------ simpan */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Save className="h-4 w-4 text-brand" />
          Simpan konfigurasi saat ini
        </h3>
        <div className="mt-3 space-y-3">
          <Field label="Nama konfigurasi" hint="Dipakai sebagai judul riwayat, boleh sama berkali-kali.">
            <TextInput value={name} onChange={setName} placeholder="Kantor Cabang Bandung" />
          </Field>

          {secretsPresent && (
            <Toggle
              checked={includeSecrets}
              onChange={setIncludeSecrets}
              label="Sertakan password"
              hint="Password admin dan PPPoE ikut tersimpan sebagai teks biasa. Biarkan mati bila riwayat ini bisa dilihat orang lain."
            />
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={handleSaveServer} disabled={savingServer}>
              <Database className="h-4 w-4" />
              {savingServer ? "Menyimpan…" : "Simpan ke server"}
            </Button>
            <Button variant="brand" onClick={handleSave}>
              <Save className="h-4 w-4" />
              Simpan di browser
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4" />
              Unduh file .json
            </Button>
            <Button onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" />
              Muat dari file
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImport(file);
              }}
            />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- server */}
      <section className="border-t border-line-soft pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Database className="h-4 w-4 text-brand" />
            Riwayat di server
            {serverEntries && serverEntries.length > 0 && (
              <span className="font-mono text-[11px] font-normal text-faint">
                ({serverEntries.length})
              </span>
            )}
          </h3>
          {isAdmin && (
            <div className="flex gap-1.5">
              <CheckPill active={serverScope === "mine"} onClick={() => setServerScope("mine")}>
                Punya saya
              </CheckPill>
              <CheckPill active={serverScope === "all"} onClick={() => setServerScope("all")}>
                Semua akun
              </CheckPill>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {serverError ? (
            <Note tone="bad">{serverError}</Note>
          ) : serverEntries === null ? (
            <p className="py-4 text-center text-xs text-faint">Memuat…</p>
          ) : serverEntries.length === 0 ? (
            <EmptyState>Belum ada konfigurasi tersimpan di server.</EmptyState>
          ) : (
            serverEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-raised/50 p-3 transition-colors hover:border-line"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {entry.name}
                    {entry.ownerUsername && !entry.mine && (
                      <span className="ml-1.5 font-mono text-[10px] text-faint">
                        · {entry.ownerUsername}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint/80">
                    {formatDate(entry.savedAt)}
                    {entry.hasSecrets && " · berisi password"}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={busyId === entry.id}
                  onClick={() => handleLoadServer(entry.id)}
                  title={`Muat ${entry.name}`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Muat
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="px-2"
                  disabled={busyId === entry.id}
                  title={`Hapus ${entry.name}`}
                  ariaLabel={`Hapus ${entry.name}`}
                  onClick={() => handleDeleteServer(entry.id, entry.name)}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-3">
          <Note>
            Tersimpan di database server — bisa dimuat ulang dari perangkat lain selama login
            dengan akun yang sama.
            {isAdmin && " Sebagai admin, Anda juga bisa melihat riwayat milik semua akun."}
          </Note>
        </div>
      </section>

      {/* ------------------------------------------------------------- daftar */}
      <section className="border-t border-line-soft pt-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FolderOpen className="h-4 w-4 text-brand" />
          Tersimpan di browser ini
          {entries.length > 0 && (
            <span className="font-mono text-[11px] font-normal text-faint">
              ({entries.length})
            </span>
          )}
        </h3>

        <div className="mt-3 space-y-2">
          {entries.length === 0 ? (
            <EmptyState>Belum ada konfigurasi tersimpan.</EmptyState>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-line-soft bg-raised/50 p-3 transition-colors hover:border-line"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{entry.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-faint">
                    {describeConfig(entry.config)}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint/80">
                    {formatDate(entry.savedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onLoad(entry.config, entry.name);
                    onClose();
                  }}
                  title={`Muat ${entry.name}`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Muat
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="px-2"
                  title={`Hapus ${entry.name}`}
                  ariaLabel={`Hapus ${entry.name}`}
                  onClick={() => {
                    if (confirm(`Hapus konfigurasi "${entry.name}"?`)) {
                      setEntries(deleteSaved(entry.id));
                    }
                  }}
                >
                  <Trash className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-3">
          <Note>
            Hanya tersimpan di penyimpanan browser perangkat ini — tidak ikut berpindah ke
            perangkat lain. Gunakan &ldquo;Simpan ke server&rdquo; di atas untuk riwayat yang bisa
            diakses dari mana saja.
          </Note>
        </div>
      </section>
    </div>
  );
}
