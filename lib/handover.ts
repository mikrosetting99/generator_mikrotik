import { allInterfaces, physicalInterfaces } from "./interfaces";
import { getModel } from "./models";
import { addressPart, networkOf } from "./net";
import type { SetupConfig } from "./types";

/**
 * Berita Acara Serah Terima dalam bentuk satu berkas HTML mandiri.
 *
 * Sengaja tidak memakai pustaka PDF: dokumen ini biasanya ditandatangani di
 * atas kertas, jadi keluaran cetak justru yang utama. Dialog cetak browser
 * sekaligus menyediakan "Simpan sebagai PDF" dengan teks yang tetap tajam —
 * bukan gambar seperti hasil render kanvas.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Teks bebas dari textarea: baris baru dipertahankan. */
function escMultiline(value: string): string {
  return esc(value).replace(/\r?\n/g, "<br>");
}

function formatDate(iso: string): string {
  const date = iso ? new Date(`${iso}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

const DASH = "—";

function row(label: string, value: string): string {
  return `<tr><th>${esc(label)}</th><td>${value.trim() ? esc(value) : DASH}</td></tr>`;
}

/** Peran tiap port fisik, supaya teknisi tahu kabel mana masuk ke mana. */
export interface PortRole {
  iface: string;
  role: string;
  detail: string;
}

export function portRoles(config: SetupConfig): PortRole[] {
  const bridgeOf = new Map<string, string>();
  for (const bridge of config.bridges) {
    for (const port of bridge.ports) bridgeOf.set(port, bridge.name.trim());
  }

  return physicalInterfaces(config).map((iface) => {
    const wan = config.wans.find((w) => w.iface === iface);
    if (wan) {
      const detail =
        wan.mode === "dhcp"
          ? "IP otomatis dari ISP"
          : `${wan.address} · gateway ${wan.gateway}`;
      return { iface, role: "WAN — ke ISP", detail: wan.comment.trim() || detail };
    }

    const bridge = bridgeOf.get(iface);
    if (bridge) {
      const address = config.addresses.find((a) => a.iface === bridge);
      return {
        iface,
        role: `Anggota ${bridge}`,
        detail: address ? `segmen ${networkOf(address.address) || address.address}` : "",
      };
    }

    const address = config.addresses.find((a) => a.iface === iface);
    if (address) return { iface, role: "LAN", detail: address.address };

    return { iface, role: "Tidak dipakai", detail: "" };
  });
}

/** Ringkasan tiap segmen jaringan beserta layanan yang berjalan di atasnya. */
function segmentRows(config: SetupConfig): string {
  const rows = config.addresses
    .filter((a) => a.iface && a.address.trim())
    .map((address) => {
      const dhcp = config.dhcpServers.find((d) => d.iface === address.iface);
      const pool = dhcp ? config.pools.find((p) => p.name.trim() === dhcp.pool) : undefined;
      const hotspot = config.hotspots.find((h) => h.iface === address.iface);
      const services: string[] = [];
      if (dhcp) {
        services.push(
          pool
            ? `DHCP ${pool.rangeStart}–${pool.rangeEnd}`
            : "DHCP",
        );
      }
      if (hotspot) services.push(`Hotspot "${hotspot.name.trim()}"`);
      if (config.pppoe.enabled && config.pppoe.iface === address.iface) services.push("PPPoE Server");

      return `<tr>
        <td>${esc(address.iface)}</td>
        <td>${esc(address.address.trim())}</td>
        <td>${esc(address.comment.trim() || DASH)}</td>
        <td>${services.length ? esc(services.join(", ")) : DASH}</td>
      </tr>`;
    });

  if (rows.length === 0) return `<tr><td colspan="4">${DASH}</td></tr>`;
  return rows.join("");
}

function servicesSection(config: SetupConfig): string {
  const blocks: string[] = [];

  if (config.hotspots.length > 0) {
    const rows = config.hotspots
      .map((hs) => {
        const address = config.addresses.find((a) => a.iface === hs.iface);
        return `<tr>
          <td>${esc(hs.name.trim())}</td>
          <td>${esc(hs.iface)}</td>
          <td>${esc(address ? addressPart(address.address) : DASH)}</td>
          <td>${esc(hs.dnsName.trim() || DASH)}</td>
        </tr>`;
      })
      .join("");
    blocks.push(`<h2>Layanan Hotspot</h2>
      <table class="grid">
        <tr><th>Nama</th><th>Interface</th><th>Alamat portal</th><th>DNS name</th></tr>
        ${rows}
      </table>
      <p class="hint">Akun pengguna hotspot dibuat terpisah melalui menu IP &rsaquo; Hotspot &rsaquo; Users.</p>`);
  }

  if (config.pppoe.enabled) {
    const profiles = config.pppoe.profiles.filter((p) => p.name.trim());
    const profileRows = profiles.length
      ? profiles
          .map(
            (p) => `<tr>
              <td>${esc(p.name.trim())}</td>
              <td>${esc(p.rateLimit.trim() || "tanpa batas")}</td>
              <td>${esc(p.pool || "bawaan RouterOS")}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="3">Memakai profile bawaan RouterOS</td></tr>`;

    blocks.push(`<h2>Layanan PPPoE</h2>
      <table class="info">
        ${row("Service name", config.pppoe.serviceName)}
        ${row("Interface", config.pppoe.iface)}
        ${row("Profile bawaan", config.pppoe.defaultProfile)}
      </table>
      <table class="grid">
        <tr><th>Paket</th><th>Kecepatan</th><th>IP Pool</th></tr>
        ${profileRows}
      </table>`);
  }

  return blocks.join("\n");
}

function credentialsSection(config: SetupConfig): string {
  if (!config.handover.includeCredentials) {
    return `<h2>Akses Perangkat</h2>
      <p class="hint">Kredensial tidak dicantumkan di dokumen ini dan diserahkan terpisah.</p>`;
  }

  const rows = [
    row("User admin", config.system.adminUser),
    row("Password admin", config.system.adminPassword || "(tidak diubah)"),
    ...config.users
      .filter((u) => u.name.trim())
      .map((u) => row(`User ${u.name.trim()} (${u.group})`, u.password || DASH)),
  ].join("");

  const pppoeRows = config.pppoe.enabled
    ? config.pppoe.secrets
        .filter((s) => s.user.trim())
        .map(
          (s) => `<tr>
            <td>${esc(s.user.trim())}</td>
            <td>${esc(s.password || DASH)}</td>
            <td>${esc(s.profile)}</td>
          </tr>`,
        )
        .join("")
    : "";

  return `<h2>Akses Perangkat</h2>
    <table class="info">${rows}</table>
    ${
      pppoeRows
        ? `<h3>Akun PPPoE pelanggan</h3>
           <table class="grid">
             <tr><th>Username</th><th>Password</th><th>Paket</th></tr>
             ${pppoeRows}
           </table>`
        : ""
    }
    <p class="warn">Simpan dokumen ini di tempat aman — berisi kata sandi perangkat.</p>`;
}

/** Menyusun seluruh dokumen BAST sebagai satu berkas HTML siap cetak. */
export function buildHandoverDocument(config: SetupConfig): string {
  const h = config.handover;
  const model = getModel(config.modelId);
  const company = h.companyName.trim() || "Mikrosetting.com";

  const wanRows = config.wans
    .filter((w) => w.iface)
    .map(
      (w) => `<tr>
        <td>${esc(w.iface)}</td>
        <td>${esc(w.mode === "dhcp" ? "DHCP Client" : "Static")}</td>
        <td>${esc(w.mode === "dhcp" ? "otomatis dari ISP" : `${w.address} · gw ${w.gateway}`)}</td>
        <td>${esc(w.comment.trim() || DASH)}</td>
      </tr>`,
    )
    .join("");

  const portRows = portRoles(config)
    .map(
      (p) => `<tr>
        <td>${esc(p.iface)}</td>
        <td>${esc(p.role)}</td>
        <td>${esc(p.detail || DASH)}</td>
      </tr>`,
    )
    .join("");

  const vlanRows = config.vlans
    .filter((v) => v.name.trim())
    .map(
      (v) => `<tr><td>${esc(v.name.trim())}</td><td>${esc(v.vlanId)}</td><td>${esc(v.parent)}</td></tr>`,
    )
    .join("");

  const dnsServers = config.dns.servers.map((s) => s.trim()).filter(Boolean);
  const interfaceCount = allInterfaces(config).length;

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>BAST ${esc(h.customerName.trim() || "Pelanggan")}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: #fff;
    color: #111827;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
  }

  .sheet { max-width: 190mm; margin: 0 auto; padding: 10mm 0; }

  header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 18px; }
  .company { font-size: 13pt; font-weight: 700; letter-spacing: .01em; }
  .doctype { margin-top: 2px; font-size: 9pt; color: #4b5563; text-transform: uppercase; letter-spacing: .14em; }

  h1 { font-size: 15pt; text-align: center; margin: 22px 0 4px; letter-spacing: .01em; }
  .docnum { text-align: center; font-size: 9.5pt; color: #4b5563; margin-bottom: 20px; }

  h2 {
    font-size: 11pt;
    margin: 20px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #d1d5db;
  }
  h3 { font-size: 10pt; margin: 14px 0 6px; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }

  table.info th {
    width: 34%;
    text-align: left;
    font-weight: 600;
    color: #374151;
    padding: 4px 8px 4px 0;
    vertical-align: top;
  }
  table.info td { padding: 4px 0; vertical-align: top; }

  table.grid { border: 1px solid #9ca3af; margin-top: 4px; }
  table.grid th, table.grid td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; }
  table.grid th { background: #f3f4f6; font-weight: 600; }

  .two { display: flex; gap: 20px; }
  .two > * { flex: 1; }

  .hint { font-size: 9pt; color: #4b5563; margin: 4px 0 0; }
  .warn {
    font-size: 9pt;
    margin-top: 8px;
    padding: 6px 9px;
    border: 1px solid #d1d5db;
    border-left: 3px solid #6b7280;
    background: #f9fafb;
  }

  .notes { white-space: normal; }

  /* Blok tanda tangan tidak boleh terpotong antar halaman. */
  .sign { margin-top: 30px; page-break-inside: avoid; }
  .sign table { width: 100%; }
  .sign td { width: 50%; text-align: center; vertical-align: top; padding-top: 6px; }
  .sign .space { height: 68px; }
  .sign .name { border-top: 1px solid #111827; padding-top: 5px; font-weight: 600; }
  .sign .role { font-size: 9pt; color: #4b5563; }

  footer {
    margin-top: 26px;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    font-size: 8.5pt;
    color: #6b7280;
    display: flex;
    justify-content: space-between;
  }

  h2, h3 { page-break-after: avoid; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }

  @media screen {
    body { background: #e5e7eb; padding: 20px; }
    .sheet { background: #fff; padding: 16mm 14mm; box-shadow: 0 2px 12px rgba(0,0,0,.15); }
  }
</style>
</head>
<body>
<div class="sheet">

  <header>
    <div class="company">${esc(company)}</div>
    <div class="doctype">Dokumen Serah Terima Pekerjaan</div>
  </header>

  <h1>BERITA ACARA SERAH TERIMA</h1>
  <div class="docnum">
    ${h.docNumber.trim() ? `Nomor: ${esc(h.docNumber.trim())} &middot; ` : ""}${formatDate(h.date)}
  </div>

  <p>
    Pada hari ini telah dilaksanakan serah terima hasil pekerjaan konfigurasi perangkat
    jaringan MikroTik dengan rincian sebagai berikut.
  </p>

  <div class="two">
    <div>
      <h2>Pelanggan</h2>
      <table class="info">
        ${row("Nama", h.customerName)}
        ${row("Alamat", h.customerAddress)}
        ${row("Telepon", h.customerPhone)}
      </table>
    </div>
    <div>
      <h2>Pelaksana</h2>
      <table class="info">
        ${row("Perusahaan", company)}
        ${row("Teknisi", h.technicianName)}
        ${row("Tanggal", formatDate(h.date))}
      </table>
    </div>
  </div>

  <h2>Perangkat</h2>
  <table class="info">
    ${row("Model", model ? model.name : DASH)}
    ${row("Arsitektur", model && model.arch !== "-" ? model.arch : DASH)}
    ${row("RouterOS", config.ros ? config.ros : DASH)}
    ${row("Nomor seri", h.serialNumber)}
    ${row("System identity", config.system.identity)}
    ${row("Jumlah interface", String(interfaceCount))}
  </table>

  <h2>Koneksi Internet (WAN)</h2>
  <table class="grid">
    <tr><th>Interface</th><th>Mode</th><th>Alamat</th><th>Keterangan</th></tr>
    ${wanRows || `<tr><td colspan="4">${DASH}</td></tr>`}
  </table>

  <h2>Segmen Jaringan</h2>
  <table class="grid">
    <tr><th>Interface</th><th>IP Router</th><th>Keterangan</th><th>Layanan</th></tr>
    ${segmentRows(config)}
  </table>
  ${
    dnsServers.length
      ? `<p class="hint">DNS server: ${esc(dnsServers.join(", "))}${
          config.dns.allowRemoteRequests ? " — router juga melayani DNS untuk klien." : "."
        }</p>`
      : ""
  }

  ${
    vlanRows
      ? `<h2>VLAN</h2>
         <table class="grid">
           <tr><th>Nama</th><th>VLAN ID</th><th>Interface induk</th></tr>
           ${vlanRows}
         </table>`
      : ""
  }

  <h2>Penggunaan Port</h2>
  <table class="grid">
    <tr><th>Port</th><th>Fungsi</th><th>Keterangan</th></tr>
    ${portRows || `<tr><td colspan="3">${DASH}</td></tr>`}
  </table>

  ${servicesSection(config)}

  ${credentialsSection(config)}

  <h2>Lingkup Pekerjaan</h2>
  <div class="notes">${escMultiline(h.scope.trim() || DASH)}</div>

  ${h.notes.trim() ? `<h2>Catatan</h2><div class="notes">${escMultiline(h.notes.trim())}</div>` : ""}

  <h2>Pernyataan</h2>
  <p>
    Pelanggan menyatakan telah menerima hasil pekerjaan di atas dalam keadaan berfungsi
    dengan baik, serta telah menerima penjelasan mengenai cara penggunaannya.
  </p>

  <div class="sign">
    <table>
      <tr>
        <td class="role">Diserahkan oleh,</td>
        <td class="role">Diterima oleh,</td>
      </tr>
      <tr><td class="space"></td><td class="space"></td></tr>
      <tr>
        <td><div class="name">${esc(h.technicianName.trim() || "( ....................... )")}</div>
          <div class="role">Teknisi &middot; ${esc(company)}</div></td>
        <td><div class="name">${esc(h.customerName.trim() || "( ....................... )")}</div>
          <div class="role">Pelanggan</div></td>
      </tr>
    </table>
  </div>

  <footer>
    <span>Dibuat dengan Generator Script Mikrotik by Mikrosetting.com</span>
    <span>${formatDate(h.date)}</span>
  </footer>

</div>
</body>
</html>
`;
}
