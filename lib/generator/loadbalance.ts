import type { IspEntry, LoadBalanceConfig } from "../types-loadbalance";
import { args, ScriptBuilder } from "./script-builder";

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

  let sectionNo = 0;
  const section = (title: string, description?: string) => {
    sectionNo += 1;
    s.section(`${sectionNo}. ${title}`, description);
  };

  // ---------------------------------------------------------------- header
  s.banner([
    "SCRIPT LOAD BALANCE PCC MULTI-ISP + FAILOVER RECURSIVE GATEWAY",
    "Generator Script Mikrotik by Mikrosetting.com",
    "",
    `Jumlah ISP : ${isps.length}`,
    `RouterOS   : ${config.ros ? config.ros : "(belum dipilih)"}`,
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

  // ------------------------------------------------------- mangle: PCC mark
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

  // ------------------------------------------------------ mangle: mark-routing
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

  // ----------------------------------------------------- recursive target
  section(
    "RECURSIVE GATEWAY — TARGET PENGUJI JALUR",
    "Host route /32 ke IP publik lewat gateway asli tiap ISP, dipantau check-gateway=ping. Inilah yang mendeteksi ISP mati.",
  );
  isps.forEach((isp) => {
    s.addIfMissing(
      "/ip route",
      [
        ["dst-address", `${isp.recursiveTarget}/32`],
        ["gateway", isp.gateway],
      ],
      args([
        ["dst-address", `${isp.recursiveTarget}/32`],
        ["gateway", isp.gateway],
        ["distance", 1],
        ["scope", 10],
        ["check-gateway", "ping"],
        ["comment", tag(`Cek jalur ${isp.name}`)],
      ]),
    );
  });

  // -------------------------------------------------------- routing table
  if (v7) {
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
  section(
    "DEFAULT ROUTE PER ISP (BERLAPIS)",
    "Tiap tabel/mark ISP diberi rute ke SEMUA ISP secara berurutan — bila ISP utamanya putus, trafik yang sudah di-mark otomatis lompat ke ISP berikutnya.",
  );
  isps.forEach((owner, ownerIndex) => {
    const routingMark = `to-${slugs[ownerIndex]}`;
    const order = isps.map((_, k) => isps[(ownerIndex + k) % isps.length]);
    order.forEach((entry, position) => {
      const distance = position + 1;
      s.addIfMissing(
        "/ip route",
        [
          ["dst-address", "0.0.0.0/0"],
          ["gateway", entry.recursiveTarget],
          [v7 ? "routing-table" : "routing-mark", routingMark],
        ],
        args([
          ["dst-address", "0.0.0.0/0"],
          ["gateway", entry.recursiveTarget],
          [v7 ? "routing-table" : "routing-mark", routingMark],
          ["distance", distance],
          ["target-scope", 10],
          ["check-gateway", "ping"],
          [
            "comment",
            tag(
              position === 0
                ? `Utama ${owner.name}`
                : `Cadangan ${owner.name} via ${entry.name}`,
            ),
          ],
        ]),
      );
    });
  });

  // ------------------------------------------------- default route umum
  section(
    "DEFAULT ROUTE UMUM (TANPA MARK)",
    "Untuk trafik yang tidak kena mangle (mis. dari router sendiri). Urutan ISP dan distance mengikuti isian di section ISP.",
  );
  isps.forEach((isp) => {
    s.addIfMissing(
      "/ip route",
      [
        ["dst-address", "0.0.0.0/0"],
        ["gateway", isp.recursiveTarget],
      ],
      args([
        ["dst-address", "0.0.0.0/0"],
        ["gateway", isp.recursiveTarget],
        ["distance", isp.distance],
        ["target-scope", 10],
        ["check-gateway", "ping"],
        ["comment", tag(`Default via ${isp.name}`)],
      ]),
    );
  });

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
  s.banner([
    "SELESAI — CARA MEMERIKSA HASIL",
    "",
    "/ip route print where dst-address=\"0.0.0.0/0\"",
    "  Pastikan rute recursive (gateway = IP target, bukan gateway asli ISP)",
    "  aktif (huruf A di kolom paling kiri).",
    "",
    "/ip firewall mangle print stats",
    "  Kolom bytes/packets naik berarti PCC sedang membagi trafik.",
    "",
    ...isps.map(
      (isp, i) => `ping ${isp.recursiveTarget} routing-mark=to-${slugs[i]}   # cek jalur ${isp.name}`,
    ),
    "",
    "Cabut salah satu kabel ISP, lalu ulangi ping di atas — trafik ke ISP",
    "yang mati harus tetap lewat (failover ke ISP lain) dalam beberapa detik.",
    "",
    "BERSIHKAN (bila perlu mengulang dari nol)",
    '  /ip firewall mangle remove [find comment~"By Mikrosetting"]',
    '  /ip firewall nat remove [find comment~"By Mikrosetting"]',
    '  /ip route remove [find comment~"By Mikrosetting"]',
    ...(v7 ? ['  /routing table remove [find comment~"By Mikrosetting"]'] : []),
  ]);

  return s.toString();
}
