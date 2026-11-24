"use client";

import { useState } from "react";
import { Check, Copy } from "@/components/icons";
import { Button, Field, Select, TextInput, Toggle } from "@/components/ui";
import { durationLabel, isRosDuration, TRIAL_DEFAULTS, trialAutoNote, trialCommand } from "@/lib/hotspot-page";
import type { HotspotPageConfig } from "@/lib/types-hotspot-login";

const UPTIMES = ["5m", "10m", "15m", "30m", "1h", "2h"];
const RESETS = ["1h", "6h", "12h", "1d", "7d"];

/** Pilihan cepat + "lainnya" untuk isian waktu RouterOS. */
function DurationField({
  label,
  hint,
  value,
  presets,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  presets: string[];
  onChange: (v: string) => void;
}) {
  const custom = !presets.includes(value);
  const [other, setOther] = useState(custom);
  const valid = isRosDuration(value);
  return (
    <Field label={label} hint={hint} error={other && value && !valid ? "Format waktu RouterOS, mis. 45m, 1h30m, 1d." : undefined}>
      <Select
        value={other ? "lain" : value}
        placeholder=""
        onChange={(v) => {
          if (v === "lain") setOther(true);
          else {
            setOther(false);
            onChange(v);
          }
        }}
        options={[...presets.map((p) => ({ value: p, label: durationLabel(p) })), { value: "lain", label: "Lainnya…" }]}
      />
      {other && <TextInput mono value={value} onChange={(v) => onChange(v.trim())} placeholder="mis. 45m" invalid={Boolean(value) && !valid} />}
    </Field>
  );
}

/**
 * Pengaturan tombol "Coba gratis" (login trial RouterOS). Bawaan mati.
 * Tombolnya hanya tampil di router bila login-by profil hotspot memuat "trial",
 * jadi perintah untuk mengaktifkannya disediakan di sini.
 */
export function TrialSettings({
  page,
  setPage,
}: {
  page: HotspotPageConfig;
  setPage: (partial: Partial<HotspotPageConfig>) => void;
}) {
  const [copied, setCopied] = useState(false);
  const command = trialCommand(page);

  return (
    <div className="space-y-4">
      <Toggle
        checked={page.showTrial}
        onChange={(showTrial) => setPage({ showTrial })}
        label="Aktifkan tombol coba gratis"
        hint="Pengunjung bisa internetan sebentar tanpa voucher. Satu perangkat (MAC) hanya sekali dalam jeda yang Anda tentukan."
      />

      {page.showTrial && (
        <>
          <div className="grid gap-4">
            <Field label="Tulisan tombol">
              <TextInput
                value={page.trialLabel ?? ""}
                onChange={(trialLabel) => setPage({ trialLabel })}
                placeholder={TRIAL_DEFAULTS.label}
              />
            </Field>
            <Field label="Keterangan" hint="Kosongkan agar dibuat otomatis dari lama dan jeda coba gratis.">
              <TextInput
                value={page.trialNote ?? ""}
                onChange={(trialNote) => setPage({ trialNote })}
                placeholder={trialAutoNote(page)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <DurationField
                label="Lama coba gratis"
                hint="trial-uptime-limit"
                value={page.trialUptime ?? TRIAL_DEFAULTS.uptime}
                presets={UPTIMES}
                onChange={(trialUptime) => setPage({ trialUptime })}
              />
              <DurationField
                label="Boleh diulang setelah"
                hint="trial-uptime-reset"
                value={page.trialReset ?? TRIAL_DEFAULTS.reset}
                presets={RESETS}
                onChange={(trialReset) => setPage({ trialReset })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-warn/30 bg-warn/[0.07] p-3">
            <p className="text-xs font-semibold text-ink">Aktifkan juga di router</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Tombol ini baru muncul di HP pengunjung setelah login trial aktif di profil hotspot. Jalankan sekali di
              New Terminal (perintah ini juga ada di PETUNJUK-UPLOAD.txt di dalam zip):
            </p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-line bg-canvas p-2 font-mono text-[11px] leading-relaxed text-ink">
              {command}
            </pre>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(command);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  } catch {
                    // clipboard diblokir: salin manual dari kotak di atas
                  }
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Tersalin" : "Salin perintah"}
              </Button>
              <span className="text-[11px] leading-relaxed text-faint">
                Bila profil Anda juga memakai cookie / mac-cookie, tambahkan ke login-by.
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
