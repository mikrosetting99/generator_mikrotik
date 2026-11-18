"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "@/components/icons";
import { Thumb, VIEWS } from "@/components/hotspot-login/TemplateGallery";
import { Button, cn, controlBase, Field, Note, SearchSelect } from "@/components/ui";
import { getModel } from "@/lib/models";
import { formatPhone } from "@/lib/phone";
import {
  MAX_NEEDS,
  modelOptions,
  PURPOSES,
  usesLoginPage,
  type Purpose,
  type SettingRequestData,
} from "@/lib/setting-request";

interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
}

export type SubmitResult = { ok: true } | { ok: false; error?: string; errors?: Record<string, string> };

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
  invalid,
  autoComplete,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel";
  placeholder?: string;
  invalid?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel";
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      className={cn(controlBase, "h-11 sm:h-10", invalid && "border-bad")}
    />
  );
}

/**
 * Isian Form Setting Mikrotik. Dipakai pelanggan (link publik) dan admin (merapikan isian).
 * Kolom berganti sesuai peruntukan: Hotspot/PPPoE butuh nama usaha & telepon admin,
 * Kantor butuh penjelasan kebutuhan.
 */
export function RequestForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: SettingRequestData;
  submitLabel: string;
  onSubmit: (data: SettingRequestData) => Promise<SubmitResult>;
}) {
  const [data, setData] = useState<SettingRequestData>(() => ({
    ...initial,
    phone: initial.phone ? formatPhone(initial.phone) : "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);

  const groups = useMemo(modelOptions, []);
  const model = data.modelId ? getModel(data.modelId) : undefined;
  const office = data.purpose === "kantor";
  const needsTemplate = usesLoginPage(data.purpose);

  useEffect(() => {
    if (!needsTemplate || templates) return;
    fetch("/api/hotspot-templates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]));
  }, [needsTemplate, templates]);

  const set = <K extends keyof SettingRequestData>(key: K, value: SettingRequestData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await onSubmit(data);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setError(res.error ?? "Gagal mengirim.");
        // Bawa pengguna ke kolom pertama yang bermasalah.
        requestAnimationFrame(() => document.querySelector("[data-invalid='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2.5" data-invalid={Boolean(errors.purpose)}>
        <legend className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
          Peruntukan <span className="text-bad">*</span>
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PURPOSES.map((p) => {
            const active = data.purpose === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("purpose", p.id as Purpose)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  active ? "border-brand bg-brand/[0.08]" : "border-line bg-surface hover:border-brand/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                    active ? "border-brand bg-brand" : "border-line bg-canvas",
                  )}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-ink)]" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{p.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{p.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.purpose && <p className="text-xs text-bad">{errors.purpose}</p>}
      </fieldset>

      {data.purpose && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2" data-invalid={Boolean(errors.modelId)}>
            <Field
              label="Type MikroTik"
              required
              error={errors.modelId}
              hint={
                model && model.id !== "custom"
                  ? `${model.interfaces.length} interface · ${model.supports.includes("v7") ? "RouterOS v7" : "RouterOS v6"}${model.note ? ` · ${model.note}` : ""}`
                  : "Ketik untuk mencari, mis. hAP, hEX, RB951, CCR."
              }
            >
              <SearchSelect
                value={data.modelId}
                onChange={(v) => set("modelId", v)}
                groups={groups}
                placeholder="— pilih type MikroTik —"
                searchPlaceholder="Cari type, mis. hAP ac²"
                invalid={Boolean(errors.modelId)}
              />
            </Field>
          </div>

          {!office && (
            <div className="sm:col-span-2" data-invalid={Boolean(errors.businessName)}>
              <Field
                label="Nama usaha / nama voucher"
                required
                error={errors.businessName}
                hint="Tampil di halaman login dan menjadi nama WiFi."
              >
                <Input
                  value={data.businessName}
                  onChange={(v) => set("businessName", v)}
                  placeholder="Mis. Warung Kopi Bu Sri"
                  invalid={Boolean(errors.businessName)}
                  autoComplete="organization"
                />
              </Field>
            </div>
          )}

          <div data-invalid={Boolean(errors.email)} className={office ? "sm:col-span-2" : ""}>
            <Field label="Email aktif" required error={errors.email}>
              <Input
                type="email"
                inputMode="email"
                value={data.email}
                onChange={(v) => set("email", v)}
                placeholder="nama@email.com"
                invalid={Boolean(errors.email)}
                autoComplete="email"
              />
            </Field>
          </div>

          {!office && (
            <div data-invalid={Boolean(errors.phone)}>
              <Field
                label="No. telepon admin"
                required
                error={errors.phone}
                hint="Dipakai untuk tombol WhatsApp di halaman login."
              >
                <Input
                  type="tel"
                  inputMode="tel"
                  value={data.phone}
                  onChange={(v) => set("phone", v)}
                  placeholder="0812xxxxxxxx"
                  invalid={Boolean(errors.phone)}
                  autoComplete="tel"
                />
              </Field>
            </div>
          )}

          {office && (
            <div className="sm:col-span-2" data-invalid={Boolean(errors.needs)}>
              <Field
                label="Jelaskan kebutuhan"
                required
                error={errors.needs}
                hint={`${data.needs.length}/${MAX_NEEDS} · Mis. jumlah komputer/HP, perlu WiFi tamu terpisah, CCTV, printer, VPN ke cabang, batas bandwidth.`}
              >
                <textarea
                  value={data.needs}
                  maxLength={MAX_NEEDS}
                  rows={6}
                  onChange={(e) => set("needs", e.target.value)}
                  placeholder="Ceritakan jaringan kantor yang Anda butuhkan…"
                  className={cn(controlBase, "min-h-36 py-2.5 leading-relaxed", errors.needs && "border-bad")}
                />
              </Field>
            </div>
          )}
        </div>
      )}

      {needsTemplate && (
        <section className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Template login page</p>
            <p className="mt-1 text-xs leading-relaxed text-faint">
              Pilih tampilan halaman login hotspot. Nama usaha dan nomor WhatsApp Anda dipasang otomatis.
            </p>
          </div>
          {templates === null ? (
            <p className="py-4 text-center text-xs text-faint">Memuat template…</p>
          ) : templates.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-xs text-faint">
              Belum ada template. Admin akan memakai tampilan standar.
            </p>
          ) : (
            <div role="radiogroup" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {templates.map((t) => {
                const active = data.templateId === t.id || (!data.templateId && t.isDefault);
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => set("templateId", t.id)}
                    className={cn(
                      "relative flex flex-col items-center gap-2 rounded-xl border p-2.5 text-left transition-colors",
                      active ? "border-brand bg-brand/[0.08]" : "border-line bg-surface hover:border-brand/40",
                    )}
                  >
                    {active && (
                      <span className="absolute right-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full bg-brand text-[color:var(--color-brand-ink)]">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <Thumb id={t.id} width={96} height={208} device={VIEWS[0]} />
                    <span className="w-full truncate text-center text-xs font-medium text-ink">{t.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {error && <Note tone="bad">{error}</Note>}

      <Button variant="primary" className="w-full" onClick={submit} disabled={busy || !data.purpose}>
        {busy ? "Mengirim…" : submitLabel}
      </Button>
    </div>
  );
}
