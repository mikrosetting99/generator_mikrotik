"use client";

import { AlertCircle, AlertTriangle, Plus, Trash } from "@/components/icons";
import {
  Button,
  CheckPill,
  EmptyState,
  Field,
  Note,
  Panel,
  Row,
  Select,
  TextInput,
  Toggle,
} from "@/components/ui";
import {
  newAddress,
  newBridge,
  newDhcpServer,
  newHotspot,
  newPool,
  newPppoeProfile,
  newSecret,
  newUser,
  newVlan,
  newWan,
  newWireless,
  TIMEZONES,
  WIRELESS_COUNTRIES,
} from "@/lib/defaults";
import {
  addressOfInterface,
  allInterfaces,
  physicalInterfaces,
  wirelessInterfaces,
  wirelessKind,
} from "@/lib/interfaces";
import { getModel, modelsBySeries, ROS_LABEL } from "@/lib/models";
import { addressPart, networkOf, suggestPoolRange } from "@/lib/net";
import { DEFAULT_PPP_PROFILE } from "@/lib/types";
import type {
  HotspotAuth,
  Issue,
  RosVersion,
  SectionId,
  SetupConfig,
  UserGroup,
} from "@/lib/types";
import { checkPassword } from "@/lib/validate";

export interface SectionProps {
  config: SetupConfig;
  patch: (partial: Partial<SetupConfig>) => void;
  issues: Issue[];
}

export const SECTION_META: Array<{ id: SectionId; step: string; title: string }> = [
  { id: "device", step: "a–b", title: "Perangkat & RouterOS" },
  { id: "wan", step: "c", title: "WAN" },
  { id: "dns", step: "d", title: "DNS" },
  { id: "nat", step: "e", title: "NAT" },
  { id: "bridge", step: "f", title: "Bridge" },
  { id: "wireless", step: "f2", title: "Wireless" },
  { id: "vlan", step: "g", title: "VLAN" },
  { id: "address", step: "h", title: "IP Address" },
  { id: "pool", step: "i", title: "IP Pool" },
  { id: "dhcp", step: "j", title: "DHCP Server" },
  { id: "hotspot", step: "k", title: "IP Hotspot" },
  { id: "pppoe", step: "l", title: "PPPoE Server" },
  { id: "firewall", step: "m", title: "Firewall & TTL" },
  { id: "user", step: "n", title: "User Mikrotik" },
];

/* ------------------------------------------------------------- utilities */

