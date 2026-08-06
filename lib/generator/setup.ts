import { addressOfInterface, lanInterfaces } from "../interfaces";
import { getModel } from "../models";
import { addressPart, isCidr, networkOf } from "../net";
import type { SetupConfig } from "../types";
import { args, raw, ScriptBuilder } from "./script-builder";

const WAN_LIST = "WAN";
const LAN_LIST = "LAN";

/** Penanda pembuat yang ikut di setiap comment agar mudah dikenali di Winbox. */
const BRAND = "By Mikrosetting";

/**
 * Menyusun isi comment= milik objek RouterOS.
 * Teks pengguna tetap di depan, penanda pembuat ditambahkan di belakang.
 */
function tag(text?: string): string {
  const clean = (text ?? "").trim();
  return clean ? `${clean} - ${BRAND}` : BRAND;
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Interface yang perlu masuk interface-list LAN. */
function lanListMembers(config: SetupConfig): string[] {
  const members = new Set<string>(lanInterfaces(config));
  for (const bridge of config.bridges) if (bridge.name.trim()) members.add(bridge.name.trim());
  for (const vlan of config.vlans) if (vlan.name.trim()) members.add(vlan.name.trim());
  for (const wan of config.wans) members.delete(wan.iface);
  return [...members];
}

export function generateSetupScript(config: SetupConfig): string {
  const s = new ScriptBuilder();
  const model = getModel(config.modelId);
  const v7 = config.ros === "v7";
  const wans = config.wans.filter((w) => w.iface);
  const wanIfaces = wans.map((w) => w.iface);
  const lanMembers = lanListMembers(config);
  const needsInterfaceList =
    config.firewall.enabled || (config.nat.enabled && config.nat.mode === "global");

  // ---------------------------------------------------------------- header
  s.banner([
    "SCRIPT SETUP MIKROTIK BARU",
    "Generator Script Mikrotik by Mikrosetting.com",
    "",
    `Perangkat  : ${model ? model.name : "(belum dipilih)"}${model && model.arch !== "-" ? ` [${model.arch}]` : ""}`,
    `RouterOS   : ${config.ros ? config.ros : "(belum dipilih)"}`,
    `Dibuat     : ${stamp()}`,
    "",
    "PERINGATAN",
    "Script ini menambah konfigurasi baru ke router. Jalankan pada router",
    "kondisi default/reset. Jika router sudah terkonfigurasi, backup dulu:",
    "  /system backup save name=sebelum-setup",
    "  /export file=sebelum-setup",
    "",
    "Cara pakai: buka Winbox/WebFig > New Terminal, lalu paste seluruh isi",
    "script ini sekaligus dan tekan Enter.",
  ]);

  if (model?.note) {
    s.blank().comment(`Catatan perangkat: ${model.note}`);
  }
  if (needsInterfaceList) {
    s.blank().comment(
      "Script memakai interface-list (butuh RouterOS 6.41 ke atas atau v7).",
    );
  }

  // -------------------------------------------------------------- identitas
  const sys = config.system;
  if (sys.identity || sys.adminPassword || sys.timezone || sys.ntp) {
    s.section("1. IDENTITAS ROUTER, JAM & PASSWORD ADMIN");
    if (sys.identity) {
      s.line(`/system identity set ${args([["name", sys.identity]])}`);
    }
    if (sys.timezone) {
      s.line(`/system clock set ${args([["time-zone-name", sys.timezone]])}`);
    }
    if (sys.ntp) {
      s.comment("Sinkron jam otomatis — penting agar log & sertifikat akurat.");
      // v6 memakai server-dns-names, v7 menyatukannya di properti servers.
      s.line(
        v7
          ? "/system ntp client set enabled=yes servers=id.pool.ntp.org,pool.ntp.org"
          : "/system ntp client set enabled=yes server-dns-names=id.pool.ntp.org,pool.ntp.org",
      );
    }
    if (sys.adminPassword) {
      s.comment("Ganti password user admin. Simpan password ini baik-baik!");
      s.line(
        `/user set [find name=${ScriptBuilder.q(sys.adminUser || "admin")}] ${args([
          ["password", sys.adminPassword],
        ])}`,
      );
    } else {
      s.comment("PERHATIAN: password admin belum diatur di generator.");
      s.comment('Atur manual: /user set [find name=admin] password="PasswordKuatAnda"');
    }
  }

  // ----------------------------------------------------------------- bridge
  if (config.bridges.length > 0) {
    s.section(
      "2. BRIDGE",
      "Menggabungkan beberapa port fisik menjadi satu segmen LAN.",
    );
    s.line("/interface bridge");
    for (const bridge of config.bridges) {
      if (!bridge.name.trim()) continue;
      s.line(`add ${args([["name", bridge.name.trim()], ["comment", tag()]])}`);
    }
    const hasPorts = config.bridges.some((b) => b.ports.length > 0);
    if (hasPorts) {
      s.blank().line("/interface bridge port");
      for (const bridge of config.bridges) {
        for (const port of bridge.ports) {
          s.line(`add ${args([["bridge", bridge.name.trim()], ["interface", port]])}`);
        }
      }
    }
  }

  // ------------------------------------------------------------------- vlan
  if (config.vlans.length > 0) {
    s.section("3. VLAN", "Membuat interface VLAN di atas interface induk.");
    s.line("/interface vlan");
    for (const vlan of config.vlans) {
      if (!vlan.name.trim()) continue;
      s.line(
        `add ${args([
          ["name", vlan.name.trim()],
          ["vlan-id", vlan.vlanId],
          ["interface", vlan.parent],
          ["disabled", false],
          ["comment", tag(`VLAN ${vlan.vlanId} di ${vlan.parent}`)],
        ])}`,
      );
    }
  }

  // -------------------------------------------------------------------- wan
  if (wans.length > 0) {
    s.section(
      "4. WAN (koneksi ke ISP)",
      wans.length > 1
        ? "Beberapa WAN dibedakan lewat distance — angka terkecil jadi jalur utama."
        : "Konfigurasi jalur internet dari ISP.",
    );

    const dhcpWans = wans.filter((w) => w.mode === "dhcp");
    if (dhcpWans.length > 0) {
      s.line("/ip dhcp-client");
      for (const wan of dhcpWans) {
        s.line(
          `add ${args([
            ["interface", wan.iface],
            ["add-default-route", wan.addDefaultRoute],
            ["default-route-distance", wan.addDefaultRoute ? wan.dhcpDistance : ""],
            ["use-peer-dns", wan.usePeerDns],
            ["use-peer-ntp", false],
            ["disabled", false],
            ["comment", tag(wan.comment || `WAN ${wan.iface}`)],
          ])}`,
        );
      }
    }

    const staticWans = wans.filter((w) => w.mode === "static");
    if (staticWans.length > 0) {
      s.blank().comment("IP statis dari ISP");
      s.line("/ip address");
      for (const wan of staticWans) {
        s.line(
          `add ${args([
            ["address", wan.address],
            ["interface", wan.iface],
            ["comment", tag(wan.comment || `WAN ${wan.iface}`)],
          ])}`,
        );
      }
      s.blank().comment("Default route ke gateway ISP");
      s.line("/ip route");
      for (const wan of staticWans) {
        s.line(
          `add ${args([
            ["dst-address", "0.0.0.0/0"],
            ["gateway", wan.gateway],
            ["distance", wan.staticDistance],
            ["comment", tag(wan.comment || `default via ${wan.iface}`)],
          ])}`,
        );
      }
    }
  }

  // ------------------------------------------------------------ interface list
  if (needsInterfaceList) {
    s.section(
      "5. INTERFACE LIST",
      "Pengelompokan interface agar rule NAT & firewall ringkas dan mudah dirawat.",
    );
    s.line("/interface list");
    s.line(`add ${args([["name", WAN_LIST]])}`);
    s.line(`add ${args([["name", LAN_LIST]])}`);
    s.blank().line("/interface list member");
    for (const iface of wanIfaces) {
      s.line(`add ${args([["list", WAN_LIST], ["interface", iface]])}`);
    }
    for (const iface of lanMembers) {
      s.line(`add ${args([["list", LAN_LIST], ["interface", iface]])}`);
    }
  }

  // -------------------------------------------------------------- ip address
  const lanAddresses = config.addresses.filter((a) => a.iface && a.address.trim());
  if (lanAddresses.length > 0) {
    s.section("6. IP ADDRESS", "Alamat IP router di tiap segmen jaringan.");
    s.line("/ip address");
    for (const addr of lanAddresses) {
      s.line(
        `add ${args([
          ["address", addr.address.trim()],
          ["interface", addr.iface],
          ["comment", tag(addr.comment || `IP ${addr.iface}`)],
        ])}`,
      );
    }
  }

  // -------------------------------------------------------------------- dns
  const dnsServers = config.dns.servers.map((d) => d.trim()).filter(Boolean);
  if (dnsServers.length > 0 || config.dns.allowRemoteRequests) {
    s.section(
      "7. DNS",
      config.dns.allowRemoteRequests
        ? "Router juga melayani permintaan DNS dari klien LAN (allow-remote-requests)."
        : "DNS hanya dipakai oleh router itu sendiri.",
    );
    s.line(
      `/ip dns set ${args([
        ["servers", dnsServers.join(",")],
        ["allow-remote-requests", config.dns.allowRemoteRequests],
      ])}`,
    );
  }

  // ---------------------------------------------------------------- ip pool
  if (config.pools.length > 0) {
    s.section("8. IP POOL", "Kumpulan IP yang dibagikan ke klien (DHCP/Hotspot/PPPoE).");
    s.line("/ip pool");
    for (const pool of config.pools) {
      if (!pool.name.trim()) continue;
      s.line(
        `add ${args([
          ["name", pool.name.trim()],
          ["ranges", `${pool.rangeStart.trim()}-${pool.rangeEnd.trim()}`],
          ["comment", tag()],
        ])}`,
      );
    }
  }

  // ----------------------------------------------------------- dhcp server
  if (config.dhcpServers.length > 0) {
    s.section("9. DHCP SERVER", "Membagikan IP otomatis ke perangkat klien.");
    s.line("/ip dhcp-server");
    for (const dhcp of config.dhcpServers) {
      if (!dhcp.name.trim()) continue;
      s.line(
        `add ${args([
          ["name", dhcp.name.trim()],
          ["interface", dhcp.iface],
          ["address-pool", dhcp.pool],
          ["lease-time", dhcp.leaseTime || "1d"],
          ["disabled", false],
          ["comment", tag(`DHCP untuk ${dhcp.iface}`)],
        ])}`,
      );
    }
    s.blank().line("/ip dhcp-server network");
    for (const dhcp of config.dhcpServers) {
      const ifaceAddress = addressOfInterface(config, dhcp.iface);
      const network = dhcp.network.trim() || networkOf(ifaceAddress);
      if (!network) continue;
      const gateway = dhcp.gateway.trim() || addressPart(ifaceAddress);
      const dns =
        dhcp.dnsServers.trim() ||
        (config.dns.allowRemoteRequests ? gateway : dnsServers.join(","));
      s.line(
        `add ${args([
          ["address", network],
          ["gateway", gateway],
          ["dns-server", dns],
          ["comment", tag(`network untuk ${dhcp.name.trim() || dhcp.iface}`)],
        ])}`,
      );
    }
  }

  // -------------------------------------------------------------------- nat
  if (config.nat.enabled) {
    s.section(
      "10. NAT MASQUERADE",
      "Menyamarkan IP privat LAN menjadi IP publik WAN agar bisa keluar internet.",
    );
    s.line("/ip firewall nat");
    if (config.nat.mode === "global") {
      s.line(
        `add ${args([
          ["chain", "srcnat"],
          ["action", "masquerade"],
          ["out-interface-list", WAN_LIST],
          ["comment", tag("NAT untuk semua WAN")],
        ])}`,
      );
    } else {
      for (const iface of config.nat.interfaces) {
        s.line(
          `add ${args([
            ["chain", "srcnat"],
            ["action", "masquerade"],
            ["out-interface", iface],
            ["comment", tag(`NAT via ${iface}`)],
          ])}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------- hotspot
  if (config.hotspots.length > 0) {
    s.section(
      "11. IP HOTSPOT",
      "Portal login untuk pengguna. Halaman login (file HTML) diunduh terpisah\ndan di-upload ke folder 'hotspot' pada File List router.",
    );
    s.line("/ip hotspot profile");
    for (const hs of config.hotspots) {
      const ifaceAddress = addressOfInterface(config, hs.iface);
      s.line(
        `add ${args([
          ["name", `hsprof-${hs.name.trim() || hs.iface}`],
          ["hotspot-address", addressPart(ifaceAddress)],
          ["dns-name", hs.dnsName.trim()],
          ["html-directory", "hotspot"],
          ["login-by", hs.auth.join(",")],
          ["use-radius", false],
          ["comment", tag(`profil hotspot ${hs.name.trim() || hs.iface}`)],
        ])}`,
      );
    }
    s.blank().line("/ip hotspot");
    for (const hs of config.hotspots) {
      s.line(
        `add ${args([
          ["name", hs.name.trim()],
          ["interface", hs.iface],
          ["address-pool", hs.pool],
          ["profile", `hsprof-${hs.name.trim() || hs.iface}`],
          ["addresses-per-mac", hs.addressesPerMac || "2"],
          ["disabled", false],
          ["comment", tag(`hotspot di ${hs.iface}`)],
        ])}`,
      );
    }
    s.blank().comment("Tambahkan user hotspot sesuai kebutuhan, contoh:");
    s.comment('/ip hotspot user add name=user1 password="PasswordKuat" profile=default');
  }

  // ------------------------------------------------------------ pppoe server
  if (config.pppoe.enabled) {
    const p = config.pppoe;
    s.section("12. PPPOE SERVER", "Layanan dial-up PPPoE untuk pelanggan/klien.");
    s.line("/ppp profile");
    s.line(
      `add ${args([
        ["name", p.profileName.trim()],
        ["local-address", addressPart(p.localAddress)],
        ["remote-address", p.pool],
        ["dns-server", dnsServers.join(",") || addressPart(p.localAddress)],
        ["rate-limit", p.rateLimit.trim()],
        ["only-one", p.oneSessionPerHost],
        ["comment", tag("profil PPPoE")],
      ])}`,
    );
    s.blank().comment("Metode autentikasi memakai bawaan RouterOS (pap, chap, mschap1, mschap2).");
    s.line("/interface pppoe-server server");
    s.line(
      `add ${args([
        ["service-name", p.serviceName.trim()],
        ["interface", p.iface],
        ["default-profile", p.profileName.trim()],
        ["one-session-per-host", p.oneSessionPerHost],
        ["max-mtu", "1480"],
        ["max-mru", "1480"],
        ["disabled", false],
        ["comment", tag(`PPPoE server di ${p.iface}`)],
      ])}`,
    );
    if (p.secrets.length > 0) {
      s.blank().comment("Akun pelanggan PPPoE");
      s.line("/ppp secret");
      for (const secret of p.secrets) {
        if (!secret.user.trim()) continue;
        s.line(
          `add ${args([
            ["name", secret.user.trim()],
            ["password", secret.password],
            ["service", "pppoe"],
            ["profile", p.profileName.trim()],
            ["comment", tag()],
          ])}`,
        );
      }
    }
  }

  // --------------------------------------------------------------- firewall
  const fw = config.firewall;
  if (fw.enabled) {
    s.section(
      "13. FIREWALL DASAR & PENGAMANAN",
      "Melindungi router dari akses internet dan membuang paket tidak valid.",
    );
    s.line("/ip firewall filter");
    s.comment("--- chain input: trafik yang menuju router itu sendiri");
    s.line(
      `add ${args([
        ["chain", "input"],
        ["action", "accept"],
        ["connection-state", "established,related,untracked"],
        ["comment", tag("terima koneksi yang sudah terbentuk")],
      ])}`,
    );
    if (fw.dropInvalid) {
      s.line(
        `add ${args([
          ["chain", "input"],
          ["action", "drop"],
          ["connection-state", "invalid"],
          ["comment", tag("buang paket invalid")],
        ])}`,
      );
    }
    if (fw.allowIcmp) {
      s.line(
        `add ${args([
          ["chain", "input"],
          ["action", "accept"],
          ["protocol", "icmp"],
          ["comment", tag("izinkan ping ke router")],
        ])}`,
      );
    }
    if (fw.protectInput) {
      s.line(
        `add ${args([
          ["chain", "input"],
          ["action", "accept"],
          ["in-interface-list", LAN_LIST],
          ["comment", tag("izinkan akses penuh dari LAN")],
        ])}`,
      );
      s.line(
        `add ${args([
          ["chain", "input"],
          ["action", "drop"],
          ["in-interface-list", WAN_LIST],
          ["comment", tag("tolak semua akses dari internet ke router")],
        ])}`,
      );
    }

    s.blank().comment("--- chain forward: trafik antar jaringan (klien ke internet)");
    if (fw.fasttrack) {
      s.line(
        `add ${args([
          ["chain", "forward"],
          ["action", "fasttrack-connection"],
          ["connection-state", "established,related"],
          ["hw-offload", v7 ? true : undefined],
          ["comment", tag("fasttrack: percepat koneksi yang sudah terbentuk")],
        ])}`,
      );
    }
    s.line(
      `add ${args([
        ["chain", "forward"],
        ["action", "accept"],
        ["connection-state", "established,related,untracked"],
        ["comment", tag("terima koneksi yang sudah terbentuk")],
      ])}`,
    );
    if (fw.dropInvalid) {
      s.line(
        `add ${args([
          ["chain", "forward"],
          ["action", "drop"],
          ["connection-state", "invalid"],
          ["comment", tag("buang paket invalid")],
        ])}`,
      );
    }
    s.line(
      `add ${args([
        ["chain", "forward"],
        ["action", "drop"],
        ["connection-state", "new"],
        ["connection-nat-state", raw("!dstnat")],
        ["in-interface-list", WAN_LIST],
        ["comment", tag("tolak koneksi baru dari internet yang bukan port forward")],
      ])}`,
    );

    if (fw.disableUnusedServices || fw.restrictServices) {
      s.blank().comment("--- layanan router");
      s.line("/ip service");
      if (fw.disableUnusedServices) {
        for (const service of ["telnet", "ftp", "api", "api-ssl"]) {
          s.line(`set ${service} ${args([["disabled", true]])}`);
        }
      }
      if (fw.restrictServices && fw.mgmtSubnet.trim() && isCidr(fw.mgmtSubnet)) {
        for (const service of ["ssh", "winbox", "www"]) {
          s.line(`set ${service} ${args([["address", fw.mgmtSubnet.trim()]])}`);
        }
      }
    }

    if (fw.limitDiscovery) {
      s.blank().comment("--- sembunyikan router dari sisi internet");
      s.line(
        `/ip neighbor discovery-settings set ${args([["discover-interface-list", LAN_LIST]])}`,
      );
    }
    if (fw.limitMacServer) {
      s.line(`/tool mac-server set ${args([["allowed-interface-list", LAN_LIST]])}`);
      s.line(
        `/tool mac-server mac-winbox set ${args([["allowed-interface-list", LAN_LIST]])}`,
      );
      s.line(`/tool mac-server ping set ${args([["enabled", false]])}`);
    }
  }

  // ----------------------------------------------------------------- footer
  s.section("SELESAI — CARA MEMERIKSA HASIL");
  s.comment("Jalankan perintah berikut satu per satu untuk verifikasi:");
  s.comment("  /ip address print          -> daftar IP yang terpasang");
  s.comment("  /ip route print            -> pastikan ada default route (DAc/DAS)");
  s.comment("  /ip dhcp-client print      -> status WAN DHCP harus 'bound'");
  s.comment("  /ip dhcp-server lease print -> klien yang sudah dapat IP");
  s.comment("  /ip firewall filter print  -> urutan rule firewall");
  s.comment("  /ping 8.8.8.8              -> tes koneksi internet dari router");
  if (config.hotspots.length > 0) {
    s.comment("  /ip hotspot active print   -> user hotspot yang sedang login");
  }
  if (config.pppoe.enabled) {
    s.comment("  /ppp active print          -> sesi PPPoE yang aktif");
  }
  s.blank().comment(`Seluruh objek hasil script ini diberi comment "${BRAND}".`);
  s.comment(`Menghapus semuanya: /ip firewall filter remove [find comment~"${BRAND}"]`);
  s.comment("(ulangi untuk menu lain: /ip firewall nat, /ip address, /ip pool, dst)");

  return s.toString();
}
