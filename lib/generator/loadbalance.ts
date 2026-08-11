import type { IspEntry, LoadBalanceConfig } from "../types-loadbalance";
import { args, type ArgValue, ScriptBuilder } from "./script-builder";

/** Penanda pembuat yang ikut di setiap comment agar mudah dikenali di Winbox. */
const BRAND = "By Mikrosetting";

function tag(text?: string): string {
  const clean = (text ?? "").trim();
  return clean ? `${clean} - ${BRAND}` : BRAND;
}

function stamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Nama pendek RouterOS-safe untuk connection-mark / routing-mark / routing table. */
function ispSlug(isp: IspEntry, index: number): string {
  const clean = isp.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || `isp${index + 1}`;
}

export function generateLoadBalanceScript(config: LoadBalanceConfig): string {
  const s = new ScriptBuilder();
  const v7 = config.ros === "v7";
  const isps = config.isps.filter((i) => i.iface.trim() && i.gateway.trim());
  const lan = config.lanIface.trim();
  const slugs = isps.map((isp, i) => ispSlug(isp, i));
  const totalWeight = isps.reduce((sum, isp) => sum + (Number(isp.weight) || 1), 0);
  const { pccEnabled, failoverEnabled, failoverMethod } = config;
  const recursive = failoverEnabled && failoverMethod === "recursive";
  const netwatch = failoverEnabled && failoverMethod === "netwatch";
  const schedule = failoverEnabled && failoverMethod === "schedule";

  /** Gateway yang dipakai default route: target recursive (v7/v6, dua-duanya) untuk method recursive, gateway asli untuk netwatch/schedule. */
  const failoverGateway = (isp: IspEntry) => (recursive ? isp.checkTarget : isp.gateway);
  const failoverExtraArgs: Array<[string, ArgValue]> = recursive
    ? [
        ["target-scope", 10],
        ["check-gateway", "ping"],
      ]
    : [];

  let sectionNo = 0;
  const section = (title: string, description?: string) => {
    sectionNo += 1;
    s.section(`${sectionNo}. ${title}`, description);
  };

  // ---------------------------------------------------------------- header
  const methodLabel = { recursive: "Recursive Gateway", netwatch: "Netwatch Ping", schedule: "Scheduler Check" }[
    failoverMethod
  ];
  s.banner([
    "SCRIPT LOAD BALANCE PCC & FAILOVER MULTI-ISP",
    "Generator Script Mikrotik by Mikrosetting.com",
    "",
    `Jumlah ISP : ${isps.length}`,
    `RouterOS   : ${config.ros ? config.ros : "(belum dipilih)"}`,
    `Load Balance (PCC) : ${pccEnabled ? "aktif" : "tidak aktif"}`,
    `Failover            : ${failoverEnabled ? `aktif — metode ${methodLabel}` : "tidak aktif"}`,
    `Dibuat     : ${stamp()}`,
    "",
    "SYARAT",
    "Interface tiap ISP (dan interface LAN) harus SUDAH punya IP address —",
    "script ini hanya menambah lapisan routing/PCC di atasnya, bukan",
    "mengatur ulang alamat IP. Gunakan menu Setup Mikrotik Baru dulu bila",
    "WAN belum dikonfigurasi.",
    "",
    "SIFAT SCRIPT INI",
    "Hanya menambah, tidak menghapus apa pun. Setiap perintah dilindungi",
    "pemeriksaan \"buat hanya bila belum ada\", jadi aman dijalankan ulang.",
    "",
    "BACKUP DULU (bila router sudah terpakai)",
    "  /system backup save name=sebelum-loadbalance",
    "  /export file=sebelum-loadbalance",
  ]);

  if (isps.length < 2) {
    s.blank().comment(
      "Minimal 2 ISP diperlukan agar load balance & failover berjalan — lengkapi dulu section ISP.",
    );
    return s.toString();
  }
  if (!pccEnabled && !failoverEnabled) {
    s.blank().comment(
      "Aktifkan Load Balance (PCC) atau Failover di section Opsi Lanjutan — keduanya mati, tidak ada yang bisa digenerate.",
    );
    return s.toString();
  }

  // ------------------------------------------------------- mangle: PCC mark
  if (pccEnabled) {
    section(
      "MANGLE — PCC MARK-CONNECTION",
      `Membagi koneksi baru dari ${lan || "(LAN belum diisi)"} ke tiap ISP berdasarkan bobot yang diatur (total bobot saat ini: ${totalWeight}).`,
    );
    let offset = 0;
    isps.forEach((isp, i) => {
      const weight = Math.max(1, Number(isp.weight) || 1);
      const connMark = `${slugs[i]}-conn`;
      for (let r = 0; r < weight; r += 1) {
        const remainder = offset + r;
        s.addIfMissing(
          "/ip firewall mangle",
          [
            ["chain", "prerouting"],
            ["in-interface", lan],
            ["connection-mark", "no-mark"],
            ["per-connection-classifier", `${config.classifier}:${totalWeight}/${remainder}`],
          ],
          args([
            ["chain", "prerouting"],
            ["in-interface", lan],
            ["connection-mark", "no-mark"],
            ["per-connection-classifier", `${config.classifier}:${totalWeight}/${remainder}`],
            ["action", "mark-connection"],
            ["new-connection-mark", connMark],
            ["passthrough", false],
            ["comment", tag(`PCC ${isp.name} (jatah ${remainder + 1}/${totalWeight})`)],
          ]),
        );
      }
      offset += weight;
    });

    section("MANGLE — MARK-ROUTING", "Mengarahkan tiap connection-mark ke tabel routing ISP-nya.");
    isps.forEach((isp, i) => {
      const connMark = `${slugs[i]}-conn`;
      const routingMark = `to-${slugs[i]}`;
      s.addIfMissing(
        "/ip firewall mangle",
        [
          ["chain", "prerouting"],
          ["connection-mark", connMark],
        ],
        args([
          ["chain", "prerouting"],
          ["connection-mark", connMark],
          ["action", "mark-routing"],
          ["new-routing-mark", routingMark],
          ["passthrough", false],
          ["comment", tag(`Routing ${isp.name}`)],
        ]),
      );
    });
  }

  // ------------------------------------------------------- deteksi failover
  if (recursive) {
    section(
      "RECURSIVE GATEWAY — TARGET PENGUJI JALUR",
      "Host route /32 ke IP publik lewat gateway asli tiap ISP, dipantau check-gateway=ping. Inilah yang mendeteksi ISP mati.",
    );
    isps.forEach((isp) => {
      s.addIfMissing(
        "/ip route",
        [
          ["dst-address", `${isp.checkTarget}/32`],
          ["gateway", isp.gateway],
        ],
        args([
          ["dst-address", `${isp.checkTarget}/32`],
          ["gateway", isp.gateway],
          ["distance", 1],
          ["scope", 10],
          ["check-gateway", "ping"],
          ["comment", tag(`Cek jalur ${isp.name}`)],
        ]),
      );
    });
  } else if (netwatch) {
    section(
      "NETWATCH — PIN JALUR CEK",
      "Route /32 khusus supaya ping Netwatch ke target tiap ISP pasti lewat gateway ISP itu (Netwatch sendiri tidak punya opsi pilih interface).",
    );
    isps.forEach((isp) => {
      s.addIfMissing(
        "/ip route",
        [
          ["dst-address", `${isp.checkTarget}/32`],
          ["gateway", isp.gateway],
        ],
        args([
          ["dst-address", `${isp.checkTarget}/32`],
          ["gateway", isp.gateway],
          ["distance", 1],
          ["comment", tag(`Pin cek jalur ${isp.name}`)],
        ]),
      );
    });

    section(
      "NETWATCH — DETEKSI ISP",
      "Memantau target tiap ISP; saat putus/pulih, route ISP itu otomatis dimatikan/dinyalakan di semua tabel.",
    );
    isps.forEach((isp) => {
      const upScript = `:log info "${isp.name} aktif kembali"; /ip route enable [find gateway=${isp.gateway}]`;
      const downScript = `:log info "${isp.name} terputus"; /ip route disable [find gateway=${isp.gateway}]`;
      const netwatchArgs: Array<[string, ArgValue]> = [
        ["host", isp.checkTarget],
        ["interval", config.checkInterval],
      ];
      if (v7) netwatchArgs.push(["type", "simple"]);
      netwatchArgs.push(
        ["up-script", upScript],
        ["down-script", downScript],
        ["comment", tag(`Netwatch ${isp.name}`)],
      );
      s.addIfMissing("/tool netwatch", [["host", isp.checkTarget]], args(netwatchArgs));
    });
  } else if (schedule) {
    section(
      "SCHEDULER — DETEKSI ISP",
      "Script berkala ping tiap ISP lewat interface-nya masing-masing (tanpa perlu paket Netwatch); ISP yang tidak merespons route-nya dimatikan sampai pulih.",
    );
    const scriptName = "mikrosetting-failover-check";
    const schedulerName = "mikrosetting-failover-scheduler";
    const scriptSource = [
      ":local ok",
      ...isps.flatMap((isp) => [
        `:set ok [/ping ${isp.checkTarget} interface=${isp.iface} count=3]`,
        `:if ($ok > 0) do={ /ip route enable [find gateway=${isp.gateway}] } else={ /ip route disable [find gateway=${isp.gateway}] }`,
      ]),
    ].join("\n");
    s.addIfMissing(
      "/system script",
      [["name", scriptName]],
      args([
        ["name", scriptName],
        ["source", scriptSource],
        ["comment", tag("Cek jalur tiap ISP")],
      ]),
    );
    s.addIfMissing(
      "/system scheduler",
      [["name", schedulerName]],
      args([
        ["name", schedulerName],
        ["interval", config.checkInterval],
        ["on-event", scriptName],
        ["comment", tag("Jadwal cek jalur ISP")],
      ]),
    );
  }

  // -------------------------------------------------------- routing table
  if (pccEnabled && v7) {
    section(
      "ROUTING TABLE",
      "RouterOS v7 mewajibkan tabel routing dideklarasikan dulu sebelum dipakai di /ip route.",
    );
    slugs.forEach((slug, i) => {
      const name = `to-${slug}`;
      // /routing table memakai "fib" sebagai flag telanjang, bukan fib=yes —
      // di luar pola args() yang selalu key=value, jadi ditambah manual.
      s.addIfMissing(
        "/routing table",
        [["name", name]],
        `${args([["name", name], ["comment", tag(`Tabel ${isps[i].name}`)]])} fib`,
      );
    });
  }

  // --------------------------------------------- default route per routing-mark
  if (pccEnabled) {
    section(
      "DEFAULT ROUTE PER ISP",
      failoverEnabled
        ? "Tiap tabel/mark ISP diberi rute ke SEMUA ISP secara berurutan — bila ISP utamanya putus, trafik yang sudah di-mark otomatis lompat ke ISP berikutnya."
        : "Failover tidak aktif — tiap tabel/mark ISP cuma punya satu rute langsung ke gateway-nya sendiri, tanpa cadangan.",
    );
    isps.forEach((owner, ownerIndex) => {
      const routingMark = `to-${slugs[ownerIndex]}`;
      if (!failoverEnabled) {
        s.addIfMissing(
          "/ip route",
          [
            ["dst-address", "0.0.0.0/0"],
            ["gateway", owner.gateway],
            [v7 ? "routing-table" : "routing-mark", routingMark],
          ],
          args([
            ["dst-address", "0.0.0.0/0"],
            ["gateway", owner.gateway],
            [v7 ? "routing-table" : "routing-mark", routingMark],
            ["distance", 1],
            ["comment", tag(`Default ${owner.name}`)],
          ]),
        );
        return;
      }
      const order = isps.map((_, k) => isps[(ownerIndex + k) % isps.length]);
      order.forEach((entry, position) => {
        const distance = position + 1;
        s.addIfMissing(
          "/ip route",
          [
            ["dst-address", "0.0.0.0/0"],
            ["gateway", failoverGateway(entry)],
            [v7 ? "routing-table" : "routing-mark", routingMark],
          ],
          args([
            ["dst-address", "0.0.0.0/0"],
            ["gateway", failoverGateway(entry)],
            [v7 ? "routing-table" : "routing-mark", routingMark],
            ["distance", distance],
            ...failoverExtraArgs,
            [
              "comment",
              tag(position === 0 ? `Utama ${owner.name}` : `Cadangan ${owner.name} via ${entry.name}`),
            ],
          ]),
        );
      });
    });
  }

  // ------------------------------------------------- default route umum
  section(
    "DEFAULT ROUTE UMUM (TANPA MARK)",
    pccEnabled
      ? "Untuk trafik yang tidak kena mangle (mis. dari router sendiri)."
      : "Jalur utama untuk seluruh trafik — PCC tidak aktif, jadi tidak ada pembagian per koneksi.",
  );
  if (failoverEnabled) {
    isps.forEach((isp) => {
      s.addIfMissing(
        "/ip route",
        [
          ["dst-address", "0.0.0.0/0"],
          ["gateway", failoverGateway(isp)],
        ],
        args([
          ["dst-address", "0.0.0.0/0"],
          ["gateway", failoverGateway(isp)],
          ["distance", isp.distance],
          ...failoverExtraArgs,
          ["comment", tag(`Default via ${isp.name}`)],
        ]),
      );
    });
  } else {
    const primary = isps.reduce((min, isp) => (Number(isp.distance) < Number(min.distance) ? isp : min));
    s.addIfMissing(
      "/ip route",
      [
        ["dst-address", "0.0.0.0/0"],
        ["gateway", primary.gateway],
      ],
      args([
        ["dst-address", "0.0.0.0/0"],
        ["gateway", primary.gateway],
        ["distance", primary.distance],
        ["comment", tag(`Default via ${primary.name}`)],
      ]),
    );
  }

  // ----------------------------------------------------------------- NAT
  if (config.natEnabled) {
    section("NAT", "Masquerade per interface ISP.");
    isps.forEach((isp) => {
      s.addIfMissing(
        "/ip firewall nat",
        [
          ["chain", "srcnat"],
          ["action", "masquerade"],
          ["out-interface", isp.iface],
        ],
        args([
          ["chain", "srcnat"],
          ["action", "masquerade"],
          ["out-interface", isp.iface],
          ["comment", tag(`NAT ${isp.name}`)],
        ]),
      );
    });
  }

  // ------------------------------------------------------------ verifikasi
  const cleanup = [
    '  /ip firewall mangle remove [find comment~"By Mikrosetting"]',
    '  /ip firewall nat remove [find comment~"By Mikrosetting"]',
    '  /ip route remove [find comment~"By Mikrosetting"]',
    ...(pccEnabled && v7 ? ['  /routing table remove [find comment~"By Mikrosetting"]'] : []),
    ...(netwatch ? ['  /tool netwatch remove [find comment~"By Mikrosetting"]'] : []),
    ...(schedule
      ? [
          '  /system scheduler remove [find comment~"By Mikrosetting"]',
          '  /system script remove [find comment~"By Mikrosetting"]',
        ]
      : []),
  ];
  s.banner([
    "SELESAI — CARA MEMERIKSA HASIL",
    "",
    "/ip route print where dst-address=\"0.0.0.0/0\"",
    recursive
      ? "  Pastikan rute recursive (gateway = IP target, bukan gateway asli ISP) aktif (huruf A)."
      : "  Pastikan rute yang berstatus A (aktif) mengarah ke ISP yang sedang hidup.",
    "",
    ...(pccEnabled
      ? [
          "/ip firewall mangle print stats",
          "  Kolom bytes/packets naik berarti PCC sedang membagi trafik.",
          "",
          ...isps.map(
            (isp, i) => `ping ${isp.checkTarget} routing-mark=to-${slugs[i]}   # cek jalur ${isp.name}`,
          ),
          "",
        ]
      : []),
    ...(failoverEnabled
      ? [
          "Cabut salah satu kabel ISP, lalu tunggu beberapa detik — trafik ke ISP yang mati",
          "harus otomatis lewat ISP lain (failover).",
          netwatch ? "/tool netwatch print   # kolom STATUS harus berubah jadi down" : "",
          schedule ? `/system scheduler print   # cek waktu jalan terakhir "${"mikrosetting-failover-scheduler"}"` : "",
          "",
        ].filter(Boolean)
      : []),
    "BERSIHKAN (bila perlu mengulang dari nol)",
    ...cleanup,
  ]);

  return s.toString();
}
