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
    version: "1.36.1",
    date: "2026-10-21",
    title: "Hitung Bandwidth: angka utama adalah kebutuhan puncak + cadangan",
    changes: [
      {
        type: "changed",
        items: [
          "Di menu Hitung Bandwidth, angka besar yang disorot kini kebutuhan bandwidth (kebutuhan puncak + cadangan), mis. 216 Mbps. Paket ISP terdekat yang cukup (mis. 300 Mbps) dipindah menjadi keterangan kecil di bawahnya.",
        ],
      },
    ],
  },
  {
    version: "1.36.0",
    date: "2026-10-21",
    title: "Menu baru: Hitung Bandwidth",
    changes: [
      {
        type: "added",
        items: [
          "Menu Hitung Bandwidth (/hitung-bandwidth, grup Alat) untuk memperkirakan kebutuhan bandwidth ISP dari jumlah user PPPoE, Hotspot, dan IP DHCP. Tiap layanan punya banyak paket pembatasan (nama, download, upload, jumlah user), persen user online bersamaan, dan intensitas pemakaian dengan profil cepat Ringan/Sedang/Berat.",
          "Hasil langsung: paket ISP yang disarankan (dibulatkan ke ukuran lazim), kebutuhan puncak + cadangan (headroom), kebutuhan upload, rasio overbooking, kasus terburuk bila semua user penuh, porsi per layanan, rincian per paket, dan bagian tiap ISP untuk Load Balance (termasuk agar tetap cukup bila satu ISP mati). Ada peringatan bila overbooking terlalu tinggi atau isian belum lengkap.",
          "Asumsi bisa diatur: cadangan 0–200%, skenario jam sibuk Hemat/Normal/Aman, dan jumlah ISP 1–8.",
          "Perintah RouterOS siap salin untuk pembatasan tiap paket: /ppp profile (PPPoE), /ip hotspot user profile (Hotspot), dan tipe PCQ + simple queue per subnet (IP DHCP), dengan rate-limit upload/download.",
          "Isian tersimpan di browser (tidak dikirim ke server) dan menu bisa diatur dari Dashboard Admin seperti menu lain.",
        ],
      },
    ],
  },
  {
    version: "1.35.4",
    date: "2026-10-20",
    title: "Load Balance 3–8 ISP: disamakan dengan script LB PCC standar",
    changes: [
      {
        type: "fixed",
        items: [
          "Script Load Balance untuk 3 ISP ke atas kini memiliki jumlah rule yang sama dengan script LB PCC standar. Penyebab router terputus saat script ditempel adalah rute cadangan lintas ISP yang bertambah N×(N−1) (3 ISP = 6 rute, 8 ISP = 56 rute) dan tidak ada di script standar.",
        ],
      },
      {
        type: "changed",
        items: [
          "Rute cadangan lintas ISP dijadikan opsi \"Rute cadangan lintas ISP\" di Pengaturan lanjutan, mati secara bawaan. Aktifkan hanya bila memerlukan failover untuk koneksi yang sudah dibagi PCC.",
        ],
      },
    ],
  },
  {
    version: "1.35.3",
    date: "2026-10-18",
    title: "Halaman login: kartu tidak lagi bergantung pada animasi untuk muncul (iPhone)",
    changes: [
      {
        type: "fixed",
        items: [
          "Animasi masuk kartu login sebelumnya memudar dari opacity 0. Browser mini iOS untuk captive portal bisa menunda animasi, sehingga kartu tetap tak terlihat dan halaman tampak kosong di iPhone padahal normal di Android. Animasi kini hanya bergeser 6 px tanpa mengubah opacity, jadi kartu selalu terlihat. Animasi centang di halaman Berhasil masuk juga tidak lagi mulai dari transparan. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.35.2",
    date: "2026-10-18",
    title: "Halaman login: jeda 3 detik dengan animasi saat kode voucher benar",
    changes: [
      {
        type: "added",
        items: [
          "Setelah kode voucher benar (halaman Berhasil masuk), pengguna melihat animasi centang hijau, bilah waktu yang terisi selama 3 detik, dan hitung mundur \"Kode voucher benar. Mengalihkan dalam N detik…\" sebelum dialihkan otomatis. Tombol \"Lanjutkan sekarang\" tetap ada untuk melewati jeda, dan ada pengalihan cadangan 4 detik bila JavaScript mati. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.35.1",
    date: "2026-10-18",
    title: "WhatsApp di halaman login menjadi teks tegas",
    changes: [
      {
        type: "changed",
        items: [
          "WhatsApp di halaman login tidak lagi berupa tombol, melainkan teks tebal bergaris bawah di bawah form (tanpa ikon dan bingkai). Warna teks bisa dipilih (bawaan hijau yang menyesuaikan terang/gelapnya kartu, atau putih/hitam/warna lain) dan ukuran tulisannya 11–24 px. Pengaturan warna tombol dan tinggi tombol dihapus dari editor. Berlaku di desain Minimal dan Poster, juga di halaman logout dan error; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.35.0",
    date: "2026-10-18",
    title: "Halaman login: pesan error berjenis dan layar loading",
    changes: [
      {
        type: "added",
        items: [
          "Pesan error di halaman login kini berjenis, dengan judul dan warna sendiri: \"Server tidak merespons\" (RADIUS timeout, oranye), \"Voucher sudah digunakan\" (batas sesi/perangkat, biru), \"Voucher habis\" (batas waktu atau kuota, kuning), dan \"Kode tidak valid\" (merah). Jenisnya dikenali dari pesan asli RouterOS, sehingga tetap benar walau teks di errors.txt diubah.",
          "Layar loading penuh (spinner di atas latar kabur) tampil setelah kode voucher diisi dan Login ditekan. Bila server lambat lebih dari 8 detik, teksnya berganti menjadi \"Masih menunggu respons server…\". Layar ditutup otomatis bila pengguna kembali dengan tombol Back. Tombol Login tetap berputar dan tidak bisa ditekan dua kali.",
        ],
      },
      {
        type: "changed",
        items: [
          "errors.txt: pesan untuk RADIUS tidak merespons, voucher dipakai perangkat lain, voucher habis waktu, voucher habis kuota, dan kode tidak valid ditulis lebih jelas (kode tidak valid kini menyebut kemungkinan voucher sudah digunakan atau habis). Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.34.4",
    date: "2026-10-17",
    title: "Load Balance: disamakan dengan script LB PCC yang terbukti jalan",
    changes: [
      {
        type: "fixed",
        items: [
          "Mode IP Address List (RFC1918): rule mark-routing prerouting kini memakai src-address-list=LOCAL-IP dan dst-address-list=!LOCAL-IP, seperti rule PCC-nya. Sebelumnya hanya src-address-list.",
          "Mode target lokal bawaan diganti dari Interface (bridge-lan, hanya tebakan nama) menjadi IP Address List (RFC1918), yang tidak bergantung pada nama interface LAN. Nama LAN yang salah di mode Interface membuat rule PCC tidak pernah cocok sehingga tidak ada trafik yang dibagi.",
          "Rule WAN mark-connection dikembalikan ke chain input, sesuai pola yang terbukti jalan.",
          "Nama mark/routing table tidak lagi memakai strip: nama ISP \"ISP 1\" menjadi ISP1-conn dan to-ISP1 (sebelumnya ISP-1-conn dan to-ISP-1).",
        ],
      },
    ],
  },
  {
    version: "1.34.3",
    date: "2026-10-17",
    title: "Load Balance: mark-connection WAN memakai prerouting",
    changes: [
      {
        type: "fixed",
        items: [
          "Rule mangle yang menandai koneksi masuk dari WAN (ISPx-conn) kini memakai chain prerouting, bukan input. Dengan input, koneksi yang diteruskan ke LAN (port-forward/dst-nat) tidak ditandai sehingga balasannya bisa keluar lewat ISP yang salah; prerouting menangkap koneksi ke router sekaligus koneksi yang diteruskan.",
        ],
      },
    ],
  },
  {
    version: "1.34.2",
    date: "2026-10-17",
    title: "Load Balance: FastTrack tidak lagi menggagalkan PCC",
    changes: [
      {
        type: "fixed",
        items: [
          "Script Load Balance (PCC) kini membatasi rule FastTrack bawaan MikroTik ke koneksi tanpa mark (set connection-mark=no-mark pada rule fasttrack-connection). FastTrack yang melewati mangle adalah penyebab umum PCC tidak membagi trafik di router berkonfigurasi bawaan. Koneksi PCC selalu bermark ISPx-conn sehingga tetap diproses mangle, sedangkan trafik lain tetap ter-fasttrack.",
          "Script \"Hapus semua\" ikut mengembalikan rule FastTrack seperti semula (unset connection-mark).",
        ],
      },
    ],
  },
  {
    version: "1.34.1",
    date: "2026-10-17",
    title: "Load Balance: perbaikan penyebab PCC tidak berjalan",
    changes: [
      {
        type: "fixed",
        items: [
          "Mode Interface List: script kini membuat interface-list LAN bila belum ada. Sebelumnya rule mangle yang merujuk list yang tidak ada ditolak router, sehingga PCC tidak terpasang sama sekali. Interface LAN tetap harus dimasukkan sebagai member list (petunjuk perintahnya ada di script).",
          "RouterOS v7 dengan Recursive Gateway: rute per routing-table (to-ISPx) kini memakai gateway dengan akhiran @main agar next-hop rekursif dicari di tabel main. Tanpa ini rute di tabel ISP tidak bisa menemukan host-route cek dan trafik bertanda tidak punya jalan keluar.",
          "Script diakhiri daftar cek bila LB tidak berjalan: sumber trafik LAN, counter mangle, status rute, FastTrack, dan koneksi tiap ISP.",
        ],
      },
    ],
  },
  {
    version: "1.34.0",
    date: "2026-10-17",
    title: "Load Balance: script hapus semua settingan",
    changes: [
      {
        type: "added",
        items: [
          "Panel script Load Balance kini punya dua tab: \"Script setup\" dan \"Hapus semua\". Tab Hapus semua menghasilkan script yang membuang semua rule mangle (PCC, bypass lokal, bypass hotspot), NAT per ISP, route (recursive, per routing-mark, cadangan, default), tabel routing (v7), Netwatch/Scheduler/Script failover, dan address-list LOCAL-IP. Bisa disalin atau diunduh sebagai file -hapus.rsc, dan tidak bergantung pada kelengkapan form.",
          "Rule dikenali dari komentar khas Load Balance dan dari ciri-cirinya (nama connection-mark/routing-mark per ISP, interface, address-list), sehingga rule menu lain seperti NAT atau anti tethering dari Setup Mikrotik Baru tidak ikut terhapus.",
        ],
      },
      {
        type: "changed",
        items: [
          "Baris penutup script setup Load Balance kini mengarahkan ke tab Hapus semua, menggantikan perintah pembersihan berbasis komentar yang bisa ikut menghapus rule menu lain.",
        ],
      },
    ],
  },
  {
    version: "1.33.1",
    date: "2026-10-17",
    title: "Tampilan mode terang dipertegas",
    changes: [
      {
        type: "changed",
        items: [
          "Mode terang di seluruh aplikasi dipertegas: latar halaman sedikit lebih gelap agar kartu putih menonjol, garis tepi dan pemisah lebih jelas, teks sekunder lebih gelap, kartu mendapat bayangan tipis, dan judul section (mis. NAMA & SAMBUTAN, KARTU FORM) memakai warna aksen penuh dan huruf tebal. Mode gelap tidak berubah.",
        ],
      },
    ],
  },
  {
    version: "1.33.0",
    date: "2026-10-17",
    title: "Load Balance: format script dibuat ringkas seperti LB PCC standar",
    changes: [
      {
        type: "changed",
        items: [
          "Hasil script Load Balance ditulis ulang dengan format ringkas: header ringkasan (tanggal, RouterOS, jumlah ISP, Recursive Gateway, Bandwidth Ratio, tipe PCC, target lokal), lalu perintah dikelompokkan per menu (address-list, nat, routing table, route, mangle) dengan baris add biasa tanpa pembungkus \"buat bila belum ada\".",
          "Isi mangle mengikuti pola standar: bypass hotspot (nonaktif), bypass trafik lokal di lima chain, mark-connection di chain input per WAN, mark-routing output, PCC mark-connection (dst-address-type=!local), lalu mark-routing prerouting. Address-list LOCAL-IP (RFC1918) dan NAT dengan dst-address-list=!LOCAL-IP kini selalu dibuat di semua mode target lokal.",
          "Route: cek recursive (scope/target-scope 10), route per routing-mark, dan default route memakai scope/target-scope 30 dengan check-gateway=ping. Nama mark mempertahankan huruf asli nama ISP (mis. ISP1-conn, to-ISP1). Bila failover aktif, rute cadangan lintas ISP untuk tiap routing-mark ditambahkan di bawah rute utama.",
          "Karena memakai add biasa, menjalankan script dua kali akan menggandakan rule — bersihkan dulu dengan perintah di baris penutup script bila perlu mengulang.",
        ],
      },
    ],
  },
  {
    version: "1.32.0",
    date: "2026-10-16",
    title: "Setup Mikrotik Baru: NAT tanpa out-interface, user superadmin, generate password",
    changes: [
      {
        type: "added",
        items: [
          "NAT: pilihan cakupan baru \"Global tanpa out-interface — action masquerade saja\". Menulis satu rule chain=srcnat action=masquerade tanpa out-interface (dilindungi pemeriksaan agar tidak dobel bila rule yang sama sudah ada), cocok untuk WAN yang sering berganti atau banyak ISP.",
          "User Mikrotik: tombol Tambah User kini langsung mengisi nama \"superadmin\" (group full) untuk user pertama.",
          "Password admin dan password user punya tombol Generate (acak 14 karakter: huruf besar-kecil, angka, simbol; tanpa karakter membingungkan atau yang butuh escaping), Tampilkan/Sembunyikan, dan Salin. Password hasil generate otomatis ditampilkan agar bisa dicatat sebelum script dijalankan.",
        ],
      },
    ],
  },
  {
    version: "1.31.3",
    date: "2026-10-16",
    title: "Ubah nama interface nonaktif secara bawaan",
    changes: [
      {
        type: "changed",
        items: [
          "Di menu Nama Interface (Setup Mikrotik Baru) kini ada saklar \"Ubah nama interface\" yang mati secara bawaan: kolom nama terkunci dan menampilkan nama bawaan (ether1, ether2, dst), dan script tidak menulis perintah ganti nama. Aktifkan saklar bila ingin mengganti nama; komentar interface tetap bisa diisi kapan saja.",
        ],
      },
    ],
  },
  {
    version: "1.31.2",
    date: "2026-10-15",
    title: "Kartu paket lebih tegas, tombol Template jelas terlihat",
    changes: [
      {
        type: "changed",
        items: [
          "Desain daftar paket \"Kartu\" (desain Minimal) dirancang ulang: kepala kartu berwarna dengan nama paket, harga besar tebal, rincian durasi dan masa aktif dengan ikon, bingkai tebal dan bayangan. Kartu tersusun rapi dua atau tiga per baris menyesuaikan lebar layar. Warna tabel dan warna font tetap bisa diatur. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
      {
        type: "fixed",
        items: [
          "Tombol \"Template\" (admin) di daftar desain tersimpan terasa tidak berfungsi karena formulirnya muncul di bawah daftar, di luar layar. Formulir kini muncul tepat di bawah desain yang diklik, dan pesan hasilnya digulir ke tampilan.",
        ],
      },
    ],
  },
  {
    version: "1.31.1",
    date: "2026-10-15",
    title: "Bagian Nama & sambutan selalu terbuka saat menu dimasuki",
    changes: [
      {
        type: "fixed",
        items: [
          "Di Halaman Login Hotspot, bagian \"Nama & sambutan\" kini dipastikan terbuka otomatis saat menu pertama kali dimasuki. Status buka-tutup dipegang aplikasi, bukan browser, sehingga tidak ikut terbawa dari halaman yang dipulihkan dari cache.",
        ],
      },
    ],
  },
  {
    version: "1.31.0",
    date: "2026-10-15",
    title: "Background aplikasi dari dashboard admin, Pengaturan umum dirapikan",
    changes: [
      {
        type: "added",
        items: [
          "Dashboard Admin: bagian baru \"Background aplikasi\". Admin menambah gambar (JPG/PNG/WEBP, maks 400 KB) ke galeri, memilih satu dengan tombol Pakai, dan mengatur lapisan warna tema 0–90% agar tulisan tetap terbaca. Background berlaku di seluruh halaman aplikasi, lengkap dengan pratinjau, dan bisa dilepas kapan saja. Pilihan berlaku setelah menekan Simpan.",
        ],
      },
      {
        type: "changed",
        items: [
          "Bagian \"Pengaturan umum\" ditata ulang menjadi kartu: Identitas situs (logo + nama) dan Tombol WhatsApp berdampingan, lalu Teks halaman utama selebar penuh, masing-masing dengan judul dan penjelasan singkat.",
        ],
      },
    ],
  },
  {
    version: "1.30.0",
    date: "2026-10-15",
    title: "Setup Mikrotik Baru: menu Nama Interface",
    changes: [
      {
        type: "changed",
        items: [
          "Ganti nama interface kini punya menu sendiri, \"Nama Interface\", tepat setelah Firewall & TTL (sebelum User Mikrotik). Komentar interface ikut pindah ke menu ini.",
          "Kolom nama sudah terisi nama bawaan (ether1, ether2, ether3, dst) dan bisa langsung diedit; port yang namanya tidak diubah tidak ikut diganti di script. Ada ringkasan jumlah nama/komentar yang diatur dan tombol \"Kembalikan semua ke nama bawaan\".",
        ],
      },
    ],
  },
  {
    version: "1.29.1",
    date: "2026-10-14",
    title: "Form nama interface selalu terlihat",
    changes: [
      {
        type: "changed",
        items: [
          "Form \"Nama & komentar interface\" di Setup Mikrotik Baru tidak lagi tersembunyi dalam lipatan: tampil langsung dengan judul sendiri di bawah daftar port setelah Type Mikrotik dipilih.",
        ],
      },
    ],
  },
  {
    version: "1.29.0",
    date: "2026-10-14",
    title: "Setup Mikrotik Baru: ganti nama interface",
    changes: [
      {
        type: "added",
        items: [
          "Di bagian Type Mikrotik, \"Komentar interface\" menjadi \"Nama & komentar interface\": tabel per port dengan kolom Nama baru dan Komentar, label peran (WAN 1, Bridge ...), saran nama, dan pemeriksaan langsung bila nama kembar atau memuat karakter terlarang. Spasi otomatis diganti strip.",
          "Seluruh form dan isi script tetap memakai nama bawaan (ether1, dst). Perintah ganti nama ditulis di bagian paling akhir script, sebelum catatan penutup, sehingga semua setting sebelumnya tidak terlewat; RouterOS memperbarui rujukannya sendiri. Validasi juga menolak nama yang bentrok dengan interface lain atau dengan nama bridge/VLAN di script.",
        ],
      },
    ],
  },
  {
    version: "1.28.0",
    date: "2026-10-14",
    title: "Tombol WhatsApp didesain ulang, widget jam dihapus",
    changes: [
      {
        type: "changed",
        items: [
          "Tombol WhatsApp di halaman login kini berwarna hijau WhatsApp penuh dengan bayangan, bukan lagi tombol bergaris. Warna tombol, warna tulisan, tinggi tombol (32–72 px), dan ukuran tulisan (11–24 px) bisa diatur di bagian WhatsApp. Warna tulisan otomatis menyesuaikan bila tidak dipilih. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
          "Widget jam di halaman login dihapus.",
        ],
      },
    ],
  },
  {
    version: "1.27.1",
    date: "2026-10-14",
    title: "Warna font tabel paket bisa diubah",
    changes: [
      {
        type: "added",
        items: [
          "Pilihan \"Warna font tabel\" di bagian Tabel harga paket. Mengubah warna tulisan di kepala tabel, isi baris, kartu, dan lencana harga (desain Minimal) serta kartu harga (desain Poster). Kosong = otomatis menyesuaikan warna tabel. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.27.0",
    date: "2026-10-14",
    title: "Widget jam di halaman login",
    changes: [
      {
        type: "added",
        items: [
          "Bagian baru \"Widget\" di editor Halaman Login Hotspot: jam digital yang bisa diletakkan di pojok kiri atas, atas tengah, atau pojok kanan atas. Pilihan tambahan: tampilkan detik dan tampilkan hari/tanggal. Jam memakai waktu perangkat pengguna dan warnanya mengikuti tema halaman. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.26.0",
    date: "2026-10-14",
    title: "Pengaturan Mode login dan Tombol dipisah, desain daftar paket bisa dipilih",
    changes: [
      {
        type: "changed",
        items: [
          "Bagian \"Mode login & tombol\" dipecah menjadi dua: \"Mode login\" (mode saat halaman dibuka, tombol pilihan Voucher/Member, tautan coba gratis) dan \"Tombol\" (warna tombol Voucher, kecerahan, warna tombol Login, warna font tombol).",
        ],
      },
      {
        type: "added",
        items: [
          "Pilihan \"Desain daftar paket\" di bagian Tabel harga paket: Tabel (kepala berwarna, baris selang-seling), Kartu (kotak harga berdampingan), atau Daftar (baris dengan lencana harga). Warna tabel harga ikut diterapkan. Berlaku di desain Minimal; desain Poster tetap memakai kartu harga. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.25.1",
    date: "2026-10-14",
    title: "Kode voucher bisa huruf kapital",
    changes: [
      {
        type: "fixed",
        items: [
          "Kolom kode voucher di halaman login tidak lagi memaksa huruf kecil, jadi voucher/username berhuruf kapital (atau campuran) bisa diketik dan dipakai login. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },
  {
    version: "1.25.0",
    date: "2026-10-14",
    title: "Pratinjau HP berbentuk iPhone",
    changes: [
      {
        type: "changed",
        items: [
          "Pratinjau mode HP di editor Halaman Login Hotspot kini berbentuk iPhone sungguhan: bodi logam dengan sudut membulat, notch dengan speaker dan kamera, status bar (jam, sinyal, Wi-Fi, baterai), tombol samping, dan indikator home di bawah. Ukuran layar tetap 390 × 844 dan otomatis menyesuaikan area pratinjau; Tablet dan Laptop tidak berubah.",
        ],
      },
    ],
  },
  {
    version: "1.24.0",
    date: "2026-10-14",
    title: "Template default, placeholder, dan petunjuk login bisa diatur",
    changes: [
      {
        type: "added",
        items: [
          "Admin bisa menetapkan satu template sebagai default: tombol \"Jadikan default\" / \"Lepas default\" di daftar Template (editor dan Dashboard Admin). Siapa pun yang membuka Halaman Login Hotspot langsung memulai dari desain itu; template default tampil paling atas dengan label \"default\".",
          "Bagian baru \"Petunjuk & placeholder\": kalimat petunjuk di atas kolom login (mode Voucher dan Member, mis. \"Masukkan kode voucher, lalu klik Login.\") beserta warnanya, dan placeholder kolom kode voucher, username, dan password. Bila dikosongkan, memakai teks bawaan tiap desain. Teks yang diketik diamankan (tanda kutip dan tag HTML tidak merusak halaman). Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.23.0",
    date: "2026-10-14",
    title: "Logo dan Background terpisah, sudut form bisa diatur",
    changes: [
      {
        type: "added",
        items: [
          "Pengaturan \"Sudut form (border radius)\" 0–40 px di bagian Kartu form: 0 membuat kartu siku-siku, makin besar makin membulat. Berlaku di desain Minimal; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
      {
        type: "changed",
        items: [
          "Bagian \"Background & Logo\" dipecah menjadi dua menu: \"Logo\" (unggah, galeri admin, letak, tinggi) dan \"Background\" (warna latar halaman, gambar latar, kepekatan lapisan, mode, dan fokus gambar). Pengaturan gambar di dalam form dipindah ke bagian Kartu form.",
        ],
      },
    ],
  },  {
    version: "1.22.1",
    date: "2026-10-14",
    title: "IP cek berurutan 1.1.1.1 – 1.1.1.8",
    changes: [
      {
        type: "changed",
        items: [
          "IP/DNS cek jalur di Load Balance kini berurutan penuh: 1.1.1.1, 1.1.1.2, 1.1.1.3, … sampai 1.1.1.8 untuk ISP ke-1 sampai ke-8 (sebelumnya ISP ke-4 dst. memakai resolver publik lain).",
        ],
      },
    ],
  },  {
    version: "1.22.0",
    date: "2026-10-14",
    title: "Load Balance: Interface List, isian berurutan, target cek 1.1.1.x",
    changes: [
      {
        type: "added",
        items: [
          "Target lokal kini punya tiga pilihan: Interface, Interface List (rule PCC memakai in-interface-list), dan Address List (RFC1918).",
        ],
      },
      {
        type: "changed",
        items: [
          "Isian jalur ISP terisi berurutan sejak awal: ether1 / 192.168.1.1 / 1.1.1.1, ether2 / 192.168.2.1 / 1.1.1.2, ether3 / 192.168.3.1 / 1.1.1.3, dan seterusnya, sehingga tinggal memilih versi RouterOS. Tombol \"Kosongkan\" mengosongkan semua isian, dan \"Reset\" mengembalikan isian berurutan.",
          "Target cek jalur (IP/DNS) memakai 1.1.1.1, 1.1.1.2, 1.1.1.3; ISP ke-4 dan seterusnya memakai resolver publik lain (8.8.8.8, 9.9.9.9, dst.) karena alamat 1.1.1.4 ke atas tidak dijamin menjawab ping.",
        ],
      },
    ],
  },  {
    version: "1.21.1",
    date: "2026-10-14",
    title: "Tampilan Load Balance lebih simpel",
    changes: [
      {
        type: "changed",
        items: [
          "Halaman Load Balance dibuat lebih ringkas: empat kartu saklar diganti deretan tombol kecil (Load balance, Failover, Rasio bandwidth, NAT), pilihan Target lokal jadi dua tombol, dan pengaturan yang jarang dipakai (metode PCC, metode failover, interval, prioritas cadangan) disembunyikan di \"Pengaturan lanjutan\".",
          "Jalur ISP kini berupa tabel satu baris per ISP (WAN, Gateway, Mbps, IP cek) sehingga semua ISP terlihat sekaligus; kolom Mbps dan IP cek hanya muncul bila fiturnya aktif.",
        ],
      },
    ],
  },  {
    version: "1.21.0",
    date: "2026-10-14",
    title: "Load Balance PCC + Failover jadi generator satu layar",
    changes: [
      {
        type: "changed",
        items: [
          "Halaman Load Balance PCC + Failover dirombak dari wizard bertahap menjadi generator satu layar: pengaturan dan kartu jalur ISP di kiri, script hasil yang ikut berubah saat mengisi di kanan.",
        ],
      },
      {
        type: "added",
        items: [
          "Jumlah jalur WAN (2–8 ISP) dipilih langsung; ISP yang sudah diisi tidak hilang saat jumlah diubah.",
          "Target lokal bisa berupa Interface LAN atau IP Address List (RFC1918): mode address list membuat daftar LOCAL-IP, memakai src/dst address-list di rule PCC, dan membatasi NAT ke tujuan di luar jaringan lokal.",
          "Rasio bandwidth: isi kecepatan tiap ISP (Mbps) dan beban dibagi sesuai perbandingannya (maksimal 10 bagian per ISP agar rule mangle tetap wajar), menggantikan isian bobot manual.",
        ],
      },
    ],
  },  {
    version: "1.20.2",
    date: "2026-10-14",
    title: "Autoflush DNS lebih rapi",
    changes: [
      {
        type: "changed",
        items: [
          "Autoflush DNS: komentar scheduler di router kini \"Autoflush DNS cache - By Mikrosetting\"; tombol pilihan cepat (6 jam, 12 jam, dst.) dihapus — interval diisi manual; dan tata letak diratakan: panel Jadwal flush dan Cara pakai berakhir sejajar di bawah.",
        ],
      },
    ],
  },  {
    version: "1.20.1",
    date: "2026-10-14",
    title: "Keterangan perlu login di kartu menu",
    changes: [
      {
        type: "added",
        items: [
          "Kartu menu di beranda yang diatur wajib login kini diberi keterangan \"perlu login\" (dengan ikon gembok), sehingga pengunjung tahu sebelum menekannya. Pengunjung yang sudah login melihat keterangan yang lebih redup.",
        ],
      },
    ],
  },  {
    version: "1.20.0",
    date: "2026-10-13",
    title: "Menu Autoflush DNS",
    changes: [
      {
        type: "added",
        items: [
          "Menu baru Autoflush DNS (/autoflush-dns): membuat scheduler Mikrotik yang menjalankan /ip dns cache flush secara berkala. Interval (menit/jam/hari/minggu) dan jam mulai bisa diatur, ada pilihan cepat (tiap 6 jam, 12 jam, harian 03:00, mingguan), opsi menimpa scheduler lama, dan opsi mencatat setiap flush ke log. Hasilnya script siap tempel (v6 dan v7) atau file .rsc.",
          "Menu ini masuk ke grup Mikrotik bila grup itu ada, dan ke grup Konfigurasi bila belum; urutan dan grupnya tetap bisa diatur dari Dashboard Admin.",
        ],
      },
    ],
  },  {
    version: "1.19.0",
    date: "2026-10-13",
    title: "Batas gambar 300 KB, daftar template dirapikan, pengaturan warna berurutan",
    changes: [
      {
        type: "changed",
        items: [
          "Fitur kompres otomatis gambar latar dihapus. Batas ukuran semua gambar yang diunggah (latar, logo, gambar form, dan galeri admin) kini 300 KB; gambar yang lebih besar ditolak dengan pesan ukuran.",
          "Daftar template dirapikan: jendela lebih lebar dengan kartu tiga kolom yang seragam — thumbnail besar di atas, lalu nama, jenis desain, contoh warna, keterangan, tombol Pratinjau dan Pakai, dan baris aksi admin (Timpa, Hapus) di bawahnya.",
          "Pengaturan di editor diurutkan agar tiap warna tepat di bawah pengaturan yang diwarnainya: Nama hotspot → Warna nama hotspot → Teks sambutan → Warna teks sambutan; Mode login → Warna tombol Voucher → Kecerahan → Warna tombol Login → Warna font tombol; Warna latar halaman di bagian Background & Logo; dan Warna font umum di bagian terakhir.",
        ],
      },
    ],
  },  {
    version: "1.18.0",
    date: "2026-10-13",
    title: "Kompres otomatis gambar latar, batas 200 KB",
    changes: [
      {
        type: "added",
        items: [
          "Gambar latar yang diunggah dikompres otomatis di browser: diperkecil (sisi terpanjang maks 1920 px) dan disimpan ulang sebagai JPEG sampai maksimal 200 KB, lalu ditampilkan catatan hasilnya (mis. 2,6 MB → 141 KB). Gambar yang sudah di bawah 200 KB dipakai apa adanya. Berlaku juga untuk unggahan latar oleh admin ke galeri.",
        ],
      },
      {
        type: "changed",
        items: [
          "Batas ukuran gambar latar kini 200 KB (sebelumnya 600 KB), termasuk untuk galeri latar admin. Berkas asli yang diterima hingga 25 MB.",
        ],
      },
    ],
  },  {
    version: "1.17.0",
    date: "2026-10-13",
    title: "Thumbnail dan pratinjau template",
    changes: [
      {
        type: "added",
        items: [
          "Daftar template menampilkan thumbnail halaman login sungguhan (dimuat saat kartunya terlihat), lengkap dengan nama, keterangan, dan warna utama.",
          "Tombol Pratinjau membuka pratinjau besar yang bisa dicoba (HP iPhone 13 atau Laptop), dengan tombol \"Pakai template ini\".",
        ],
      },
    ],
  },  {
    version: "1.16.1",
    date: "2026-10-13",
    title: "Jadikan desain tersimpan sebagai template",
    changes: [
      {
        type: "added",
        items: [
          "Alur membuat template: rancang halaman login, simpan ke database lewat Simpan / Muat, lalu admin menekan tombol \"Template\" pada desain tersimpan itu untuk menjadikannya template bagi semua pengguna. Hanya admin yang melihat tombol ini; desain tersimpan aslinya tidak berubah.",
        ],
      },
    ],
  },  {
    version: "1.16.0",
    date: "2026-10-13",
    title: "Template Halaman Login Hotspot siap pakai",
    changes: [
      {
        type: "added",
        items: [
          "Template siap pakai: admin merancang desain di editor lalu menerbitkannya lewat tombol Template (seluruh pengaturan, termasuk logo dan latar, ikut tersimpan). Siapa pun, juga tanpa login, bisa memuat template itu ke editor lalu menyesuaikannya.",
          "Admin bisa menimpa isi template dengan desain yang sedang dibuka, atau menghapusnya, dari tombol Template maupun dari bagian \"Template Halaman Login Hotspot\" di Dashboard Admin.",
        ],
      },
    ],
  },  {
    version: "1.15.1",
    date: "2026-10-12",
    title: "Tombol Voucher dan Member satu warna",
    changes: [
      {
        type: "changed",
        items: [
          "Tombol Voucher dan Member kini sama-sama berwarna tombol Voucher. Yang dipilih tampil penuh, bercincin, tulisan tebal, dan bertanda centang; yang tidak dipilih dipudarkan. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.15.0",
    date: "2026-10-12",
    title: "Warna font umum dan warna teks sambutan",
    changes: [
      {
        type: "added",
        items: [
          "\"Warna font\" untuk seluruh tulisan di halaman login (label, tabel, catatan, footer, kolom isian, dan tombol outline), terpisah dari nama hotspot, teks sambutan, teks berjalan, dan tulisan di dalam tombol berwarna yang masing-masing punya pengaturan sendiri.",
          "\"Warna teks sambutan\" di bagian Nama & sambutan. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.14.1",
    date: "2026-10-12",
    title: "Warna font tombol bisa diatur",
    changes: [
      {
        type: "added",
        items: [
          "Warna font di dalam tombol berwarna (tombol Login dan tombol Voucher/Member yang aktif) bisa dipilih sendiri, atau dikembalikan ke otomatis (hitam/putih sesuai warna tombol). Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.14.0",
    date: "2026-10-12",
    title: "Warna tabel harga, teks berjalan tanpa latar",
    changes: [
      {
        type: "added",
        items: [
          "Warna tabel harga bisa dipilih sendiri (kepala tabel di desain Minimal, kartu harga di desain Poster); tulisannya menyesuaikan otomatis agar terbaca. Bila tidak dipilih, ikut warna tombol Voucher.",
          "Teks berjalan bisa dibuat tanpa warna latar (hanya tulisan, otomatis mengikuti warna teks kartu), dan warna font-nya bisa dipilih sendiri. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.13.1",
    date: "2026-10-12",
    title: "Form tidak lagi terdorong ke bawah oleh logo",
    changes: [
      {
        type: "fixed",
        items: [
          "Saat logo diletakkan di atas form, kartu form tetap tepat di tengah layar: logo menempati ruang kosong di atasnya (dan footer di luar form di ruang kosong bawahnya) sehingga tidak mendorong form ke bawah. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.13.0",
    date: "2026-10-12",
    title: "Letak logo dan footer, saklar WhatsApp",
    changes: [
      {
        type: "added",
        items: [
          "Logo bisa diletakkan di dalam kartu form atau di atas kartu (di luar form).",
          "Teks footer bisa diletakkan di dalam kartu form atau di bawah kartu (di luar form); di atas gambar latar footer diberi alas gelap tipis agar terbaca.",
          "Tombol WhatsApp punya saklar tampil/sembunyi tanpa menghapus nomornya. Pengaturan WhatsApp dan \"Catatan & footer\" kini dipisah menjadi dua bagian. Letak logo dan footer berlaku di desain Minimal; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
      {
        type: "changed",
        items: ["Bagian \"Gambar\" di editor diganti namanya menjadi \"Background & Logo\"."],
      },
    ],
  },  {
    version: "1.12.0",
    date: "2026-10-12",
    title: "Warna teks berjalan sendiri, warna tombol Voucher, latar bawaan baru",
    changes: [
      {
        type: "added",
        items: [
          "Teks berjalan punya warna sendiri: warna bar (bawaan abu kebiruan gelap #1e293b) dan warna tulisan (otomatis terbaca, atau pilih sendiri), tidak lagi mengikuti warna tema.",
        ],
      },
      {
        type: "changed",
        items: [
          "Pengaturan \"Warna tema\" diganti \"Warna tombol Voucher\" (beserta kecerahannya). Warna ini dipakai tombol Voucher/Member yang aktif, dan tetap menjadi dasar warna judul tabel, tautan, serta tombol Login bila warna tombol Login tidak dipilih sendiri.",
          "Warna latar halaman bawaan kini #eef2f7.",
        ],
      },
    ],
  },  {
    version: "1.11.0",
    date: "2026-10-12",
    title: "Teks berjalan bisa dimatikan dan dipindah, pengaturan tampilan dipisah",
    changes: [
      {
        type: "added",
        items: [
          "Teks berjalan di Halaman Login Hotspot kini punya saklar tampil/sembunyi (teksnya tidak terhapus) dan pilihan letak: di atas atau di bawah form. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
      {
        type: "changed",
        items: [
          "Bagian \"Tampilan\" di editor dipecah jadi tiga bagian terpisah yang bisa dibuka-tutup: \"Nama & sambutan\", \"Warna\", dan \"Kartu form\".",
        ],
      },
    ],
  },  {
    version: "1.10.0",
    date: "2026-10-12",
    title: "Warna nama hotspot dan tombol Login",
    changes: [
      {
        type: "added",
        items: [
          "Warna tulisan nama hotspot dan warna tombol Login bisa dipilih sendiri di Halaman Login Hotspot (warna siap pakai atau bebas), atau dikembalikan ke otomatis. Warna tulisan di dalam tombol menyesuaikan sendiri agar terbaca. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.9.0",
    date: "2026-10-12",
    title: "Garis tepi form login bisa diatur",
    changes: [
      {
        type: "added",
        items: [
          "Pengaturan \"Garis tepi form\" di Halaman Login Hotspot: tebal 0–8 px (0 = tanpa garis) dan warna garis sendiri, atau otomatis mengikuti warna tema. Berlaku di desain Minimal; paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.8.1",
    date: "2026-10-12",
    title: "Kartu login tanpa garis tebal di atas",
    changes: [
      {
        type: "changed",
        items: [
          "Garis aksen tebal di sisi atas kartu form login dihapus; kartu kembali berbingkai tipis rata di semua sisi. Paket halaman login perlu di-upload ulang ke router.",
        ],
      },
    ],
  },  {
    version: "1.8.0",
    date: "2026-10-12",
    title: "Kecerahan warna tema bisa diatur",
    changes: [
      {
        type: "added",
        items: [
          "Slider \"Kecerahan warna tema\" (50–150%) di Halaman Login Hotspot: menggelapkan atau menerangkan warna tema yang dipilih tanpa mengganti warnanya, lengkap dengan contoh warna hasil dan tombol atur ulang 100%. Warna teks di atas tombol dan tabel menyesuaikan otomatis agar tetap terbaca.",
        ],
      },
    ],
  },  {
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
