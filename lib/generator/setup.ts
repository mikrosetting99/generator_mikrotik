import { whatsappLink } from "../hotspot-page";
import { addressOfInterface, lanInterfaces, wirelessKind } from "../interfaces";
import { getModel } from "../models";
import { addressPart, isCidr, networkOf } from "../net";
import {
  DEFAULT_PPP_PROFILE,
  type SetupConfig,
  type WirelessBand,
  type WirelessEntry,
} from "../types";
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

/**
 * Nilai `band=` RouterOS untuk tiap pilihan di form.
 *
 * "auto" tidak dipetakan ke apa pun: propertinya memang tidak ditulis, supaya
 * radio memakai band bawaannya. Band yang salah — 5 GHz pada radio 2.4 GHz,
 * atau mode ac pada radio yang hanya n — membuat perintahnya ditolak router.
 */
const WIRELESS_BAND: Record<Exclude<WirelessBand, "auto">, { legacy: string; wifi: string }> = {
  "2ghz": { legacy: "2ghz-b/g/n", wifi: "2ghz-ax" },
  "5ghz": { legacy: "5ghz-a/n/ac", wifi: "5ghz-ax" },
  "5ghz-n": { legacy: "5ghz-a/n", wifi: "5ghz-ac" },
};

/** Nama profile keamanan yang dibuat untuk sebuah radio. */
function securityProfileName(radio: WirelessEntry): string {
  return `sec-${radio.iface}`;
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

  // --------------------------------------------------------------- wireless
  const radios = config.wireless.radios.filter((r) => r.iface && r.ssid.trim());
  if (radios.length > 0) {
    const kind = wirelessKind(config);
    const country = config.wireless.country.trim();

    section(
      "WIRELESS (WiFi)",
      kind === "wifi"
        ? "Radio ax diatur lewat menu /interface wifi (RouterOS 7.13 ke atas).\nPada RouterOS 7.8–7.12 menu itu masih bernama /interface wifiwave2 —\nganti kata 'wifi' menjadi 'wifiwave2' bila router menolak perintahnya."
        : "Radio diatur lewat menu /interface wireless (paket wireless).",
    );
    s.comment("Radio dicari memakai nama bawaan pabrik. Bila radio pernah diganti");
    s.comment("nama, blok di bawah dilewati tanpa mengubah apa pun — sesuaikan");
    s.comment("namanya di sini, atau kembalikan nama radio seperti semula.");
    s.blank();
    s.comment("Agar klien WiFi masuk ke segmen yang sama dengan port kabel, radio");
    s.comment("harus menjadi port bridge — diatur di section BRIDGE.");
    s.blank();

    if (kind === "wifi") {
      for (const radio of radios) {
        const open = radio.security === "open";
        const isAp = radio.mode === "ap";
        s.setIfPresent(
          "/interface wifi",
          [["name", radio.iface]],
          args([
            ["configuration.mode", radio.mode === "ap" ? "ap" : radio.mode],
            ["configuration.ssid", radio.ssid.trim()],
            ["configuration.country", country],
            ["configuration.hide-ssid", isAp ? radio.hideSsid : undefined],
            // Daftar kosong berarti jaringan terbuka. Ditulis eksplisit supaya
            // sisa pengaturan keamanan lama pada radio ikut terhapus.
            [
              "security.authentication-types",
              open ? raw('""') : radio.security === "wpa2-wpa3" ? "wpa2-psk,wpa3-psk" : "wpa2-psk",
            ],
            ["security.passphrase", open ? raw('""') : radio.password],
            ["datapath.client-isolation", isAp ? radio.clientIsolation : undefined],
            ["channel.band", radio.band === "auto" ? undefined : WIRELESS_BAND[radio.band].wifi],
            ["disabled", false],
            ["comment", tag(`WiFi ${radio.ssid.trim()}`)],
          ]),
        );
      }
    } else {
      if (radios.some((r) => r.security === "wpa2-wpa3")) {
        s.comment("Catatan: paket wireless lama belum mendukung WPA3 — radio yang");
        s.comment("memilihnya tetap dipasang WPA2-PSK.");
        s.blank();
      }
      s.comment("Profil keamanan dibuat lebih dulu, lalu ditunjuk oleh radionya.");
      for (const radio of radios) {
        const open = radio.security === "open";
        const profile = securityProfileName(radio);
        s.addIfMissing(
          "/interface wireless security-profiles",
          [["name", profile]],
          args([
            ["name", profile],
            ["mode", open ? "none" : "dynamic-keys"],
            ["authentication-types", open ? undefined : "wpa2-psk"],
            ["unicast-ciphers", open ? undefined : "aes-ccm"],
            ["group-ciphers", open ? undefined : "aes-ccm"],
            ["wpa2-pre-shared-key", open ? undefined : radio.password],
          ]),
        );
      }
      s.blank();
      for (const radio of radios) {
        const isAp = radio.mode === "ap";
        s.setIfPresent(
          "/interface wireless",
          [["name", radio.iface]],
          args([
            ["mode", isAp ? "ap-bridge" : radio.mode],
            ["ssid", radio.ssid.trim()],
            ["security-profile", securityProfileName(radio)],
            // Nama negara di menu wireless lama ditulis huruf kecil.
            ["country", country.toLowerCase()],
            ["band", radio.band === "auto" ? undefined : WIRELESS_BAND[radio.band].legacy],
            ["frequency", isAp ? "auto" : undefined],
            ["hide-ssid", isAp ? radio.hideSsid : undefined],
            // default-forwarding=no memutus lalu lintas antar klien di radio ini.
            ["default-forwarding", isAp ? !radio.clientIsolation : undefined],
            ["disabled", false],
            ["comment", tag(`WiFi ${radio.ssid.trim()}`)],
          ]),
        );
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
    const profiles = p.profiles.filter((prof) => prof.name.trim());
    if (profiles.length > 0) {
      s.comment("Paket layanan. Klien tanpa profile sendiri memakai default-profile");
      s.comment("yang diatur di server PPPoE di bawah.");
      for (const prof of profiles) {
        s.addIfMissing(
          "/ppp profile",
          [["name", prof.name.trim()]],
          args([
            ["name", prof.name.trim()],
            ["local-address", addressPart(prof.localAddress)],
            ["remote-address", prof.pool],
            ["dns-server", dnsServers.join(",") || addressPart(prof.localAddress)],
            ["rate-limit", prof.rateLimit.trim()],
            ["only-one", prof.onlyOne],
            ["comment", tag(`paket PPPoE ${prof.name.trim()}`)],
          ]),
        );
      }
      s.blank();
    } else {
      s.comment("Memakai profile bawaan RouterOS — tidak ada paket khusus yang dibuat.");
    }

    s.comment("Metode autentikasi memakai bawaan RouterOS (pap, chap, mschap1, mschap2).");
    s.addIfMissing(
      "/interface pppoe-server server",
      [["interface", p.iface]],
      args([
        ["service-name", p.serviceName.trim()],
        ["interface", p.iface],
        ["default-profile", p.defaultProfile.trim() || DEFAULT_PPP_PROFILE],
        ["one-session-per-host", p.oneSessionPerHost],
        ["max-mtu", "1480"],
        ["max-mru", "1480"],
        ["disabled", false],
        ["comment", tag(`PPPoE server di ${p.iface}`)],
      ]),
    );

    const secrets = p.secrets.filter((secret) => secret.user.trim());
    if (secrets.length > 0) {
      s.blank().comment("Akun pelanggan PPPoE");
      for (const secret of secrets) {
        s.addIfMissing(
          "/ppp secret",
          [["name", secret.user.trim()]],
          args([
            ["name", secret.user.trim()],
            ["password", secret.password],
            ["service", "pppoe"],
            ["profile", secret.profile.trim() || DEFAULT_PPP_PROFILE],
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

  // -------------------------------------------------------- anti tethering
  const anti = config.antiTethering;
  const antiIfaces = anti.interfaces.filter(Boolean);
  if (anti.enabled && antiIfaces.length > 0) {
    section(
      "ANTI TETHERING (UBAH TTL)",
      "Paket yang keluar ke klien diberi TTL rendah. Perangkat klien masih bisa\nmemakainya sendiri, tetapi tidak bisa meneruskannya lagi — meneruskan\nmembuat TTL menjadi 0 dan paketnya dibuang.",
    );

    if (anti.ttl === "1") {
      s.comment("TTL 1: semua pembagian ulang terhenti, termasuk router milik pelanggan.");
    } else {
      s.comment("TTL 2: menyisakan satu lompatan, jadi router milik pelanggan tetap");
      s.comment("jalan, tetapi perangkat di belakangnya tidak bisa tethering lagi.");
    }
    if (fw.enabled && fw.fasttrack) {
      s.blank();
      s.comment("PENTING: FastTrack aktif. Koneksi yang sudah ter-fasttrack melewati");
      s.comment("mangle, sehingga aturan di bawah tidak berlaku untuk koneksi itu.");
      s.comment("Matikan FastTrack bila anti tethering harus benar-benar rapat.");
    }
    s.blank();

    for (const iface of antiIfaces) {
      const label = tag(`anti tethering ${iface}`);
      s.addIfMissing(
        "/ip firewall mangle",
        [["comment", label]],
        args([
          ["chain", "postrouting"],
          ["action", "change-ttl"],
          ["new-ttl", `set:${anti.ttl}`],
          ["out-interface", iface],
          ["comment", label],
        ]),
      );
    }

    s.blank().comment("Bila ada perangkat yang memang boleh membagi ulang — misalnya");
    s.comment("access point tambahan milik sendiri — kecualikan lebih dulu, contoh:");
    s.comment(
      `/ip firewall mangle add chain=postrouting action=accept dst-address=192.168.10.5 out-interface=${antiIfaces[0]} place-before=0`,
    );
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
  if (radios.length > 0) {
    s.comment(
      wirelessKind(config) === "wifi"
        ? "  /interface wifi print      -> SSID & status tiap radio"
        : "  /interface wireless print  -> SSID & status tiap radio",
    );
  }
  if (config.hotspots.length > 0) {
    s.comment("  /ip hotspot active print   -> user hotspot yang sedang login");
  }
  if (config.pppoe.enabled) {
    s.comment("  /ppp active print          -> sesi PPPoE yang aktif");
  }
  if (config.users.some((u) => u.name.trim())) {
    s.comment("  /user print                -> daftar user router");
  }
  if (anti.enabled && antiIfaces.length > 0) {
    s.comment("  /ip firewall mangle print stats -> hitungan paket anti tethering");
  }
  s.blank().comment(`Objek hasil script ini diberi comment "${BRAND}".`);
  s.comment("Pengecualian: DHCP server, hotspot, profil hotspot, dan PPPoE server");
  s.comment("memang tidak punya kolom comment di RouterOS.");
  if (radios.length > 0 && wirelessKind(config) === "legacy") {
    s.comment('Profil keamanan wireless dikenali dari namanya yang berawalan "sec-".');
  }
  s.comment(`Menghapus semuanya: /ip firewall filter remove [find comment~"${BRAND}"]`);
  s.comment("(ulangi untuk menu lain: /ip firewall nat, /ip address, /ip pool, dst)");

  return s.toString();
}
