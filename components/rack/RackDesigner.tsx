"use client";

import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { AppSwitcher } from "@/components/AppSwitcher";
import { Check, Copy, Database, Download, Trash, Upload } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, Field, Note, Panel, Select, TextInput } from "@/components/ui";
import {
  billOfMaterials,
  canPlace,
  DEPTH_PRESETS,
  DEVICE_KINDS,
  deviceFromTemplate,
  devicesAbove,
  exampleRack,
  fmtNum,
  KIND_COLOR,
  KIND_LABEL,
  MAX_DEPTH,
  MAX_DEVICE_DEPTH,
  MAX_DEVICE_U,
  MAX_DEVICES,
  MAX_U,
  MIN_DEPTH,
  MIN_U,
  normalizeRack,
  patchDevice as patchDeviceIn,
  portUsage,
  removeDevice,
  HEIGHT_CHOICES,
  matchModel,
  modelLabel,
  outerHeightMm,
  RACK_MODELS,
  RACK_TYPE,
  RACK_TYPES,
  rackSizeLabel,
  rackWarnings,
  summarize,
  TWO_POST_MAX_DEPTH,
  TWO_POST_MAX_KG,
  usableDepth,
  type DeviceKind,
  type DeviceTemplate,
  type RackDevice,
  type RackModel,
  type RackState,
  type RackType,
} from "@/lib/rack";
import { CABLE_HEX, cableRoute, portInUse, portLayout, portSummary, type CableEnd, type RackCable } from "@/lib/rack-ports";
import { CablePanel, type CableDraft } from "./CablePanel";
import { DeviceLibrary } from "./DeviceLibrary";
import { PortGrid, PortsEditor } from "./PortGrid";

const STORAGE_KEY = "rack-designer-v1";
const VIEW_KEY = "rack-designer-view";
/** Tinggi satu U di layar (px). */
const UH = 22;

// Three.js hanya dimuat saat tampilan 3D dibuka, dan hanya di browser.
const Rack3D = dynamic(() => import("./Rack3D"), {
  ssr: false,
  loading: () => <div className="flex h-[560px] items-center justify-center rounded-lg bg-raised text-xs text-muted ring-1 ring-line sm:h-[640px]">Memuat tampilan 3D…</div>,
});

