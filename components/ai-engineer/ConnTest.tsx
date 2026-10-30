"use client";

import type { DiagResult } from "@/lib/ai-routers";

export interface DiagState {
  busy: boolean;
  result?: DiagResult;
  error?: string;
}

/** Hasil test koneksi API: tiap langkah (alamat, port, login, baca data) dengan waktu dan penjelasan. */
export function ConnTest({ state }: { state: DiagState }) {
  if (state.busy) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-2 text-xs text-muted" role="status">
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        Menguji koneksi API… (maks. sekitar 20 detik)
      </p>
    );
  }
  if (state.error) return <p className="rounded-md border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad">{state.error}</p>;
  const r = state.result;
  if (!r) return null;
  return (
    <div className={`overflow-hidden rounded-md border ${r.ok ? "border-ok/40" : "border-bad/40"}`}>
      <p className={`px-3 py-1.5 text-xs font-semibold ${r.ok ? "bg-ok/10 text-ok" : "bg-bad/10 text-bad"}`}>
        {r.ok ? "Koneksi API berhasil" : "Koneksi API gagal"}
      </p>
      <ol className="divide-y divide-line-soft bg-surface">
        {r.steps.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5 px-3 py-2 text-xs">
            <span
              aria-hidden
              className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${s.skipped ? "bg-faint" : s.ok ? "bg-ok" : "bg-bad"}`}
            >
              {s.skipped ? "–" : s.ok ? "✓" : "✕"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{s.label}</span>
              <span className={`block break-words font-mono text-[11px] ${s.skipped ? "text-faint" : s.ok ? "text-muted" : "text-bad"}`}>{s.detail}</span>
            </span>
            {!s.skipped && <span className="shrink-0 font-mono text-[11px] text-faint">{s.ms} ms</span>}
          </li>
        ))}
      </ol>
      {r.hint && <p className="border-t border-line bg-warn/10 px-3 py-2 text-xs leading-relaxed text-warn">{r.hint}</p>}
    </div>
  );
}
