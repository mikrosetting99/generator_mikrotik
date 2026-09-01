/**
 * Script pemeriksa Mikrotik.
 *
 * Dua hal yang menentukan bentuknya:
 *
 * 1. Script ini tidak mengubah konfigurasi apa pun: tidak ada `add`, `set`,
 *    `enable`, maupun `disable`. Satu-satunya penghapusan adalah berkas hasil
 *    pemeriksaan sebelumnya, milik script ini sendiri.
 *    Teknisi menempelkannya di router pelanggan
 *    yang sedang bermasalah — apa pun yang diubah di keadaan itu membuat
 *    penyebab aslinya makin sulit ditemukan, dan kesalahan kecil bisa memutus
 *    jaringan yang masih setengah jalan.
 *
 * 2. Keluarannya bukan `print`, melainkan baris berpenanda buatan sendiri.
 *    Tata letak `print` berbeda antar versi RouterOS dan antar lebar terminal,
 *    jadi membacanya berarti menebak-nebak. Bentuk "JENIS|nilai|nilai" tetap
 *    sama di v6 maupun v7 dan bisa dibaca tanpa ambiguitas.
 *
 * Nilai yang mengandung "|" — komentar firewall, misalnya — tidak dilarikan.
 * Sebagai gantinya tiap jenis baris punya jumlah kolom tetap dan kolom yang
 * bebas isi selalu diletakkan paling akhir, sehingga sisa barisnya boleh
 * disatukan kembali apa adanya saat dibaca.
 */

export const VERSI_LAPORAN = 1;

/** Nama berkas hasil di menu Files router. */
export const NAMA_BERKAS = "cek-mikrotik";

export type Bagian =
  | "sistem"
  | "internet"
  | "ip"
  | "dhcp"
  | "hotspot"
  | "pppoe"
  | "firewall";

export interface OpsiCek {
  bagian: Bagian[];
  /** Interface WAN yang diuji ping-nya. Kosong = router memilih jalurnya sendiri. */
  wan: string[];
  /** Alamat yang di-ping. Bawaan: DNS Google dan Cloudflare. */
  target: string[];
  /** Banyak paket ping per target. Makin besar makin lama script berjalan. */
  jumlahPing: number;
  /**
   * "berkas" menulis hasilnya ke file di router, "layar" mencetaknya di
   * terminal. Berkas jauh lebih nyaman: memblok ratusan baris di terminal
   * Winbox sulit dan mudah terpotong.
   */
  keluaran: "berkas" | "layar";
}

export const BAGIAN_LABEL: Record<Bagian, string> = {
  sistem: "Resource & identitas",
  internet: "Koneksi internet",
  ip: "IP address, route, DNS",
  dhcp: "DHCP server & looping",
  hotspot: "Hotspot server",
  pppoe: "PPPoE server",
  firewall: "Firewall filter, NAT, mangle",
};

export const OPSI_BAWAAN: OpsiCek = {
  bagian: ["sistem", "internet", "ip", "dhcp", "hotspot", "pppoe", "firewall"],
  wan: [],
  target: ["8.8.8.8", "1.1.1.1"],
  jumlahPing: 4,
  keluaran: "berkas",
};

/* ------------------------------------------------------------------ *
 * Penyusun
 * ------------------------------------------------------------------ */

class Penyusun {
  private baris: string[] = [];

  komentar(teks: string): this {
    for (const l of teks.split("\n")) this.baris.push(`# ${l}`);
    return this;
  }

  kode(teks: string): this {
    this.baris.push(teks);
    return this;
  }

  kosong(): this {
    if (this.baris.length && this.baris[this.baris.length - 1] !== "") this.baris.push("");
    return this;
  }

