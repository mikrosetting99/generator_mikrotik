"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import { AppSwitcher } from "@/components/AppSwitcher";
import { Check, Copy, Database, Download, Plus, Trash, Upload } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, Field, Note, Panel, Select, TextInput } from "@/components/ui";
import {
  billOfMaterials,
  canPlace,
  DEVICE_KINDS,
  DEVICE_LIBRARY,
  deviceFromTemplate,
  devicesAbove,
  exampleRack,
  fmtNum,
  KIND_COLOR,
  KIND_LABEL,
  MAX_DEVICE_U,
  MAX_DEVICES,
  MAX_U,
  MIN_U,
  normalizeRack,
  RACK_PRESETS,
  rackWarnings,
  summarize,
  type DeviceKind,
  type DeviceTemplate,
  type RackDevice,
  type RackState,
} from "@/lib/rack";

const STORAGE_KEY = "rack-designer-v1";
/** Tinggi satu U di layar (px). */
const UH = 22;

/** Isian angka yang boleh dikosongkan saat mengetik; kosong dibaca 0. */
function NumberField({ label, value, onChange, suffix, step }: { label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: string }) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          step={step ?? "any"}
          value={Number.isFinite(value) && value !== 0 ? String(value) : ""}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(",", ".")) || 0)}
          className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 pr-12 font-mono text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-faint">{suffix}</span>}
      </div>
    </Field>
  );
}

