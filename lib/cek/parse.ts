/**
 * Pembacaan laporan yang ditempel teknisi.
 *
 * Yang ditempel adalah seluruh isi layar terminal, bukan hanya baris laporan —
 * di dalamnya ada perintah yang ikut terpantul, prompt router, dan sisa
 * keluaran lain. Jadi pembacaan di sini sengaja memungut baris yang dikenali
 * dan mengabaikan sisanya, alih-alih menuntut masukan yang bersih.
 *
 * Tiap jenis baris punya jumlah kolom tetap. Kolom terakhir pada baris firewall
 * adalah comment, yang boleh mengandung "|" — karena itu sisa kolomnya
 * disatukan kembali, bukan dipotong.
 */

export interface Sistem {
  identity: string;
  versi: string;
  board: string;
  uptime: string;
  cpuLoad: number;
  memoriBebas: number;
  memoriTotal: number;
  diskBebas: number;
  diskTotal: number;
}

export interface Antarmuka {
  nama: string;
  tipe: string;
  jalan: boolean;
  mati: boolean;
}

export interface Ping {
  lewat: string;
  target: string;
  berhasil: number;
  dikirim: number;
}

export interface Alamat {
  alamat: string;
  iface: string;
  mati: boolean;
  dinamis: boolean;
}

export interface Rute {
  tujuan: string;
  gateway: string;
  distance: string;
  aktif: boolean;
}

export interface DhcpClient {
  iface: string;
  status: string;
  alamat: string;
  mati: boolean;
}

export interface DhcpServer {
  nama: string;
  iface: string;
  pool: string;
  leaseTime: string;
  mati: boolean;
}

export interface DhcpNetwork {
  alamat: string;
  gateway: string;
  dns: string;
}

export interface Pool {
  nama: string;
  ranges: string;
}

export interface Bridge {
  nama: string;
  protocolMode: string;
}

export interface BridgePort {
  bridge: string;
  iface: string;
  edge: string;
}

export interface Hotspot {
  nama: string;
  iface: string;
  pool: string;
  profil: string;
  mati: boolean;
}

export interface HotspotProfil {
  nama: string;
  alamat: string;
  dnsName: string;
  htmlDirectory: string;
  loginBy: string;
}

export interface PppoeServer {
  serviceName: string;
  iface: string;
  defaultProfile: string;
  maxMtu: string;
  mati: boolean;
}

export interface PppProfil {
  nama: string;
  localAddress: string;
  remoteAddress: string;
  rateLimit: string;
  onlyOne: string;
}

export interface AturanFirewall {
  chain: string;
  action: string;
  mati: boolean;
  bytes: number;
  comment: string;
}

export interface Layanan {
  nama: string;
  port: string;
  alamat: string;
  mati: boolean;
}

export interface Laporan {
  versi: number;
  waktu: string;
  sistem: Sistem | null;
  antarmuka: Antarmuka[];
  ping: Ping[];
  alamat: Alamat[];
  rute: Rute[];
  dns: { servers: string; allowRemote: boolean; dinamis: string } | null;
  dhcpClient: DhcpClient[];
  dhcpServer: DhcpServer[];
  dhcpNetwork: DhcpNetwork[];
  pool: Pool[];
  jumlahLease: number;
  bridge: Bridge[];
  bridgePort: BridgePort[];
  hotspot: Hotspot[];
  hotspotProfil: HotspotProfil[];
  jumlahHotspotUser: number;
  jumlahHotspotAktif: number;
  walledGarden: { host: string; action: string }[];
  pppoe: PppoeServer[];
  pppProfil: PppProfil[];
  jumlahPppSecret: number;
  jumlahPppAktif: number;
  filter: AturanFirewall[];
  nat: AturanFirewall[];
  mangle: AturanFirewall[];
  layanan: Layanan[];
  /** Baris berpenanda yang tidak dikenali — untuk menelusuri versi yang berbeda. */
  takDikenal: string[];
  selesai: boolean;
}

function laporanKosong(): Laporan {
  return {
    versi: 0,
    waktu: "",
    sistem: null,
    antarmuka: [],
    ping: [],
    alamat: [],
    rute: [],
    dns: null,
    dhcpClient: [],
    dhcpServer: [],
    dhcpNetwork: [],
    pool: [],
    jumlahLease: 0,
    bridge: [],
    bridgePort: [],
    hotspot: [],
    hotspotProfil: [],
    jumlahHotspotUser: 0,
    jumlahHotspotAktif: 0,
    walledGarden: [],
    pppoe: [],
    pppProfil: [],
    jumlahPppSecret: 0,
    jumlahPppAktif: 0,
    filter: [],
    nat: [],
    mangle: [],
    layanan: [],
    takDikenal: [],
    selesai: false,
  };
}

