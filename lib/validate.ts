import { addressOfInterface, physicalInterfaces, wirelessInterfaces } from "./interfaces";
import { getModel } from "./models";
import { addressPart, ipInCidr, isCidr, isIpv4 } from "./net";
import { RESERVED_PPP_PROFILES, type Issue, type SetupConfig } from "./types";

export interface PasswordCheck {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  problems: string[];
}

export function checkPassword(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 8) problems.push("minimal 8 karakter");
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) problems.push("kombinasi huruf besar & kecil");
  if (!/\d/.test(password)) problems.push("mengandung angka");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("mengandung simbol");

  const score = Math.max(0, 4 - problems.length) as 0 | 1 | 2 | 3 | 4;
  const label = ["Sangat lemah", "Lemah", "Cukup", "Kuat", "Sangat kuat"][score];
  return { score, label, problems };
}

/** Nama objek RouterOS: hindari spasi & karakter yang butuh escaping. */
const NAME_OK = /^[A-Za-z0-9_.-]+$/;

export function validateConfig(config: SetupConfig): Issue[] {
  const issues: Issue[] = [];
  const err = (section: Issue["section"], message: string) =>
    issues.push({ section, level: "error", message });
  const warn = (section: Issue["section"], message: string) =>
    issues.push({ section, level: "warn", message });

  // --- a & b: Type Mikrotik + RouterOS ---------------------------------
  const model = getModel(config.modelId);
  if (!model) {
    err("device", "Type Mikrotik belum dipilih.");
  } else if (config.modelId === "custom" && physicalInterfaces(config).length === 0) {
    err("device", "Daftar interface manual masih kosong.");
  }
  if (!config.ros) {
    err("device", "Versi RouterOS wajib dipilih sebelum mengisi section lain.");
  } else if (model && !model.supports.includes(config.ros)) {
    err("device", `${model.name} tidak mendukung RouterOS ${config.ros}.`);
  }

  if (config.system.identity && !NAME_OK.test(config.system.identity)) {
    err("device", "Identity hanya boleh huruf, angka, titik, strip, dan underscore.");
  }

  // --- c: WAN -----------------------------------------------------------
  const wanIfaces = config.wans.map((w) => w.iface).filter(Boolean);
  if (config.wans.length === 0 || wanIfaces.length === 0) {
    err("wan", "Minimal 1 interface WAN wajib diisi.");
  }
  if (new Set(wanIfaces).size !== wanIfaces.length) {
    err("wan", "Satu interface tidak boleh dipakai oleh dua WAN sekaligus.");
  }
  config.wans.forEach((wan, i) => {
    const tag = `WAN ${i + 1}`;
    if (!wan.iface) {
      err("wan", `${tag}: interface belum dipilih.`);
      return;
    }
    if (wan.mode === "static") {
      if (!isCidr(wan.address)) err("wan", `${tag}: IP address harus format CIDR, misal 100.64.0.2/30.`);
      if (!isIpv4(wan.gateway)) err("wan", `${tag}: gateway bukan alamat IPv4 yang valid.`);
      if (isCidr(wan.address) && isIpv4(wan.gateway) && !ipInCidr(wan.gateway, wan.address)) {
        warn("wan", `${tag}: gateway ${wan.gateway} di luar subnet ${wan.address}.`);
      }
      if (!/^\d+$/.test(wan.staticDistance) || Number(wan.staticDistance) < 1 || Number(wan.staticDistance) > 255) {
        err("wan", `${tag}: distance harus angka 1–255.`);
      }
    } else if (wan.addDefaultRoute) {
      if (!/^\d+$/.test(wan.dhcpDistance) || Number(wan.dhcpDistance) < 1 || Number(wan.dhcpDistance) > 255) {
        err("wan", `${tag}: default-route-distance harus angka 1–255.`);
      }
    }
  });
  const defaultRouteCount = config.wans.filter(
    (w) => (w.mode === "dhcp" && w.addDefaultRoute) || w.mode === "static",
  ).length;
  if (config.wans.length > 1 && defaultRouteCount > 1) {
    const distances = config.wans.map((w) => (w.mode === "dhcp" ? w.dhcpDistance : w.staticDistance));
    if (new Set(distances).size !== distances.length) {
      warn("wan", "Beberapa WAN memakai distance yang sama — atur berbeda, atau gunakan menu Load Balance / Fail Over.");
    }
  }

  // --- d: DNS -----------------------------------------------------------
  const dnsServers = config.dns.servers.map((s) => s.trim()).filter(Boolean);
  dnsServers.forEach((server) => {
    if (!isIpv4(server)) err("dns", `DNS server "${server}" bukan alamat IPv4 yang valid.`);
  });
  if (dnsServers.length === 0 && !config.wans.some((w) => w.mode === "dhcp" && w.usePeerDns)) {
    warn("dns", "Tidak ada DNS server manual dan tidak ada WAN DHCP yang memakai peer DNS.");
  }

  // --- e: NAT -----------------------------------------------------------
  if (config.nat.enabled && config.nat.mode === "perInterface" && config.nat.interfaces.length === 0) {
    err("nat", "Mode per-interface dipilih tapi belum ada interface WAN yang ditandai.");
  }
  if (!config.nat.enabled) {
    warn("nat", "NAT masquerade dimatikan — klien LAN tidak akan bisa keluar ke internet.");
  }

  // --- f: Bridge --------------------------------------------------------
  const bridgeNames = config.bridges.map((b) => b.name.trim()).filter(Boolean);
  if (new Set(bridgeNames).size !== bridgeNames.length) {
    err("bridge", "Nama bridge tidak boleh duplikat.");
  }
  const portOwner = new Map<string, string>();
  config.bridges.forEach((bridge, i) => {
    const tag = bridge.name.trim() || `Bridge ${i + 1}`;
    if (!bridge.name.trim()) err("bridge", `Bridge ${i + 1}: nama belum diisi.`);
    else if (!NAME_OK.test(bridge.name.trim())) err("bridge", `${tag}: nama mengandung karakter tidak valid.`);
    if (bridge.ports.length === 0) err("bridge", `${tag}: minimal 1 port harus dipilih.`);
    for (const port of bridge.ports) {
      const owner = portOwner.get(port);
      if (owner && owner !== tag) {
        err("bridge", `Interface ${port} dipakai di dua bridge (${owner} dan ${tag}).`);
      } else {
        portOwner.set(port, tag);
      }
      if (wanIfaces.includes(port)) {
        err("bridge", `${tag}: ${port} sudah dipakai sebagai WAN, jangan dijadikan port bridge.`);
      }
    }
  });

  // --- f2: Wireless -----------------------------------------------------
  const radios = config.wireless.radios;
  const availableRadios = wirelessInterfaces(config);
  const radioIfaces = radios.map((r) => r.iface).filter(Boolean);
  if (new Set(radioIfaces).size !== radioIfaces.length) {
    err("wireless", "Satu radio tidak boleh diatur dua kali.");
  }
  radios.forEach((radio, i) => {
    const tag = radio.ssid.trim() || radio.iface || `Radio ${i + 1}`;
    if (!radio.iface) {
      err("wireless", `Radio ${i + 1}: interface belum dipilih.`);
    } else if (!availableRadios.includes(radio.iface)) {
      err("wireless", `${tag}: ${radio.iface} bukan radio pada model yang dipilih.`);
    }

    if (!radio.ssid.trim()) {
      err("wireless", `Radio ${i + 1}: SSID belum diisi.`);
    } else if (radio.ssid.trim().length > 32) {
      err("wireless", `${tag}: SSID maksimal 32 karakter.`);
    }

    if (radio.security !== "open") {
      // Batas WPA-PSK: 8–63 karakter. Di luar itu router menolak kuncinya.
      if (radio.password.length < 8) {
        err("wireless", `${tag}: password WiFi minimal 8 karakter.`);
      } else if (radio.password.length > 63) {
        err("wireless", `${tag}: password WiFi maksimal 63 karakter.`);
      }
    }

    if (radio.mode !== "ap" || !radio.iface) return;

    // Radio yang tidak digabung ke bridge dan tidak punya IP tidak terhubung
    // ke mana pun — SSID-nya muncul, tapi klien tidak dapat apa-apa.
    const bridge = portOwner.get(radio.iface);
    const segment = bridge || radio.iface;
    if (!bridge && !addressOfInterface(config, radio.iface)) {
      warn(
        "wireless",
        `${tag}: ${radio.iface} belum masuk bridge mana pun dan belum punya IP — klien WiFi tidak akan dapat akses. Jadikan port bridge di section Bridge.`,
      );
    }

    const behindHotspot = config.hotspots.some((h) => h.iface === segment);
    if (radio.security === "open" && !behindHotspot) {
      warn(
        "wireless",
        `${tag}: jaringan terbuka tanpa portal hotspot — siapa pun dalam jangkauan bisa memakai internet Anda.`,
      );
    }
    if (radio.security !== "open" && behindHotspot) {
      warn(
        "wireless",
        `${tag}: klien harus melewati dua lapis login — password WiFi lalu halaman hotspot. Untuk hotspot voucher, biasanya SSID dibuat terbuka.`,
      );
    }
  });

  // --- g: VLAN ----------------------------------------------------------
  const vlanNames = config.vlans.map((v) => v.name.trim()).filter(Boolean);
  if (new Set(vlanNames).size !== vlanNames.length) err("vlan", "Nama VLAN tidak boleh duplikat.");
  const vlanPairs = new Set<string>();
  config.vlans.forEach((vlan, i) => {
    const tag = vlan.name.trim() || `VLAN ${i + 1}`;
    if (!vlan.name.trim()) err("vlan", `VLAN ${i + 1}: nama belum diisi.`);
    else if (!NAME_OK.test(vlan.name.trim())) err("vlan", `${tag}: nama mengandung karakter tidak valid.`);
    const id = Number(vlan.vlanId);
    if (!/^\d+$/.test(vlan.vlanId) || id < 1 || id > 4094) {
      err("vlan", `${tag}: VLAN ID harus angka 1–4094.`);
    }
    if (!vlan.parent) err("vlan", `${tag}: interface induk belum dipilih.`);
    const pair = `${vlan.parent}#${vlan.vlanId}`;
    if (vlan.parent && vlan.vlanId) {
      if (vlanPairs.has(pair)) err("vlan", `VLAN ID ${vlan.vlanId} duplikat pada induk ${vlan.parent}.`);
      vlanPairs.add(pair);
    }
  });

  // --- h: IP Address ----------------------------------------------------
  const addrPairs = new Set<string>();
  config.addresses.forEach((addr, i) => {
    const tag = `IP #${i + 1}`;
    if (!addr.iface) err("address", `${tag}: interface belum dipilih.`);
    if (!isCidr(addr.address)) {
      err("address", `${tag}: alamat harus format CIDR, misal 192.168.10.1/24.`);
    }
    const key = `${addr.iface}#${addr.address}`;
    if (addrPairs.has(key)) err("address", `${tag}: alamat duplikat pada interface yang sama.`);
    addrPairs.add(key);
    const owner = portOwner.get(addr.iface);
    if (owner) {
      err("address", `${tag}: ${addr.iface} adalah port bridge ${owner} — pasang IP di bridge-nya, bukan di port.`);
    }
    if (wanIfaces.includes(addr.iface) && config.wans.find((w) => w.iface === addr.iface)?.mode === "dhcp") {
      warn("address", `${tag}: ${addr.iface} memakai DHCP Client, IP statis di sini bisa bentrok.`);
    }
  });

  // --- i: IP Pool -------------------------------------------------------
  const poolNames = config.pools.map((p) => p.name.trim()).filter(Boolean);
  if (new Set(poolNames).size !== poolNames.length) err("pool", "Nama pool tidak boleh duplikat.");
  config.pools.forEach((pool, i) => {
    const tag = pool.name.trim() || `Pool ${i + 1}`;
    if (!pool.name.trim()) err("pool", `Pool ${i + 1}: nama belum diisi.`);
    else if (!NAME_OK.test(pool.name.trim())) err("pool", `${tag}: nama mengandung karakter tidak valid.`);
    if (!isIpv4(pool.rangeStart)) err("pool", `${tag}: IP awal tidak valid.`);
    if (!isIpv4(pool.rangeEnd)) err("pool", `${tag}: IP akhir tidak valid.`);
  });

  // --- j: DHCP Server ---------------------------------------------------
  config.dhcpServers.forEach((dhcp, i) => {
    const tag = dhcp.name.trim() || `DHCP Server ${i + 1}`;
    if (!dhcp.name.trim()) err("dhcp", `DHCP Server ${i + 1}: nama belum diisi.`);
    if (!dhcp.iface) err("dhcp", `${tag}: interface belum dipilih.`);
    if (!dhcp.pool) err("dhcp", `${tag}: pool belum dipilih.`);
    else if (!poolNames.includes(dhcp.pool)) err("dhcp", `${tag}: pool "${dhcp.pool}" tidak ada di section IP Pool.`);
    const network = dhcp.network.trim() || addressOfInterface(config, dhcp.iface);
    if (!network) {
      err("dhcp", `${tag}: network tidak bisa ditentukan — isi IP address untuk ${dhcp.iface || "interface ini"} lebih dulu.`);
    } else if (dhcp.network.trim() && !isCidr(dhcp.network)) {
      err("dhcp", `${tag}: network harus format CIDR.`);
    }
    if (dhcp.gateway && !isIpv4(dhcp.gateway)) err("dhcp", `${tag}: gateway bukan IPv4 yang valid.`);
    const pool = config.pools.find((p) => p.name.trim() === dhcp.pool);
    if (pool && network && isCidr(network)) {
      if (isIpv4(pool.rangeStart) && !ipInCidr(pool.rangeStart, network)) {
        warn("dhcp", `${tag}: range pool ${pool.name} di luar subnet ${network}.`);
      }
    }
  });

  // --- k: Hotspot -------------------------------------------------------
  config.hotspots.forEach((hs, i) => {
    const tag = hs.name.trim() || `Hotspot ${i + 1}`;
    if (!hs.name.trim()) err("hotspot", `Hotspot ${i + 1}: nama belum diisi.`);
    if (!hs.iface) err("hotspot", `${tag}: interface belum dipilih.`);
    if (hs.auth.length === 0) {
      err("hotspot", `${tag}: minimal 1 metode autentikasi harus dipilih.`);
    } else if (!hs.auth.some((a) => a === "http-pap" || a === "http-chap")) {
      // cookie & mac-cookie hanya menyimpan sesi; login pertamanya tetap
      // butuh form HTTP, dan RouterOS menolak profil tanpa salah satunya.
      err("hotspot", `${tag}: cookie/mac-cookie perlu didampingi http-pap atau http-chap.`);
    }
    if (!hs.pool) err("hotspot", `${tag}: address pool belum dipilih.`);
    else if (!poolNames.includes(hs.pool)) err("hotspot", `${tag}: pool "${hs.pool}" tidak ada di section IP Pool.`);
    if (hs.iface && !addressOfInterface(config, hs.iface)) {
      err("hotspot", `${tag}: ${hs.iface} belum punya IP address — tambahkan di section IP Address.`);
    }
    // Klien hotspot tetap butuh DHCP server untuk mendapat IP. Yang benar
    // adalah keduanya memakai pool yang sama — itu pula yang dilakukan
    // /ip hotspot setup bawaan RouterOS. Yang perlu ditegur justru bila
    // poolnya berbeda, atau bila DHCP server-nya tidak ada sama sekali.
    const dhcpOnIface = config.dhcpServers.filter((d) => d.iface === hs.iface);
    if (hs.iface && dhcpOnIface.length === 0) {
      warn(
        "hotspot",
        `${tag}: ${hs.iface} belum punya DHCP Server — klien hotspot tidak akan dapat IP otomatis.`,
      );
    } else if (hs.pool && dhcpOnIface.some((d) => d.pool && d.pool !== hs.pool)) {
      warn(
        "hotspot",
        `${tag}: DHCP Server di ${hs.iface} memakai pool berbeda dari hotspot — samakan agar tidak bentrok.`,
      );
    }
  });

  // --- l: PPPoE Server --------------------------------------------------
  if (config.pppoe.enabled) {
    const p = config.pppoe;
    if (!p.iface) err("pppoe", "Interface PPPoE Server belum dipilih.");
    if (!p.serviceName.trim()) err("pppoe", "Service name belum diisi.");

    // --- paket / profile ---
    const profileNames = p.profiles.map((prof) => prof.name.trim()).filter(Boolean);
    if (new Set(profileNames).size !== profileNames.length) {
      err("pppoe", "Nama paket tidak boleh duplikat.");
    }
    p.profiles.forEach((prof, i) => {
      const label = prof.name.trim() || `Paket #${i + 1}`;
      if (!prof.name.trim()) {
        err("pppoe", `Paket #${i + 1}: nama belum diisi.`);
      } else if (!NAME_OK.test(prof.name.trim())) {
        err("pppoe", `${label}: nama hanya boleh huruf, angka, titik, strip, dan underscore.`);
      } else if (RESERVED_PPP_PROFILES.includes(prof.name.trim())) {
        // Nama ini sudah dipakai RouterOS; membuatnya akan dilewati penjagaan
        // sehingga pengaturan yang diisi di sini tidak pernah terpasang.
        err("pppoe", `${label}: nama itu milik profile bawaan RouterOS — pakai nama lain.`);
      }
      if (prof.localAddress.trim() && !isIpv4(addressPart(prof.localAddress))) {
        err("pppoe", `${label}: local address harus alamat IPv4, misal 10.10.10.1.`);
      }
      if (prof.pool && !poolNames.includes(prof.pool)) {
        err("pppoe", `${label}: pool "${prof.pool}" tidak ada di section IP Pool.`);
      }
      if (prof.rateLimit.trim() && !/^\d+[kMG]?\/\d+[kMG]?$/.test(prof.rateLimit.trim())) {
        err("pppoe", `${label}: rate limit harus format "upload/download", misal 5M/10M.`);
      }
      if (!prof.pool && !prof.localAddress.trim() && !prof.rateLimit.trim()) {
        warn("pppoe", `${label}: belum ada pengaturan apa pun, isinya sama saja dengan profile bawaan.`);
      }
    });

    const knownProfiles = [...RESERVED_PPP_PROFILES, ...profileNames];
    if (!knownProfiles.includes(p.defaultProfile.trim())) {
      err("pppoe", `Default profile "${p.defaultProfile}" tidak ada — pilih ulang.`);
    }

    // --- akun pelanggan ---
    const users = p.secrets.map((s) => s.user.trim()).filter(Boolean);
    if (new Set(users).size !== users.length) err("pppoe", "Username PPPoE duplikat.");
    p.secrets.forEach((secret, i) => {
      const label = secret.user.trim() || `User #${i + 1}`;
      if (!secret.user.trim()) err("pppoe", `User #${i + 1}: username belum diisi.`);
      if (!secret.password.trim()) err("pppoe", `${label}: password belum diisi.`);
      else if (secret.password.trim().length < 6) {
        warn("pppoe", `${label}: password kurang dari 6 karakter.`);
      }
      if (!knownProfiles.includes(secret.profile.trim())) {
        err("pppoe", `${label}: paket "${secret.profile}" tidak ada — pilih ulang.`);
      }
    });
  }

  // --- Firewall ---------------------------------------------------------
  if (config.firewall.enabled) {
    if (config.firewall.restrictServices) {
      if (!config.firewall.mgmtSubnet.trim()) {
        warn("firewall", "Subnet manajemen kosong — akses Winbox/SSH tidak dibatasi ke subnet tertentu.");
      } else if (!isCidr(config.firewall.mgmtSubnet)) {
        err("firewall", "Subnet manajemen harus format CIDR, misal 192.168.10.0/24.");
      }
    }
    if (config.firewall.fasttrack && config.hotspots.length > 0) {
      warn("firewall", "FastTrack aktif bersama Hotspot — bisa membuat perhitungan trafik/queue hotspot tidak akurat.");
    }
  }

  // --- Anti tethering -----------------------------------------------------
  const anti = config.antiTethering;
  if (anti.enabled) {
    const chosen = anti.interfaces.filter(Boolean);
    if (chosen.length === 0) {
      err("firewall", "Anti tethering aktif tapi belum ada interface yang dipilih.");
    }
    for (const iface of chosen) {
      if (wanIfaces.includes(iface)) {
        // Ke arah WAN, TTL rendah membuat paket mati sebelum sampai tujuan —
        // bukan anti tethering, melainkan memutus internet.
        err(
          "firewall",
          `Anti tethering: ${iface} adalah interface WAN. Aturan ini dipasang ke arah klien, bukan ke arah ISP.`,
        );
      }
      const owner = portOwner.get(iface);
      if (owner) {
        warn(
          "firewall",
          `Anti tethering: ${iface} adalah port bridge ${owner} — pasang di bridge-nya agar trafik benar-benar melewati aturan ini.`,
        );
      }
    }
    if (config.firewall.enabled && config.firewall.fasttrack) {
      warn(
        "firewall",
        "Anti tethering tidak akan konsisten selama FastTrack aktif — koneksi ber-FastTrack melewati mangle. Matikan FastTrack bila aturan ini harus rapat.",
      );
    }
    if (anti.ttl === "1" && config.pppoe.enabled && chosen.includes(config.pppoe.iface)) {
      warn(
        "firewall",
        "TTL 1 di interface PPPoE akan memutus pelanggan yang memakai router sendiri. Pakai TTL 2 bila pelanggan PPPoE punya router di rumahnya.",
      );
    }
  }

  // --- User router -------------------------------------------------------
  if (config.system.adminPassword) {
    const check = checkPassword(config.system.adminPassword);
    if (check.score < 3) {
      err("user", `Password admin terlalu lemah — perlu ${check.problems.join(", ")}.`);
    }
  } else {
    warn("user", "Password admin dikosongkan — router akan tetap tanpa password.");
  }

  const userNames = config.users.map((u) => u.name.trim()).filter(Boolean);
  if (new Set(userNames).size !== userNames.length) {
    err("user", "Nama user tidak boleh duplikat.");
  }
  config.users.forEach((user, i) => {
    const tag = user.name.trim() || `User #${i + 1}`;
    if (!user.name.trim()) {
      err("user", `User #${i + 1}: nama belum diisi.`);
    } else if (!NAME_OK.test(user.name.trim())) {
      err("user", `${tag}: nama hanya boleh huruf, angka, titik, strip, dan underscore.`);
    }
    if (user.name.trim() === config.system.adminUser.trim()) {
      err("user", `${tag}: nama sama dengan user admin yang sudah ada — pakai nama lain.`);
    }
    if (!user.password) {
      err("user", `${tag}: password belum diisi.`);
    } else {
      const check = checkPassword(user.password);
      if (check.score < 3) err("user", `${tag}: password terlalu lemah — perlu ${check.problems.join(", ")}.`);
    }
    if (user.allowedAddress.trim() && !isCidr(user.allowedAddress)) {
      err("user", `${tag}: batas alamat harus format CIDR, misal 192.168.10.0/24.`);
    }
  });

  return issues;
}

export function hasErrors(issues: Issue[]): boolean {
  return issues.some((i) => i.level === "error");
}
