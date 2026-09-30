import type { Laporan } from "./parse";

/**
 * Aturan pemeriksaan.
 *
 * Tiap temuan menyebutkan tiga hal: apa yang terlihat, mengapa itu masalah,
 * dan apa yang harus dilakukan. Temuan tanpa alasan hanya jadi daftar keluhan,
 * dan teknisi di lapangan tidak bisa menilai mana yang perlu ditangani lebih
 * dulu.
 *
 * Yang tidak diperiksa juga disebutkan. Router tanpa hotspot bukan berarti
 * hotspotnya sehat — dan diam soal itu membuat laporan terbaca lebih meyakinkan
 * daripada seharusnya.
 */

export type Tingkat = "kritis" | "peringatan" | "info" | "baik";

export interface Temuan {
  tingkat: Tingkat;
  bagian: string;
  judul: string;
  /** Apa yang terbaca di router. */
  terlihat: string;
  /** Mengapa itu jadi masalah. */
  sebab?: string;
  /** Apa yang perlu dikerjakan. */
  saran?: string;
  /** Perintah RouterOS yang bisa disalin, bila ada yang jelas. */
  perintah?: string;
}

const URUT: Record<Tingkat, number> = { kritis: 0, peringatan: 1, info: 2, baik: 3 };

/** Alamat privat menurut RFC1918 — dipakai menebak sisi LAN. */
function privat(cidr: string): boolean {
  const ip = cidr.split("/")[0];
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function persen(bagian: number, total: number): number {
  return total > 0 ? Math.round((bagian / total) * 100) : 0;
}

function mb(byte: number): string {
  return `${Math.round(byte / 1024 / 1024)} MB`;
}

export function analisa(L: Laporan): Temuan[] {
  const t: Temuan[] = [];
  const tambah = (x: Temuan) => t.push(x);

  /* ------------------------------------------------------------ sistem */
  if (L.sistem) {
    const s = L.sistem;
    if (s.cpuLoad >= 90) {
      tambah({
        tingkat: "kritis",
        bagian: "Resource",
        judul: "CPU nyaris penuh",
        terlihat: `Beban CPU ${s.cpuLoad}%.`,
        sebab:
          "Pada beban setinggi ini router mulai membuang paket dan Winbox ikut berat, jadi gejalanya terasa seperti internet lambat padahal jalurnya sehat.",
        saran:
          "Periksa rule mangle dan queue yang berat, dan pastikan FastTrack aktif bila hotspot tidak dipakai.",
        perintah: "/tool profile duration=10",
      });
    } else if (s.cpuLoad >= 70) {
      tambah({
        tingkat: "peringatan",
        bagian: "Resource",
        judul: "CPU tinggi",
        terlihat: `Beban CPU ${s.cpuLoad}%.`,
        sebab: "Belum mengganggu, tapi tidak menyisakan ruang saat trafik memuncak.",
        perintah: "/tool profile duration=10",
      });
    }

    if (s.memoriTotal > 0) {
      const sisa = persen(s.memoriBebas, s.memoriTotal);
      if (sisa <= 10) {
        tambah({
          tingkat: "kritis",
          bagian: "Resource",
          judul: "Memori nyaris habis",
          terlihat: `Sisa ${mb(s.memoriBebas)} dari ${mb(s.memoriTotal)} (${sisa}%).`,
          sebab:
            "RouterOS akan mulai menolak koneksi baru, dan pada perangkat kecil bisa restart sendiri.",
          saran:
            "Kurangi logging ke memori, batasi jumlah entri connection tracking, atau kurangi beban hotspot.",
        });
      } else if (sisa <= 25) {
        tambah({
          tingkat: "peringatan",
          bagian: "Resource",
          judul: "Memori menipis",
          terlihat: `Sisa ${mb(s.memoriBebas)} dari ${mb(s.memoriTotal)} (${sisa}%).`,
        });
      }
    }

    if (s.diskTotal > 0 && persen(s.diskBebas, s.diskTotal) <= 10) {
      tambah({
        tingkat: "peringatan",
        bagian: "Resource",
        judul: "Penyimpanan hampir penuh",
        terlihat: `Sisa ${mb(s.diskBebas)} dari ${mb(s.diskTotal)}.`,
        sebab:
          "Folder hotspot, backup, dan log menumpuk di sini. Penuh berarti halaman login gagal di-upload dan backup gagal dibuat.",
        perintah: "/file print",
      });
    }

    if (/^\d+m\d+s$/.test(s.uptime) || /^\d+s$/.test(s.uptime)) {
      tambah({
        tingkat: "peringatan",
        bagian: "Resource",
        judul: "Router baru saja menyala ulang",
        terlihat: `Uptime baru ${s.uptime}.`,
        sebab:
          "Kalau pelanggan tidak sengaja mematikannya, ini bisa berarti listrik tidak stabil, adaptor bermasalah, atau router restart sendiri karena kehabisan memori.",
        perintah: "/log print where topics~\"critical\"",
      });
    }
  }

  /* ---------------------------------------------------------- internet */
  if (L.ping.length > 0) {
    const perJalur = new Map<string, { berhasil: number; dikirim: number }>();
    for (const p of L.ping) {
      const k = perJalur.get(p.lewat) ?? { berhasil: 0, dikirim: 0 };
      k.berhasil += p.berhasil;
      k.dikirim += p.dikirim;
      perJalur.set(p.lewat, k);
    }

    const semuaMati = [...perJalur.values()].every((k) => k.berhasil === 0);
    if (semuaMati) {
      tambah({
        tingkat: "kritis",
        bagian: "Internet",
        judul: "Tidak ada jalur internet yang hidup",
        terlihat: "Seluruh ping ke DNS publik gagal.",
        sebab:
          "Router sendiri tidak bisa keluar, jadi masalahnya bukan di sisi klien. Urutan yang biasanya bermasalah: kabel/ONT ISP, default route, lalu NAT.",
        saran: "Periksa status WAN dan default route lebih dulu, baru firewall.",
        perintah: "/ip route print where dst-address=0.0.0.0/0",
      });
    } else {
      for (const [jalur, k] of perJalur) {
        if (k.berhasil === 0) {
          tambah({
            tingkat: "kritis",
            bagian: "Internet",
            judul: `Jalur ${jalur} mati`,
            terlihat: `Seluruh ${k.dikirim} paket lewat ${jalur} gagal, sementara jalur lain hidup.`,
            sebab: "ISP pada jalur ini putus, atau interface-nya salah pilih.",
            perintah: `/interface monitor-traffic ${jalur} once`,
          });
        } else if (k.berhasil < k.dikirim) {
          const hilang = persen(k.dikirim - k.berhasil, k.dikirim);
          tambah({
            tingkat: hilang >= 30 ? "kritis" : "peringatan",
            bagian: "Internet",
            judul: `Paket hilang di jalur ${jalur}`,
            terlihat: `${k.berhasil} dari ${k.dikirim} paket berhasil (${hilang}% hilang).`,
            sebab:
              "Kehilangan paket membuat internet terasa putus-putus meski statusnya tersambung — inilah keluhan yang paling sering disalahartikan sebagai lambat.",
            saran: "Periksa kualitas kabel/redaman ISP, dan uji ulang saat jam sibuk.",
          });
        }
      }
      if (![...perJalur.values()].some((k) => k.berhasil < k.dikirim)) {
        tambah({
          tingkat: "baik",
          bagian: "Internet",
          judul: "Semua jalur internet sehat",
          terlihat: `${perJalur.size} jalur diuji, tidak ada paket yang hilang.`,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- ip */
  if (L.rute.length > 0 || L.alamat.length > 0) {
    const aktif = L.rute.filter((r) => r.aktif);
    if (aktif.length === 0) {
      tambah({
        tingkat: "kritis",
        bagian: "IP",
        judul: "Tidak ada default route aktif",
        terlihat: L.rute.length
          ? `Ada ${L.rute.length} default route, tapi tidak satu pun aktif.`
          : "Tidak ada route 0.0.0.0/0 sama sekali.",
        sebab: "Tanpa default route, router tidak tahu ke mana mengirim trafik internet.",
        perintah: "/ip route print detail where dst-address=0.0.0.0/0",
      });
    } else if (aktif.length > 1) {
      const jarak = new Set(aktif.map((r) => r.distance));
      if (jarak.size === 1) {
        tambah({
          tingkat: "peringatan",
          bagian: "IP",
          judul: "Beberapa default route berjarak sama",
          terlihat: `${aktif.length} route aktif, semuanya distance ${[...jarak][0]}.`,
          sebab:
            "Router membagi trafik acak antar jalur tanpa mengingat koneksi, sehingga sesi yang sedang berjalan bisa pindah jalur dan terputus. Ini gejala khas load balance yang belum memakai PCC.",
          saran: "Bedakan distance-nya, atau pakai menu Load Balance PCC.",
        });
      }
    }

    const dnsKosong = !L.dns || (!L.dns.servers.trim() && !L.dns.dinamis.trim());
    if (dnsKosong) {
      tambah({
        tingkat: "kritis",
        bagian: "IP",
        judul: "DNS server kosong",
        terlihat: "Tidak ada DNS statis maupun dari DHCP client.",
        sebab: "Ping ke angka bisa jalan, tapi membuka situs gagal — keluhan khasnya 'internet ada tapi tidak bisa browsing'.",
        perintah: "/ip dns set servers=8.8.8.8,1.1.1.1",
      });
    }

    for (const a of L.alamat.filter((x) => x.mati)) {
      tambah({
        tingkat: "peringatan",
        bagian: "IP",
        judul: `Alamat ${a.alamat} dinonaktifkan`,
        terlihat: `Terpasang di ${a.iface} tetapi disabled.`,
        sebab: "Segmen ini tidak akan berfungsi walau konfigurasi lainnya benar.",
      });
    }
  }

  /* -------------------------------------------------------------- dhcp */
  if (L.dhcpServer.length > 0) {
    const perIface = new Map<string, string[]>();
    for (const d of L.dhcpServer) {
      perIface.set(d.iface, [...(perIface.get(d.iface) ?? []), d.nama]);
    }
    for (const [iface, nama] of perIface) {
      if (nama.length > 1) {
        tambah({
          tingkat: "kritis",
          bagian: "DHCP",
          judul: `Dua DHCP server di ${iface}`,
          terlihat: `${nama.join(", ")} sama-sama melayani ${iface}.`,
          sebab:
            "Klien mendapat IP dari server mana saja yang menjawab lebih dulu, jadi sebagian dapat gateway yang salah dan tidak bisa internetan — dan gejalanya berpindah-pindah tiap perangkat menyala ulang.",
          saran: "Matikan salah satunya, sisakan yang poolnya benar.",
          perintah: `/ip dhcp-server print where interface=${iface}`,
        });
      }
    }

    for (const d of L.dhcpServer) {
      if (d.pool && !L.pool.some((p) => p.nama === d.pool)) {
        tambah({
          tingkat: "kritis",
          bagian: "DHCP",
          judul: `Pool "${d.pool}" tidak ada`,
          terlihat: `DHCP server ${d.nama} menunjuk pool yang tidak terdaftar.`,
          sebab: "Klien tidak akan pernah mendapat IP.",
          perintah: "/ip pool print",
        });
      }
      const punyaAlamat = L.alamat.some((a) => a.iface === d.iface && !a.mati);
      if (!punyaAlamat) {
        tambah({
          tingkat: "kritis",
          bagian: "DHCP",
          judul: `${d.iface} melayani DHCP tanpa punya IP`,
          terlihat: `DHCP server ${d.nama} berjalan di ${d.iface}, tetapi interface itu tidak punya alamat aktif.`,
          sebab: "Router tidak bisa menjadi gateway bagi klien di segmen ini.",
        });
      }
      if (d.mati) {
        tambah({
          tingkat: "peringatan",
          bagian: "DHCP",
          judul: `DHCP server ${d.nama} dinonaktifkan`,
          terlihat: `Melayani ${d.iface} tetapi disabled.`,
          sebab: "Klien di segmen itu harus mengisi IP manual.",
        });
      }
    }
  }

  /* Bridge tanpa STP: bukan bukti ada loop, tapi inilah yang membuat loop —
     kalau terjadi — tidak tertangani dan langsung melumpuhkan jaringan. */
  for (const b of L.bridge) {
    const port = L.bridgePort.filter((p) => p.bridge === b.nama);
    if (port.length > 1 && b.protocolMode.toLowerCase() === "none") {
      tambah({
        tingkat: "peringatan",
        bagian: "DHCP & loop",
        judul: `Bridge ${b.nama} tanpa STP`,
        terlihat: `${port.length} port digabung dengan protocol-mode=none.`,
        sebab:
          "Bila dua port tidak sengaja tersambung ke switch yang sama, paket berputar tanpa henti dan seluruh jaringan lumpuh. STP memutus putaran itu sendiri.",
        saran: "Nyalakan RSTP kecuali ada alasan khusus mematikannya.",
        perintah: `/interface bridge set ${b.nama} protocol-mode=rstp`,
      });
    }
  }

  /* ----------------------------------------------------------- hotspot */
  if (L.hotspot.length > 0) {
    for (const h of L.hotspot) {
      const profil = L.hotspotProfil.find((p) => p.nama === h.profil);
      if (!profil) {
        tambah({
          tingkat: "kritis",
          bagian: "Hotspot",
          judul: `Profil "${h.profil}" tidak ada`,
          terlihat: `Hotspot ${h.nama} menunjuk profil yang tidak terdaftar.`,
        });
      } else {
        if (profil.htmlDirectory && !/hotspot/i.test(profil.htmlDirectory)) {
          tambah({
            tingkat: "peringatan",
            bagian: "Hotspot",
            judul: "Folder halaman login tidak lazim",
            terlihat: `html-directory = "${profil.htmlDirectory}".`,
            sebab:
              "Halaman login yang di-upload biasanya masuk ke folder hotspot. Kalau folder ini salah, pengguna melihat halaman bawaan atau error.",
          });
        }
        if (!/http-pap|http-chap/i.test(profil.loginBy)) {
          tambah({
            tingkat: "kritis",
            bagian: "Hotspot",
            judul: "Tidak ada metode login lewat form",
            terlihat: `login-by = "${profil.loginBy}".`,
            sebab:
              "cookie dan mac-cookie hanya menyimpan sesi yang sudah ada. Tanpa http-pap atau http-chap, pengguna baru tidak punya cara masuk sama sekali.",
            perintah: `/ip hotspot profile set ${profil.nama} login-by=http-chap,http-pap`,
          });
        }
      }

      if (h.pool && !L.pool.some((p) => p.nama === h.pool)) {
        tambah({
          tingkat: "kritis",
          bagian: "Hotspot",
          judul: `Address pool "${h.pool}" tidak ada`,
          terlihat: `Dipakai hotspot ${h.nama}.`,
        });
      }

      const dhcp = L.dhcpServer.filter((d) => d.iface === h.iface);
      if (dhcp.length === 0) {
        tambah({
          tingkat: "kritis",
          bagian: "Hotspot",
          judul: `Tidak ada DHCP server di ${h.iface}`,
          terlihat: `Hotspot ${h.nama} berjalan di sana.`,
          sebab:
            "Klien hotspot tetap perlu IP otomatis sebelum bisa melihat halaman login. Tanpa DHCP, perangkat pengguna berhenti di 'terhubung, tanpa internet'.",
        });
      } else if (h.pool && dhcp.some((d) => d.pool && d.pool !== h.pool)) {
        tambah({
          tingkat: "peringatan",
          bagian: "Hotspot",
          judul: "Pool hotspot dan DHCP berbeda",
          terlihat: `Hotspot memakai ${h.pool}, DHCP memakai ${dhcp.map((d) => d.pool).join(", ")}.`,
          sebab:
            "Klien mendapat IP di luar jangkauan hotspot, sehingga tidak pernah dialihkan ke halaman login.",
        });
      }

      if (h.mati) {
        tambah({
          tingkat: "peringatan",
          bagian: "Hotspot",
          judul: `Hotspot ${h.nama} dinonaktifkan`,
          terlihat: `Terpasang di ${h.iface} tetapi disabled.`,
        });
      }
    }

    if (L.jumlahHotspotUser === 0) {
      tambah({
        tingkat: "peringatan",
        bagian: "Hotspot",
        judul: "Belum ada user hotspot",
        terlihat: "Daftar user kosong.",
        sebab: "Tidak ada yang bisa login kecuali memakai trial atau voucher yang dibuat kemudian.",
      });
    }
  }

  /* ------------------------------------------------------------- pppoe */
  for (const p of L.pppoe) {
    if (p.mati) {
      tambah({
        tingkat: "kritis",
        bagian: "PPPoE",
        judul: "PPPoE server dinonaktifkan",
        terlihat: `Service "${p.serviceName}" di ${p.iface} dalam keadaan disabled.`,
        sebab: "Tidak ada pelanggan yang bisa dial.",
        perintah: `/interface pppoe-server server enable [find interface=${p.iface}]`,
      });
    }
    if (p.defaultProfile && !L.pppProfil.some((x) => x.nama === p.defaultProfile)) {
      tambah({
        tingkat: "kritis",
        bagian: "PPPoE",
        judul: `Default profile "${p.defaultProfile}" tidak ada`,
        terlihat: "Server menunjuk profile yang tidak terdaftar.",
        sebab: "Pelanggan tanpa profile sendiri akan gagal dial.",
        perintah: "/ppp profile print",
      });
    }
  }
  if (L.pppoe.length > 0 && L.jumlahPppSecret === 0) {
    tambah({
      tingkat: "peringatan",
      bagian: "PPPoE",
      judul: "Belum ada akun PPPoE",
      terlihat: "Daftar secret kosong.",
    });
  }
  if (L.pppoe.length > 0 && L.jumlahPppSecret > 0 && L.jumlahPppAktif === 0) {
    tambah({
      tingkat: "peringatan",
      bagian: "PPPoE",
      judul: "Tidak ada pelanggan yang sedang tersambung",
      terlihat: `${L.jumlahPppSecret} akun terdaftar, 0 sedang aktif.`,
      sebab:
        "Wajar bila sedang sepi, tetapi kalau seharusnya ada yang online, periksa kabel distribusi dan interface tempat PPPoE server dipasang.",
    });
  }

  /* ---------------------------------------------------------- firewall */
  if (L.filter.length > 0 || L.nat.length > 0) {
    const adaLanPrivat = L.alamat.some((a) => !a.dinamis && privat(a.alamat));
    const adaMasquerade = L.nat.some(
      (n) => n.chain === "srcnat" && /masquerade/i.test(n.action) && !n.mati,
    );
    if (adaLanPrivat && !adaMasquerade) {
      tambah({
        tingkat: "kritis",
        bagian: "Firewall",
        judul: "Tidak ada NAT masquerade aktif",
        terlihat: "Ada segmen LAN privat, tetapi tidak ada rule srcnat masquerade yang menyala.",
        sebab:
          "Klien LAN tidak bisa keluar ke internet sama sekali, sementara router sendiri bisa — persis gejala 'router bisa ping, klien tidak'.",
        perintah: "/ip firewall nat print",
      });
    }

    const dropInput = L.filter.some(
      (f) => f.chain === "input" && /drop/i.test(f.action) && !f.mati,
    );
    if (L.filter.length > 0 && !dropInput) {
      tambah({
        tingkat: "peringatan",
        bagian: "Firewall",
        judul: "Chain input tidak punya rule drop",
        terlihat: `${L.filter.length} rule filter, tidak satu pun drop di chain input.`,
        sebab: "Router terbuka dari sisi internet untuk semua layanan yang menyala.",
      });
    }

    const mati = [...L.filter, ...L.nat, ...L.mangle].filter((r) => r.mati);
    if (mati.length > 0) {
      tambah({
        tingkat: "info",
        bagian: "Firewall",
        judul: `${mati.length} rule dinonaktifkan`,
        terlihat: mati
          .slice(0, 3)
          .map((r) => `${r.chain}/${r.action}${r.comment ? ` — ${r.comment}` : ""}`)
          .join("; "),
        sebab:
          "Rule yang dimatikan saat menelusuri masalah sering lupa dinyalakan kembali. Pastikan memang disengaja.",
      });
    }

    const nganggur = L.filter.filter((f) => !f.mati && f.bytes === 0);
    if (nganggur.length > 0 && L.sistem && !/^\d+[ms]/.test(L.sistem.uptime)) {
      tambah({
        tingkat: "info",
        bagian: "Firewall",
        judul: `${nganggur.length} rule filter belum pernah kena trafik`,
        terlihat: nganggur
          .slice(0, 3)
          .map((r) => `${r.chain}/${r.action}${r.comment ? ` — ${r.comment}` : ""}`)
          .join("; "),
        sebab:
          "Biasanya berarti rule itu berada di bawah rule lain yang sudah menangkap trafiknya lebih dulu, jadi tidak pernah tercapai.",
      });
    }
  }

  for (const s of L.layanan) {
    if (!s.mati && /^(telnet|ftp|api|www)$/.test(s.nama)) {
      tambah({
        tingkat: s.nama === "telnet" || s.nama === "ftp" ? "peringatan" : "info",
        bagian: "Firewall",
        judul: `Layanan ${s.nama} menyala`,
        terlihat: s.alamat ? `Dibatasi ke ${s.alamat}.` : "Terbuka untuk semua alamat.",
        sebab:
          s.nama === "telnet" || s.nama === "ftp"
            ? "Keduanya mengirim password tanpa enkripsi dan jadi sasaran percobaan masuk otomatis."
            : undefined,
        perintah: s.alamat ? undefined : `/ip service set ${s.nama} disabled=yes`,
      });
    }
    if (!s.mati && /^(winbox|ssh)$/.test(s.nama) && !s.alamat) {
      tambah({
        tingkat: "peringatan",
        bagian: "Firewall",
        judul: `${s.nama} tidak dibatasi alamat`,
        terlihat: "Bisa diakses dari alamat mana pun yang bisa menjangkau router.",
        saran: "Batasi ke subnet manajemen Anda.",
        perintah: `/ip service set ${s.nama} address=192.168.10.0/24`,
      });
    }
  }

  return t.sort((a, b) => URUT[a.tingkat] - URUT[b.tingkat]);
}

/** Bagian yang tidak ada datanya — supaya laporan tidak terbaca lebih meyakinkan dari isinya. */
export function tidakDiperiksa(L: Laporan): string[] {
  const kosong: string[] = [];
  if (!L.sistem) kosong.push("Resource & identitas");
  if (L.ping.length === 0) kosong.push("Koneksi internet");
  if (L.alamat.length === 0) kosong.push("IP address & route");
  if (L.dhcpServer.length === 0) kosong.push("DHCP server");
  if (L.hotspot.length === 0) kosong.push("Hotspot");
  if (L.pppoe.length === 0) kosong.push("PPPoE server");
  if (L.filter.length === 0 && L.nat.length === 0) kosong.push("Firewall");
  return kosong;
}

export function ringkas(temuan: Temuan[]): Record<Tingkat, number> {
  const r: Record<Tingkat, number> = { kritis: 0, peringatan: 0, info: 0, baik: 0 };
  for (const x of temuan) r[x.tingkat] += 1;
  return r;
}
