"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Check, Copy, Download, Terminal } from "@/components/icons";
import { Button, Note } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { highlightScriptLine } from "@/lib/script-highlight";
import type { LbIssue, LbSectionId } from "@/lib/types-loadbalance";

export function ScriptPreview({
  script,
  issues,
  onJump,
  filename,
}: {
  script: string;
  issues: LbIssue[];
  onJump: (section: LbSectionId) => void;
  filename: string;
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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const status = blocked
    ? { tone: "border-bad/40 bg-bad/10 text-bad", text: `${errors.length} error` }
    : warnings.length > 0
      ? { tone: "border-warn/40 bg-warn/10 text-warn", text: `${warnings.length} catatan` }
      : { tone: "border-accent/40 bg-accent/10 text-accent", text: "siap pakai" };

  return (
    <div className="flex flex-col gap-4">
      <div className="edge-light overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-line-soft bg-canvas/60 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
          </span>
          <span className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted">
            <Terminal className="h-3.5 w-3.5 text-faint" />
            <span className="truncate">{filename}</span>
          </span>
          <span
            className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${status.tone}`}
          >
            {status.text}
          </span>
        </div>

        <pre className="max-h-[50vh] overflow-auto bg-code px-3 py-3 font-mono text-[11.5px] leading-[1.7] lg:max-h-[calc(100vh-23rem)] lg:min-h-[300px]">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3 px-1 hover:bg-white/[0.03]">
              <span className="w-7 shrink-0 select-none text-right text-faint/40">{i + 1}</span>
              <span className="whitespace-pre-wrap break-words">{highlightScriptLine(line)}</span>
            </div>
          ))}
        </pre>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-4 py-2 font-mono text-[11px] text-faint">
          <span>
            {commandCount} perintah · {lines.length} baris
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line-soft bg-canvas/40 px-4 py-3.5">
          <Button
            variant="primary"
            onClick={copy}
            disabled={blocked}
            title={blocked ? "Perbaiki error terlebih dahulu" : "Salin seluruh script"}
            className="flex-1"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Tersalin" : "Copy to Clipboard"}
          </Button>
          <Button
            onClick={() =>
              downloadBlob(new Blob([script], { type: "text/plain;charset=utf-8" }), filename)
            }
            disabled={blocked}
            title="Unduh sebagai file .rsc"
          >
            <Download className="h-4 w-4" />
            .rsc
          </Button>
        </div>
      </div>

      {blocked && (
        <div className="rounded-2xl border border-bad/30 bg-bad/[0.06] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-bad">
            <AlertCircle className="h-4 w-4" />
            Perbaiki dulu sebelum menyalin
          </h3>
          <ul className="mt-2.5 space-y-1">
            {errors.slice(0, 8).map((issue, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onJump(issue.section)}
                  className="group flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-xs leading-relaxed text-bad/90 transition-colors hover:bg-bad/10 hover:text-bad"
                >
                  <ArrowRight className="mt-0.5 h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="-ml-4 group-hover:ml-0">{issue.message}</span>
                </button>
              </li>
            ))}
            {errors.length > 8 && (
              <li className="px-1.5 text-xs text-bad/70">
                …dan {errors.length - 8} error lainnya.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold text-ink">Cara menjalankan</h3>
        <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
          {[
            <>
              Backup dulu:{" "}
              <code className="rounded bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-brand">
                /system backup save name=sebelum-loadbalance
              </code>
            </>,
            <>
              Buka Winbox atau WebFig, klik menu <span className="text-ink">New Terminal</span>.
            </>,
            <>Tempel seluruh script sekaligus (Ctrl+V), lalu tekan Enter.</>,
            <>Jalankan perintah verifikasi di bagian akhir script.</>,
          ].map((text, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line bg-canvas font-mono text-[10px] text-brand">
                {i + 1}
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4">
          <Note>
            Script dibuat sepenuhnya di browser Anda. IP dan konfigurasi tidak dikirim ke server
            mana pun.
          </Note>
        </div>
      </div>
    </div>
  );
}