  toString(): string {
    return `${this.baris.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
  }
}

/**
 * Satu baris laporan.
 *
 * `get` dibungkus [:tostr ...] supaya nilai kosong tidak menghentikan
 * penggabungan string — di RouterOS, merangkai nil dengan "." menghasilkan nil,
 * dan barisnya hilang sama sekali tanpa pesan apa pun.
 */
function put(jenis: string, ...bagian: string[]): string {
  const isi = bagian.map((b) => `[:tostr ${b}]`).join(' . "|" . ');
  return bagian.length
    ? `  :put ("${jenis}|" . ${isi})`
    : `  :put "${jenis}"`;
}

/** Mengulang tiap baris sebuah menu, lalu mencetak satu baris laporan. */
function loop(menu: string, jenis: string, kolom: string[], filter = ""): string {
  const cari = filter ? `${menu} find where ${filter}` : `${menu} find`;
  const ambil = kolom.map((k) => `[${menu} get $i ${k}]`);
  return [
    `:foreach i in=[${cari}] do={`,
    put(jenis, ...ambil),
    "}",
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Script
 * ------------------------------------------------------------------ */

export function buatScriptCek(opsi: OpsiCek): string {
  const s = new Penyusun();
  const bagian = new Set(opsi.bagian);
  const target = opsi.target.filter(Boolean);
  const jumlah = Math.max(1, Math.min(10, opsi.jumlahPing || 4));


  s.kode(`:put "MSCEK|${VERSI_LAPORAN}"`);
  s.kode(':put ("WAKTU|" . [:tostr [/system clock get date]] . " " . [:tostr [/system clock get time]])');
  s.kosong();

  /* --------------------------------------------------------- sistem */
  if (bagian.has("sistem")) {
    s.komentar("--- resource & identitas");
    s.kode(':put ("IDENT|" . [:tostr [/system identity get name]])');
    s.kode(
      ':put ("SYS|" . [:tostr [/system resource get version]] . "|" ' +
        '. [:tostr [/system resource get board-name]] . "|" ' +
        '. [:tostr [/system resource get uptime]] . "|" ' +
        '. [:tostr [/system resource get cpu-load]] . "|" ' +
        '. [:tostr [/system resource get free-memory]] . "|" ' +
        '. [:tostr [/system resource get total-memory]] . "|" ' +
        '. [:tostr [/system resource get free-hdd-space]] . "|" ' +
        '. [:tostr [/system resource get total-hdd-space]])',
    );
    s.kosong();
    s.komentar("--- interface");
    s.kode(
      loop("/interface", "IF", ["name", "type", "running", "disabled"]),
    );
    s.kosong();
  }

  /* ------------------------------------------------------- internet */
  if (bagian.has("internet") && target.length > 0) {
    s.komentar("--- ping ke DNS publik");
    s.komentar("Angka terakhir tiap baris = paket yang berhasil dari total.");

    const jalur = opsi.wan.length > 0 ? opsi.wan : [""];
    for (const wan of jalur) {
      for (const t of target) {
        const lewat = wan ? ` interface=${wan}` : "";
        const label = wan || "auto";
        s.kode(
          `:do { :local ok [/ping ${t} count=${jumlah}${lewat}]; ` +
            `:put ("PING|${label}|${t}|" . [:tostr $ok] . "|${jumlah}") } ` +
            `on-error={ :put "PING|${label}|${t}|0|${jumlah}" }`,
        );
      }
    }
    s.kosong();
  }

  /* ------------------------------------------------------------- ip */
  if (bagian.has("ip")) {
    s.komentar("--- alamat IP, route, DNS");
    s.kode(loop("/ip address", "ADDR", ["address", "interface", "disabled", "dynamic"]));
    s.kode(
      loop("/ip route", "ROUTE", ["dst-address", "gateway", "distance", "active"], "dst-address=0.0.0.0/0"),
    );
    s.kode(
      ':put ("DNS|" . [:tostr [/ip dns get servers]] . "|" ' +
        '. [:tostr [/ip dns get allow-remote-requests]] . "|" ' +
        '. [:tostr [/ip dns get dynamic-servers]])',
    );
    s.kode(loop("/ip dhcp-client", "DHCPC", ["interface", "status", "address", "disabled"]));
    s.kosong();
  }

  /* ----------------------------------------------------------- dhcp */
  if (bagian.has("dhcp")) {
    s.komentar("--- DHCP server");
    s.kode(
      loop("/ip dhcp-server", "DHCPS", ["name", "interface", "address-pool", "lease-time", "disabled"]),
    );
    s.kode(loop("/ip dhcp-server network", "DHCPN", ["address", "gateway", "dns-server"]));
    s.kode(loop("/ip pool", "POOL", ["name", "ranges"]));
    s.kode(':put ("LEASE|" . [:tostr [:len [/ip dhcp-server lease find]]])');
    s.kosong();
    s.komentar("--- bridge: pintu masuk paling umum untuk loop jaringan");
    s.kode(loop("/interface bridge", "BR", ["name", "protocol-mode"]));
    s.kode(loop("/interface bridge port", "BRPORT", ["bridge", "interface", "edge"]));
    s.kosong();
  }

  /* -------------------------------------------------------- hotspot */
  if (bagian.has("hotspot")) {
    s.komentar("--- hotspot");
    s.kode(
      loop("/ip hotspot", "HS", ["name", "interface", "address-pool", "profile", "disabled"]),
    );
    s.kode(
      loop("/ip hotspot profile", "HSPROF", [
        "name",
        "hotspot-address",
        "dns-name",
        "html-directory",
        "login-by",
      ]),
    );
    s.kode(':put ("HSUSER|" . [:tostr [:len [/ip hotspot user find]]])');
    s.kode(':put ("HSAKTIF|" . [:tostr [:len [/ip hotspot active find]]])');
    s.kode(loop("/ip hotspot walled-garden", "WG", ["dst-host", "action"]));
    s.kosong();
  }

  /* ---------------------------------------------------------- pppoe */
  if (bagian.has("pppoe")) {
    s.komentar("--- PPPoE server");
    s.komentar("Password akun PPPoE sengaja TIDAK ikut dicetak.");
    s.kode(
      loop("/interface pppoe-server server", "PPPOE", [
        "service-name",
        "interface",
        "default-profile",
        "max-mtu",
        "disabled",
      ]),
    );
    s.kode(
      loop("/ppp profile", "PPPROF", ["name", "local-address", "remote-address", "rate-limit", "only-one"]),
    );
    s.kode(':put ("PPPSECRET|" . [:tostr [:len [/ppp secret find]]])');
    s.kode(':put ("PPPAKTIF|" . [:tostr [:len [/ppp active find]]])');
    s.kosong();
  }

  /* ------------------------------------------------------- firewall */
  if (bagian.has("firewall")) {
    s.komentar("--- firewall");
    s.komentar("Kolom terakhir adalah comment, dan boleh mengandung tanda |.");
    for (const [menu, jenis] of [
      ["/ip firewall filter", "FW"],
      ["/ip firewall nat", "NAT"],
      ["/ip firewall mangle", "MANGLE"],
    ] as const) {
      s.kode(
        [
          `:foreach i in=[${menu} find] do={`,
          put(
            jenis,
            `[${menu} get $i chain]`,
            `[${menu} get $i action]`,
            `[${menu} get $i disabled]`,
            `[${menu} get $i bytes]`,
            `[${menu} get $i comment]`,
          ),
          "}",
        ].join("\n"),
      );
    }
    s.kode(loop("/ip service", "SVC", ["name", "port", "address", "disabled"]));
    s.kosong();
  }

  s.kode(':put "SELESAI"');

  return opsi.keluaran === "berkas"
    ? bungkusKeBerkas(s.toString(), opsi)
    : kepala(opsi, "layar") + s.toString();
}

/* ------------------------------------------------------------------ *
 * Kepala & pembungkus
 * ------------------------------------------------------------------ */

function kepala(opsi: OpsiCek, mode: "berkas" | "layar"): string {
  const detik = perkiraanDetik(opsi);
  const baris = [
    "#".repeat(64),
    "SCRIPT PEMERIKSA MIKROTIK",
    "Generator Script Mikrotik by Mikrosetting.com",
    "",
    "Script ini TIDAK MENGUBAH KONFIGURASI router: tidak ada perintah",
    "add, set, enable, atau disable di dalamnya.",
    "",
    "CARA PAKAI",
    "1. Buka Winbox/WebFig > New Terminal (atau SSH).",
    "2. Paste seluruh isi ini sekaligus, lalu Enter.",
  ];

  if (mode === "berkas") {
    baris.push(
      `3. Tunggu sekitar ${detik} detik. Hasilnya TIDAK tampil di layar.`,
      `4. Buka menu Files, cari berkas ${NAMA_BERKAS}.txt`,
      "5. Seret berkas itu ke komputer Anda, lalu unggah di halaman",
      "   Cek Mikrotik. Tidak perlu menyalin teks dari terminal.",
      "",
      `Satu-satunya yang dihapus adalah ${NAMA_BERKAS}.txt milik pemeriksaan`,
      "sebelumnya, supaya hasil lama tidak tertukar dengan yang baru.",
    );
  } else {
    baris.push(
      `3. Tunggu sekitar ${detik} detik, sampai muncul baris SELESAI.`,
      "4. Blok seluruh keluarannya, salin, lalu tempel kembali",
      "   ke halaman Cek Mikrotik.",
    );
  }

  baris.push("#".repeat(64));
  return `${baris.map((l) => (l ? `# ${l}` : "#")).join("\n")}\n\n`;
}

/**
 * Membungkus seluruh pemeriksaan ke dalam :execute yang menulis ke berkas.
 *
 * Ini jawaban untuk kendala nyata di lapangan: memblok ratusan baris di
 * terminal Winbox sulit, mudah terpotong, dan dilakukan sambil ditunggu
 * pelanggan. Dengan berkas, teknisi cukup menyeretnya dari menu Files.
 *
 * :execute berjalan di latar belakang, jadi terminal langsung bebas dan
 * berkasnya baru muncul setelah pemeriksaan selesai — termasuk setelah ping
 * yang memakan waktu. Karena itu kepalanya menyebut lama tunggunya, bukan
 * menyuruh menunggu baris SELESAI yang memang tidak akan tampil.
 */
function bungkusKeBerkas(badan: string, opsi: OpsiCek): string {
  /* Komentar dan baris kosong dibuang di dalam :execute: isinya diurai
     sebagai satu blok script, dan penjelasannya sudah ada di kepala — di
     luar blok ini, tempat teknisi benar-benar membacanya. */
  const isi = badan
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => `  ${l}`)
    .join("\n");

  return (
    `${kepala(opsi, "berkas")}` +
    `/file remove [find name="${NAMA_BERKAS}.txt"]\n` +
    `:execute file=${NAMA_BERKAS} script={\n${isi}\n}\n`
  );
}

/** Perkiraan lama script berjalan, untuk diberitahukan sebelum ditempel. */
export function perkiraanDetik(opsi: OpsiCek): number {
  if (!opsi.bagian.includes("internet")) return 2;
  const jalur = Math.max(1, opsi.wan.length || 1);
  return opsi.jumlahPing * opsi.target.filter(Boolean).length * jalur + 2;
}