function Meter({ label, value, max, unit, pct }: { label: string; value: string; max: string; unit?: string; pct: number }) {
  const tone = pct > 100 ? "bg-bad" : pct > 80 ? "bg-warn" : "bg-brand";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-ink">
          {value}
          <span className="text-faint">
            {" "}
            / {max}
            {unit ? ` ${unit}` : ""}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-raised">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

interface DragState {
  id: string;
  startY: number;
  startPos: number;
  pos: number;
  moved: boolean;
}

/** Simulasi desain rack server: susun perangkat per U, lihat ruang, daya, panas, berat, dan UPS. */
export function RackDesigner() {
  const [rack, setRack] = useState<RackState>(() => exampleRack());
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<{ u: number; pos: number; valid: boolean } | null>(null);
  const [flash, setFlash] = useState<{ tone: "info" | "warn" | "bad"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const dragTemplate = useRef<DeviceTemplate | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Pulihkan rack terakhir dari browser ini (tidak dikirim ke server).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setRack(normalizeRack(JSON.parse(saved)));
    } catch {
      // penyimpanan diblokir atau data rusak: pakai contoh
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rack));
    } catch {
      // abaikan
    }
  }, [rack, ready]);

  const summary = useMemo(() => summarize(rack), [rack]);
  const warnings = useMemo(() => rackWarnings(rack, summary), [rack, summary]);
  const selected = rack.devices.find((d) => d.id === selectedId) ?? null;
  const H = rack.heightU;

  const patchRack = (partial: Partial<RackState>) => setRack((r) => ({ ...r, ...partial }));
  const patchDevice = (id: string, partial: Partial<RackDevice>) =>
    setRack((r) => ({ ...r, devices: r.devices.map((d) => (d.id === id ? { ...d, ...partial } : d)) }));

  /** Pindah atau ubah tinggi perangkat hanya bila tidak keluar rack dan tidak menimpa perangkat lain. */
  const placeDevice = (d: RackDevice, u: number, pos: number): boolean => {
    if (!canPlace(rack, u, pos, d.id)) {
      setFlash({ tone: "warn", text: `${d.name} tidak muat di U${pos}${u > 1 ? `–${pos + u - 1}` : ""}: keluar rack atau menimpa perangkat lain.` });
      return false;
    }
    setFlash(null);
    patchDevice(d.id, { u, pos });
    return true;
  };

  const addTemplate = (t: DeviceTemplate, pos?: number) => {
    if (rack.devices.length >= MAX_DEVICES) return setFlash({ tone: "warn", text: `Maksimal ${MAX_DEVICES} perangkat per rack.` });
    const d = deviceFromTemplate(rack, t, pos);
    if (!d) return setFlash({ tone: "warn", text: `Tidak ada ruang ${t.u}U kosong${pos ? ` di U${pos}` : ""} untuk ${t.name}.` });
    setFlash(null);
    setRack((r) => ({ ...r, devices: [...r.devices, d] }));
    setSelectedId(d.id);
  };

  const duplicate = (d: RackDevice) => {
    const t: DeviceTemplate = { id: "", name: d.name, kind: d.kind, u: d.u, watts: d.watts, kg: d.kg, upsWatts: d.upsWatts };
    addTemplate(t);
  };

  const remove = (id: string) => {
    setRack((r) => ({ ...r, devices: r.devices.filter((d) => d.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const setHeight = (u: number) => {
    const height = Math.min(Math.max(Math.round(u) || MIN_U, MIN_U), MAX_U);
    const out = devicesAbove(rack.devices, height);
    if (out.length) {
      return setFlash({ tone: "warn", text: `Tidak bisa jadi ${height}U: ${out.map((d) => d.name).join(", ")} ada di atas U${height}. Pindahkan dulu.` });
    }
    setFlash(null);
    const preset = RACK_PRESETS.find((p) => p.u === height);
    patchRack({ heightU: height, ...(preset ? { maxKg: preset.maxKg } : {}) });
  };

  /* ------------------------------------------------ geser perangkat di rack */

  const onDevicePointerDown = (e: PointerEvent<HTMLButtonElement>, d: RackDevice) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id: d.id, startY: e.clientY, startPos: d.pos, pos: d.pos, moved: false });
  };
  const onDevicePointerMove = (e: PointerEvent<HTMLButtonElement>, d: RackDevice) => {
    if (!drag || drag.id !== d.id) return;
    const dy = drag.startY - e.clientY;
    const pos = Math.min(Math.max(drag.startPos + Math.round(dy / UH), 1), H - d.u + 1);
    if (pos !== drag.pos || (!drag.moved && Math.abs(dy) > 4)) setDrag({ ...drag, pos, moved: drag.moved || Math.abs(dy) > 4 });
  };
  const onDevicePointerUp = (d: RackDevice) => {
    if (!drag || drag.id !== d.id) return;
    if (drag.moved) {
      if (drag.pos !== d.pos) placeDevice(d, d.u, drag.pos);
    } else {
      setSelectedId(d.id);
    }
    setDrag(null);
  };

  /* ------------------------------------------ seret perangkat dari daftar */

  /** U teratas di bawah kursor, dari posisi vertikal di dalam rack. */
  const unitAtPointer = (clientY: number) => {
    const rect = bodyRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    return Math.min(Math.max(H - Math.floor((clientY - rect.top) / UH), 1), H);
  };
  const onRackDragOver = (e: DragEvent<HTMLDivElement>) => {
    const t = dragTemplate.current;
    if (!t) return;
    e.preventDefault();
    const pos = Math.max(unitAtPointer(e.clientY) - t.u + 1, 1);
    if (!hover || hover.pos !== pos || hover.u !== t.u) setHover({ u: t.u, pos, valid: canPlace(rack, t.u, pos) });
  };
  const onRackDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const t = dragTemplate.current;
    if (t && hover) addTemplate(t, hover.pos);
    dragTemplate.current = null;
    setHover(null);
  };

  /* ------------------------------------------------------- berkas & salin */

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rack, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${rack.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "rack"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = normalizeRack(JSON.parse(await file.text()));
      setRack(next);
      setSelectedId(null);
      setFlash({ tone: "info", text: `${next.name} dimuat (${next.devices.length} perangkat).` });
    } catch {
      setFlash({ tone: "bad", text: "Berkas tidak bisa dibaca. Pilih berkas .json hasil Ekspor." });
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const copyBom = async () => {
    try {
      await navigator.clipboard.writeText(billOfMaterials(rack));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard diblokir
    }
  };

  const sorted = [...rack.devices].sort((a, b) => b.pos - a.pos);
  const units = Array.from({ length: H }, (_, i) => H - i);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl print:hidden">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <AppSwitcher />
            <div className="flex min-w-0 items-center gap-2">
              <Database className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Simulasi Rack Server</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => { setRack(exampleRack()); setSelectedId(null); setFlash(null); }} title="Muat contoh rack NOC">
              Contoh
            </Button>
            <Button size="sm" onClick={() => { if (window.confirm("Kosongkan semua perangkat di rack?")) { setRack((r) => ({ ...r, devices: [] })); setSelectedId(null); } }}>
              Kosongkan
            </Button>
            <Button size="sm" onClick={exportJson} title="Simpan desain sebagai berkas .json">
              <Download className="h-3.5 w-3.5" /> Ekspor
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} title="Buka berkas .json hasil Ekspor">
              <Upload className="h-3.5 w-3.5" /> Impor
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importJson(e.target.files?.[0])} />
            <Button size="sm" onClick={() => window.print()}>
              Cetak
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="grid w-full gap-5 px-5 py-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-8 xl:grid-cols-[260px_minmax(0,1fr)_340px] print:block">
        {/* --------------------------------------------- daftar perangkat */}
        <aside className="space-y-5 print:hidden">
          <Panel title="Perangkat" description="Klik untuk menambah, atau seret ke posisi di rack.">
            <ul className="space-y-1">
              {DEVICE_LIBRARY.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      dragTemplate.current = t;
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onDragEnd={() => {
                      dragTemplate.current = null;
                      setHover(null);
                    }}
                    onClick={() => addTemplate(t)}
                    className="flex w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:border-brand/50 hover:bg-brand/[0.05]"
                  >
                    <span className="h-3.5 w-1.5 shrink-0 rounded-sm" style={{ background: KIND_COLOR[t.kind] }} />
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">{t.u}U</span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={() => addTemplate({ id: "custom", name: "Perangkat baru", kind: "other", u: 1, watts: 0, kg: 0 })}
            >
              <Plus className="h-3.5 w-3.5" /> Perangkat custom
            </Button>
          </Panel>
        </aside>

        {/* ------------------------------------------------------- rack */}
        <section className="min-w-0 space-y-4">
          {flash && (
            <div className="print:hidden">
              <Note tone={flash.tone}>{flash.text}</Note>
            </div>
          )}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">{rack.name}</h2>
            <span className="font-mono text-xs text-muted">
              {H}U · terpakai {summary.usedU}U · kosong {summary.freeU}U
            </span>
          </div>

          <div className="mx-auto w-full max-w-[520px] rounded-lg bg-[#1b1f26] p-2 shadow-lg ring-1 ring-black/40">
            <div className="flex">
              <UnitLabels units={units} />
              <div
                ref={bodyRef}
                className="relative flex-1 select-none rounded-sm bg-[#111419]"
                style={{ height: H * UH }}
                onDragOver={onRackDragOver}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(null);
                }}
                onDrop={onRackDrop}
              >
                {units.map((u) => (
                  <div key={u} className="absolute inset-x-0 border-b border-white/[0.06]" style={{ top: (H - u) * UH, height: UH }} />
                ))}

                {hover && (
                  <div
                    className={`pointer-events-none absolute inset-x-1 z-20 rounded-sm border-2 border-dashed ${hover.valid ? "border-ok bg-ok/15" : "border-bad bg-bad/15"}`}
                    style={{ top: (H - (hover.pos + hover.u - 1)) * UH, height: hover.u * UH }}
                  />
                )}

                {rack.devices.map((d) => {
                  const dragging = drag?.id === d.id && drag.moved;
                  const pos = dragging ? drag.pos : d.pos;
                  const valid = !dragging || canPlace(rack, d.u, pos, d.id);
                  const isSel = d.id === selectedId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onPointerDown={(e) => onDevicePointerDown(e, d)}
                      onPointerMove={(e) => onDevicePointerMove(e, d)}
                      onPointerUp={() => onDevicePointerUp(d)}
                      onPointerCancel={() => setDrag(null)}
                      // Enter/Spasi dari keyboard (detail 0); klik mouse sudah ditangani pointerup.
                      onClick={(e) => e.detail === 0 && setSelectedId(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                          placeDevice(d, d.u, d.pos + (e.key === "ArrowUp" ? 1 : -1));
                        }
                      }}
                      aria-label={`${d.name}, U${d.pos}${d.u > 1 ? ` sampai ${d.pos + d.u - 1}` : ""}`}
                      title="Seret untuk memindah · klik untuk mengubah · panah atas/bawah memindah 1U"
                      className={`absolute inset-x-1 flex touch-none items-center gap-2 overflow-hidden rounded-sm border px-2 text-left text-white transition-shadow ${
                        dragging ? "z-30 cursor-grabbing opacity-90 shadow-2xl" : "z-10 cursor-grab"
                      } ${isSel ? "ring-2 ring-white" : ""} ${valid ? "border-white/15" : "border-bad ring-2 ring-bad"}`}
                      style={{
                        top: (H - (pos + d.u - 1)) * UH + 1,
                        height: d.u * UH - 2,
                        background:
                          d.kind === "blank"
                            ? "repeating-linear-gradient(90deg,#2a2f38 0 6px,#252a32 6px 12px)"
                            : `linear-gradient(90deg, ${KIND_COLOR[d.kind]} 0 6px, #2b313c 6px)`,
                      }}
                    >
                      <span className="ml-1.5 min-w-0 flex-1 truncate text-[12px] font-medium leading-none">{d.name}</span>
                      <span className="shrink-0 font-mono text-[10px] leading-none text-white/60">
                        {d.u}U{d.watts ? ` · ${fmtNum(d.watts)}W` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              <UnitLabels units={units} />
            </div>
          </div>
          <p className="text-center text-[11px] text-faint print:hidden">Tampak depan · U1 di paling bawah · seret perangkat untuk memindah</p>
        </section>

        {/* ------------------------------------- pengaturan, ringkasan, editor */}
        <aside className="space-y-5 lg:col-span-2 xl:col-span-1">
          <Panel title="Ringkasan">
            <div className="space-y-3">
              <Meter label="Ruang" value={`${summary.usedU}U`} max={`${H}U`} pct={summary.usedPct} />
              <Meter label="Daya" value={fmtNum(summary.watts)} max={fmtNum(rack.maxWatts)} unit="W" pct={summary.powerLoadPct} />
              {summary.upsLoadPct !== null && <Meter label="Beban UPS" value={fmtNum(summary.watts)} max={fmtNum(summary.upsWatts)} unit="W" pct={summary.upsLoadPct} />}
              <Meter label="Berat" value={fmtNum(summary.kg)} max={fmtNum(rack.maxKg)} unit="kg" pct={rack.maxKg ? (summary.kg / rack.maxKg) * 100 : 0} />
              <dl className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="rounded-md bg-raised px-2.5 py-2">
                  <dt className="text-muted">Arus</dt>
                  <dd className="font-mono text-sm text-ink">
                    {fmtNum(summary.amps)} A <span className="text-faint">@{rack.voltage} V</span>
                  </dd>
                </div>
                <div className="rounded-md bg-raised px-2.5 py-2">
                  <dt className="text-muted">Panas</dt>
                  <dd className="font-mono text-sm text-ink">{Math.round(summary.btu).toLocaleString("id-ID")} BTU/jam</dd>
                </div>
              </dl>
            </div>
            {warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {warnings.map((w) => (
                  <Note key={w.text} tone={w.tone}>
                    {w.text}
                  </Note>
                ))}
              </div>
            )}
          </Panel>

          {selected && (
            <div className="print:hidden">
              <DeviceEditor
                key={selected.id}
                device={selected}
                onPatch={(p) => patchDevice(selected.id, p)}
                onPlace={(u, pos) => placeDevice(selected, u, pos)}
                onDuplicate={() => duplicate(selected)}
                onRemove={() => remove(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          )}

          <div className="print:hidden">
            <Panel title="Rack">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Nama rack">
                  <TextInput value={rack.name} onChange={(name) => patchRack({ name: name.slice(0, 80) })} />
                </Field>
                <Field label="Tinggi rack">
                  <Select
                    value={String(H)}
                    onChange={(v) => setHeight(Number(v))}
                    options={[
                      ...RACK_PRESETS.map((p) => ({ value: String(p.u), label: p.label })),
                      ...(RACK_PRESETS.some((p) => p.u === H) ? [] : [{ value: String(H), label: `${H}U` }]),
                    ]}
                  />
                </Field>
                <NumberField label="Beban maksimal rack" value={rack.maxKg} onChange={(n) => patchRack({ maxKg: Math.max(0, n) })} suffix="kg" />
                <NumberField label="Kapasitas listrik / PDU" value={rack.maxWatts} onChange={(n) => patchRack({ maxWatts: Math.max(0, n) })} suffix="W" />
                <NumberField label="Tegangan" value={rack.voltage} onChange={(n) => patchRack({ voltage: Math.max(0, n) })} suffix="V" />
              </div>
            </Panel>
          </div>

          <Panel
            title="Daftar perangkat"
            description="Dari atas ke bawah."
            right={
              <span className="print:hidden">
                <Button size="sm" onClick={copyBom} disabled={!rack.devices.length}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
              </span>
            }
          >
            {sorted.length === 0 ? (
              <p className="py-4 text-center text-xs text-faint">Rack masih kosong.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-faint">
                    <th className="py-1.5 pr-2 font-medium">Posisi</th>
                    <th className="py-1.5 pr-2 font-medium">Perangkat</th>
                    <th className="py-1.5 pr-2 text-right font-medium">W</th>
                    <th className="py-1.5 text-right font-medium">kg</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={`cursor-pointer border-b border-line/60 hover:bg-brand/[0.05] ${d.id === selectedId ? "bg-brand/[0.08]" : ""}`}
                    >
                      <td className="py-1.5 pr-2 font-mono text-muted">{d.u === 1 ? `U${d.pos}` : `U${d.pos}–${d.pos + d.u - 1}`}</td>
                      <td className="py-1.5 pr-2 text-ink">
                        <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: KIND_COLOR[d.kind] }} />
                        {d.name}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-ink">{fmtNum(d.watts)}</td>
                      <td className="py-1.5 text-right font-mono text-ink">{fmtNum(d.kg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <p className="text-[11px] leading-relaxed text-faint print:hidden">
            Angka daya dan berat perangkat bawaan adalah perkiraan umum; sesuaikan dengan datasheet perangkat Anda. Desain tersimpan di browser ini
            saja. Pakai Ekspor untuk menyimpan atau berbagi berkasnya.
          </p>
        </aside>
      </div>
    </main>
  );
}

function UnitLabels({ units }: { units: number[] }) {
  return (
    <div className="w-7 shrink-0">
      {units.map((u) => (
        <div key={u} className="flex items-center justify-center font-mono text-[9px] text-white/40" style={{ height: UH }}>
          {u}
        </div>
      ))}
    </div>
  );
}

function DeviceEditor({
  device,
  onPatch,
  onPlace,
  onDuplicate,
  onRemove,
  onClose,
}: {
  device: RackDevice;
  onPatch: (p: Partial<RackDevice>) => void;
  onPlace: (u: number, pos: number) => boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // Tinggi dan posisi diketik dulu, baru diterapkan bila muat (supaya angka setengah jadi tidak ditolak).
  const [u, setU] = useState(String(device.u));
  const [pos, setPos] = useState(String(device.pos));
  useEffect(() => {
    setU(String(device.u));
    setPos(String(device.pos));
  }, [device.u, device.pos]);

  const apply = () => {
    const nu = Math.min(Math.max(Math.round(Number(u)) || 1, 1), MAX_DEVICE_U);
    const np = Math.max(Math.round(Number(pos)) || 1, 1);
    if (nu === device.u && np === device.pos) return;
    if (!onPlace(nu, np)) {
      setU(String(device.u));
      setPos(String(device.pos));
    }
  };

  return (
    <Panel
      title="Perangkat terpilih"
      right={
        <Button size="sm" variant="ghost" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
        <Field label="Nama" className="sm:col-span-2">
          <TextInput value={device.name} onChange={(name) => onPatch({ name: name.slice(0, 60) })} />
        </Field>
        <Field label="Jenis" className="sm:col-span-2">
          <Select
            value={device.kind}
            onChange={(v) => onPatch({ kind: v as DeviceKind, ...(v === "ups" ? {} : { upsWatts: 0 }) })}
            options={DEVICE_KINDS.map((k) => ({ value: k.id, label: k.label }))}
          />
        </Field>
        <Field label="Tinggi (U)">
          <input
            type="number"
            min={1}
            max={MAX_DEVICE_U}
            value={u}
            onChange={(e) => setU(e.target.value)}
            onBlur={apply}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm text-ink focus:border-brand focus:outline-none"
          />
        </Field>
        <Field label="Posisi bawah (U)">
          <input
            type="number"
            min={1}
            value={pos}
            onChange={(e) => setPos(e.target.value)}
            onBlur={apply}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 font-mono text-sm text-ink focus:border-brand focus:outline-none"
          />
        </Field>
        <NumberField label="Daya" value={device.watts} onChange={(n) => onPatch({ watts: Math.max(0, n) })} suffix="W" />
        <NumberField label="Berat" value={device.kg} onChange={(n) => onPatch({ kg: Math.max(0, n) })} suffix="kg" />
        {device.kind === "ups" && (
          <div className="sm:col-span-2">
            <NumberField label="Kapasitas UPS" value={device.upsWatts} onChange={(n) => onPatch({ upsWatts: Math.max(0, n) })} suffix="W" />
          </div>
        )}
        <Field label="Catatan" className="sm:col-span-2">
          <TextInput value={device.note} onChange={(note) => onPatch({ note: note.slice(0, 200) })} placeholder="mis. IP 10.0.0.2, SN, pemilik" />
        </Field>
      </div>
      <p className="mt-2 text-[11px] text-faint">{KIND_LABEL[device.kind]} · menempati U{device.pos}{device.u > 1 ? `–${device.pos + device.u - 1}` : ""}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onPlace(device.u, device.pos + 1)}>
          Naik 1U
        </Button>
        <Button size="sm" onClick={() => onPlace(device.u, device.pos - 1)} disabled={device.pos <= 1}>
          Turun 1U
        </Button>
        <Button size="sm" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" /> Duplikat
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove}>
          <Trash className="h-3.5 w-3.5" /> Hapus
        </Button>
      </div>
    </Panel>
  );
}
