"use client";

import { useMemo, useState } from "react";
import { Plus, Trash } from "@/components/icons";
import { Button, Field, Note, Panel, Select, TextInput } from "@/components/ui";
import type { RackState } from "@/lib/rack";
import {
  CABLE_COLORS,
  CABLE_HEX,
  CABLE_KIND_LABEL,
  CABLE_KINDS,
  cableBom,
  cableLength,
  checkCable,
  CABLE_COLOR_LABEL,
  DAC_MAX_M,
  defaultCableKind,
  devicePorts,
  estimateLength,
  findPort,
  fmtLength,
  MAX_CABLES,
  newCableId,
  portInUse,
  roundToStd,
  STD_LENGTHS,
  type CableEnd,
  type CableKind,
  type RackCable,
} from "@/lib/rack-ports";

export interface CableDraft {
  a: CableEnd | null;
  b: CableEnd | null;
}

const DEFAULT_COLOR: Record<CableKind, string> = { utp: "blue", fiber: "yellow", dac: "black" };

/** Patch cord: sambungkan dua port, lihat daftar kabel dan kebutuhan per panjang. */
export function CablePanel({
  rack,
  draft,
  setDraft,
  selectedCableId,
  setSelectedCableId,
  onChange,
}: {
  rack: RackState;
  draft: CableDraft;
  setDraft: (d: CableDraft) => void;
  selectedCableId: string | null;
  setSelectedCableId: (id: string | null) => void;
  onChange: (cables: RackCable[]) => void;
}) {
  const [kind, setKind] = useState<CableKind | "auto">("auto");
  const [color, setColor] = useState<string>("auto");
  const [lengthM, setLengthM] = useState(0);
  const [label, setLabel] = useState("");

  const withPorts = rack.devices.filter((d) => devicePorts(d).length).sort((a, b) => b.pos - a.pos);
  const devName = (id: string) => rack.devices.find((d) => d.id === id)?.name ?? "?";

  const portType = (e: CableEnd | null) => {
    const d = e && rack.devices.find((x) => x.id === e.dev);
    return (d && e && findPort(d, e.port)?.type) || null;
  };
  const ta = portType(draft.a);
  const tb = portType(draft.b);
  const autoKind: CableKind = ta && tb ? defaultCableKind(ta, tb) : "utp";
  const estimate = draft.a?.port && draft.b?.port ? estimateLength(rack, { a: draft.a, b: draft.b }) : null;
  // DAC panjang tidak ada: estimasi lewat batas → pakai fiber
  const effKind: CableKind = kind === "auto" ? (autoKind === "dac" && estimate !== null && estimate > DAC_MAX_M ? "fiber" : autoKind) : kind;
  const effColor = color === "auto" ? DEFAULT_COLOR[effKind] : color;
  const check = draft.a?.port && draft.b?.port ? checkCable(rack, draft.a, draft.b, effKind) : null;

  const connect = () => {
    if (!draft.a || !draft.b || !check?.ok) return;
    if (rack.cables.length >= MAX_CABLES) return;
    const cable: RackCable = { id: newCableId(), a: draft.a, b: draft.b, kind: effKind, color: effColor, lengthM, label: label.trim().slice(0, 40) };
    onChange([...rack.cables, cable]);
    setSelectedCableId(cable.id);
    setDraft({ a: null, b: null });
    setLabel("");
    setLengthM(0);
  };

  const bom = useMemo(() => cableBom(rack), [rack]);

  const endPicker = (which: "a" | "b") => {
    const end = draft[which];
    const dev = end && rack.devices.find((d) => d.id === end.dev);
    const ports = dev ? devicePorts(dev) : [];
    return (
      <div className="grid grid-cols-2 gap-2">
        <Select
          value={end?.dev ?? ""}
          onChange={(v) => setDraft({ ...draft, [which]: v ? { dev: v, port: "" } : null })}
          placeholder="Pilih perangkat…"
          options={withPorts.map((d) => ({ value: d.id, label: `U${d.pos} · ${d.name}` }))}
        />
        <Select
          value={end?.port ?? ""}
          onChange={(v) => end && setDraft({ ...draft, [which]: { dev: end.dev, port: v } })}
          placeholder={dev ? "Pilih port…" : "—"}
          disabled={!dev}
          options={ports.map((p) => {
            const used = dev && portInUse(rack.cables, { dev: dev.id, port: p.name });
            return { value: p.name, label: `${p.name}${used ? " (terpakai)" : ""}`, disabled: !!used };
          })}
        />
      </div>
    );
  };

  return (
    <Panel title="Patch cord" description="Pilih dua port (dari daftar atau klik port di panel perangkat terpilih), lalu sambungkan.">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Ujung A">{endPicker("a")}</Field>
        <Field label="Ujung B">{endPicker("b")}</Field>
        <Field label="Jenis kabel">
          <Select
            value={kind}
            onChange={(v) => setKind(v as CableKind | "auto")}
            options={[{ value: "auto", label: `Otomatis (${CABLE_KIND_LABEL[effKind]})` }, ...CABLE_KINDS.map((k) => ({ value: k.id, label: k.label }))]}
          />
        </Field>
        <Field label="Warna">
          <Select
            value={color}
            onChange={setColor}
            options={[{ value: "auto", label: `Otomatis (${CABLE_COLOR_LABEL[DEFAULT_COLOR[effKind]]})` }, ...CABLE_COLORS.map((c) => ({ value: c.id, label: c.label }))]}
          />
        </Field>
        <Field label="Panjang" hint={estimate !== null ? `Estimasi jalur ${estimate.toLocaleString("id-ID", { maximumFractionDigits: 2 })} m lewat cable manager samping.` : undefined}>
          <Select
            value={String(lengthM)}
            onChange={(v) => setLengthM(Number(v))}
            options={[
              { value: "0", label: estimate !== null ? `Otomatis (${fmtLength(roundToStd(estimate))})` : "Otomatis" },
              ...STD_LENGTHS.map((m) => ({ value: String(m), label: fmtLength(m) })),
            ]}
          />
        </Field>
        <Field label="Label (opsional)">
          <TextInput value={label} onChange={setLabel} placeholder="mis. Uplink ISP, VLAN 10" />
        </Field>
      </div>

      {check && !check.ok && (
        <div className="mt-3">
          <Note tone="warn">{check.reason}</Note>
        </div>
      )}
      {check?.ok && check.notes.length > 0 && (
        <div className="mt-3">
          <Note tone="info">{check.notes.join(" ")}</Note>
        </div>
      )}
      {lengthM > 0 && estimate !== null && lengthM < estimate - 0.05 && (
        <div className="mt-3">
          <Note tone="warn">Panjang {fmtLength(lengthM)} lebih pendek dari estimasi jalur; kabel akan tegang atau tidak sampai.</Note>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={connect} disabled={!check?.ok || rack.cables.length >= MAX_CABLES}>
          <Plus className="h-3.5 w-3.5" /> Sambungkan
        </Button>
        {(draft.a || draft.b) && (
          <Button size="sm" variant="ghost" onClick={() => setDraft({ a: null, b: null })}>
            Batal
          </Button>
        )}
        {rack.cables.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (window.confirm(`Lepas semua ${rack.cables.length} patch cord?`)) {
                onChange([]);
                setSelectedCableId(null);
              }
            }}
          >
            Lepas semua
          </Button>
        )}
      </div>

      {rack.cables.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                <th className="py-1.5 pr-2 font-medium">Dari</th>
                <th className="py-1.5 pr-2 font-medium">Ke</th>
                <th className="py-1.5 pr-2 font-medium">Kabel</th>
                <th className="py-1.5 pr-2 text-right font-medium">Panjang</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rack.cables.map((c) => {
                const len = cableLength(rack, c);
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCableId(c.id === selectedCableId ? null : c.id)}
                    className={`cursor-pointer border-b border-line/60 hover:bg-brand/[0.05] ${c.id === selectedCableId ? "bg-brand/[0.08]" : ""}`}
                  >
                    <td className="py-1.5 pr-2 text-ink">
                      {devName(c.a.dev)} <span className="font-mono text-muted">{c.a.port}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-ink">
                      {devName(c.b.dev)} <span className="font-mono text-muted">{c.b.port}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-ink">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ring-1 ring-black/20" style={{ background: CABLE_HEX[c.color] }} />
                      {CABLE_KIND_LABEL[c.kind].split(" (")[0]}
                      {c.label && <span className="text-faint"> · {c.label}</span>}
                    </td>
                    <td className={`py-1.5 pr-2 text-right font-mono ${len.tooShort ? "text-bad" : "text-ink"}`} title={len.estimate !== null ? `Estimasi ${len.estimate.toFixed(2)} m` : undefined}>
                      {fmtLength(len.length)}
                      {c.lengthM === 0 && <span className="text-faint"> ·auto</span>}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange(rack.cables.filter((x) => x.id !== c.id));
                          if (selectedCableId === c.id) setSelectedCableId(null);
                        }}
                        className="rounded p-1 text-faint hover:text-bad"
                        aria-label="Lepas kabel"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mb-1.5 mt-4 text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Kebutuhan kabel</p>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {bom.map((r) => (
              <li key={`${r.kind}${r.length}${r.color}`} className="flex items-center gap-2 rounded-md bg-raised px-2.5 py-1.5">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/20" style={{ background: CABLE_HEX[r.color] }} />
                <span className="min-w-0 flex-1 truncate text-ink">
                  {CABLE_KIND_LABEL[r.kind].split(" (")[0]} {fmtLength(r.length)} {CABLE_COLOR_LABEL[r.color]?.split(" (")[0].toLowerCase()}
                </span>
                <span className="font-mono text-ink">× {r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
