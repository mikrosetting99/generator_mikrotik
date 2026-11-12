"use client";

import { Plus, Trash } from "@/components/icons";
import { Button } from "@/components/ui";
import type { RackDevice } from "@/lib/rack";
import {
  CABLE_HEX,
  devicePorts,
  duplicatePortNames,
  MAX_PORT_GROUPS,
  MAX_PORTS,
  PORT_TYPE,
  PORT_TYPES,
  portInUse,
  type CableEnd,
  type PortGroup,
  type PortType,
  type RackCable,
} from "@/lib/rack-ports";

/** Nama pendek di tombol: angka di akhir nama port, atau nama lengkap bila pendek. */
function shortName(name: string): string {
  if (name.length <= 5) return name;
  const m = /(\d+(?:[/-]\d+)*)$/.exec(name);
  return m ? m[1].split(/[/-]/).pop()! : name.slice(0, 5);
}

/** Port perangkat per grup; klik port kosong untuk memulai/menyelesaikan patch cord. */
export function PortGrid({
  device,
  cables,
  draft,
  selectedCableId,
  onPick,
  onSelectCable,
}: {
  device: RackDevice;
  cables: RackCable[];
  draft: { a: CableEnd | null; b: CableEnd | null };
  selectedCableId: string | null;
  onPick: (end: CableEnd) => void;
  onSelectCable: (id: string) => void;
}) {
  const ports = devicePorts(device);
  if (!ports.length) return <p className="text-xs text-faint">Perangkat ini tidak punya port jaringan.</p>;
  const isDraft = (name: string) => [draft.a, draft.b].some((e) => e && e.dev === device.id && e.port === name);

  return (
    <div className="space-y-2.5">
      {device.ports.map((g, gi) => {
        const list = ports.filter((p) => p.group === gi);
        return (
          <div key={gi}>
            <p className="mb-1 text-[10.5px] text-muted">
              {PORT_TYPE[g.type].label} · {list.length} port
            </p>
            <div className="flex flex-wrap gap-1">
              {list.map((p) => {
                const cable = portInUse(cables, { dev: device.id, port: p.name });
                const color = cable ? CABLE_HEX[cable.color] : undefined;
                const pending = isDraft(p.name);
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => (cable ? onSelectCable(cable.id) : onPick({ dev: device.id, port: p.name }))}
                    title={cable ? `${p.name}: terpakai (klik untuk melihat kabel)` : `${p.name}: kosong (klik untuk menyambung)`}
                    aria-label={`Port ${p.name}${cable ? ", terpakai" : ""}`}
                    className={`min-w-8 rounded border px-1 py-0.5 font-mono text-[10px] leading-4 transition-colors ${
                      pending ? "border-brand bg-brand text-white" : cable ? "border-transparent text-white" : "border-line bg-surface text-muted hover:border-brand hover:text-ink"
                    } ${cable && cable.id === selectedCableId ? "ring-2 ring-ink ring-offset-1 ring-offset-surface" : ""}`}
                    style={cable && !pending ? { background: color, color: cable.color === "white" || cable.color === "yellow" ? "#111" : "#fff" } : undefined}
                  >
                    {shortName(p.name)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Ubah grup port (untuk perangkat custom atau model yang dimodifikasi). */
export function PortsEditor({ groups, onChange }: { groups: PortGroup[]; onChange: (g: PortGroup[]) => void }) {
  const total = devicePorts({ ports: groups }).length;
  const dup = duplicatePortNames(groups);
  const set = (i: number, p: Partial<PortGroup>) => onChange(groups.map((g, j) => (j === i ? { ...g, ...p } : g)));
  const input = "min-h-8 w-full rounded-md border border-line bg-surface px-2 font-mono text-xs text-ink focus:border-brand focus:outline-none";

  return (
    <div className="space-y-2">
      {groups.map((g, i) => (
        <div key={i} className="grid grid-cols-[1fr_52px_1fr_44px_28px] items-center gap-1.5">
          <select value={g.type} onChange={(e) => set(i, { type: e.target.value as PortType })} className={input} aria-label="Jenis port">
            {PORT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={64}
            value={g.bare ? 1 : g.count}
            disabled={g.bare}
            onChange={(e) => set(i, { count: Math.min(Math.max(Math.round(Number(e.target.value)) || 1, 1), 64) })}
            className={input}
            aria-label="Jumlah port"
            title="Jumlah port"
          />
          <input value={g.prefix} onChange={(e) => set(i, { prefix: e.target.value.slice(0, 20) })} className={input} aria-label="Awalan nama" placeholder="ether" title="Awalan nama port" />
          <input
            type="number"
            min={0}
            value={g.start}
            disabled={g.bare}
            onChange={(e) => set(i, { start: Math.min(Math.max(Math.round(Number(e.target.value)) || 0, 0), 999) })}
            className={input}
            aria-label="Nomor awal"
            title="Nomor port pertama"
          />
          <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} className="flex h-8 items-center justify-center rounded-md text-faint hover:text-bad" aria-label="Hapus grup port">
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {groups.length > 0 && <p className="text-[10.5px] text-faint">Jenis · jumlah · awalan nama · nomor awal. Contoh: ether + 1 → ether1, ether2, …</p>}
      {dup.length > 0 && <p className="text-[11px] text-bad">Nama port dobel: {dup.slice(0, 4).join(", ")}. Ubah awalan atau nomor awal.</p>}
      <Button
        size="sm"
        onClick={() => onChange([...groups, { type: "rj45", count: 8, prefix: "Port ", start: groups.length ? total + 1 : 1 }])}
        disabled={groups.length >= MAX_PORT_GROUPS || total >= MAX_PORTS}
      >
        <Plus className="h-3.5 w-3.5" /> Tambah grup port
      </Button>
    </div>
  );
}
