/**
 * Satu-satunya sumber data changelog — dipakai oleh halaman /changelog dan
 * oleh `npm run changelog:generate` untuk menulis ulang CHANGELOG.md.
 * Versi aplikasi (dipakai VersionBadge) selalu mengikuti entri paling atas.
 */

export type ChangeType = "added" | "changed" | "fixed";

export interface ChangeGroup {
  type: ChangeType;
  items: string[];
}

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: ChangeGroup[];
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  added: "Ditambahkan",
  changed: "Diubah",
  fixed: "Diperbaiki",
};

/** Terbaru di paling atas. */
export const CHANGELOG: Release[] = [
  {
    version: "1.7.3",
    date: "2026-10-12",
    title: "Warna tema lebih menyatu di halaman login",
    changes: [
      {
        type: "changed",
        items: [
          "Desain Minimal: warna tema kini juga dipakai di judul, tautan, judul tabel, garis bingkai kartu (dengan aksen tebal di atas kartu), dan garis tombol Voucher/Member — bukan hanya tombol dan tabel. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
      {
        type: "fixed",
        items: [
          "Warna tema yang terang (kuning, biru langit) tidak lagi membuat judul dan tautan sulit dibaca di atas kartu putih: untuk teks, warna otomatis digelapkan secukupnya sampai kontrasnya cukup. Footer tidak lagi dipudarkan.",
        ],
      },
    ],
  },  {
    version: "1.7.2",
    date: "2026-10-12",
    title: "Halaman login tanpa alamat IP",
    changes: [
      {
        type: "changed",
        items: [
          "Tulisan \"IP Anda …\" di bawah form login dihapus dari desain Minimal dan Poster. Teks footer tetap tampil bila diisi. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.7.1",
    date: "2026-10-12",
    title: "Bawaan baru Halaman Login Hotspot",
    changes: [
      {
        type: "changed",
        items: [
          "Nilai bawaan desain baru: lebar form 390 px, kepekatan lapisan gelap latar 0%, dan mode gambar latar \"Penuh\". Desain yang sudah tersimpan tetap memakai nilainya sendiri.",
        ],
      },
    ],
  },  {
    version: "1.7.0",
    date: "2026-10-12",
    title: "Galeri logo dan rekomendasi ukuran gambar",
    changes: [
      {
        type: "added",
        items: [
          "Galeri logo siap pakai: admin mengunggahnya di Dashboard Admin (PNG, JPG, WEBP, atau SVG, maks 200 KB), dan semua pengguna Halaman Login Hotspot bisa langsung memilihnya. Pengguna tetap bisa mengunggah logo sendiri.",
          "Kotak rekomendasi ukuran di editor dan di dashboard admin: logo 400 × 160 px (rasio 5:2, PNG/SVG transparan), latar 1920 × 1080 px (16:9, JPG) atau 1080 × 1920 px untuk HP tegak.",
        ],
      },
    ],
  },  {
    version: "1.6.4",
    date: "2026-10-12",
    title: "Model baru: hEX refresh (E50UG)",
    changes: [
      {
        type: "added",
        items: ["Model Mikrotik hEX refresh (E50UG) di pilihan Type Mikrotik: 5 port Gigabit Ethernet, hanya RouterOS v7."],
      },
    ],
  },  {
    version: "1.6.3",
    date: "2026-10-11",
    title: "Latar tidak lagi terpotong di layar laptop",
    changes: [
      {
        type: "added",
        items: [
          "Mode gambar \"Utuh + kabur\" (kini bawaan): seluruh gambar latar terlihat di tengah tanpa terpotong, dan sisi layar yang kosong diisi salinan gambar yang dikaburkan. Berlaku di desain Minimal dan Poster; mode Penuh, Utuh, dan Tarik tetap tersedia. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.6.2",
    date: "2026-10-11",
    title: "Perbaikan edit nama grup",
    changes: [
      {
        type: "fixed",
        items: [
          "Nama grup menu di dashboard admin bisa diketik dengan lancar; sebelumnya kursor terlepas di setiap huruf. Nama diterapkan saat Enter atau pindah kolom, dan nama kosong atau kembar dengan grup lain dibatalkan.",
        ],
      },
    ],
  },  {
    version: "1.6.1",
    date: "2026-10-11",
    title: "File .rsc siap di-restore",
    changes: [
      {
        type: "changed",
        items: [
          "File .rsc yang diunduh dari Setup Mikrotik Baru kini diawali petunjuk restore: upload ke Files lalu /import, atau restore total lewat /system reset-configuration run-after-reset, plus cara menyimpannya sebagai file .backup asli router. Tampilan script di layar tidak berubah.",
        ],
      },
    ],
  },  {
    version: "1.6.0",
    date: "2026-10-11",
    title: "Studio pratinjau, iPhone 13, dan konfirmasi logout",
    changes: [
      {
        type: "added",
        items: [
          "Popup konfirmasi sebelum keluar dari akun (di beranda dan di Setup Mikrotik Baru).",
          "Pilihan \"Mode gambar\" untuk latar halaman login: Penuh (menutupi layar), Utuh (seluruh gambar terlihat), atau Tarik (memenuhi layar).",
        ],
      },
      {
        type: "changed",
        items: [
          "Pratinjau Halaman Login Hotspot dibuat seperti studio: panel pratinjau sejajar dan setinggi menu edit di kiri, memenuhi layar tanpa perlu menggulir halaman.",
          "Ukuran pratinjau HP mengikuti iPhone 13 (390 × 844), dengan sudut layar yang lebih membulat.",
        ],
      },
    ],
  },  {
    version: "1.5.3",
    date: "2026-10-11",
    title: "Judul dan ikon tab mengikuti identitas situs",
    changes: [
      {
        type: "changed",
        items: [
          "Judul tab browser kini memakai nama situs dari dashboard admin (mis. \"Cek Mikrotik — Nama Situs\"), dan ikon tab (favicon) memakai logo yang diunggah di sana. Tanpa logo, ikon bawaan tetap dipakai.",
        ],
      },
    ],
  },  {
    version: "1.5.2",
    date: "2026-10-11",
    title: "Latar halaman login menyesuaikan ukuran layar",
    changes: [
      {
        type: "fixed",
        items: [
          "Gambar latar pada desain Minimal kini ditaruh di lapisan tetap seukuran layar, sehingga selalu menutupi seluruh layar HP (tegak maupun mendatar), tablet, dan laptop — tidak lagi melar atau membesar saat isi halaman panjang karena tabel paket. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
      {
        type: "added",
        items: [
          "Pilihan \"Fokus gambar\" (tengah, atas, bawah, kiri, kanan) untuk menentukan sisi gambar latar yang tetap terlihat saat gambar dipotong menyesuaikan layar.",
        ],
      },
    ],
  },  {
    version: "1.5.1",
    date: "2026-10-11",
    title: "Pengaturan menu & grup lebih mudah",
    changes: [
      {
        type: "changed",
        items: [
          "Menu & grup di dashboard admin kini berupa satu kartu per grup: nama grup bisa diedit langsung di judulnya, lengkap dengan panah geser dan tombol tambah menu.",
          "Panah ↑↓ pada menu bergerak lintas grup — di ujung sebuah grup, menu pindah ke grup tetangga — jadi tidak perlu membuka pengaturan lain untuk memindahkan menu.",
        ],
      },
    ],
  },  {
    version: "1.5.0",
    date: "2026-10-11",
    title: "Kalkulator IP, grup menu, dan dashboard admin lebih ringkas",
    changes: [
      {
        type: "added",
        items: [
          "Halaman Kalkulator IP (/kalkulator-ip): network, broadcast, rentang host, netmask, wildcard, jenis alamat, tampilan biner, pembagian subnet, dan perintah RouterOS siap salin. Tersedia sebagai menu yang bisa diatur dari dashboard admin.",
          "Grup menu: menu di beranda dikelompokkan (bawaan \"Konfigurasi\" dan \"Alat\"); nama, urutan, dan isi grup diatur dari dashboard admin.",
        ],
      },
      {
        type: "changed",
        items: [
          "Dashboard admin dibuat dropdown per bagian supaya tidak panjang digulir; identitas situs, tombol WhatsApp, dan teks beranda digabung di \"Pengaturan umum\".",
        ],
      },
    ],
  },  {
    version: "1.4.1",
    date: "2026-10-11",
    title: "Login hotspot terasa lebih cepat",
    changes: [
      {
        type: "changed",
        items: [
          "Tombol Login di halaman login hotspot langsung berputar dan menampilkan \"Memproses…\" saat ditekan, jadi tidak terlihat macet saat router memproses.",
        ],
      },
      {
        type: "fixed",
        items: [
          "Halaman \"Berhasil masuk\" kini langsung mengalihkan, tidak lagi menunggu logo dan gambar latar selesai dimuat lebih dulu. Paket halaman login perlu di-upload ulang ke router agar berlaku.",
        ],
      },
    ],
  },  {
    version: "1.4.0",
    date: "2026-10-11",
    title: "Logo, nama situs, dan tombol WhatsApp dari admin",
    changes: [
      {
        type: "added",
        items: [
          "Logo dan nama situs diatur dari Dashboard Admin; tampil di pojok kiri atas beranda dan di footer.",
          "Tombol WhatsApp (CTA) di beranda dengan nomor, teks tombol, dan pesan awal yang diatur dari Dashboard Admin, plus pilihan tombol melayang di pojok kanan bawah.",
        ],
      },
      {
        type: "fixed",
        items: [
          "Logout tampak tidak berfungsi karena nginx menyimpan cache halaman beranda; aplikasi kini meminta nginx tidak men-cache halaman dinamis, dan cookie sesi dihapus lewat jalur cadangan.",
        ],
      },
    ],
  },  {
    version: "1.3.0",
    date: "2026-10-11",
    title: "Galeri latar untuk Halaman Login Hotspot",
    changes: [
      {
        type: "added",
        items: [
          "Admin bisa mengunggah galeri latar siap pakai di Dashboard Admin; semua pengguna Halaman Login Hotspot bisa langsung memilihnya, dan tetap bisa mengunggah latar sendiri.",
        ],
      },
      {
        type: "fixed",
        items: [
          "Daftar akun di Kelola Pengguna langsung bertambah setelah akun dibuat, dan tidak lagi bisa tertahan cache browser/proxy.",
        ],
      },
    ],
  },  {
    version: "1.2.0",
    date: "2026-10-11",
    title: "Dashboard admin, analitik menu, dan akses menu per pengaturan",
    changes: [
      {
        type: "added",
        items: [
          "Dashboard Admin (/admin), hanya bisa dibuka admin: ringkasan pengguna & data tersimpan, pengaturan menu beranda, versi aplikasi, dan changelog terbaru.",
          "Pengaturan per menu: tampil/sembunyi, mode pengembangan (hanya admin yang bisa membuka), dan wajib login atau bebas diakses.",
          "Tambah, hapus, dan urutkan menu beranda sendiri (alamat dalam situs atau tautan luar, dengan pilihan ikon).",
          "Pengaturan teks beranda: judul, kalimat pembuka, tombol utama, bagian cuplikan/jaminan, dan footer.",
          "Analitik: jumlah pemakaian tiap menu dihitung dan ditampilkan di kartu menu serta di dashboard admin. Tanpa data pribadi; satu browser dihitung sekali per menu dalam 30 menit.",
          "Komentar interface pada Setup Mikrotik Baru (tertutup secara default), ditulis ke script lewat /interface set.",
        ],
      },
      {
        type: "changed",
        items: [
          "Logika login: beranda kini terbuka untuk umum dan menampilkan username saat sudah login. Menu hanya meminta login bila diatur begitu di dashboard admin; yang sudah login bisa membuka semua menu.",
          "Menu beranda dibuat lebih ringkas: kartu kecil berisi ikon, judul, dan satu kalimat.",
          "Pilihan Type Mikrotik di Setup kini punya kolom cari.",
        ],
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-10",
    title: "Halaman Login Hotspot lebih lengkap",
    changes: [
      {
        type: "added",
        items: [
          "Simpan dan muat desain halaman login hotspot ke database (butuh akun), termasuk logo dan gambar.",
          "Pratinjau bisa dialihkan ke ukuran HP, tablet, dan laptop; pratinjau tetap di tempat saat menu edit di kiri digulir.",
          "Warna form, kepekatan form sampai 0% (tembus pandang), lebar form yang bisa diatur, dan gambar di dalam form.",
          "Menu edit dikelompokkan jadi bagian yang bisa dibuka-tutup.",
        ],
      },
      {
        type: "changed",
        items: [
          "Desain dipangkas menjadi Minimal (bawaan) dan Poster; pilihan Voucher, Korporat, dan Gelap Modern dihapus.",
          "Tabel paket dirombak: kepala berwarna, baris selang-seling, harga rata kanan.",
        ],
      },
      {
        type: "fixed",
        items: [
          "Kartu form tidak lagi punya scroll sendiri saat isinya panjang; yang menggulir seluruh halaman.",
          "Daftar desain tersimpan langsung diperbarui setelah menyimpan, dengan pesan error yang jelas bila server menolak.",
        ],
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-30",
    title: "Login & riwayat konfigurasi di database",
    changes: [
      {
        type: "added",
        items: [
          "Sistem login (username/password) khusus menu Setup Mikrotik Baru.",
          "Riwayat konfigurasi tersimpan di database MySQL — bisa dimuat ulang dari perangkat lain selama login dengan akun yang sama.",
          "Panel admin (/admin/users) untuk mendaftarkan akun pengguna baru.",
          "Peran Admin bisa melihat riwayat konfigurasi milik semua akun, tidak hanya miliknya sendiri.",
        ],
      },
      {
        type: "changed",
        items: [
          "Menu Setup Mikrotik Baru kini wajib login. Load Balance & Fail Over dan Halaman Login Hotspot tetap bisa dipakai publik tanpa akun.",
          "Dialog Simpan/Muat menambah bagian \"Riwayat di server\" berdampingan dengan opsi lama \"Tersimpan di browser ini\".",
          "Script update server diganti nama dari `deploy.sh` jadi `update.sh`, sekaligus ditambah pra-pemeriksaan (`.env` ada, git bersih) dan pencatatan ke `update.log`.",
        ],
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-09-30",
    title: "Polish UI/UX",
    changes: [
      {
        type: "changed",
        items: [
          "Landing page: hapus badge kicker dan teks gradient pada judul, sesuai prinsip desain yang lebih bersih.",
          "Gabungkan kartu menu \"Load Balance PCC\" dan \"Fail Over\" jadi satu kartu — sebelumnya keduanya mengarah ke halaman builder yang sama.",
          "Rapikan duplikasi kode: fungsi unduh file dan pewarnaan sintaks script dipindah jadi helper bersama (`lib/download.ts`, `lib/script-highlight.tsx`).",
        ],
      },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-08-15",
    title: "Perbaikan bug",
    changes: [
      {
        type: "fixed",
        items: ["Modal tidak lagi merebut fokus balik ke tombol tutup di setiap ketikan."],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-08-11",
    title: "Load Balance & Fail Over jadi menu sendiri",
    changes: [
      {
        type: "added",
        items: [
          "Menu baru: Load Balance PCC multi-ISP dengan failover recursive gateway.",
          "Metode failover tambahan: Netwatch Ping dan Scheduler Check, selain Recursive Gateway.",
        ],
      },
      {
        type: "changed",
        items: [
          "Halaman Login dipindah keluar dari wizard Setup jadi menu tersendiri.",
          "Load Balance (PCC) dan Failover kini independen — bisa diaktifkan salah satu atau keduanya.",
        ],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-08-10",
    title: "Wireless, anti-tethering, desain Poster",
    changes: [
      {
        type: "added",
        items: [
          "Section Wireless supaya hotspot di perangkat yang punya radio Wi-Fi (hAP, dst) benar-benar berfungsi.",
          "Anti-tethering lewat penurunan TTL ke klien.",
          "Desain halaman login \"Poster\", mengikuti tata letak PRONET.",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-08-08",
    title: "BAST & halaman login jadi langkah sendiri",
    changes: [
      { type: "added", items: ["Dokumen Berita Acara Serah Terima (BAST) untuk pelanggan."] },
      { type: "changed", items: ["Editor halaman login dipisah jadi langkah tersendiri di wizard Setup."] },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-08-07",
    title: "PPPoE multi-profile, tema terang, preset siap pakai",
    changes: [
      {
        type: "added",
        items: [
          "Dukungan banyak profile PPPoE dalam satu konfigurasi.",
          "Tema terang untuk UI generator.",
          "Konfigurasi siap pakai (preset) yang mencakup hotspot dan PPPoE.",
          "Model RB450Gx4 ditambahkan ke database perangkat.",
          "Pengaturan ukuran logo pada halaman login hotspot.",
        ],
      },
      {
        type: "fixed",
        items: ["Pratinjau halaman login tidak lagi menggeser posisi scroll saat mengetik."],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-08-06",
    title: "Database model & halaman login hotspot",
    changes: [
      {
        type: "added",
        items: [
          "Branding Mikrosetting pada script hasil generate dan UI.",
          "Panduan deploy ke aaPanel (Node.js + PM2), termasuk `deploy.sh`.",
          "Database model Mikrotik diperluas menjadi 47 entri.",
          "Template halaman login hotspot dengan kustomisasi warna, logo, dan gambar latar.",
          "Paket hotspot lengkap sebagai satu folder (bukan hanya satu file HTML).",
        ],
      },
      {
        type: "changed",
        items: ["Urutan wizard: manajemen user dipindah ke langkah terakhir, firewall default nonaktif."],
      },
      {
        type: "fixed",
        items: [
          "Script hasil generate aman ditempel ulang di router yang sudah pernah dikonfigurasi.",
          "Berhenti mengirim parameter comment= ke menu Mikrotik yang menolaknya.",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-08-05",
    title: "Rilis awal — Setup Mikrotik Baru",
    changes: [
      {
        type: "added",
        items: [
          "Builder Setup Mikrotik Baru (menu pertama) — seluruh proses generate berjalan di browser.",
          "Alur wizard langkah-per-langkah untuk mengisi konfigurasi.",
          "Simpan & muat konfigurasi di penyimpanan browser (localStorage).",
        ],
      },
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
