"use client";

import { useState } from "react";
import { Button, Note } from "@/components/ui";
import { buildHotspotPackage } from "@/lib/hotspot-page";
import type { Issue, SetupConfig } from "@/lib/types";
import { createZip } from "@/lib/zip";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "mikrotik"
  );
}

export function ScriptPreview({
  script,
  config,
  issues,
  onJump,
}: {
  script: string;
  config: SetupConfig;
  issues: Issue[];
  onJump: (section: Issue["section"]) => void;
}) {
  const [copied, setCopied] = useState(false);
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warn");
  const blocked = errors.length > 0;
  const lines = script.split("\n");
  const commandCount = lines.filter((l) => l.trim() && !l.trim().startsWith("#")).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">Preview Script</h2>
            <p className="mt-0.5 font-mono text-[11px] text-faint">
              {commandCount} perintah · {lines.length} baris
            </p>
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              blocked
                ? "border-bad/40 bg-bad/10 text-bad"
                : warnings.length > 0
                  ? "border-warn/40 bg-warn/10 text-warn"
                  : "border-good/40 bg-good/10 text-good"
            }`}
          >
            {blocked ? `${errors.length} error` : warnings.length > 0 ? `${warnings.length} catatan` : "siap"}
          </span>
        </div>

        <pre className="max-h-[38vh] min-h-[220px] overflow-auto px-4 py-3 font-mono text-[11.5px] leading-[1.65] xl:max-h-[46vh]">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span className="w-7 shrink-0 select-none text-right text-faint/50">{i + 1}</span>
              <span
                className={
                  line.trimStart().startsWith("#")
                    ? "text-faint"
                    : line.trimStart().startsWith("/")
                      ? "text-brand"
                      : "text-ink"
                }
              >
                {line || " "}
              </span>
            </div>
          ))}
        </pre>

        <div className="flex flex-wrap gap-2 border-t border-line-soft px-4 py-3">
          <Button
            variant="primary"
            onClick={copy}
            disabled={blocked}
            title={blocked ? "Perbaiki error terlebih dahulu" : undefined}
          >
            {copied ? "✓ Tersalin" : "Copy to Clipboard"}
          </Button>
          <Button
            onClick={() =>
              download(
                new Blob([script], { type: "text/plain;charset=utf-8" }),
                `setup-${slug(config.system.identity || config.modelId)}.rsc`,
              )
            }
            disabled={blocked}
          >
            Download .rsc
          </Button>
          {config.hotspots.length > 0 && (
            <Button
              onClick={() =>
                download(
                  createZip(buildHotspotPackage(config.system.identity || "Hotspot")),
                  `hotspot-login-${slug(config.system.identity || "mikrotik")}.zip`,
                )
              }
            >
              Unduh login page
            </Button>
          )}
        </div>
      </div>

      {blocked && (
        <div className="rounded-2xl border border-bad/30 bg-bad/5 p-4">
          <h3 className="text-sm font-semibold text-bad">Perbaiki dulu sebelum menyalin</h3>
          <ul className="mt-2 space-y-1.5">
            {errors.slice(0, 8).map((issue, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onJump(issue.section)}
                  className="text-left text-xs leading-relaxed text-bad/90 underline decoration-bad/30 underline-offset-2 hover:decoration-bad"
                >
                  {issue.message}
                </button>
              </li>
            ))}
            {errors.length > 8 && (
              <li className="text-xs text-bad/70">…dan {errors.length - 8} error lainnya.</li>
            )}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Cara menjalankan</h3>
        <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            <span className="font-mono text-brand">1.</span> Backup dulu:{" "}
            <span className="font-mono text-ink">/system backup save name=sebelum-setup</span>
          </li>
          <li>
            <span className="font-mono text-brand">2.</span> Buka Winbox atau WebFig, klik menu{" "}
            <span className="text-ink">New Terminal</span>.
          </li>
          <li>
            <span className="font-mono text-brand">3.</span> Tempel seluruh script sekaligus
            (Ctrl+V), lalu tekan Enter.
          </li>
          <li>
            <span className="font-mono text-brand">4.</span> Jalankan perintah verifikasi di bagian
            akhir script.
          </li>
        </ol>
        <div className="mt-3">
          <Note>
            Script dibuat sepenuhnya di browser Anda. IP, password, dan data lain tidak dikirim ke
            server mana pun.
          </Note>
        </div>
      </div>
    </div>
  );
}
