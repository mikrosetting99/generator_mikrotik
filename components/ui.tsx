"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

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
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
          {required && <span className="ml-1 text-bad">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="text-xs text-bad">{error}</span>
      ) : hint ? (
        <span className="text-xs leading-relaxed text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/* ----------------------------------------------------------------- inputs */

const controlBase =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition " +
  "placeholder:text-faint focus:border-brand/70 focus:ring-2 focus:ring-brand/20 disabled:opacity-50";

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
        mono && "font-mono tracking-tight",
        invalid && "border-bad/70 focus:border-bad focus:ring-bad/20",
        className,
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "— pilih —",
  invalid,
  disabled,
  className,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">) {
  return (
    <span className="relative block">
      <select
        {...rest}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          controlBase,
          "appearance-none pr-9",
          invalid && "border-bad/70",
          className,
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
      >
        ▾
      </span>
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
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start gap-3 rounded-lg border border-line-soft bg-canvas/60 px-3 py-2.5 text-left transition hover:border-line"
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition",
          checked ? "bg-brand" : "bg-line",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-canvas transition",
            checked ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-faint">{hint}</span>}
      </span>
    </button>
  );
}

export function CheckPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-brand/60 bg-brand/15 text-brand"
          : "border-line bg-canvas text-muted hover:border-line hover:text-ink",
      )}
    >
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
}: {
  onClick?: () => void;
  children: ReactNode;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const variants = {
    default: "border border-line bg-raised text-ink hover:border-brand/50 hover:text-brand",
    primary: "border border-brand/60 bg-brand/15 text-brand hover:bg-brand/25",
    ghost: "border border-transparent text-muted hover:bg-raised hover:text-ink",
    danger: "border border-transparent text-faint hover:bg-bad/10 hover:text-bad",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
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
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {step && (
              <span className="rounded-md bg-brand/10 px-1.5 py-0.5 font-mono text-[11px] text-brand">
                {step}
              </span>
            )}
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {optional && (
              <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                opsional
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</p>
          )}
        </div>
        {right}
      </header>
      <div className="px-5 py-4">{children}</div>
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
    <div className="rounded-xl border border-line-soft bg-raised/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-brand/80">{label}</span>
        {onRemove && (
          <Button variant="danger" size="sm" onClick={onRemove} title="Hapus baris">
            Hapus
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-faint">
      {children}
    </p>
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
    info: "border-brand/25 bg-brand/5 text-muted",
    warn: "border-warn/30 bg-warn/5 text-warn/90",
    bad: "border-bad/30 bg-bad/5 text-bad/90",
  };
  return (
    <div className={cn("rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed", tones[tone])}>
      {children}
    </div>
  );
}
