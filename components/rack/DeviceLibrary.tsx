"use client";

import { useMemo, useState } from "react";
import { Plus } from "@/components/icons";
import { Button } from "@/components/ui";
import { BRANDS, DEVICE_LIBRARY, KIND_COLOR, KIND_DEPTH, type DeviceTemplate } from "@/lib/rack";
import { portSummary } from "@/lib/rack-ports";

/** Daftar perangkat: filter merek dan cari nama, klik untuk menambah atau seret ke rack. */
export function DeviceLibrary({
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  onAdd: (t: DeviceTemplate) => void;
  onDragStart: (t: DeviceTemplate) => void;
  onDragEnd: () => void;
}) {
  const [brand, setBrand] = useState("");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEVICE_LIBRARY.filter((t) => (!brand || t.brand === brand) && (!q || `${t.brand} ${t.name}`.toLowerCase().includes(q)));
  }, [brand, query]);

  const grouped = BRANDS.map((b) => ({ brand: b, items: list.filter((t) => t.brand === b) })).filter((g) => g.items.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {["", ...BRANDS].map((b) => (
          <button
            key={b || "all"}
            type="button"
            onClick={() => setBrand(b)}
            aria-pressed={brand === b}
            className={`rounded-md border px-2 py-0.5 text-[11px] transition-colors ${brand === b ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:text-ink"}`}
          >
            {b || "Semua"}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari model, mis. CCR2004, R650…"
        aria-label="Cari perangkat"
        className="min-h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
      />

      <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
        {grouped.length === 0 && <p className="py-4 text-center text-xs text-faint">Tidak ada perangkat yang cocok.</p>}
        {grouped.map((g) => (
          <div key={g.brand}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-faint">{g.brand}</p>
            <ul className="space-y-1">
              {g.items.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      onDragStart(t);
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => onAdd(t)}
                    title={`${t.u}U · kedalaman ${t.depthMm} mm · ${t.watts} W · ${t.kg} kg${t.ports.length ? ` · port ${t.portSide === "rear" ? "belakang" : "depan"}` : ""}`}
                    className="flex w-full items-start gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:border-brand/50 hover:bg-brand/[0.05]"
                  >
                    <span className="mt-1 h-3.5 w-1.5 shrink-0 rounded-sm" style={{ background: KIND_COLOR[t.kind] }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{t.name}</span>
                      {t.ports.length > 0 && <span className="block truncate text-[10.5px] text-faint">{portSummary(t.ports)}</span>}
                    </span>
                    <span className="shrink-0 pt-0.5 font-mono text-[11px] text-faint">{t.u}U</span>
                    <Plus className="mt-1 h-3.5 w-3.5 shrink-0 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Button
        size="sm"
        className="w-full"
        onClick={() => onAdd({ id: "custom", name: "Perangkat baru", brand: "", kind: "other", u: 1, watts: 0, kg: 0, depthMm: KIND_DEPTH.other, ports: [] })}
      >
        <Plus className="h-3.5 w-3.5" /> Perangkat custom
      </Button>
      <p className="text-[10.5px] leading-relaxed text-faint">
        Daya, berat, dan kedalaman model asli adalah perkiraan dari datasheet; cek lagi sebelum membeli. Nama port mengikuti penamaan masing-masing merek.
      </p>
    </div>
  );
}