/** Isian angka yang boleh dikosongkan saat mengetik; kosong dibaca 0. */
function NumberField({
  label,
  value,
  onChange,
  suffix,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: string;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
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
  const [undo, setUndo] = useState<{ device: RackDevice; cables: RackCable[]; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [showCables, setShowCables] = useState(true);
  const [draft, setDraft] = useState<CableDraft>({ a: null, b: null });
  const [selectedCableId, setSelectedCableId] = useState<string | null>(null);
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
    try {
      // #3d di alamat langsung membuka tampilan 3D (bisa dipakai untuk berbagi tautan)
      if (window.location.hash === "#3d" || localStorage.getItem(VIEW_KEY) === "3d") setMode("3d");
    } catch {
      // abaikan
    }
    setReady(true);
  }, []);
  const switchMode = (m: "2d" | "3d") => {
    setMode(m);
    try {
      localStorage.setItem(VIEW_KEY, m);
    } catch {
      // abaikan
    }
  };
  const select3d = useCallback((id: string) => setSelectedId(id), []);
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
  const model = matchModel(rack);
  const ports = useMemo(() => portUsage(rack), [rack]);

  const patchRack = (partial: Partial<RackState>) => setRack((r) => ({ ...r, ...partial }));
  const patchDevice = (id: string, partial: Partial<RackDevice>) => setRack((r) => patchDeviceIn(r, id, partial));
  const setCables = (cables: RackCable[]) => setRack((r) => ({ ...r, cables }));

  /** Klik port kosong: isi ujung A dulu, lalu B. */
  const pickPort = (end: CableEnd) => {
    setSelectedCableId(null);
    setDraft((d) => {
      const same = (e: CableEnd | null) => e && e.dev === end.dev && e.port === end.port;
      if (same(d.a)) return { ...d, a: null };
      if (same(d.b)) return { ...d, b: null };
      if (!d.a?.port) return { ...d, a: end };
      if (!d.b?.port) return { ...d, b: end };
      return { a: end, b: null };
    });
  };

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
    const t: DeviceTemplate = {
      id: d.model,
      name: d.name,
      brand: d.brand,
      kind: d.kind,
      u: d.u,
      watts: d.watts,
      kg: d.kg,
      depthMm: d.depthMm,
      upsWatts: d.upsWatts,
      ports: d.ports,
      portSide: d.portSide,
    };
    addTemplate(t);
  };

  /** Hapus perangkat (dan kabelnya); rack sebelumnya disimpan supaya bisa dibatalkan. */
  const remove = (id: string) => {
    const d = rack.devices.find((x) => x.id === id);
    if (!d) return;
    const cables = rack.cables.filter((c) => c.a.dev === id || c.b.dev === id);
    setUndo({ device: d, cables, text: `${d.name} dihapus${cables.length ? ` beserta ${cables.length} kabel` : ""}.` });
    setFlash(null);
    setRack((r) => removeDevice(r, id));
    if (selectedId === id) setSelectedId(null);
    setDraft((x) => ({ a: x.a?.dev === id ? null : x.a, b: x.b?.dev === id ? null : x.b }));
    setSelectedCableId(null);
  };
  /** Kembalikan perangkat terakhir yang dihapus ke posisinya, beserta kabel yang portnya masih kosong. */
  const undoRemove = () => {
    if (!undo) return;
    const { device, cables } = undo;
    if (!canPlace(rack, device.u, device.pos)) {
      return setFlash({ tone: "warn", text: `${device.name} tidak bisa dikembalikan: U${device.pos} sudah terisi perangkat lain.` });
    }
    const devices = [...rack.devices, device];
    const restored = cables.filter((c) => !portInUse(rack.cables, c.a) && !portInUse(rack.cables, c.b) && cableRoute({ devices }, c));
    setRack((r) => ({ ...r, devices: [...r.devices, device], cables: [...r.cables, ...restored] }));
    setSelectedId(device.id);
    setUndo(null);
    if (restored.length < cables.length) setFlash({ tone: "info", text: `${cables.length - restored.length} kabel tidak dikembalikan karena portnya sudah dipakai.` });
  };
  const removeRef = useRef(remove);
  useEffect(() => {
    removeRef.current = remove;
  });
  const remove3d = useCallback((id: string) => removeRef.current(id), []);

  const setHeight = (u: number) => {
    const height = Math.min(Math.max(Math.round(u) || MIN_U, MIN_U), MAX_U);
    const out = devicesAbove(rack.devices, height);
    if (out.length) {
      return setFlash({ tone: "warn", text: `Tidak bisa jadi ${height}U: ${out.map((d) => d.name).join(", ")} ada di atas U${height}. Pindahkan dulu.` });
    }
    setFlash(null);
    patchRack({ heightU: height });
  };

  /** Pakai ukuran dari katalog (tinggi, lebar, kedalaman, beban maksimal). */
  const applyModel = (m: RackModel): boolean => {
    const out = devicesAbove(rack.devices, m.heightU);
    if (out.length) {
      setFlash({ tone: "warn", text: `Tidak bisa jadi ${m.heightU}U: ${out.map((d) => d.name).join(", ")} ada di atas U${m.heightU}. Pindahkan dulu.` });
      return false;
    }
    setFlash(null);
    patchRack({ type: m.type, heightU: m.heightU, widthMm: m.widthMm, depthMm: m.depthMm, maxKg: m.maxKg });
    return true;
  };

  /** Ganti jenis rak: pakai model jenis itu yang tingginya paling dekat dan masih memuat semua perangkat. */
  const changeType = (type: RackType) => {
    const fits = RACK_MODELS.filter((m) => m.type === type && !devicesAbove(rack.devices, m.heightU).length).sort(
      (a, b) => Math.abs(a.heightU - H) - Math.abs(b.heightU - H) || Math.abs(a.depthMm - rack.depthMm) - Math.abs(b.depthMm - rack.depthMm),
    );
    if (!fits.length) {
      const top = Math.max(...rack.devices.map((d) => d.pos + d.u - 1));
      return setFlash({ tone: "warn", text: `${RACK_TYPE[type].short} paling tinggi tidak memuat perangkat sampai U${top}. Pindahkan perangkat ke bawah dulu.` });
    }
    applyModel(fits[0]);
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
      setUndo(null);
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
            <Button size="sm" onClick={() => { setRack(exampleRack()); setSelectedId(null); setFlash(null); setUndo(null); setDraft({ a: null, b: null }); setSelectedCableId(null); }} title="Muat contoh rack NOC">
              Contoh
            </Button>
            <Button size="sm" onClick={() => { if (window.confirm("Kosongkan semua perangkat dan kabel di rack?")) { setRack((r) => ({ ...r, devices: [], cables: [] })); setSelectedId(null); setUndo(null); setDraft({ a: null, b: null }); setSelectedCableId(null); } }}>
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
            <DeviceLibrary
              onAdd={(t) => addTemplate(t)}
              onDragStart={(t) => {
                dragTemplate.current = t;
              }}
              onDragEnd={() => {
                dragTemplate.current = null;
                setHover(null);
              }}
            />
          </Panel>
        </aside>

        {/* ------------------------------------------------------- rack */}
        <section className="min-w-0 space-y-4">
          {flash && (
            <div className="print:hidden">
              <Note tone={flash.tone}>{flash.text}</Note>
            </div>
          )}
          {undo && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink print:hidden" role="status">
              <span>{undo.text}</span>
              <span className="flex gap-1">
                <Button size="sm" onClick={undoRemove}>
                  Batalkan
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setUndo(null)} ariaLabel="Tutup pemberitahuan">
                  Tutup
                </Button>
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-ink">{rack.name}</h2>
              <span className="font-mono text-xs text-muted">
                {rackSizeLabel(rack)} · terpakai {summary.usedU}U · kosong {summary.freeU}U
              </span>
            </div>
            <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setShowCables((v) => !v)}
              aria-pressed={showCables}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${showCables ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
            >
              Kabel {rack.cables.length ? `(${rack.cables.length})` : ""}
            </button>
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="Tampilan rack">
              {(["2d", "3d"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  aria-pressed={mode === m}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${mode === m ? "bg-brand text-white" : "text-muted hover:text-ink"}`}
                >
                  {m === "2d" ? "2D · Edit" : "3D"}
                </button>
              ))}
            </div>
            </div>
          </div>

          {mode === "3d" ? (
            <Rack3D rack={rack} selectedId={selectedId} onSelect={select3d} onRemove={remove3d} showCables={showCables} selectedCableId={selectedCableId} />
          ) : (
          <>
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
                  const top = (H - (pos + d.u - 1)) * UH + 1;
                  const height = d.u * UH - 2;
                  return (
                    <Fragment key={d.id}>
                    <button
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
                        } else if (e.key === "Delete" || e.key === "Backspace") {
                          e.preventDefault();
                          remove(d.id);
                        }
                      }}
                      aria-label={`${d.name}, U${d.pos}${d.u > 1 ? ` sampai ${d.pos + d.u - 1}` : ""}`}
                      title="Seret untuk memindah · klik untuk mengubah · panah atas/bawah memindah 1U · Delete untuk menghapus"
                      className={`absolute inset-x-1 flex touch-none items-center gap-2 overflow-hidden rounded-sm border px-2 text-left text-white transition-shadow ${
                        dragging ? "z-30 cursor-grabbing opacity-90 shadow-2xl" : "z-10 cursor-grab"
                      } ${isSel ? "ring-2 ring-white" : ""} ${valid ? "border-white/15" : "border-bad ring-2 ring-bad"}`}
                      style={{
                        top,
                        height,
                        background:
                          d.kind === "blank"
                            ? "repeating-linear-gradient(90deg,#2a2f38 0 6px,#252a32 6px 12px)"
                            : `linear-gradient(90deg, ${KIND_COLOR[d.kind]} 0 6px, #2b313c 6px)`,
                      }}
                    >
                      {d.portSide === "front" && d.ports.length > 0 ? (
                        <>
                          <span className="ml-1.5 w-[27%] min-w-0 truncate text-[11.5px] font-medium leading-none">{d.name}</span>
                          <FrontPorts device={d} cables={rack.cables} draft={draft} />
                        </>
                      ) : (
                        <>
                          <span className="ml-1.5 min-w-0 flex-1 truncate text-[12px] font-medium leading-none">{d.name}</span>
                          <span className="shrink-0 font-mono text-[10px] leading-none text-white/60">
                            {d.ports.length > 0 ? "port di belakang · " : ""}
                            {d.u}U{d.watts ? ` · ${fmtNum(d.watts)}W` : ""}
                          </span>
                        </>
                      )}
                    </button>
                    {isSel && !dragging && (
                      // di kolom nomor U sebelah kanan, supaya tidak menutupi port
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        aria-label={`Hapus ${d.name}`}
                        title={`Hapus ${d.name}`}
                        className="absolute z-40 flex h-5 w-6 items-center justify-center rounded bg-bad text-white shadow-md ring-1 ring-black/40 hover:brightness-110 print:hidden"
                        style={{ top: top + height / 2 - 10, right: -27 }}
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    )}
                    </Fragment>
                  );
                })}

                {showCables && (
                  <CableOverlay
                    devices={drag?.moved ? rack.devices.map((d) => (d.id === drag.id ? { ...d, pos: drag.pos } : d)) : rack.devices}
                    cables={rack.cables}
                    heightU={H}
                    selectedCableId={selectedCableId}
                  />
                )}
              </div>
              <UnitLabels units={units} />
            </div>
          </div>
          <p className="text-center text-[11px] text-faint print:hidden">
            Tampak depan · U1 di paling bawah · seret perangkat untuk memindah · garis putus-putus = kabel ke port belakang
          </p>
          </>
          )}

          <CablePanel
            rack={rack}
            draft={draft}
            setDraft={setDraft}
            selectedCableId={selectedCableId}
            setSelectedCableId={setSelectedCableId}
            onChange={setCables}
          />
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
                <div className="col-span-2 rounded-md bg-raised px-2.5 py-2">
                  <dt className="text-muted">Port &amp; patch cord</dt>
                  <dd className="font-mono text-sm text-ink">
                    {ports.used}/{ports.total} port terpakai · {rack.cables.length} kabel
                  </dd>
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
                rack={rack}
                onPatch={(p) => patchDevice(selected.id, p)}
                onPlace={(u, pos) => placeDevice(selected, u, pos)}
                onDuplicate={() => duplicate(selected)}
                onRemove={() => remove(selected.id)}
                onClose={() => setSelectedId(null)}
                portGrid={
                  <PortGrid
                    device={selected}
                    cables={rack.cables}
                    draft={draft}
                    selectedCableId={selectedCableId}
                    onPick={pickPort}
                    onSelectCable={setSelectedCableId}
                  />
                }
              />
            </div>
          )}

          <div className="print:hidden">
            <Panel title="Rack">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Field label="Nama rack">
                  <TextInput value={rack.name} onChange={(name) => patchRack({ name: name.slice(0, 80) })} />
                </Field>
                <Field label="Jenis rak" hint={RACK_TYPE[rack.type].description}>
                  <Select
                    value={rack.type}
                    onChange={(v) => changeType(v as RackType)}
                    options={RACK_TYPES.map((t) => ({ value: t.id, label: t.label }))}
                  />
                </Field>
                <Field label="Ukuran" hint="Memilih ukuran mengisi tinggi, lebar, kedalaman, dan beban maksimal. Bisa diubah lagi di bawah.">
                  <Select
                    value={model?.id ?? "custom"}
                    onChange={(v) => {
                      const m = RACK_MODELS.find((x) => x.id === v);
                      if (m) applyModel(m);
                    }}
                    options={[
                      ...RACK_MODELS.filter((m) => m.type === rack.type).map((m) => ({ value: m.id, label: modelLabel(m) })),
                      ...(model ? [] : [{ value: "custom", label: `Ukuran sendiri: ${H}U · ${rack.widthMm} × ${rack.depthMm} mm` }]),
                    ]}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tinggi">
                    <Select
                      value={String(H)}
                      onChange={(v) => setHeight(Number(v))}
                      options={[...new Set([...HEIGHT_CHOICES, H])].sort((a, b) => a - b).map((u) => ({ value: String(u), label: `${u}U` }))}
                    />
                  </Field>
                  <Field label="Lebar">
                    <Select
                      value={String(rack.widthMm)}
                      onChange={(v) => patchRack({ widthMm: Number(v) })}
                      options={RACK_TYPE[rack.type].widths.map((w) => ({ value: String(w), label: `${w} mm` }))}
                    />
                  </Field>
                </div>
                {RACK_TYPE[rack.type].hasDepth ? (
                  <DepthPicker rack={rack} onChange={(depthMm) => patchRack({ depthMm })} />
                ) : (
                  <p className="text-[11px] leading-relaxed text-faint">
                    Rak 2-post tidak punya rel belakang, jadi kedalaman perangkat tidak dibatasi; perangkat lebih dari {TWO_POST_MAX_DEPTH} mm atau{" "}
                    {TWO_POST_MAX_KG} kg sebaiknya di atas shelf.
                  </p>
                )}
                <dl className="grid grid-cols-3 gap-2 rounded-md bg-raised px-3 py-2 text-xs">
                  <div>
                    <dt className="text-muted">Lebar</dt>
                    <dd className="font-mono text-ink">{rack.widthMm} mm</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{rack.type === "open2" ? "Tapak" : "Dalam"}</dt>
                    <dd className="font-mono text-ink">{rack.depthMm} mm</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Tinggi luar</dt>
                    <dd className="font-mono text-ink">{outerHeightMm(rack)} mm</dd>
                  </div>
                </dl>
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
                    <th className="py-1.5 pr-2 text-right font-medium">mm</th>
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
                      <td className={`py-1.5 pr-2 text-right font-mono ${tooDeep(rack, d) ? "text-bad" : "text-ink"}`}>{d.depthMm}</td>
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

