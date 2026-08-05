"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  FolderOpen,
  Save,
  Trash,
  Upload,
} from "@/components/icons";
import { Button, EmptyState, Field, Note, TextInput, Toggle } from "@/components/ui";
import {
  deleteSaved,
  describeConfig,
  hasSecrets,
  listSaved,
  parseFilePayload,
  saveConfig,
  toFilePayload,
  type SavedConfig,
} from "@/lib/storage";
import type { SetupConfig } from "@/lib/types";

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
  const [entries, setEntries] = useState<SavedConfig[]>([]);
  const [name, setName] = useState("");
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [flash, setFlash] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEntries(listSaved());
  }, []);

  const notify = (tone: "ok" | "bad", text: string) => {
    setFlash({ tone, text });
    setTimeout(() => setFlash(null), 3500);
  };

  const secretsPresent = hasSecrets(config);

  const handleSave = () => {
    setEntries(saveConfig(name, config, includeSecrets));
    notify("ok", `Konfigurasi "${name.trim() || "Tanpa nama"}" tersimpan di browser ini.`);
    setName("");
  };

  const handleExport = () => {
    const label = name.trim() || "konfigurasi-mikrotik";
    const blob = new Blob([toFilePayload(label, config, includeSecrets)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileSlug(label)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
      {flash && (
        <Note tone={flash.tone === "ok" ? "info" : "bad"}>{flash.text}</Note>
      )}

      {/* ------------------------------------------------------------ simpan */}
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Save className="h-4 w-4 text-brand" />
          Simpan konfigurasi saat ini
        </h3>
        <div className="mt-3 space-y-3">
          <Field label="Nama konfigurasi" hint="Nama yang sama akan menimpa entri sebelumnya.">
            <TextInput
              value={name}
              onChange={setName}
              placeholder="Kantor Cabang Bandung"
            />
          </Field>

          {secretsPresent && (
            <Toggle
              checked={includeSecrets}
              onChange={setIncludeSecrets}
              label="Sertakan password"
              hint="Password admin dan PPPoE ikut tersimpan sebagai teks biasa. Biarkan mati bila perangkat ini dipakai bersama."
            />
          )}

          <div className="flex flex-wrap gap-2">
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
      </section>

      <Note>
        Data tersimpan di penyimpanan browser perangkat ini saja — tidak dikirim ke server dan
        tidak ikut berpindah ke perangkat lain. Gunakan file .json bila ingin memindahkannya.
      </Note>
    </div>
  );
}
