import { whatsappLink } from "../hotspot-page";
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

  /** Nomor section mengikuti blok yang benar-benar ditulis. */
  let sectionNo = 0;
  const section = (title: string, description?: string) => {
    sectionNo += 1;
    s.section(`${sectionNo}. ${title}`, description);
  };

  // ---------------------------------------------------------------- header
  s.banner([
    "SCRIPT SETUP MIKROTIK BARU",
    "Generator Script Mikrotik by Mikrosetting.com",
    "",
    `Perangkat  : ${model ? model.name : "(belum dipilih)"}${model && model.arch !== "-" ? ` [${model.arch}]` : ""}`,
    `RouterOS   : ${config.ros ? config.ros : "(belum dipilih)"}`,
    `Dibuat     : ${stamp()}`,
    "",
    "CARA PAKAI",
    "Buka Winbox/WebFig > New Terminal, paste seluruh isi script ini",
    "sekaligus, lalu tekan Enter.",
    "",
    "SIFAT SCRIPT INI",
    "Hanya menambah, tidak menghapus apa pun. Setiap perintah dilindungi",
    "pemeriksaan \"buat hanya bila belum ada\", jadi aman dijalankan ulang",
    "dan tidak memunculkan error di router yang masih berkonfigurasi bawaan.",
    "Sisi lainnya: objek yang sudah ada TIDAK diubah — bila hasilnya tidak",
    "sesuai harapan, hapus objek lama itu lalu jalankan script ini lagi.",
    "",
    "BACKUP DULU (bila router sudah terpakai)",
    "  /system backup save name=sebelum-setup",
    "  /export file=sebelum-setup",
    ...(config.firewall.enabled
      ? [
          "",
          "CATATAN FIREWALL",
          "Rule firewall di script ini ditambahkan di URUTAN PALING BAWAH.",
          "Bila router masih memakai firewall bawaan pabrik, rule bawaan",
          "dievaluasi lebih dulu sehingga rule baru bisa tidak pernah tercapai.",
          "Periksa dengan /ip firewall filter print lalu susun ulang bila perlu,",
          "atau mulai dari router bersih:",
          "  /system reset-configuration no-defaults=yes",
          "(perintah itu memutus koneksi — jalankan sendiri, bukan lewat script)",
        ]
      : []),
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
  if (sys.identity || sys.timezone || sys.ntp) {
    section("IDENTITAS ROUTER & JAM");
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
  }

  // ----------------------------------------------------------------- bridge
  if (config.bridges.length > 0) {
    section("BRIDGE",
      "Menggabungkan beberapa port fisik menjadi satu segmen LAN.",
    );
    for (const bridge of config.bridges) {
      if (!bridge.name.trim()) continue;
      s.addIfMissing(
        "/interface bridge",
        [["name", bridge.name.trim()]],
        args([["name", bridge.name.trim()], ["comment", tag()]]),
      );
    }
    const hasPorts = config.bridges.some((b) => b.ports.length > 0);
    if (hasPorts) {
      for (const bridge of config.bridges) {
        for (const port of bridge.ports) {
          s.addIfMissing(
            "/interface bridge port",
            [["interface", port]],
            args([["bridge", bridge.name.trim()], ["interface", port]]),
          );
        }
      }
    }
  }

  // ------------------------------------------------------------------- vlan
  if (config.vlans.length > 0) {
    section("VLAN", "Membuat interface VLAN di atas interface induk.");
    for (const vlan of config.vlans) {
      if (!vlan.name.trim()) continue;
      s.addIfMissing(
        "/interface vlan",
        [["name", vlan.name.trim()]],
        args([
          ["name", vlan.name.trim()],
          ["vlan-id", vlan.vlanId],
          ["interface", vlan.parent],
          ["disabled", false],
          ["comment", tag(`VLAN ${vlan.vlanId} di ${vlan.parent}`)],
        ]),
      );
    }
  }

  // -------------------------------------------------------------------- wan
  if (wans.length > 0) {
    section("WAN (koneksi ke ISP)",
      wans.length > 1
        ? "Beberapa WAN dibedakan lewat distance — angka terkecil jadi jalur utama."
        : "Konfigurasi jalur internet dari ISP.",
    );

    const dhcpWans = wans.filter((w) => w.mode === "dhcp");
    if (dhcpWans.length > 0) {
      // Satu interface hanya boleh punya satu DHCP client — router bawaan
      // pabrik biasanya sudah memasang satu di ether1.
      for (const wan of dhcpWans) {
        s.addIfMissing(
          "/ip dhcp-client",
          [["interface", wan.iface]],
          args([
            ["interface", wan.iface],
            ["add-default-route", wan.addDefaultRoute],
            ["default-route-distance", wan.addDefaultRoute ? wan.dhcpDistance : ""],
            ["use-peer-dns", wan.usePeerDns],
            ["use-peer-ntp", false],
            ["disabled", false],
            ["comment", tag(wan.comment || `WAN ${wan.iface}`)],
          ]),
        );
      }
    }

    const staticWans = wans.filter((w) => w.mode === "static");
    if (staticWans.length > 0) {
      s.blank().comment("IP statis dari ISP");
      for (const wan of staticWans) {
        s.addIfMissing(
          "/ip address",
          [["address", wan.address]],
          args([
            ["address", wan.address],
            ["interface", wan.iface],
            ["comment", tag(wan.comment || `WAN ${wan.iface}`)],
          ]),
        );
      }
      s.blank().comment("Default route ke gateway ISP");
      for (const wan of staticWans) {
        s.addIfMissing(
          "/ip route",
          [["dst-address", "0.0.0.0/0"], ["gateway", wan.gateway]],
          args([
            ["dst-address", "0.0.0.0/0"],
            ["gateway", wan.gateway],
            ["distance", wan.staticDistance],
            ["comment", tag(wan.comment || `default via ${wan.iface}`)],
          ]),
        );
      }
    }
  }

  // ------------------------------------------------------------ interface list
  if (needsInterfaceList) {
    section("INTERFACE LIST",
      "Pengelompokan interface agar rule NAT & firewall ringkas dan mudah dirawat.",
    );
    // Konfigurasi bawaan pabrik sudah membuat list WAN & LAN pada banyak model.
    for (const list of [WAN_LIST, LAN_LIST]) {
      s.addIfMissing("/interface list", [["name", list]], args([["name", list]]));
    }
    s.blank();
    for (const iface of wanIfaces) {
      s.addIfMissing(
        "/interface list member",
        [["list", WAN_LIST], ["interface", iface]],
        args([["list", WAN_LIST], ["interface", iface]]),
      );
    }
    for (const iface of lanMembers) {
      s.addIfMissing(
        "/interface list member",
        [["list", LAN_LIST], ["interface", iface]],
        args([["list", LAN_LIST], ["interface", iface]]),
      );
    }
  }

  // -------------------------------------------------------------- ip address
  const lanAddresses = config.addresses.filter((a) => a.iface && a.address.trim());
  if (lanAddresses.length > 0) {
    section(
      "IP ADDRESS", "Alamat IP router di tiap segmen jaringan.");
    for (const addr of lanAddresses) {
      s.addIfMissing(
        "/ip address",
        [["address", addr.address.trim()]],
        args([
          ["address", addr.address.trim()],
          ["interface", addr.iface],
          ["comment", tag(addr.comment || `IP ${addr.iface}`)],
        ]),
      );
    }
  }

  // -------------------------------------------------------------------- dns
  const dnsServers = config.dns.servers.map((d) => d.trim()).filter(Boolean);
  if (dnsServers.length > 0 || config.dns.allowRemoteRequests) {
    section("DNS",
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
    section(
      "IP POOL", "Kumpulan IP yang dibagikan ke klien (DHCP/Hotspot/PPPoE).");
    for (const pool of config.pools) {
      if (!pool.name.trim()) continue;
      s.addIfMissing(
        "/ip pool",
        [["name", pool.name.trim()]],
        args([
          ["name", pool.name.trim()],
          ["ranges", `${pool.rangeStart.trim()}-${pool.rangeEnd.trim()}`],
          ["comment", tag()],
        ]),
      );
    }
  }

  // ----------------------------------------------------------- dhcp server
  if (config.dhcpServers.length > 0) {
    section(
      "DHCP SERVER", "Membagikan IP otomatis ke perangkat klien.");
    for (const dhcp of config.dhcpServers) {
      if (!dhcp.name.trim()) continue;
      // Satu interface hanya boleh dilayani satu DHCP server.
      s.addIfMissing(
        "/ip dhcp-server",
        [["interface", dhcp.iface]],
        args([
          ["name", dhcp.name.trim()],
          ["interface", dhcp.iface],
          ["address-pool", dhcp.pool],
          ["lease-time", dhcp.leaseTime || "1d"],
          ["disabled", false],
          ["comment", tag(`DHCP untuk ${dhcp.iface}`)],
        ]),
      );
    }
    for (const dhcp of config.dhcpServers) {
      const ifaceAddress = addressOfInterface(config, dhcp.iface);
      const network = dhcp.network.trim() || networkOf(ifaceAddress);
      if (!network) continue;
      const gateway = dhcp.gateway.trim() || addressPart(ifaceAddress);
      const dns =
        dhcp.dnsServers.trim() ||
        (config.dns.allowRemoteRequests ? gateway : dnsServers.join(","));
      s.addIfMissing(
        "/ip dhcp-server network",
        [["address", network]],
        args([
          ["address", network],
          ["gateway", gateway],
          ["dns-server", dns],
          ["comment", tag(`network untuk ${dhcp.name.trim() || dhcp.iface}`)],
        ]),
      );
    }
  }

  // -------------------------------------------------------------------- nat
  if (config.nat.enabled) {
    section("NAT MASQUERADE",
      "Menyamarkan IP privat LAN menjadi IP publik WAN agar bisa keluar internet.",
    );
    if (config.nat.mode === "global") {
      s.addIfMissing(
        "/ip firewall nat",
        [["chain", "srcnat"], ["action", "masquerade"], ["out-interface-list", WAN_LIST]],
        args([
          ["chain", "srcnat"],
          ["action", "masquerade"],
          ["out-interface-list", WAN_LIST],
          ["comment", tag("NAT untuk semua WAN")],
        ]),
      );
    } else {
      for (const iface of config.nat.interfaces) {
        s.addIfMissing(
          "/ip firewall nat",
          [["chain", "srcnat"], ["action", "masquerade"], ["out-interface", iface]],
          args([
            ["chain", "srcnat"],
            ["action", "masquerade"],
            ["out-interface", iface],
            ["comment", tag(`NAT via ${iface}`)],
          ]),
        );
      }
    }
  }

  // ---------------------------------------------------------------- hotspot
  if (config.hotspots.length > 0) {
    section("IP HOTSPOT",
      "Portal login untuk pengguna. Halaman login (file HTML) diunduh terpisah\ndan di-upload ke folder 'hotspot' pada File List router.",
    );
    for (const hs of config.hotspots) {
      const ifaceAddress = addressOfInterface(config, hs.iface);
      const profileName = `hsprof-${hs.name.trim() || hs.iface}`;
      s.addIfMissing(
        "/ip hotspot profile",
        [["name", profileName]],
        args([
          ["name", profileName],
          ["hotspot-address", addressPart(ifaceAddress)],
          ["dns-name", hs.dnsName.trim()],
          ["html-directory", "hotspot"],
          ["login-by", hs.auth.join(",")],
          ["use-radius", false],
          ["comment", tag(`profil hotspot ${hs.name.trim() || hs.iface}`)],
        ]),
      );
    }
    for (const hs of config.hotspots) {
      s.addIfMissing(
        "/ip hotspot",
        [["interface", hs.iface]],
        args([
          ["name", hs.name.trim()],
          ["interface", hs.iface],
          ["address-pool", hs.pool],
          ["profile", `hsprof-${hs.name.trim() || hs.iface}`],
          ["addresses-per-mac", hs.addressesPerMac || "2"],
          ["disabled", false],
          ["comment", tag(`hotspot di ${hs.iface}`)],
        ]),
      );
    }
    if (whatsappLink(config.hotspotPage.whatsapp)) {
      s.blank().comment("Walled garden — agar tombol WhatsApp di halaman login bisa dibuka");
      s.comment("sebelum pengguna berhasil login.");
      for (const host of ["wa.me", "*.whatsapp.com", "*.whatsapp.net", "*.wa.me"]) {
        s.addIfMissing(
          "/ip hotspot walled-garden",
          [["dst-host", host]],
          args([["dst-host", host], ["comment", tag("tombol WhatsApp")]]),
        );
      }
      s.comment("Catatan: membuka chat di aplikasi WhatsApp mungkin masih perlu aturan");
      s.comment("tambahan berbasis IP karena aplikasinya tidak memakai HTTP biasa.");
    }

    s.blank().comment("Tambahkan user hotspot sesuai kebutuhan, contoh:");
    s.comment('/ip hotspot user add name=user1 password="PasswordKuat" profile=default');
  }

  // ------------------------------------------------------------ pppoe server
  if (config.pppoe.enabled) {
    const p = config.pppoe;
    section(
      "PPPOE SERVER", "Layanan dial-up PPPoE untuk pelanggan/klien.");
    s.addIfMissing(
      "/ppp profile",
      [["name", p.profileName.trim()]],
      args([
        ["name", p.profileName.trim()],
        ["local-address", addressPart(p.localAddress)],
        ["remote-address", p.pool],
        ["dns-server", dnsServers.join(",") || addressPart(p.localAddress)],
        ["rate-limit", p.rateLimit.trim()],
        ["only-one", p.oneSessionPerHost],
        ["comment", tag("profil PPPoE")],
      ]),
    );
    s.blank().comment("Metode autentikasi memakai bawaan RouterOS (pap, chap, mschap1, mschap2).");
    s.addIfMissing(
      "/interface pppoe-server server",
      [["interface", p.iface]],
      args([
        ["service-name", p.serviceName.trim()],
        ["interface", p.iface],
        ["default-profile", p.profileName.trim()],
        ["one-session-per-host", p.oneSessionPerHost],
        ["max-mtu", "1480"],
        ["max-mru", "1480"],
        ["disabled", false],
        ["comment", tag(`PPPoE server di ${p.iface}`)],
      ]),
    );
    if (p.secrets.length > 0) {
      s.blank().comment("Akun pelanggan PPPoE");
      for (const secret of p.secrets) {
        if (!secret.user.trim()) continue;
        s.addIfMissing(
          "/ppp secret",
          [["name", secret.user.trim()]],
          args([
            ["name", secret.user.trim()],
            ["password", secret.password],
            ["service", "pppoe"],
            ["profile", p.profileName.trim()],
            ["comment", tag()],
          ]),
        );
      }
    }
  }

  // --------------------------------------------------------------- firewall
  const fw = config.firewall;
  if (fw.enabled) {
    section("FIREWALL DASAR & PENGAMANAN",
      "Melindungi router dari akses internet dan membuang paket tidak valid.",
    );
    s.comment("--- chain input: trafik yang menuju router itu sendiri");
    s.addIfMissing(
      "/ip firewall filter",
      [["comment", tag("input: terima koneksi yang sudah terbentuk")]],
      args([
        ["chain", "input"],
        ["action", "accept"],
        ["connection-state", "established,related,untracked"],
        ["comment", tag("input: terima koneksi yang sudah terbentuk")],
      ]),
    );
    if (fw.dropInvalid) {
      s.addIfMissing(
        "/ip firewall filter",
        [["comment", tag("input: buang paket invalid")]],
        args([
          ["chain", "input"],
          ["action", "drop"],
          ["connection-state", "invalid"],
          ["comment", tag("input: buang paket invalid")],
        ]),
      );
    }
    if (fw.allowIcmp) {
      s.addIfMissing(
        "/ip firewall filter",
        [["comment", tag("izinkan ping ke router")]],
        args([
          ["chain", "input"],
          ["action", "accept"],
          ["protocol", "icmp"],
          ["comment", tag("izinkan ping ke router")],
        ]),
      );
    }
    if (fw.protectInput) {
      s.addIfMissing(
        "/ip firewall filter",
        [["comment", tag("izinkan akses penuh dari LAN")]],
        args([
          ["chain", "input"],
          ["action", "accept"],
          ["in-interface-list", LAN_LIST],
          ["comment", tag("izinkan akses penuh dari LAN")],
        ]),
      );
      s.addIfMissing(
        "/ip firewall filter",
        [["comment", tag("tolak semua akses dari internet ke router")]],
        args([
          ["chain", "input"],
          ["action", "drop"],
          ["in-interface-list", WAN_LIST],
          ["comment", tag("tolak semua akses dari internet ke router")],
        ]),
      );
    }

    s.blank().comment("--- chain forward: trafik antar jaringan (klien ke internet)");
    if (fw.fasttrack) {
      s.addIfMissing(
        "/ip firewall filter",
        [["comment", tag("fasttrack: percepat koneksi yang sudah terbentuk")]],
        args([
          ["chain", "forward"],
          ["action", "fasttrack-connection"],
          ["connection-state", "established,related"],
          ["hw-offload", v7 ? true : undefined],
          ["comment", tag("fasttrack: percepat koneksi yang sudah terbentuk")],
        ]),
      );
    }
    s.addIfMissing(
      "/ip firewall filter",
      [["comment", tag("forward: terima koneksi yang sudah terbentuk")]],
      args([
        ["chain", "forward"],
        ["action", "accept"],
        ["connection-state", "established,related,untracked"],
        ["comment", tag("forward: terima koneksi yang sudah terbentuk")],
      ]),
    );
    if (fw.dropInvalid) {
      s.addIfMissing(
        "/ip firewall filter",
        [["comment", tag("forward: buang paket invalid")]],
        args([
          ["chain", "forward"],
          ["action", "drop"],
          ["connection-state", "invalid"],
          ["comment", tag("forward: buang paket invalid")],
        ]),
      );
    }
    s.addIfMissing(
      "/ip firewall filter",
      [["comment", tag("tolak koneksi baru dari internet yang bukan port forward")]],
      args([
        ["chain", "forward"],
        ["action", "drop"],
        ["connection-state", "new"],
        ["connection-nat-state", raw("!dstnat")],
        ["in-interface-list", WAN_LIST],
        ["comment", tag("tolak koneksi baru dari internet yang bukan port forward")],
      ]),
    );

    if (fw.disableUnusedServices || fw.restrictServices) {
      s.blank().comment("--- layanan router");
      if (fw.disableUnusedServices) {
        for (const service of ["telnet", "ftp", "api", "api-ssl"]) {
          s.line(`/ip service set ${service} ${args([["disabled", true]])}`);
        }
      }
      if (fw.restrictServices && fw.mgmtSubnet.trim() && isCidr(fw.mgmtSubnet)) {
        for (const service of ["ssh", "winbox", "www"]) {
          s.line(`/ip service set ${service} ${args([["address", fw.mgmtSubnet.trim()]])}`);
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

  // ------------------------------------------------------------------- user
  const newUsers = config.users.filter((u) => u.name.trim());
  if (sys.adminPassword || newUsers.length > 0) {
    section("USER & PASSWORD ROUTER",
      "Diletakkan paling akhir agar akses ke router tidak terputus di tengah\njalannya script bila ada perintah sebelumnya yang gagal.",
    );

    if (newUsers.length > 0) {
      s.comment("User baru — buat dulu sebelum password admin diganti,");
      s.comment("supaya tetap ada jalan masuk bila password admin terlupa.");
      for (const user of newUsers) {
        s.addIfMissing(
          "/user",
          [["name", user.name.trim()]],
          args([
            ["name", user.name.trim()],
            ["password", user.password],
            ["group", user.group],
            ["address", user.allowedAddress.trim()],
            ["comment", tag(user.comment)],
          ]),
        );
      }
      s.blank();
    }

    if (sys.adminPassword) {
      s.comment("Ganti password user admin. Simpan password ini baik-baik!");
      s.comment("Setelah script selesai, login ulang memakai password baru.");
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
  if (config.users.some((u) => u.name.trim())) {
    s.comment("  /user print                -> daftar user router");
  }
  s.blank().comment(`Seluruh objek hasil script ini diberi comment "${BRAND}".`);
  s.comment(`Menghapus semuanya: /ip firewall filter remove [find comment~"${BRAND}"]`);
  s.comment("(ulangi untuk menu lain: /ip firewall nat, /ip address, /ip pool, dst)");

  return s.toString();
}