function IssueList({ issues }: { issues: Issue[] }) {
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

function ifaceOptions(
  config: SetupConfig,
  opts: { skipEnslaved?: boolean; skipWan?: boolean; physicalOnly?: boolean } = {},
) {
  const wan = new Set(config.wans.map((w) => w.iface).filter(Boolean));
  return allInterfaces(config)
    .filter((i) => (opts.physicalOnly ? i.kind === "physical" : true))
    .filter((i) => (opts.skipWan ? !wan.has(i.name) : true))
    .map((i) => ({
      value: i.name,
      label: i.enslavedTo
        ? `${i.name} — port bridge ${i.enslavedTo}`
        : i.kind === "physical"
          ? i.name
          : `${i.name} (${i.kind})`,
      disabled: opts.skipEnslaved ? Boolean(i.enslavedTo) : false,
    }));
}

function poolOptions(config: SetupConfig) {
  return config.pools
    .filter((p) => p.name.trim())
    .map((p) => ({ value: p.name.trim(), label: p.name.trim() }));
}

const grid2 = "grid gap-4 sm:grid-cols-2";
const grid3 = "grid gap-4 sm:grid-cols-3";

/* ----------------------------------------------------- a & b: perangkat */

export function DeviceSection({ config, patch, issues }: SectionProps) {
  const model = getModel(config.modelId);

  return (
    <Panel
      id="device"
      step="a–b"
      title="Type Mikrotik & RouterOS"
      description="Model perangkat menentukan daftar interface dan versi RouterOS yang tersedia. Versi RouterOS wajib dipilih lebih dulu karena menentukan sintaks di seluruh script."
    >
      <div className={grid2}>
        <Field label="Type Mikrotik" required hint={model?.note}>
          <Select
            value={config.modelId}
            placeholder="— pilih model —"
            onChange={(modelId) => {
              const next = getModel(modelId);
              const ros =
                next && config.ros && next.supports.includes(config.ros as RosVersion)
                  ? config.ros
                  : next && next.supports.length === 1
                    ? next.supports[0]
                    : "";
              patch({ modelId, ros });
            }}
            groups={modelsBySeries().map((group) => ({
              label: group.series,
              options: group.models.map((m) => ({
                value: m.id,
                label: `${m.name}${m.supports.length === 1 ? " — v7 only" : ""}`,
              })),
            }))}
          />
        </Field>

        <Field
          label="RouterOS"
          required
          hint={
            model
              ? `${model.name} mendukung: ${model.supports.map((v) => ROS_LABEL[v]).join(", ")}`
              : "Pilih model perangkat lebih dulu."
          }
        >
          <Select
            value={config.ros}
            disabled={!model}
            placeholder="— pilih versi —"
            onChange={(ros) => patch({ ros: ros as RosVersion | "" })}
            options={(model?.supports ?? []).map((v) => ({ value: v, label: ROS_LABEL[v] }))}
          />
        </Field>
      </div>

      {config.modelId === "custom" && (
        <div className="mt-4">
          <Field
            label="Daftar interface perangkat"
            hint="Pisahkan dengan koma atau spasi. Contoh: ether1, ether2, ether3, sfp1, wlan1"
          >
            <TextInput
              mono
              value={config.customInterfaces}
              onChange={(customInterfaces) => patch({ customInterfaces })}
              placeholder="ether1, ether2, ether3, ether4, ether5"
            />
          </Field>
        </div>
      )}

      {model && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {physicalInterfaces(config).map((name) => (
            <span
              key={name}
              className="rounded-md border border-line-soft bg-canvas px-2 py-1 font-mono text-[11px] text-muted"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-line-soft pt-5">
        <h3 className="text-sm font-semibold text-ink">Identitas & waktu</h3>
        <div className={`mt-3 ${grid2}`}>
          <Field label="System identity" hint="Nama router yang tampil di Winbox & neighbor.">
            <TextInput
              value={config.system.identity}
              onChange={(identity) => patch({ system: { ...config.system, identity } })}
              placeholder="MikroTik-Kantor"
            />
          </Field>
          <Field label="Zona waktu">
            <Select
              value={config.system.timezone}
              placeholder="— tidak diubah —"
              onChange={(timezone) => patch({ system: { ...config.system, timezone } })}
              options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle
            checked={config.system.ntp}
            onChange={(ntp) => patch({ system: { ...config.system, ntp } })}
            label="Aktifkan NTP client"
            hint="Menyamakan jam router lewat internet — penting agar log dan penjadwalan akurat."
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-faint">
          Password admin dan penambahan user diatur di section terakhir (n) —
          sengaja dijalankan di akhir script agar akses ke router tidak terputus di tengah jalan.
        </p>
      </div>

      <IssueList issues={issues} />
    </Panel>
  );
}

/* ------------------------------------------------------------- c: WAN */

export function WanSection({ config, patch, issues }: SectionProps) {
  const options = ifaceOptions(config, { skipEnslaved: true });

  const update = (id: string, partial: Partial<(typeof config.wans)[number]>) =>
    patch({ wans: config.wans.map((w) => (w.id === id ? { ...w, ...partial } : w)) });

  return (
    <Panel
      id="wan"
      step="c"
      title="Tambah WAN"
      description="Interface yang tersambung ke ISP. Bisa lebih dari satu — bedakan prioritasnya lewat distance."
      right={
        <Button size="sm" onClick={() => patch({ wans: [...config.wans, newWan()] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah WAN
        </Button>
      }
    >
      <div className="space-y-4">
        {config.wans.length === 0 && <EmptyState>Belum ada WAN. Minimal 1 WAN wajib diisi.</EmptyState>}
        {config.wans.map((wan, index) => (
          <Row
            key={wan.id}
            label={`WAN ${index + 1}`}
            onRemove={
              config.wans.length > 1
                ? () => patch({ wans: config.wans.filter((w) => w.id !== wan.id) })
                : undefined
            }
          >
            <div className={grid2}>
              <Field label="Interface" required>
                <Select
                  value={wan.iface}
                  onChange={(iface) => update(wan.id, { iface })}
                  options={options}
                />
              </Field>
              <Field label="Mode IP">
                <Select
                  value={wan.mode}
                  placeholder=""
                  onChange={(mode) => update(wan.id, { mode: mode as "dhcp" | "static" })}
                  options={[
                    { value: "dhcp", label: "DHCP Client (IP otomatis dari ISP)" },
                    { value: "static", label: "Static (IP diberikan ISP)" },
                  ]}
                />
              </Field>
            </div>

            {wan.mode === "dhcp" ? (
              <div className="mt-4 space-y-3">
                <div className={grid2}>
                  <Toggle
                    checked={wan.addDefaultRoute}
                    onChange={(addDefaultRoute) => update(wan.id, { addDefaultRoute })}
                    label="add-default-route"
                    hint="Ambil default route dari ISP. Matikan bila route diatur manual / lewat failover."
                  />
                  <Toggle
                    checked={wan.usePeerDns}
                    onChange={(usePeerDns) => update(wan.id, { usePeerDns })}
                    label="use-peer-dns"
                    hint="Pakai DNS bawaan ISP selain DNS yang diisi di section DNS."
                  />
                </div>
                {wan.addDefaultRoute && (
                  <div className={grid2}>
                    <Field
                      label="default-route-distance"
                      hint="Angka kecil = prioritas utama. WAN cadangan pakai angka lebih besar."
                    >
                      <TextInput
                        mono
                        value={wan.dhcpDistance}
                        onChange={(dhcpDistance) => update(wan.id, { dhcpDistance })}
                        placeholder="1"
                      />
                    </Field>
                  </div>
                )}
              </div>
            ) : (
              <div className={`mt-4 ${grid3}`}>
                <Field label="IP address / prefix" required>
                  <TextInput
                    mono
                    value={wan.address}
                    onChange={(address) => update(wan.id, { address })}
                    placeholder="100.64.0.2/30"
                  />
                </Field>
                <Field label="Gateway ISP" required>
                  <TextInput
                    mono
                    value={wan.gateway}
                    onChange={(gateway) => update(wan.id, { gateway })}
                    placeholder="100.64.0.1"
                  />
                </Field>
                <Field label="Distance" hint="Prioritas default route.">
                  <TextInput
                    mono
                    value={wan.staticDistance}
                    onChange={(staticDistance) => update(wan.id, { staticDistance })}
                    placeholder="1"
                  />
                </Field>
              </div>
            )}

            <div className="mt-4">
              <Field label="Keterangan" hint="Muncul sebagai comment di router, misal nama ISP.">
                <TextInput
                  value={wan.comment}
                  onChange={(comment) => update(wan.id, { comment })}
                  placeholder="ISP Indihome"
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

/* -------------------------------------------------------------- d: DNS */

export function DnsSection({ config, patch, issues }: SectionProps) {
  const servers = config.dns.servers;
  const setServers = (next: string[]) => patch({ dns: { ...config.dns, servers: next } });

  return (
    <Panel
      id="dns"
      step="d"
      title="DNS"
      description="DNS server yang dipakai router. Aktifkan allow-remote-requests bila klien LAN memakai router sebagai DNS."
      right={
        <Button size="sm" onClick={() => setServers([...servers, ""])}>
          <Plus className="h-3.5 w-3.5" /> Tambah DNS
        </Button>
      }
    >
      <div className="space-y-3">
        {servers.length === 0 && <EmptyState>Belum ada DNS server manual.</EmptyState>}
        {servers.map((server, index) => (
          <div key={index} className="flex items-end gap-2">
            <Field label={`DNS ${index + 1}`} className="flex-1">
              <TextInput
                mono
                value={server}
                onChange={(value) => setServers(servers.map((s, i) => (i === index ? value : s)))}
                placeholder="8.8.8.8"
              />
            </Field>
            <Button
              variant="danger"
              onClick={() => setServers(servers.filter((_, i) => i !== index))}
              title={`Hapus DNS ${index + 1}`}
              ariaLabel={`Hapus DNS ${index + 1}`}
              className="px-3"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <Toggle
          checked={config.dns.allowRemoteRequests}
          onChange={(allowRemoteRequests) => patch({ dns: { ...config.dns, allowRemoteRequests } })}
          label="Allow Remote Requests"
          hint="Router melayani query DNS dari klien. Wajib aktif bila DHCP membagikan IP router sebagai DNS."
        />
      </div>

      {config.dns.allowRemoteRequests && (
        <div className="mt-4">
          <Note tone="warn">
            Dengan allow-remote-requests aktif, pastikan port 53 tidak terbuka dari internet —
            section Firewall Dasar sudah menutupnya lewat rule chain input.
          </Note>
        </div>
      )}
      <IssueList issues={issues} />
    </Panel>
  );
}

/* -------------------------------------------------------------- e: NAT */

export function NatSection({ config, patch, issues }: SectionProps) {
  const wanIfaces = config.wans.map((w) => w.iface).filter(Boolean);
  const toggleIface = (iface: string) => {
    const active = config.nat.interfaces.includes(iface);
    patch({
      nat: {
        ...config.nat,
        interfaces: active
          ? config.nat.interfaces.filter((i) => i !== iface)
          : [...config.nat.interfaces, iface],
      },
    });
  };

  return (
    <Panel
      id="nat"
      step="e"
      title="NAT Masquerade"
      description="Menyamarkan IP privat LAN dengan IP WAN agar klien bisa mengakses internet."
    >
      <Toggle
        checked={config.nat.enabled}
        onChange={(enabled) => patch({ nat: { ...config.nat, enabled } })}
        label="Aktifkan NAT masquerade"
      />

      {config.nat.enabled && (
        <div className="mt-4 space-y-4">
          <Field label="Cakupan rule">
            <Select
              value={config.nat.mode}
              placeholder=""
              onChange={(mode) => patch({ nat: { ...config.nat, mode: mode as "global" | "perInterface" } })}
              options={[
                { value: "global", label: "Global — semua interface WAN (out-interface-list=WAN)" },
                { value: "perInterface", label: "Per interface — pilih WAN tertentu" },
              ]}
            />
          </Field>

          {config.nat.mode === "perInterface" && (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Interface WAN yang di-NAT
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {wanIfaces.length === 0 && (
                  <span className="text-xs text-faint">Isi section WAN terlebih dahulu.</span>
                )}
                {wanIfaces.map((iface) => (
                  <CheckPill
                    key={iface}
                    active={config.nat.interfaces.includes(iface)}
                    onClick={() => toggleIface(iface)}
                  >
                    {iface}
                  </CheckPill>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <IssueList issues={issues} />
    </Panel>
  );
}

/* ----------------------------------------------------------- f: Bridge */

export function BridgeSection({ config, patch, issues }: SectionProps) {
  const physical = physicalInterfaces(config);
  const wanIfaces = new Set(config.wans.map((w) => w.iface).filter(Boolean));

  const update = (id: string, partial: Partial<(typeof config.bridges)[number]>) =>
    patch({ bridges: config.bridges.map((b) => (b.id === id ? { ...b, ...partial } : b)) });

  return (
    <Panel
      id="bridge"
      step="f"
      title="Bridge"
      optional
      description="Menggabungkan beberapa port fisik menjadi satu segmen LAN. Port yang sudah jadi member bridge tidak boleh diberi IP sendiri."
      right={
        <Button
          size="sm"
          onClick={() =>
            patch({
              bridges: [...config.bridges, newBridge(`bridge${config.bridges.length + 1 || 1}`)],
            })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Tambah Bridge
        </Button>
      }
    >
      <div className="space-y-4">
        {config.bridges.length === 0 && (
          <EmptyState>Belum ada bridge. Lewati bila tiap port dipakai terpisah.</EmptyState>
        )}
        {config.bridges.map((bridge, index) => {
          const takenElsewhere = new Set(
            config.bridges.filter((b) => b.id !== bridge.id).flatMap((b) => b.ports),
          );
          return (
            <Row
              key={bridge.id}
              label={`Bridge ${index + 1}`}
              onRemove={() => patch({ bridges: config.bridges.filter((b) => b.id !== bridge.id) })}
            >
              <Field label="Nama bridge" required>
                <TextInput
                  mono
                  value={bridge.name}
                  onChange={(name) => update(bridge.id, { name })}
                  placeholder="bridge-lan"
                />
              </Field>
              <div className="mt-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Port member
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {physical.map((port) => {
                    const disabled = takenElsewhere.has(port) || wanIfaces.has(port);
                    const active = bridge.ports.includes(port);
                    return (
                      <CheckPill
                        key={port}
                        active={active}
                        onClick={() => {
                          if (disabled) return;
                          update(bridge.id, {
                            ports: active
                              ? bridge.ports.filter((p) => p !== port)
                              : [...bridge.ports, port],
                          });
                        }}
                      >
                        <span className={disabled ? "line-through opacity-50" : ""}>{port}</span>
                      </CheckPill>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-faint">
                  Port bercoret sudah dipakai sebagai WAN atau member bridge lain.
                </p>
              </div>
            </Row>
          );
        })}
      </div>
      <IssueList issues={issues} />
    </Panel>
  );
}

/* --------------------------------------------------------- f2: wireless */

const WIRELESS_MODE_OPTIONS = [
  { value: "ap", label: "Access Point — memancarkan SSID" },
  { value: "station-bridge", label: "Klien ke AP MikroTik (station-bridge)" },
  { value: "station", label: "Klien ke AP merek lain (station)" },
];

export function WirelessSection({ config, patch, issues }: SectionProps) {
  const kind = wirelessKind(config);
  const available = wirelessInterfaces(config);
  const radios = config.wireless.radios;
  const taken = new Set(radios.map((r) => r.iface).filter(Boolean));
  const unused = available.find((name) => !taken.has(name));

  const update = (id: string, partial: Partial<(typeof radios)[number]>) =>
    patch({
      wireless: {
        ...config.wireless,
        radios: radios.map((r) => (r.id === id ? { ...r, ...partial } : r)),
      },
    });

  // Pilihan yang tidak berlaku untuk paket wireless perangkat ini tetap
  // ditampilkan namun dimatikan — supaya konfigurasi lama yang memakainya
  // tidak berubah menjadi kotak kosong tanpa penjelasan.
  const bandOptions = [
    { value: "auto", label: "Ikut bawaan radio — paling aman" },
    { value: "2ghz", label: kind === "wifi" ? "2.4 GHz — ax" : "2.4 GHz — b/g/n" },
    { value: "5ghz", label: kind === "wifi" ? "5 GHz — ax" : "5 GHz — a/n/ac" },
    { value: "5ghz-n", label: "5 GHz — a/n (radio lama tanpa ac)", disabled: kind === "wifi" },
  ];
  const securityOptions = [
    { value: "wpa2", label: "WPA2-PSK" },
    { value: "wpa2-wpa3", label: "WPA2 + WPA3", disabled: kind !== "wifi" },
    { value: "open", label: "Terbuka — tanpa password" },
  ];

  return (
    <Panel
      id="wireless"
      step="f2"
      title="Wireless (WiFi)"
      optional
      description={
        kind === "wifi"
          ? "Radio ax diatur lewat menu /interface wifi RouterOS v7."
          : "Radio diatur lewat menu /interface wireless."
      }
      right={
        <Button
          size="sm"
          disabled={!unused}
          title={unused ? "Atur satu radio lagi" : "Semua radio sudah diatur"}
          onClick={() =>
            patch({
              wireless: { ...config.wireless, radios: [...radios, newWireless(unused)] },
            })
          }
        >
          <Plus className="h-3.5 w-3.5" /> Tambah Radio
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Negara (regulatory domain)"
          hint="Menentukan channel dan daya pancar yang legal dipakai."
        >
          <Select
            value={config.wireless.country}
            placeholder="Ikut bawaan router"
            onChange={(country) => patch({ wireless: { ...config.wireless, country } })}
            options={WIRELESS_COUNTRIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
      </div>

      <div className="mt-5 space-y-4">
        {radios.length === 0 && (
          <EmptyState>
            Belum ada radio yang diatur — {available.join(", ") || "perangkat ini"} masih memakai
            setelan bawaan pabrik.
          </EmptyState>
        )}
        {radios.map((radio, index) => {
          const isAp = radio.mode === "ap";
          const open = radio.security === "open";
          return (
            <Row
              key={radio.id}
              label={`Radio ${index + 1}`}
              onRemove={() =>
                patch({
                  wireless: {
                    ...config.wireless,
                    radios: radios.filter((r) => r.id !== radio.id),
                  },
                })
              }
            >
              <div className={grid3}>
                <Field label="Radio" required>
                  <Select
                    value={radio.iface}
                    onChange={(iface) => update(radio.id, { iface })}
                    options={available.map((name) => ({
                      value: name,
                      label: name,
                      disabled: name !== radio.iface && taken.has(name),
                    }))}
                  />
                </Field>
                <Field label="Nama WiFi (SSID)" required>
                  <TextInput
                    value={radio.ssid}
                    onChange={(ssid) => update(radio.id, { ssid })}
                    placeholder="WiFi-Kantor"
                  />
                </Field>
                <Field label="Mode">
                  <Select
                    value={radio.mode}
                    placeholder=""
                    onChange={(mode) =>
                      update(radio.id, { mode: mode as (typeof radios)[number]["mode"] })
                    }
                    options={WIRELESS_MODE_OPTIONS}
                  />
                </Field>
              </div>

              <div className={`mt-4 ${grid3}`}>
                <Field label="Keamanan">
                  <Select
                    value={radio.security}
                    placeholder=""
                    onChange={(security) =>
                      update(radio.id, { security: security as (typeof radios)[number]["security"] })
                    }
                    options={securityOptions}
                  />
                </Field>
                <Field
                  label="Password WiFi"
                  required={!open}
                  hint={
                    open
                      ? "Tidak dipakai pada jaringan terbuka."
                      : "8–63 karakter. Sengaja terlihat — password ini memang dibagikan ke pengguna."
                  }
                >
                  <TextInput
                    mono
                    disabled={open}
                    value={radio.password}
                    onChange={(password) => update(radio.id, { password })}
                    placeholder="minimal 8 karakter"
                  />
                </Field>
                <Field
                  label="Band"
                  hint="Biarkan bawaan bila tidak yakin radio mana yang 2.4 dan mana yang 5 GHz."
                >
                  <Select
                    value={radio.band}
                    placeholder=""
                    onChange={(band) =>
                      update(radio.id, { band: band as (typeof radios)[number]["band"] })
                    }
                    options={bandOptions}
                  />
                </Field>
              </div>

              {isAp && (
                <div className={`mt-4 ${grid2}`}>
                  <Toggle
                    checked={radio.hideSsid}
                    onChange={(hideSsid) => update(radio.id, { hideSsid })}
                    label="Sembunyikan SSID"
                    hint="Nama WiFi tidak muncul di daftar; pengguna harus mengetik sendiri."
                  />
                  <Toggle
                    checked={radio.clientIsolation}
                    onChange={(clientIsolation) => update(radio.id, { clientIsolation })}
                    label="Isolasi antar klien"
                    hint="Perangkat yang terhubung tidak bisa saling melihat. Cocok untuk WiFi tamu."
                  />
                </div>
              )}
            </Row>
          );
        })}
      </div>

      {radios.length > 0 && (
        <div className="mt-4">
          <Note>
            Agar klien WiFi berada di segmen yang sama dengan port kabel, radio harus dijadikan{" "}
            <span className="text-ink">port bridge</span> di langkah Bridge. Tanpa itu SSID tetap
            muncul, tetapi klien tidak mendapat IP maupun internet.
          </Note>
        </div>
      )}
      <IssueList issues={issues} />
    </Panel>
  );
}

/* ------------------------------------------------------------- g: VLAN */

export function VlanSection({ config, patch, issues }: SectionProps) {
  const parents = ifaceOptions(config).filter((o) => !o.label.includes("(vlan)"));
  const update = (id: string, partial: Partial<(typeof config.vlans)[number]>) =>
    patch({ vlans: config.vlans.map((v) => (v.id === id ? { ...v, ...partial } : v)) });

  return (
    <Panel
      id="vlan"
      step="g"
      title="VLAN"
      optional
      description="Memisahkan jaringan secara logis di atas satu interface fisik atau bridge."
      right={
        <Button size="sm" onClick={() => patch({ vlans: [...config.vlans, newVlan()] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah VLAN
        </Button>
      }
    >
      <div className="space-y-4">
        {config.vlans.length === 0 && <EmptyState>Belum ada VLAN.</EmptyState>}
        {config.vlans.map((vlan, index) => (
          <Row
            key={vlan.id}
            label={`VLAN ${index + 1}`}
            onRemove={() => patch({ vlans: config.vlans.filter((v) => v.id !== vlan.id) })}
          >
            <div className={grid3}>
              <Field label="Nama VLAN" required>
                <TextInput
                  mono
                  value={vlan.name}
                  onChange={(name) => update(vlan.id, { name })}
                  placeholder="vlan-office"
                />
              </Field>
              <Field label="VLAN ID" required hint="Rentang 1–4094.">
                <TextInput
                  mono
                  value={vlan.vlanId}
                  onChange={(vlanId) => update(vlan.id, { vlanId })}
                  placeholder="10"
                />
              </Field>
              <Field label="Interface induk" required>
                <Select
                  value={vlan.parent}
                  onChange={(parent) => update(vlan.id, { parent })}
                  options={parents}
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

/* ------------------------------------------------------- h: IP Address */

export function AddressSection({ config, patch, issues }: SectionProps) {
  const options = ifaceOptions(config, { skipEnslaved: true });
  const update = (id: string, partial: Partial<(typeof config.addresses)[number]>) =>
    patch({ addresses: config.addresses.map((a) => (a.id === id ? { ...a, ...partial } : a)) });

  return (
    <Panel
      id="address"
      step="h"
      title="IP Address"
      description="Alamat IP router di tiap segmen. WAN mode static tidak perlu diisi di sini — sudah dibuat otomatis dari section WAN."
      right={
        <Button size="sm" onClick={() => patch({ addresses: [...config.addresses, newAddress()] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah IP
        </Button>
      }
    >
      <div className="space-y-4">
        {config.addresses.length === 0 && (
          <EmptyState>Belum ada IP address untuk sisi LAN.</EmptyState>
        )}
        {config.addresses.map((addr, index) => (
          <Row
            key={addr.id}
            label={`IP ${index + 1}`}
            onRemove={() => patch({ addresses: config.addresses.filter((a) => a.id !== addr.id) })}
          >
            <div className={grid3}>
              <Field label="Interface" required>
                <Select
                  value={addr.iface}
                  onChange={(iface) => update(addr.id, { iface })}
                  options={options}
                />
              </Field>
              <Field
                label="IP address / prefix"
                required
                hint={addr.address ? `Network: ${networkOf(addr.address) || "—"}` : "Contoh: 192.168.10.1/24"}
              >
                <TextInput
                  mono
                  value={addr.address}
                  onChange={(address) => update(addr.id, { address })}
                  placeholder="192.168.10.1/24"
                />
              </Field>
              <Field label="Keterangan">
                <TextInput
                  value={addr.comment}
                  onChange={(comment) => update(addr.id, { comment })}
                  placeholder="LAN kantor"
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

/* ---------------------------------------------------------- i: IP Pool */

export function PoolSection({ config, patch, issues }: SectionProps) {
  const update = (id: string, partial: Partial<(typeof config.pools)[number]>) =>
    patch({ pools: config.pools.map((p) => (p.id === id ? { ...p, ...partial } : p)) });

  const lanAddresses = config.addresses.filter((a) => a.address.trim() && a.iface);

  return (
    <Panel
      id="pool"
      step="i"
      title="IP Pool"
      description="Kumpulan IP yang nanti dibagikan oleh DHCP Server, Hotspot, atau PPPoE."
      right={
        <Button size="sm" onClick={() => patch({ pools: [...config.pools, newPool()] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah Pool
        </Button>
      }
    >
      <div className="space-y-4">
        {config.pools.length === 0 && <EmptyState>Belum ada pool.</EmptyState>}
        {config.pools.map((pool, index) => (
          <Row
            key={pool.id}
            label={`Pool ${index + 1}`}
            onRemove={() => patch({ pools: config.pools.filter((p) => p.id !== pool.id) })}
          >
            <div className={grid3}>
              <Field label="Nama pool" required>
                <TextInput
                  mono
                  value={pool.name}
                  onChange={(name) => update(pool.id, { name })}
                  placeholder="pool-lan"
                />
              </Field>
              <Field label="IP awal" required>
                <TextInput
                  mono
                  value={pool.rangeStart}
                  onChange={(rangeStart) => update(pool.id, { rangeStart })}
                  placeholder="192.168.10.10"
                />
              </Field>
              <Field label="IP akhir" required>
                <TextInput
                  mono
                  value={pool.rangeEnd}
                  onChange={(rangeEnd) => update(pool.id, { rangeEnd })}
                  placeholder="192.168.10.254"
                />
              </Field>
            </div>
            {lanAddresses.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-faint">Isi otomatis dari:</span>
                {lanAddresses.map((addr) => (
                  <Button
                    key={addr.id}
                    size="sm"
                    onClick={() => {
                      const range = suggestPoolRange(addr.address);
                      update(pool.id, { rangeStart: range.start, rangeEnd: range.end });
                    }}
                  >
                    {addr.iface} ({addr.address})
                  </Button>
                ))}
              </div>
            )}
          </Row>
        ))}
      </div>
      <IssueList issues={issues} />
    </Panel>
  );
}

/* ----------------------------------------------------- j: DHCP Server */

export function DhcpSection({ config, patch, issues }: SectionProps) {
  const options = ifaceOptions(config, { skipEnslaved: true, skipWan: true });
  const pools = poolOptions(config);
  const update = (id: string, partial: Partial<(typeof config.dhcpServers)[number]>) =>
    patch({ dhcpServers: config.dhcpServers.map((d) => (d.id === id ? { ...d, ...partial } : d)) });

  return (
    <Panel
      id="dhcp"
      step="j"
      title="IP DHCP Server"
      description="Membagikan IP otomatis ke perangkat klien. Network dan gateway diisi otomatis dari IP address interface — tetap bisa diubah manual."
      right={
        <Button
          size="sm"
          disabled={pools.length === 0}
          title={pools.length === 0 ? "Buat IP Pool terlebih dahulu" : undefined}
          onClick={() => patch({ dhcpServers: [...config.dhcpServers, newDhcpServer()] })}
        >
          <Plus className="h-3.5 w-3.5" /> Tambah DHCP Server
        </Button>
      }
    >
      {pools.length === 0 && (
        <div className="mb-4">
          <Note>Buat minimal satu IP Pool di section (i) sebelum menambah DHCP Server.</Note>
        </div>
      )}
      <div className="space-y-4">
        {config.dhcpServers.length === 0 && <EmptyState>Belum ada DHCP Server.</EmptyState>}
        {config.dhcpServers.map((dhcp, index) => {
          const ifaceAddress = addressOfInterface(config, dhcp.iface);
          const autoNetwork = networkOf(ifaceAddress);
          const autoGateway = addressPart(ifaceAddress);
          return (
            <Row
              key={dhcp.id}
              label={`DHCP Server ${index + 1}`}
              onRemove={() =>
                patch({ dhcpServers: config.dhcpServers.filter((d) => d.id !== dhcp.id) })
              }
            >
              <div className={grid3}>
                <Field label="Nama" required>
                  <TextInput
                    mono
                    value={dhcp.name}
                    onChange={(name) => update(dhcp.id, { name })}
                    placeholder="dhcp-lan"
                  />
                </Field>
                <Field label="Interface" required>
                  <Select
                    value={dhcp.iface}
                    onChange={(iface) => update(dhcp.id, { iface })}
                    options={options}
                  />
                </Field>
                <Field label="Address pool" required>
                  <Select
                    value={dhcp.pool}
                    onChange={(pool) => update(dhcp.id, { pool })}
                    options={pools}
                  />
                </Field>
              </div>
              <div className={`mt-4 ${grid3}`}>
                <Field
                  label="Network"
                  hint={autoNetwork ? `Otomatis: ${autoNetwork}` : "Isi IP address interface dulu."}
                >
                  <TextInput
                    mono
                    value={dhcp.network}
                    onChange={(network) => update(dhcp.id, { network })}
                    placeholder={autoNetwork || "192.168.10.0/24"}
                  />
                </Field>
                <Field label="Gateway" hint={autoGateway ? `Otomatis: ${autoGateway}` : undefined}>
                  <TextInput
                    mono
                    value={dhcp.gateway}
                    onChange={(gateway) => update(dhcp.id, { gateway })}
                    placeholder={autoGateway || "192.168.10.1"}
                  />
                </Field>
                <Field label="Lease time">
                  <TextInput
                    mono
                    value={dhcp.leaseTime}
                    onChange={(leaseTime) => update(dhcp.id, { leaseTime })}
                    placeholder="1d"
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field
                  label="DNS untuk klien"
                  hint="Kosongkan untuk memakai IP router (bila allow-remote-requests aktif) atau DNS dari section DNS."
                >
                  <TextInput
                    mono
                    value={dhcp.dnsServers}
                    onChange={(dnsServers) => update(dhcp.id, { dnsServers })}
                    placeholder={autoGateway || "192.168.10.1"}
                  />
                </Field>
              </div>
            </Row>
          );
        })}
      </div>
      <IssueList issues={issues} />
    </Panel>
  );
}

/* -------------------------------------------------------- k: IP Hotspot */

const HOTSPOT_AUTH: Array<{ value: HotspotAuth; label: string }> = [
  { value: "http-pap", label: "http-pap" },
  { value: "http-chap", label: "http-chap" },
  { value: "mac-cookie", label: "mac-cookie" },
  { value: "cookie", label: "cookie" },
];

export function HotspotSection({ config, patch, issues }: SectionProps) {
  const options = ifaceOptions(config, { skipEnslaved: true, skipWan: true });
  const pools = poolOptions(config);
  const update = (id: string, partial: Partial<(typeof config.hotspots)[number]>) =>
    patch({ hotspots: config.hotspots.map((h) => (h.id === id ? { ...h, ...partial } : h)) });

  return (
    <Panel
      id="hotspot"
      step="k"
      title="IP Hotspot"
      optional
      description="Portal login untuk pengguna. Halaman login berupa file HTML sehingga diunduh terpisah dan di-upload ke folder hotspot pada File List router."
      right={
        <Button size="sm" onClick={() => patch({ hotspots: [...config.hotspots, newHotspot()] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah Hotspot
        </Button>
      }
    >
      <div className="space-y-4">
        {config.hotspots.length === 0 && <EmptyState>Belum ada hotspot.</EmptyState>}
        {config.hotspots.map((hs, index) => {
          const ifaceAddress = addressOfInterface(config, hs.iface);
          return (
            <Row
              key={hs.id}
              label={`Hotspot ${index + 1}`}
              onRemove={() => patch({ hotspots: config.hotspots.filter((h) => h.id !== hs.id) })}
            >
              <div className={grid3}>
                <Field label="Nama hotspot" required>
                  <TextInput
                    mono
                    value={hs.name}
                    onChange={(name) => update(hs.id, { name })}
                    placeholder="hotspot1"
                  />
                </Field>
                <Field label="Interface" required>
                  <Select
                    value={hs.iface}
                    onChange={(iface) => update(hs.id, { iface })}
                    options={options}
                  />
                </Field>
                <Field label="Address pool" required>
                  <Select
                    value={hs.pool}
                    onChange={(pool) => update(hs.id, { pool })}
                    options={pools}
                  />
                </Field>
              </div>
              <div className={`mt-4 ${grid2}`}>
                <Field
                  label="Network hotspot"
                  hint="Mengikuti IP address interface — tidak bisa diubah di sini."
                >
                  <TextInput
                    mono
                    disabled
                    value={ifaceAddress ? `${networkOf(ifaceAddress)} (router ${addressPart(ifaceAddress)})` : ""}
                    onChange={() => {}}
                    placeholder="pilih interface yang sudah punya IP"
                  />
                </Field>
                <Field label="DNS name" hint="Nama yang muncul di URL halaman login (opsional).">
                  <TextInput
                    mono
                    value={hs.dnsName}
                    onChange={(dnsName) => update(hs.id, { dnsName })}
                    placeholder="hotspot.lokal"
                  />
                </Field>
              </div>
              <div className="mt-4">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Metode autentikasi <span className="text-bad">*</span>
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {HOTSPOT_AUTH.map((auth) => (
                    <CheckPill
                      key={auth.value}
                      active={hs.auth.includes(auth.value)}
                      onClick={() =>
                        update(hs.id, {
                          auth: hs.auth.includes(auth.value)
                            ? hs.auth.filter((a) => a !== auth.value)
                            : [...hs.auth, auth.value],
                        })
                      }
                    >
                      {auth.label}
                    </CheckPill>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <Toggle
                  checked={hs.whatsappWalledGarden}
                  onChange={(whatsappWalledGarden) => update(hs.id, { whatsappWalledGarden })}
                  label="Walled-garden WhatsApp (wa.me)"
                  hint="Aktifkan bila halaman login punya tombol WhatsApp — supaya bisa dibuka sebelum klien login."
                />
              </div>
            </Row>
          );
        })}
      </div>
      {config.hotspots.length > 0 && (
        <div className="mt-4">
          <Note>
            Tampilan halaman login (template, warna, logo, paket voucher) diatur di menu
            terpisah — <span className="text-ink">Halaman Login Hotspot</span> — dari menu utama.
          </Note>
        </div>
      )}
      <IssueList issues={issues} />
    </Panel>
  );
}

/* ------------------------------------------------------ l: PPPoE Server */

export function PppoeSection({ config, patch, issues }: SectionProps) {
  const p = config.pppoe;
  const options = ifaceOptions(config, { skipEnslaved: true, skipWan: true });
  const pools = poolOptions(config);
  const setPppoe = (partial: Partial<typeof p>) => patch({ pppoe: { ...p, ...partial } });

  const updateProfile = (id: string, partial: Partial<(typeof p.profiles)[number]>) =>
    setPppoe({ profiles: p.profiles.map((x) => (x.id === id ? { ...x, ...partial } : x)) });

  // Profile bawaan RouterOS selalu tersedia, ditambah paket buatan pengguna.
  const profileOptions = [
    { value: DEFAULT_PPP_PROFILE, label: `${DEFAULT_PPP_PROFILE} — bawaan RouterOS` },
    ...p.profiles
      .filter((prof) => prof.name.trim())
      .map((prof) => ({ value: prof.name.trim(), label: prof.name.trim() })),
  ];

  return (
    <Panel
      id="pppoe"
      step="l"
      title="PPPoE Server"
      optional
      description="Layanan dial-up PPPoE untuk pelanggan — tiap klien login dengan username & password sendiri."
    >
      <Toggle
        checked={p.enabled}
        onChange={(enabled) => setPppoe({ enabled })}
        label="Aktifkan PPPoE Server"
      />

      {p.enabled && (
        <div className="mt-4 space-y-4">
          <div className={grid3}>
            <Field label="Interface" required hint="Interface tempat PPPoE server mendengarkan.">
              <Select value={p.iface} onChange={(iface) => setPppoe({ iface })} options={options} />
            </Field>
            <Field label="Service name" required>
              <TextInput
                mono
                value={p.serviceName}
                onChange={(serviceName) => setPppoe({ serviceName })}
                placeholder="pppoe-service"
              />
            </Field>
            <Field
              label="Default profile"
              hint="Dipakai klien yang tidak diberi paket sendiri."
            >
              <Select
                value={p.defaultProfile}
                placeholder=""
                onChange={(defaultProfile) => setPppoe({ defaultProfile })}
                options={profileOptions}
              />
            </Field>
          </div>

          <Toggle
            checked={p.oneSessionPerHost}
            onChange={(oneSessionPerHost) => setPppoe({ oneSessionPerHost })}
            label="One session per host"
            hint="Satu akun hanya bisa dipakai satu sesi dalam waktu bersamaan."
          />

          {/* Paket layanan */}
          <div className="rounded-xl border border-line-soft bg-raised/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-brand/80">
                Paket layanan (PPP profile)
              </span>
              <Button
                size="sm"
                onClick={() => setPppoe({ profiles: [...p.profiles, newPppoeProfile()] })}
              >
                <Plus className="h-3.5 w-3.5" /> Tambah paket
              </Button>
            </div>

            {p.profiles.length === 0 ? (
              <EmptyState>
                Belum ada paket — memakai profile <span className="font-mono">default</span> bawaan
                RouterOS. Tambahkan paket bila ingin membedakan kecepatan antar pelanggan.
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {p.profiles.map((prof, index) => (
                  <Row
                    key={prof.id}
                    label={prof.name.trim() || `Paket ${index + 1}`}
                    onRemove={() =>
                      setPppoe({ profiles: p.profiles.filter((x) => x.id !== prof.id) })
                    }
                  >
                    <div className={grid3}>
                      <Field label="Nama paket" required>
                        <TextInput
                          mono
                          value={prof.name}
                          onChange={(name) => updateProfile(prof.id, { name })}
                          placeholder="paket-10mbps"
                        />
                      </Field>
                      <Field
                        label="Rate limit"
                        hint='Format "upload/download", misal 5M/10M.'
                      >
                        <TextInput
                          mono
                          value={prof.rateLimit}
                          onChange={(rateLimit) => updateProfile(prof.id, { rateLimit })}
                          placeholder="5M/10M"
                        />
                      </Field>
                      <Field label="IP Pool (remote address)" hint="Kosong = ikut bawaan RouterOS.">
                        <Select
                          value={prof.pool}
                          placeholder="— bawaan —"
                          onChange={(pool) => updateProfile(prof.id, { pool })}
                          options={pools}
                        />
                      </Field>
                    </div>
                    <div className={`mt-4 ${grid2}`}>
                      <Field
                        label="Local address"
                        hint="IP router pada sisi PPPoE. Kosong = ikut bawaan RouterOS."
                      >
                        <TextInput
                          mono
                          value={prof.localAddress}
                          onChange={(localAddress) => updateProfile(prof.id, { localAddress })}
                          placeholder="10.10.10.1"
                        />
                      </Field>
                      <Toggle
                        checked={prof.onlyOne}
                        onChange={(onlyOne) => updateProfile(prof.id, { onlyOne })}
                        label="Only one"
                        hint="Satu akun paket ini hanya boleh satu sesi aktif."
                      />
                    </div>
                  </Row>
                ))}
              </div>
            )}
          </div>

          {/* Akun pelanggan */}
          <div className="rounded-xl border border-line-soft bg-raised/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wide text-brand/80">
                Akun pelanggan (PPP secret)
              </span>
              <Button size="sm" onClick={() => setPppoe({ secrets: [...p.secrets, newSecret()] })}>
                <Plus className="h-3.5 w-3.5" /> Tambah user
              </Button>
            </div>
            {p.secrets.length === 0 ? (
              <EmptyState>Belum ada akun. Bisa juga ditambahkan manual di router nanti.</EmptyState>
            ) : (
              <div className="space-y-3">
                {p.secrets.map((secret, index) => (
                  <div key={secret.id} className="flex items-end gap-2">
                    <Field label={index === 0 ? "Username" : ""} className="flex-1">
                      <TextInput
                        mono
                        value={secret.user}
                        onChange={(user) =>
                          setPppoe({
                            secrets: p.secrets.map((s) => (s.id === secret.id ? { ...s, user } : s)),
                          })
                        }
                        placeholder="pelanggan01"
                      />
                    </Field>
                    <Field label={index === 0 ? "Password" : ""} className="flex-1">
                      <TextInput
                        mono
                        value={secret.password}
                        onChange={(password) =>
                          setPppoe({
                            secrets: p.secrets.map((s) =>
                              s.id === secret.id ? { ...s, password } : s,
                            ),
                          })
                        }
                        placeholder="password"
                      />
                    </Field>
                    <Field label={index === 0 ? "Paket" : ""} className="flex-1">
                      <Select
                        value={secret.profile}
                        placeholder=""
                        onChange={(profile) =>
                          setPppoe({
                            secrets: p.secrets.map((s) =>
                              s.id === secret.id ? { ...s, profile } : s,
                            ),
                          })
                        }
                        options={profileOptions}
                      />
                    </Field>
                    <Button
                      variant="danger"
                      className="mb-0.5 px-3"
                      title={`Hapus user ${index + 1}`}
                      ariaLabel={`Hapus user ${index + 1}`}
                      onClick={() =>
                        setPppoe({ secrets: p.secrets.filter((s) => s.id !== secret.id) })
                      }
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <IssueList issues={issues} />
    </Panel>
  );
}

/* --------------------------------------------------------- m: Firewall */

export function FirewallSection({ config, patch, issues }: SectionProps) {
  const fw = config.firewall;
  const setFw = (partial: Partial<typeof fw>) => patch({ firewall: { ...fw, ...partial } });
  const anti = config.antiTethering;
  const setAnti = (partial: Partial<typeof anti>) =>
    patch({ antiTethering: { ...anti, ...partial } });
  const wanIfaces = new Set(config.wans.map((w) => w.iface).filter(Boolean));
  // Port yang sudah jadi member bridge dilewati: trafik klien keluar lewat
  // bridge-nya, jadi aturan di port anggota tidak pernah tersentuh.
  const clientIfaces = ifaceOptions(config, { skipEnslaved: true }).filter((i) => !i.disabled);
  const lanCandidates = config.addresses
    .filter((a) => a.address.trim())
    .map((a) => networkOf(a.address))
    .filter(Boolean);

  return (
    <Panel
      id="firewall"
      step="m"
      title="Firewall Dasar & Anti Tethering"
      description="Rule standar agar router tidak terbuka dari internet, ditambah pembatasan TTL agar satu akun tidak bisa dibagikan ulang. Keduanya bisa dipakai terpisah."
    >
      <Toggle
        checked={fw.enabled}
        onChange={(enabled) => setFw({ enabled })}
        label="Sertakan firewall dasar"
      />

      {!fw.enabled && (
        <div className="mt-4">
          <Note tone="warn">
            Firewall tidak disertakan. Router akan bisa diakses dari internet dan paket tidak valid
            tidak dibuang. Aktifkan bila router ini terhubung langsung ke ISP, atau pastikan
            proteksi sudah ditangani perangkat lain di depannya.
          </Note>
        </div>
      )}

      {fw.enabled && (
        <div className="mt-4 space-y-3">
          <div className={grid2}>
            <Toggle
              checked={fw.dropInvalid}
              onChange={(dropInvalid) => setFw({ dropInvalid })}
              label="Buang paket invalid"
              hint="Drop connection-state=invalid pada chain input & forward."
            />
            <Toggle
              checked={fw.allowIcmp}
              onChange={(allowIcmp) => setFw({ allowIcmp })}
              label="Izinkan ping ke router"
              hint="Berguna untuk troubleshooting dan monitoring."
            />
            <Toggle
              checked={fw.protectInput}
              onChange={(protectInput) => setFw({ protectInput })}
              label="Tutup akses router dari internet"
              hint="Terima akses hanya dari interface-list LAN, tolak dari WAN."
            />
            <Toggle
              checked={fw.fasttrack}
              onChange={(fasttrack) => setFw({ fasttrack })}
              label="Aktifkan FastTrack"
              hint="Mempercepat forwarding, tetapi trafik ber-FastTrack tidak terhitung di queue/mangle."
            />
            <Toggle
              checked={fw.disableUnusedServices}
              onChange={(disableUnusedServices) => setFw({ disableUnusedServices })}
              label="Matikan telnet, ftp, api, api-ssl"
              hint="Layanan yang jarang dipakai dan sering jadi target brute force."
            />
            <Toggle
              checked={fw.restrictServices}
              onChange={(restrictServices) => setFw({ restrictServices })}
              label="Batasi Winbox/SSH/WebFig ke subnet manajemen"
            />
            <Toggle
              checked={fw.limitDiscovery}
              onChange={(limitDiscovery) => setFw({ limitDiscovery })}
              label="Batasi neighbor discovery ke LAN"
              hint="Router tidak terlihat oleh scanner dari sisi internet."
            />
            <Toggle
              checked={fw.limitMacServer}
              onChange={(limitMacServer) => setFw({ limitMacServer })}
              label="Batasi MAC-Winbox & MAC-Telnet ke LAN"
            />
          </div>

          {fw.restrictServices && (
            <div className="pt-1">
              <Field
                label="Subnet manajemen"
                hint="Hanya dari subnet ini Winbox/SSH/WebFig bisa diakses. Kosongkan agar tidak dibatasi."
              >
                <TextInput
                  mono
                  value={fw.mgmtSubnet}
                  onChange={(mgmtSubnet) => setFw({ mgmtSubnet })}
                  placeholder="192.168.10.0/24"
                />
              </Field>
              {lanCandidates.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-faint">Saran:</span>
                  {[...new Set(lanCandidates)].map((net) => (
                    <Button key={net} size="sm" onClick={() => setFw({ mgmtSubnet: net })}>
                      {net}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Note tone="warn">
            Pastikan Anda masih bisa mengakses router setelah script dijalankan. Jika mengatur subnet
            manajemen, jalankan script dari perangkat di dalam subnet tersebut.
          </Note>
        </div>
      )}

      {/* Blok terpisah: berguna sendiri, jadi tidak ikut mati saat firewall
          dasar dimatikan. */}
      <div className="mt-6 border-t border-line-soft pt-5">
        <Toggle
          checked={anti.enabled}
          onChange={(enabled) => setAnti({ enabled })}
          label="Anti tethering (ubah TTL)"
          hint="Satu akun tidak bisa dibagikan ulang lewat tethering HP atau repeater."
        />

        {anti.enabled && (
          <div className="mt-4 space-y-4">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Interface arah klien <span className="text-bad">*</span>
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {clientIfaces.map((iface) => {
                  const isWan = wanIfaces.has(iface.value);
                  const active = anti.interfaces.includes(iface.value);
                  return (
                    <CheckPill
                      key={iface.value}
                      active={active}
                      disabled={isWan}
                      onClick={() =>
                        setAnti({
                          interfaces: active
                            ? anti.interfaces.filter((i) => i !== iface.value)
                            : [...anti.interfaces, iface.value],
                        })
                      }
                    >
                      {iface.value}
                    </CheckPill>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-faint">
                Pilih bridge atau interface tempat klien berada — bukan interface ke ISP.
              </p>
            </div>

            <Field
              label="Nilai TTL"
              hint={
                anti.ttl === "1"
                  ? "Paling ketat. Pelanggan yang memakai router sendiri ikut terputus."
                  : "Menyisakan satu lompatan: router pelanggan tetap jalan, perangkat di belakangnya tidak bisa tethering lagi."
              }
            >
              <Select
                value={anti.ttl}
                placeholder=""
                onChange={(ttl) => setAnti({ ttl: ttl === "2" ? "2" : "1" })}
                options={[
                  { value: "1", label: "1 — blokir semua pembagian ulang" },
                  { value: "2", label: "2 — izinkan satu router pelanggan" },
                ]}
              />
            </Field>

            {fw.enabled && fw.fasttrack && (
              <Note tone="warn">
                FastTrack masih aktif. Koneksi yang sudah ter-FastTrack melewati mangle, jadi anti
                tethering tidak akan berlaku untuk koneksi tersebut — matikan FastTrack di atas bila
                aturan ini harus rapat.
              </Note>
            )}
          </div>
        )}
      </div>

      <IssueList issues={issues} />
    </Panel>
  );
}

/* ------------------------------------------------------- n: User Mikrotik */

const USER_GROUPS: Array<{ value: UserGroup; label: string }> = [
  { value: "full", label: "full — akses penuh (setara admin)" },
  { value: "write", label: "write — boleh ubah konfigurasi, tanpa kelola user" },
  { value: "read", label: "read — hanya melihat, tidak bisa mengubah" },
];

export function UserSection({ config, patch, issues }: SectionProps) {
  const password = checkPassword(config.system.adminPassword);
  const strengthColor = ["bg-bad", "bg-bad", "bg-warn", "bg-accent", "bg-accent"][password.score];

  const update = (id: string, partial: Partial<(typeof config.users)[number]>) =>
    patch({ users: config.users.map((u) => (u.id === id ? { ...u, ...partial } : u)) });

  return (
    <Panel
      id="user"
      step="n"
      title="User Mikrotik"
      description="Password admin dan penambahan user. Blok ini diletakkan paling akhir di script agar akses ke router tidak terputus bila ada perintah sebelumnya yang gagal."
      right={
        <Button size="sm" onClick={() => patch({ users: [...config.users, newUser()] })}>
          <Plus className="h-3.5 w-3.5" /> Tambah User
        </Button>
      }
    >
      <div className="rounded-xl border border-line-soft bg-raised/50 p-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
          Password admin
        </span>
        <div className={`mt-3.5 ${grid2}`}>
          <Field label="User admin" hint="User bawaan yang password-nya akan diganti.">
            <TextInput
              mono
              value={config.system.adminUser}
              onChange={(adminUser) => patch({ system: { ...config.system, adminUser } })}
              placeholder="admin"
            />
          </Field>
          <Field
            label="Password admin baru"
            hint={
              config.system.adminPassword
                ? `${password.label}${password.problems.length ? ` — perlu ${password.problems.join(", ")}` : ""}`
                : "Kosongkan jika password diatur manual nanti (tidak disarankan)."
            }
          >
            <TextInput
              type="password"
              value={config.system.adminPassword}
              onChange={(adminPassword) => patch({ system: { ...config.system, adminPassword } })}
              placeholder="minimal 8 karakter, huruf besar-kecil, angka, simbol"
            />
          </Field>
        </div>
        {config.system.adminPassword && (
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full transition-all ${strengthColor}`}
              style={{ width: `${(password.score / 4) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {config.users.length === 0 ? (
          <EmptyState>
            Belum ada user tambahan. Router tetap bisa dipakai dengan user admin saja.
          </EmptyState>
        ) : (
          config.users.map((user, index) => {
            const strength = checkPassword(user.password);
            return (
              <Row
                key={user.id}
                label={`User ${index + 1}`}
                onRemove={() => patch({ users: config.users.filter((u) => u.id !== user.id) })}
              >
                <div className={grid3}>
                  <Field label="Nama user" required>
                    <TextInput
                      mono
                      value={user.name}
                      onChange={(name) => update(user.id, { name })}
                      placeholder="teknisi"
                    />
                  </Field>
                  <Field
                    label="Password"
                    required
                    hint={
                      user.password
                        ? `${strength.label}${strength.problems.length ? ` — perlu ${strength.problems.join(", ")}` : ""}`
                        : undefined
                    }
                  >
                    <TextInput
                      type="password"
                      value={user.password}
                      onChange={(password) => update(user.id, { password })}
                      placeholder="password kuat"
                    />
                  </Field>
                  <Field label="Group">
                    <Select
                      value={user.group}
                      placeholder=""
                      onChange={(group) => update(user.id, { group: group as UserGroup })}
                      options={USER_GROUPS}
                    />
                  </Field>
                </div>
                <div className={`mt-4 ${grid2}`}>
                  <Field
                    label="Batasi login dari subnet"
                    hint="Opsional. Kosongkan agar user bisa login dari mana saja."
                  >
                    <TextInput
                      mono
                      value={user.allowedAddress}
                      onChange={(allowedAddress) => update(user.id, { allowedAddress })}
                      placeholder="192.168.10.0/24"
                    />
                  </Field>
                  <Field label="Keterangan">
                    <TextInput
                      value={user.comment}
                      onChange={(comment) => update(user.id, { comment })}
                      placeholder="teknisi lapangan"
                    />
                  </Field>
                </div>
              </Row>
            );
          })
        )}
      </div>

      {config.users.length > 0 && (
        <div className="mt-4">
          <Note>
            User baru dibuat lebih dulu, baru password admin diganti — jadi tetap ada jalan masuk
            bila password admin terlupa.
          </Note>
        </div>
      )}
      <IssueList issues={issues} />
    </Panel>
  );
}