/** RouterOS menulis boolean sebagai "true"/"false"; kosong dianggap false. */
function bool(nilai: string | undefined): boolean {
  return String(nilai ?? "").trim().toLowerCase() === "true";
}

function angka(nilai: string | undefined): number {
  const n = Number(String(nilai ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Memotong satu baris menjadi tepat `jumlah` kolom.
 *
 * Kolom terakhir menampung sisanya utuh, jadi comment yang mengandung "|"
 * tetap terbaca apa adanya.
 */
function kolom(sisa: string, jumlah: number): string[] {
  const hasil: string[] = [];
  let teks = sisa;
  for (let i = 0; i < jumlah - 1; i += 1) {
    const p = teks.indexOf("|");
    if (p < 0) {
      hasil.push(teks);
      teks = "";
      continue;
    }
    hasil.push(teks.slice(0, p));
    teks = teks.slice(p + 1);
  }
  hasil.push(teks);
  return hasil.map((k) => k.trim());
}

export interface HasilBaca {
  ok: boolean;
  laporan: Laporan;
  pesan?: string;
}

export function bacaLaporan(mentah: string): HasilBaca {
  const laporan = laporanKosong();
  let ketemuPenanda = false;

  for (const baris of mentah.split(/\r?\n/)) {
    const isi = baris.trim();
    if (!isi) continue;

    /* Perintah yang terpantul di terminal ikut memuat kata kuncinya, tapi
       diawali ":put" atau prompt — hanya baris yang BENAR-BENAR keluaran yang
       dipungut, yaitu yang dimulai tepat dengan jenisnya. */
    if (isi.startsWith(":put") || isi.startsWith("#") || isi.includes("] > ")) continue;

    const pisah = isi.indexOf("|");
    const jenis = pisah < 0 ? isi : isi.slice(0, pisah);
    const sisa = pisah < 0 ? "" : isi.slice(pisah + 1);

    switch (jenis) {
      case "MSCEK":
        laporan.versi = angka(sisa);
        ketemuPenanda = true;
        break;
      case "SELESAI":
        laporan.selesai = true;
        break;
      case "WAKTU":
        laporan.waktu = sisa;
        break;
      case "IDENT":
        laporan.sistem = { ...(laporan.sistem ?? kosongSistem()), identity: sisa };
        break;
      case "SYS": {
        const k = kolom(sisa, 8);
        laporan.sistem = {
          ...(laporan.sistem ?? kosongSistem()),
          versi: k[0],
          board: k[1],
          uptime: k[2],
          cpuLoad: angka(k[3]),
          memoriBebas: angka(k[4]),
          memoriTotal: angka(k[5]),
          diskBebas: angka(k[6]),
          diskTotal: angka(k[7]),
        };
        break;
      }
      case "IF": {
        const k = kolom(sisa, 4);
        laporan.antarmuka.push({ nama: k[0], tipe: k[1], jalan: bool(k[2]), mati: bool(k[3]) });
        break;
      }
      case "PING": {
        const k = kolom(sisa, 4);
        laporan.ping.push({
          lewat: k[0],
          target: k[1],
          berhasil: angka(k[2]),
          dikirim: angka(k[3]),
        });
        break;
      }
      case "ADDR": {
        const k = kolom(sisa, 4);
        laporan.alamat.push({
          alamat: k[0],
          iface: k[1],
          mati: bool(k[2]),
          dinamis: bool(k[3]),
        });
        break;
      }
      case "ROUTE": {
        const k = kolom(sisa, 4);
        laporan.rute.push({ tujuan: k[0], gateway: k[1], distance: k[2], aktif: bool(k[3]) });
        break;
      }
      case "DNS": {
        const k = kolom(sisa, 3);
        laporan.dns = { servers: k[0], allowRemote: bool(k[1]), dinamis: k[2] };
        break;
      }
      case "DHCPC": {
        const k = kolom(sisa, 4);
        laporan.dhcpClient.push({
          iface: k[0],
          status: k[1],
          alamat: k[2],
          mati: bool(k[3]),
        });
        break;
      }
      case "DHCPS": {
        const k = kolom(sisa, 5);
        laporan.dhcpServer.push({
          nama: k[0],
          iface: k[1],
          pool: k[2],
          leaseTime: k[3],
          mati: bool(k[4]),
        });
        break;
      }
      case "DHCPN": {
        const k = kolom(sisa, 3);
        laporan.dhcpNetwork.push({ alamat: k[0], gateway: k[1], dns: k[2] });
        break;
      }
      case "POOL": {
        const k = kolom(sisa, 2);
        laporan.pool.push({ nama: k[0], ranges: k[1] });
        break;
      }
      case "LEASE":
        laporan.jumlahLease = angka(sisa);
        break;
      case "BR": {
        const k = kolom(sisa, 2);
        laporan.bridge.push({ nama: k[0], protocolMode: k[1] });
        break;
      }
      case "BRPORT": {
        const k = kolom(sisa, 3);
        laporan.bridgePort.push({ bridge: k[0], iface: k[1], edge: k[2] });
        break;
      }
      case "HS": {
        const k = kolom(sisa, 5);
        laporan.hotspot.push({
          nama: k[0],
          iface: k[1],
          pool: k[2],
          profil: k[3],
          mati: bool(k[4]),
        });
        break;
      }
      case "HSPROF": {
        const k = kolom(sisa, 5);
        laporan.hotspotProfil.push({
          nama: k[0],
          alamat: k[1],
          dnsName: k[2],
          htmlDirectory: k[3],
          loginBy: k[4],
        });
        break;
      }
      case "HSUSER":
        laporan.jumlahHotspotUser = angka(sisa);
        break;
      case "HSAKTIF":
        laporan.jumlahHotspotAktif = angka(sisa);
        break;
      case "WG": {
        const k = kolom(sisa, 2);
        laporan.walledGarden.push({ host: k[0], action: k[1] });
        break;
      }
      case "PPPOE": {
        const k = kolom(sisa, 5);
        laporan.pppoe.push({
          serviceName: k[0],
          iface: k[1],
          defaultProfile: k[2],
          maxMtu: k[3],
          mati: bool(k[4]),
        });
        break;
      }
      case "PPPROF": {
        const k = kolom(sisa, 5);
        laporan.pppProfil.push({
          nama: k[0],
          localAddress: k[1],
          remoteAddress: k[2],
          rateLimit: k[3],
          onlyOne: k[4],
        });
        break;
      }
      case "PPPSECRET":
        laporan.jumlahPppSecret = angka(sisa);
        break;
      case "PPPAKTIF":
        laporan.jumlahPppAktif = angka(sisa);
        break;
      case "FW":
      case "NAT":
      case "MANGLE": {
        const k = kolom(sisa, 5);
        const aturan: AturanFirewall = {
          chain: k[0],
          action: k[1],
          mati: bool(k[2]),
          bytes: angka(k[3]),
          comment: k[4],
        };
        if (jenis === "FW") laporan.filter.push(aturan);
        else if (jenis === "NAT") laporan.nat.push(aturan);
        else laporan.mangle.push(aturan);
        break;
      }
      case "SVC": {
        const k = kolom(sisa, 4);
        laporan.layanan.push({ nama: k[0], port: k[1], alamat: k[2], mati: bool(k[3]) });
        break;
      }
      default:
        /* Hanya baris yang benar-benar berbentuk penanda yang dicatat sebagai
           tak dikenal; sisa layar terminal biasa diabaikan tanpa suara. */
        if (/^[A-Z]{2,10}\|/.test(isi)) laporan.takDikenal.push(isi);
    }
  }

  if (!ketemuPenanda) {
    return {
      ok: false,
      laporan,
      pesan:
        "Tidak menemukan baris MSCEK. Pastikan seluruh keluaran terminal ikut tersalin, mulai dari baris paling atas.",
    };
  }

  if (!laporan.selesai) {
    return {
      ok: true,
      laporan,
      pesan:
        "Baris SELESAI tidak ditemukan — hasilnya mungkin terpotong. Periksa apakah seluruh keluaran sudah tersalin.",
    };
  }

  return { ok: true, laporan };
}

function kosongSistem(): Sistem {
  return {
    identity: "",
    versi: "",
    board: "",
    uptime: "",
    cpuLoad: 0,
    memoriBebas: 0,
    memoriTotal: 0,
    diskBebas: 0,
    diskTotal: 0,
  };
}
