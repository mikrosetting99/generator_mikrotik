"use client";

import { useEffect, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, AlertTriangle, ChevronDown, Trash, X } from "@/components/icons";
import { cn, controlBase } from "@/lib/kelas";

export { cn, controlBase };


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

/**
 * Pilihan dengan kolom cari — untuk daftar panjang seperti tipe Mikrotik.
 * Mengetik menyaring berdasarkan nama maupun nama grup/serinya.
 */
export function SearchSelect({
  value,
  onChange,
  groups,
  placeholder = "— pilih —",
  searchPlaceholder = "Cari…",
  invalid,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  groups: Array<{ label: string; options: SelectOption[] }>;
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const visible = groups
    .map((g) => ({
      label: g.label,
      options: g.options.filter(
        (o) => !q || o.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.options.length > 0);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  return (
    <span ref={root} className="relative block">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          controlBase,
          "h-11 pr-10 text-left sm:h-10",
          invalid && "border-bad",
        )}
      >
        {selected ? selected.label : placeholder}
      </button>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="border-b border-line-soft p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = visible[0]?.options.find((o) => !o.disabled);
                  if (first) pick(first.value);
                }
              }}
              placeholder={searchPlaceholder}
              className={cn(controlBase, "h-9")}
            />
          </div>
          <div role="listbox" className="max-h-72 overflow-y-auto py-1">
            {visible.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-faint">Tidak ada hasil untuk “{query}”.</p>
            )}
            {visible.map((g) => (
              <div key={g.label}>
                <p className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
                  {g.label}
                </p>
                {g.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    disabled={o.disabled}
                    onClick={() => pick(o.value)}
                    className={cn(
                      "block w-full px-3 py-2 text-left text-sm hover:bg-brand/10",
                      o.value === value ? "text-brand" : "text-ink",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
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
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: "default" | "primary" | "brand" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** "submit" untuk tombol utama di dalam <form> (server action); bawaannya "button". */
  type?: "button" | "submit";
}) {
  const variants = {
    default:
      "border border-line bg-surface text-ink hover:border-brand/60 hover:bg-raised hover:text-brand active:scale-[0.98]",
    primary:
      "border border-brand bg-brand text-[color:var(--color-brand-ink)] font-semibold hover:brightness-110 active:scale-[0.98]",
    brand:
      "border border-accent bg-accent text-[color:var(--color-accent-ink)] font-semibold hover:brightness-110 active:scale-[0.98]",
    ghost: "border border-transparent text-muted hover:bg-raised hover:text-ink",
    danger: "border border-transparent text-faint hover:bg-bad/10 hover:text-bad",
  };
  return (
    <button
      type={type}
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
  fill,
}: {
  title: string;
  step?: string;
  description?: ReactNode;
  optional?: boolean;
  right?: ReactNode;
  children: ReactNode;
  id?: string;
  /** Panel mengisi sisa tinggi kolomnya (untuk menyejajarkan dua kolom). */
  fill?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "edge-light scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface transition-colors duration-300 hover:border-line/80",
        fill && "flex h-full flex-col",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft bg-raised/60 px-5 py-3.5">
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
      <div className={cn("px-5 py-5", fill && "flex flex-1 flex-col")}>{children}</div>
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
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Jendela lebih lebar (untuk daftar berkartu). */
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Dirender lewat portal ke <body>: dialog yang dibuka dari dalam header (yang warnanya
  // dibalik jadi putih di atas ungu) tidak boleh ikut mewarisi warna header itu.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
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
        className={`edge-light relative flex max-h-[88vh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-[0_40px_100px_-40px_rgba(0,0,0,1)] sm:rounded-2xl`}
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
    </div>,
    document.body,
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
