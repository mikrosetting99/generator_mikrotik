"use client";

import { useEffect, useRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, Trash, X } from "@/components/icons";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ label */

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
          {label}
          {required && (
            <span className="ml-1 text-bad" aria-label="wajib diisi">
              *
            </span>
          )}
        </span>
      )}
      {children}
      {error ? (
        <span className="flex items-start gap-1.5 text-xs text-bad">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs leading-relaxed text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/* ----------------------------------------------------------------- inputs */

const controlBase =
  "w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink outline-none " +
  "transition-[border-color,box-shadow,background-color] duration-200 " +
  "placeholder:text-faint/70 hover:border-line/80 " +
  "focus:border-brand focus:shadow-[0_0_0_3px_rgba(56,189,248,0.14)] focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
  type = "text",
  invalid,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: "text" | "password" | "number";
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        controlBase,
        "h-11 sm:h-10",
        mono && "font-mono text-[13px] tracking-tight",
        invalid && "border-bad focus:border-bad focus:shadow-[0_0_0_3px_rgba(248,113,113,0.16)]",
        className,
      )}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function Select({
  value,
  onChange,
  options,
  groups,
  placeholder = "— pilih —",
  invalid,
  disabled,
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  /** Alternatif `options` untuk daftar panjang yang perlu dikelompokkan. */
  groups?: Array<{ label: string; options: SelectOption[] }>;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">) {
  const renderOption = (opt: SelectOption) => (
    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
      {opt.label}
    </option>
  );

  return (
    <span className="relative block">
      <select
        {...rest}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          controlBase,
          "h-11 appearance-none pr-10 sm:h-10",
          invalid && "border-bad",
          className,
        )}
      >
        <option value="">{placeholder}</option>
        {groups
          ? groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map(renderOption)}
              </optgroup>
            ))
          : (options ?? []).map(renderOption)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200",
        checked
          ? "border-brand/35 bg-brand/[0.07] hover:border-brand/55"
          : "border-line-soft bg-canvas/50 hover:border-line",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-canvas shadow transition-transform duration-200",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm", checked ? "text-ink" : "text-muted")}>{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-faint">{hint}</span>}
      </span>
    </button>
  );
}

export function CheckPill({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 font-mono text-xs transition-all duration-200",
        active
          ? "border-brand/60 bg-brand/15 text-brand"
          : "border-line bg-canvas text-muted hover:border-brand/40 hover:text-ink",
        disabled && "cursor-not-allowed opacity-40 hover:border-line hover:text-muted",
      )}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- buttons */

export function Button({
  onClick,
  children,
  variant = "default",
  size = "md",
  disabled,
  className,
  title,
  ariaLabel,
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: "default" | "primary" | "brand" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const variants = {
    default:
      "border border-line bg-raised text-ink hover:border-brand/50 hover:bg-raised/70 hover:text-brand active:scale-[0.98]",
    primary:
      "border border-accent/40 bg-accent text-[color:var(--color-accent-ink)] font-semibold shadow-[0_10px_30px_-14px_rgba(34,197,94,0.9)] hover:brightness-110 active:scale-[0.98]",
    brand:
      "border border-brand/40 bg-brand text-[color:var(--color-brand-ink)] font-semibold shadow-[0_10px_30px_-14px_rgba(56,189,248,0.55)] hover:brightness-110 active:scale-[0.98]",
    ghost: "border border-transparent text-muted hover:bg-raised hover:text-ink",
    danger: "border border-transparent text-faint hover:bg-bad/10 hover:text-bad",
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium",
        "transition-all duration-200 disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "min-h-9 px-3 text-xs" : "min-h-11 px-4 text-sm sm:min-h-10",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ cards */

export function Panel({
  title,
  step,
  description,
  optional,
  right,
  children,
  id,
}: {
  title: string;
  step?: string;
  description?: ReactNode;
  optional?: boolean;
  right?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="edge-light scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface transition-colors duration-300 hover:border-line/80"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft bg-gradient-to-b from-white/[0.025] to-transparent px-5 py-4">
        <div className="flex min-w-0 gap-3">
          {step && (
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 font-mono text-[11px] font-medium text-brand">
              {step}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
              {optional && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                  opsional
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted">
                {description}
              </p>
            )}
          </div>
        </div>
        {right}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

/** Baris entri di dalam list dinamis (WAN, VLAN, pool, dst). */
export function Row({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-raised/50 p-4 transition-colors duration-200 hover:border-line">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
          {label}
        </span>
        {onRemove && (
          <Button
            variant="danger"
            size="sm"
            onClick={onRemove}
            title={`Hapus ${label}`}
            ariaLabel={`Hapus ${label}`}
            className="px-2"
          >
            <Trash className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line/70 px-4 py-7 text-center text-[13px] text-faint">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the modal opens/closes, not when the caller's inline onClose identity changes (that was stealing focus on every keystroke)
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-canvas/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="edge-light relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[0_40px_100px_-40px_rgba(0,0,0,1)] sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} ariaLabel="Tutup" title="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "bad";
  children: ReactNode;
}) {
  const tones = {
    info: "border-brand/20 bg-brand/[0.06] text-muted",
    warn: "border-warn/25 bg-warn/[0.07] text-warn",
    bad: "border-bad/25 bg-bad/[0.07] text-bad",
  };
  const Glyph = tone === "info" ? AlertCircle : AlertTriangle;
  return (
    <div className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3", tones[tone])}>
      <Glyph className="mt-0.5 h-4 w-4" />
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}