/** Port di muka perangkat pada tampilan 2D (hanya gambar; klik port lewat panel perangkat). */
function FrontPorts({ device, cables, draft }: { device: RackDevice; cables: RackCable[]; draft: CableDraft }) {
  const spots = portLayout(device);
  const pending = (name: string) => [draft.a, draft.b].some((e) => e && e.dev === device.id && e.port === name);
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden>
      {spots.map((p) => {
        const cable = portInUse(cables, { dev: device.id, port: p.name });
        const optic = p.type !== "rj45" && p.type !== "console";
        return (
          <span
            key={p.name}
            className={`absolute rounded-[1px] ${pending(p.name) ? "ring-1 ring-white" : ""}`}
            style={{
              left: `${(p.x - p.w / 2) * 100}%`,
              top: `${(p.y - p.h / 2) * 100}%`,
              width: `${p.w * 100}%`,
              height: `${p.h * 100}%`,
              background: cable ? CABLE_HEX[cable.color] : optic ? "#5b6270" : "#0b0d11",
              boxShadow: cable ? undefined : "inset 0 0 0 1px rgba(255,255,255,0.14)",
            }}
          />
        );
      })}
    </span>
  );
}

/**
 * Patch cord pada tampilan 2D: kurva dari port ke jalur samping lalu ke port tujuan. Koordinat x
 * 0..1000 selebar badan rack, y dalam px.
 */
