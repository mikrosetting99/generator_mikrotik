"use client";

import { AlertCircle, AlertTriangle, Plus } from "@/components/icons";
import { Button, EmptyState, Field, Note, Panel, Row, Select, TextInput, Toggle } from "@/components/ui";
import { newIsp } from "@/lib/defaults-loadbalance";
import { ROS_LABEL } from "@/lib/models";
import type { LbIssue, LbSectionId, LoadBalanceConfig, RosVersion } from "@/lib/types-loadbalance";

export interface SectionProps {
  config: LoadBalanceConfig;
  patch: (partial: Partial<LoadBalanceConfig>) => void;
  issues: LbIssue[];
}

export const SECTION_META: Array<{ id: LbSectionId; step: string; title: string }> = [
  { id: "ros", step: "a", title: "RouterOS" },
  { id: "lan", step: "b", title: "Interface LAN" },
  { id: "isp", step: "c", title: "Daftar ISP" },
  { id: "options", step: "d", title: "Opsi Lanjutan" },
];

const grid2 = "grid gap-4 sm:grid-cols-2";

function IssueList({ issues }: { issues: LbIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul className="mt-5 space-y-2 border-t border-line-soft pt-4">
      {issues.map((issue, i) => {
        const isError = issue.level === "error";
        const Glyph = isError ? AlertCircle : AlertTriangle;
        return (
          <li
            key={`${issue.message}-${i}`}
            className={`flex gap-2 text-xs leading-relaxed ${isError ? "text-bad" : "text-warn"}`}
          >
            <Glyph className="mt-0.5 h-3.5 w-3.5" />
            <span>{issue.message}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------- a: ros */

export function RosSection({ config, patch, issues }: SectionProps) {
  return (
    <Panel
      id="ros"
      step="a"
      title="Versi RouterOS"
      description="Menentukan sintaks routing table yang dipakai — v7 butuh /routing table sebelum dipakai di /ip route, v6 tidak."
    >
      <Field label="RouterOS" required>
        <Select
          value={config.ros}
          placeholder="— pilih versi —"
          onChange={(ros) => patch({ ros: ros as RosVersion | "" })}
          options={(Object.keys(ROS_LABEL) as RosVersion[]).map((v) => ({
            value: v,
            label: ROS_LABEL[v],
          }))}
        />
      </Field>
      <IssueList issues={issues} />
    </Panel>
  );
}

/* --------------------------------------------------------------- b: lan */

export function LanSection({ config, patch, issues }: SectionProps) {
  return (
    <Panel
      id="lan"
      step="b"
      title="Interface LAN"
      description="Interface atau bridge tempat trafik klien masuk — inilah yang dibagi ke tiap ISP lewat PCC. Router ini berdiri sendiri: interface tidak digantung ke database model, isi manual sesuai konfigurasi router (mis. hasil dari menu Setup Mikrotik Baru)."
    >
      <Field label="Interface / bridge LAN" required hint="Contoh: bridge-lan, ether1">
        <TextInput
          mono
          value={config.lanIface}
          onChange={(lanIface) => patch({ lanIface })}
          placeholder="bridge-lan"
        />
      </Field>
      <IssueList issues={issues} />
    </Panel>
  );
}

/* --------------------------------------------------------------- c: isp */

export function IspSection({ config, patch, issues }: SectionProps) {
  const update = (id: string, partial: Partial<(typeof config.isps)[number]>) =>
    patch({ isps: config.isps.map((i) => (i.id === id ? { ...i, ...partial } : i)) });

  return (
    <Panel
      id="isp"
      step="c"
      title="Daftar ISP"
      description="Minimal 2 ISP. Interface bisa fisik (ether2) atau virtual (pppoe-isp1) — sudah harus punya IP address & gateway aktif."
      right={
        <Button size="sm" onClick={() => patch({ isps: [...config.isps, newIsp(config.isps.length)] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah ISP
        </Button>
      }
    >
      <div className="space-y-4">
        {config.isps.length === 0 && <EmptyState>Belum ada ISP. Minimal 2 ISP wajib diisi.</EmptyState>}
        {config.isps.map((isp, index) => (
          <Row
            key={isp.id}
            label={isp.name.trim() || `ISP ${index + 1}`}
            onRemove={
              config.isps.length > 2
                ? () => patch({ isps: config.isps.filter((i) => i.id !== isp.id) })
                : undefined
            }
          >
            <div className={grid2}>
              <Field label="Nama ISP" hint="Muncul di comment & nama mark, mis. Indihome.">
                <TextInput value={isp.name} onChange={(name) => update(isp.id, { name })} />
              </Field>
              <Field label="Interface" required>
                <TextInput
                  mono
                  value={isp.iface}
                  onChange={(iface) => update(isp.id, { iface })}
                  placeholder="ether2"
                />
              </Field>
            </div>

            <div className={`mt-4 ${grid2}`}>
              <Field label="Gateway ISP" required>
                <TextInput
                  mono
                  value={isp.gateway}
                  onChange={(gateway) => update(isp.id, { gateway })}
                  placeholder="100.64.0.1"
                />
              </Field>
              <Field
                label="Target recursive gateway"
                required
                hint="IP publik unik untuk menguji jalur ISP ini, mis. resolver DNS."
              >
                <TextInput
                  mono
                  value={isp.recursiveTarget}
                  onChange={(recursiveTarget) => update(isp.id, { recursiveTarget })}
                  placeholder="8.8.8.8"
                />
              </Field>
            </div>

            <div className={`mt-4 ${grid2}`}>
              <Field label="Bobot PCC" required hint="Rasio distribusi koneksi baru ke ISP ini.">
                <TextInput
                  mono
                  value={isp.weight}
                  onChange={(weight) => update(isp.id, { weight })}
                  placeholder="1"
                />
              </Field>
              <Field
                label="Distance (jalur umum)"
                required
                hint="Prioritas ISP ini untuk trafik yang tidak kena PCC. Angka kecil = utama."
              >
                <TextInput
                  mono
                  value={isp.distance}
                  onChange={(distance) => update(isp.id, { distance })}
                  placeholder={String(index + 1)}
                />
              </Field>
            </div>
          </Row>
        ))}
      </div>
      <IssueList issues={issues} />
    </Panel>
  );
}

/* ----------------------------------------------------------- d: options */

export function OptionsSection({ config, patch, issues }: SectionProps) {
  return (
    <Panel
      id="options"
      step="d"
      title="Opsi Lanjutan"
      description="Metode pembagian PCC dan NAT keluar untuk tiap ISP."
    >
      <Field
        label="Metode classifier PCC"
        hint="both-addresses-and-ports paling direkomendasikan — seimbang tanpa memutus koneksi berjalan."
      >
        <Select
          value={config.classifier}
          placeholder=""
          onChange={(classifier) =>
            patch({ classifier: classifier as LoadBalanceConfig["classifier"] })
          }
          options={[
            { value: "both-addresses-and-ports", label: "both-addresses-and-ports (disarankan)" },
            { value: "both-addresses", label: "both-addresses — IP sumber & tujuan saja" },
            { value: "src-address", label: "src-address — per IP klien" },
          ]}
        />
      </Field>

      <div className="mt-4">
        <Toggle
          checked={config.natEnabled}
          onChange={(natEnabled) => patch({ natEnabled })}
          label="Aktifkan NAT masquerade per ISP"
          hint="Wajib aktif kalau interface ISP di atas belum punya NAT dari menu lain."
        />
      </div>

      <div className="mt-4">
        <Note>
          Trafik dari router sendiri (mis. ping, update) tidak ikut dibagi PCC — itu memakai
          default route umum di section ISP (kolom Distance), bukan mangle.
        </Note>
      </div>
      <IssueList issues={issues} />
    </Panel>
  );
}
