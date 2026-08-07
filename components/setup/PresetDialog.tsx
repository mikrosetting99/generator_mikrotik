"use client";

import { ArrowRight, Wand } from "@/components/icons";
import { Note } from "@/components/ui";
import { PRESETS } from "@/lib/presets";
import type { SetupConfig } from "@/lib/types";

export function PresetDialog({
  onPick,
  onClose,
}: {
  onPick: (config: SetupConfig, name: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              onPick(preset.build(), preset.name);
              onClose();
            }}
            className="group rounded-xl border border-line-soft bg-canvas/50 p-4 text-left transition-all duration-200 hover:border-brand/50 hover:bg-raised"
          >
            <span className="flex items-center gap-2">
              <Wand className="h-4 w-4 text-brand" />
              <span className="text-sm font-semibold text-ink">{preset.name}</span>
              <ArrowRight className="ml-auto h-4 w-4 text-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand" />
            </span>
            <span className="mt-1.5 block text-[13px] leading-relaxed text-muted">
              {preset.description}
            </span>
            <ul className="mt-2.5 space-y-1">
              {preset.points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-xs text-faint">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                  {point}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <Note>
        Semua konfigurasi memakai hEX (RB750Gr3) dan RouterOS v7 sebagai dasar — ganti model,
        interface, dan subnet sesuai perangkat Anda setelah dimuat. Password admin sengaja
        dibiarkan kosong; isi sendiri di langkah terakhir.
      </Note>
    </div>
  );
}