function CableOverlay({ devices, cables, heightU, selectedCableId }: { devices: RackDevice[]; cables: RackCable[]; heightU: number; selectedCableId: string | null }) {
  const point = (e: CableEnd) => {
    const d = devices.find((x) => x.id === e.dev);
    if (!d) return null;
    const top = (heightU - (d.pos + d.u - 1)) * UH + 1;
    const h = d.u * UH - 2;
    if (d.portSide === "rear") return { x: 985, y: top + h / 2, rear: true };
    const spot = portLayout(d).find((p) => p.name === e.port);
    return spot ? { x: 4 + spot.x * 992, y: top + spot.y * h, rear: false } : null;
  };
  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" viewBox={`0 0 1000 ${heightU * UH}`} preserveAspectRatio="none" aria-hidden>
      {cables.map((c) => {
        const a = point(c.a);
        const b = point(c.b);
        if (!a || !b || !cableRoute({ devices }, c)) return null;
        const sel = c.id === selectedCableId;
        // jarak dekat: kabel menggantung di antara kedua port; jauh: lewat cable manager samping
        // (kanan, karena kiri muka perangkat dipakai nama)
        const near = Math.abs(a.y - b.y) <= UH * 3 && !a.rear && !b.rear;
        const side = (a.x + b.x) / 2 < 300 ? -45 : 1045;
        const sag = Math.max(a.y, b.y) + 10 + Math.abs(a.x - b.x) * 0.03;
        const d = near ? `M ${a.x} ${a.y} C ${a.x} ${sag}, ${b.x} ${sag}, ${b.x} ${b.y}` : `M ${a.x} ${a.y} C ${side} ${a.y}, ${side} ${b.y}, ${b.x} ${b.y}`;
        return (
          <path
            key={c.id}
            d={d}
            fill="none"
            stroke={CABLE_HEX[c.color]}
            strokeWidth={sel ? 4 : 2}
            strokeOpacity={selectedCableId && !sel ? 0.35 : 0.9}
            strokeDasharray={a.rear || b.rear ? "5 4" : undefined}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
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

/** Kedalaman rack: pilih ukuran umum, atau "Ukuran lain" untuk mengetik sendiri. */
function tooDeep(rack: RackState, d: RackDevice): boolean {
  const usable = usableDepth(rack);
  return usable !== null && d.depthMm > usable;
}

function deviceDepthHint(rack: RackState, d: RackDevice): string {
  const usable = usableDepth(rack);
  if (usable === null) {
    return d.kind !== "shelf" && (d.depthMm > TWO_POST_MAX_DEPTH || d.kg > TWO_POST_MAX_KG)
      ? "Terlalu dalam/berat untuk 2-post tanpa shelf."
      : "Rak 2-post: dipasang dari telinga depan.";
  }
  if (rack.type === "open4") {
    return d.depthMm > usable ? `Menonjol ${d.depthMm - usable} mm di belakang rel.` : `Sisa ${usable - d.depthMm} mm sampai rel belakang.`;
  }
  return d.depthMm > usable ? `Tidak muat: rak hanya ${usable} mm.` : `Sisa ${usable - d.depthMm} mm di belakang untuk kabel.`;
}

function depthHint(rack: RackState): string {
  const usable = usableDepth(rack);
  if (rack.type === "open4") return `Jarak rel depan ke belakang ${rack.depthMm} mm; perangkat lebih dalam akan menonjol.`;
  if (rack.type === "wall") return `Perangkat muat sampai ${usable} mm (setelah rel, pintu, dan dinding).`;
  return `Perangkat muat sampai ${usable} mm (setelah rel dan pintu).`;
}

function DepthPicker({ rack, onChange }: { rack: RackState; onChange: (mm: number) => void }) {
  const value = rack.depthMm;
  const isPreset = DEPTH_PRESETS.some((p) => p.mm === value);
  const [custom, setCustom] = useState(!isPreset);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const apply = () => {
    const n = Math.round(Number(draft.replace(",", ".")));
    if (!Number.isFinite(n) || n <= 0) return setDraft(String(value));
    const mm = Math.min(Math.max(n, MIN_DEPTH), MAX_DEPTH);
    setDraft(String(mm));
    if (mm !== value) onChange(mm);
  };

  return (
    <Field label={rack.type === "open4" ? "Jarak rel (kedalaman)" : "Kedalaman rack"} hint={depthHint(rack)}>
      <div className="flex flex-col gap-2">
        <Select
          value={custom ? "custom" : String(value)}
          onChange={(v) => {
            if (v === "custom") return setCustom(true);
            setCustom(false);
            onChange(Number(v));
          }}
          options={[...DEPTH_PRESETS.map((p) => ({ value: String(p.mm), label: p.label })), { value: "custom", label: "Ukuran lain…" }]}
        />
        {custom && (
          <div className="relative">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_DEPTH}
              max={MAX_DEPTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={apply}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              aria-label="Kedalaman rack (mm)"
              className="min-h-10 w-full rounded-lg border border-line bg-surface px-3 pr-12 font-mono text-sm text-ink focus:border-brand focus:outline-none"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-faint">mm</span>
          </div>
        )}
      </div>
    </Field>
  );
}

function DeviceEditor({
  device,
  rack,
  onPatch,
  onPlace,
  onDuplicate,
  onRemove,
  onClose,
  portGrid,
}: {
  device: RackDevice;
  rack: RackState;
  onPatch: (p: Partial<RackDevice>) => void;
  onPlace: (u: number, pos: number) => boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
  portGrid: ReactNode;
}) {
  const [editPorts, setEditPorts] = useState(false);
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
        <div className="sm:col-span-2">
          <NumberField
            label="Kedalaman"
            value={device.depthMm}
            onChange={(n) => onPatch({ depthMm: Math.min(Math.max(Math.round(n), 0), MAX_DEVICE_DEPTH) })}
            suffix="mm"
            step="10"
            hint={deviceDepthHint(rack, device)}
          />
        </div>
        {device.kind === "ups" && (
          <div className="sm:col-span-2">
            <NumberField label="Kapasitas UPS" value={device.upsWatts} onChange={(n) => onPatch({ upsWatts: Math.max(0, n) })} suffix="W" />
          </div>
        )}
        <Field label="Catatan" className="sm:col-span-2">
          <TextInput value={device.note} onChange={(note) => onPatch({ note: note.slice(0, 200) })} placeholder="mis. IP 10.0.0.2, SN, pemilik" />
        </Field>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        {device.brand && device.brand !== "Generik" ? `${device.brand} · ` : ""}
        {KIND_LABEL[device.kind]} · menempati U{device.pos}
        {device.u > 1 ? `–${device.pos + device.u - 1}` : ""}
      </p>

      <div className="mt-4 border-t border-line pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
            Port{device.ports.length ? ` · ${portSummary(device.ports)}` : ""}
          </p>
          <div className="flex items-center gap-1">
            {device.ports.length > 0 && (
              <select
                value={device.portSide}
                onChange={(e) => onPatch({ portSide: e.target.value as "front" | "rear" })}
                aria-label="Letak port"
                className="min-h-7 rounded-md border border-line bg-surface px-1.5 text-[11px] text-ink focus:border-brand focus:outline-none"
              >
                <option value="front">di depan</option>
                <option value="rear">di belakang</option>
              </select>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditPorts((v) => !v)}>
              {editPorts ? "Selesai" : "Ubah port"}
            </Button>
          </div>
        </div>
        {editPorts ? <PortsEditor groups={device.ports} onChange={(ports) => onPatch({ ports })} /> : portGrid}
        {!editPorts && device.ports.length > 0 && (
          <p className="mt-2 text-[10.5px] text-faint">Klik port kosong untuk ujung A, lalu port lain (perangkat mana pun) untuk ujung B. Klik port berwarna untuk melihat kabelnya.</p>
        )}
      </div>

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
