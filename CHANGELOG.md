# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id/).

> File ini dibuat otomatis dari `lib/changelog.ts` — jangan edit langsung di
> sini, edit sumbernya lalu jalankan `npm run changelog:generate`.

## [1.7.0] - 2026-10-12

_Galeri logo dan rekomendasi ukuran gambar_

### Ditambahkan

- Galeri logo siap pakai: admin mengunggahnya di Dashboard Admin (PNG, JPG, WEBP, atau SVG, maks 200 KB), dan semua pengguna Halaman Login Hotspot bisa langsung memilihnya. Pengguna tetap bisa mengunggah logo sendiri.
- Kotak rekomendasi ukuran di editor dan di dashboard admin: logo 400 × 160 px (rasio 5:2, PNG/SVG transparan), latar 1920 × 1080 px (16:9, JPG) atau 1080 × 1920 px untuk HP tegak.

## [1.6.4] - 2026-10-12

_Model baru: hEX refresh (E50UG)_

### Ditambahkan

- Model Mikrotik hEX refresh (E50UG) di pilihan Type Mikrotik: 5 port Gigabit Ethernet, hanya RouterOS v7.

## [1.6.3] - 2026-10-11

_Latar tidak lagi terpotong di layar laptop_

### Ditambahkan

- Mode gambar "Utuh + kabur" (kini bawaan): seluruh gambar latar terlihat di tengah tanpa terpotong, dan sisi layar yang kosong diisi salinan gambar yang dikaburkan. Berlaku di desain Minimal dan Poster; mode Penuh, Utuh, dan Tarik tetap tersedia. Paket halaman login perlu di-upload ulang ke router.

## [1.6.2] - 2026-10-11

_Perbaikan edit nama grup_

### Diperbaiki

- Nama grup menu di dashboard admin bisa diketik dengan lancar; sebelumnya kursor terlepas di setiap huruf. Nama diterapkan saat Enter atau pindah kolom, dan nama kosong atau kembar dengan grup lain dibatalkan.

## [1.6.1] - 2026-10-11

_File .rsc siap di-restore_

### Diubah

- File .rsc yang diunduh dari Setup Mikrotik Baru kini diawali petunjuk restore: upload ke Files lalu /import, atau restore total lewat /system reset-configuration run-after-reset, plus cara menyimpannya sebagai file .backup asli router. Tampilan script di layar tidak berubah.

## [1.6.0] - 2026-10-11

_Studio pratinjau, iPhone 13, dan konfirmasi logout_

### Ditambahkan

- Popup konfirmasi sebelum keluar dari akun (di beranda dan di Setup Mikrotik Baru).
- Pilihan "Mode gambar" untuk latar halaman login: Penuh (menutupi layar), Utuh (seluruh gambar terlihat), atau Tarik (memenuhi layar).

### Diubah

- Pratinjau Halaman Login Hotspot dibuat seperti studio: panel pratinjau sejajar dan setinggi menu edit di kiri, memenuhi layar tanpa perlu menggulir halaman.
- Ukuran pratinjau HP mengikuti iPhone 13 (390 × 844), dengan sudut layar yang lebih membulat.

## [1.5.3] - 2026-10-11

_Judul dan ikon tab mengikuti identitas situs_

### Diubah

- Judul tab browser kini memakai nama situs dari dashboard admin (mis. "Cek Mikrotik — Nama Situs"), dan ikon tab (favicon) memakai logo yang diunggah di sana. Tanpa logo, ikon bawaan tetap dipakai.

## [1.5.2] - 2026-10-11

_Latar halaman login menyesuaikan ukuran layar_

### Diperbaiki

- Gambar latar pada desain Minimal kini ditaruh di lapisan tetap seukuran layar, sehingga selalu menutupi seluruh layar HP (tegak maupun mendatar), tablet, dan laptop — tidak lagi melar atau membesar saat isi halaman panjang karena tabel paket. Paket halaman login perlu di-upload ulang ke router.

### Ditambahkan

- Pilihan "Fokus gambar" (tengah, atas, bawah, kiri, kanan) untuk menentukan sisi gambar latar yang tetap terlihat saat gambar dipotong menyesuaikan layar.

## [1.5.1] - 2026-10-11

_Pengaturan menu & grup lebih mudah_

### Diubah

- Menu & grup di dashboard admin kini berupa satu kartu per grup: nama grup bisa diedit langsung di judulnya, lengkap dengan panah geser dan tombol tambah menu.
- Panah ↑↓ pada menu bergerak lintas grup — di ujung sebuah grup, menu pindah ke grup tetangga — jadi tidak perlu membuka pengaturan lain untuk memindahkan menu.

## [1.5.0] - 2026-10-11

_Kalkulator IP, grup menu, dan dashboard admin lebih ringkas_

### Ditambahkan

- Halaman Kalkulator IP (/kalkulator-ip): network, broadcast, rentang host, netmask, wildcard, jenis alamat, tampilan biner, pembagian subnet, dan perintah RouterOS siap salin. Tersedia sebagai menu yang bisa diatur dari dashboard admin.
- Grup menu: menu di beranda dikelompokkan (bawaan "Konfigurasi" dan "Alat"); nama, urutan, dan isi grup diatur dari dashboard admin.

### Diubah

- Dashboard admin dibuat dropdown per bagian supaya tidak panjang digulir; identitas situs, tombol WhatsApp, dan teks beranda digabung di "Pengaturan umum".

## [1.4.1] - 2026-10-11

_Login hotspot terasa lebih cepat_

### Diubah

- Tombol Login di halaman login hotspot langsung berputar dan menampilkan "Memproses…" saat ditekan, jadi tidak terlihat macet saat router memproses.

### Diperbaiki

- Halaman "Berhasil masuk" kini langsung mengalihkan, tidak lagi menunggu logo dan gambar latar selesai dimuat lebih dulu. Paket halaman login perlu di-upload ulang ke router agar berlaku.

## [1.4.0] - 2026-10-11

_Logo, nama situs, dan tombol WhatsApp dari admin_

### Ditambahkan

- Logo dan nama situs diatur dari Dashboard Admin; tampil di pojok kiri atas beranda dan di footer.
- Tombol WhatsApp (CTA) di beranda dengan nomor, teks tombol, dan pesan awal yang diatur dari Dashboard Admin, plus pilihan tombol melayang di pojok kanan bawah.

### Diperbaiki

- Logout tampak tidak berfungsi karena nginx menyimpan cache halaman beranda; aplikasi kini meminta nginx tidak men-cache halaman dinamis, dan cookie sesi dihapus lewat jalur cadangan.

## [1.3.0] - 2026-10-11

_Galeri latar untuk Halaman Login Hotspot_

### Ditambahkan

- Admin bisa mengunggah galeri latar siap pakai di Dashboard Admin; semua pengguna Halaman Login Hotspot bisa langsung memilihnya, dan tetap bisa mengunggah latar sendiri.

### Diperbaiki

- Daftar akun di Kelola Pengguna langsung bertambah setelah akun dibuat, dan tidak lagi bisa tertahan cache browser/proxy.

## [1.2.0] - 2026-10-11

_Dashboard admin, analitik menu, dan akses menu per pengaturan_

### Ditambahkan

- Dashboard Admin (/admin), hanya bisa dibuka admin: ringkasan pengguna & data tersimpan, pengaturan menu beranda, versi aplikasi, dan changelog terbaru.
- Pengaturan per menu: tampil/sembunyi, mode pengembangan (hanya admin yang bisa membuka), dan wajib login atau bebas diakses.
- Tambah, hapus, dan urutkan menu beranda sendiri (alamat dalam situs atau tautan luar, dengan pilihan ikon).
- Pengaturan teks beranda: judul, kalimat pembuka, tombol utama, bagian cuplikan/jaminan, dan footer.
- Analitik: jumlah pemakaian tiap menu dihitung dan ditampilkan di kartu menu serta di dashboard admin. Tanpa data pribadi; satu browser dihitung sekali per menu dalam 30 menit.
- Komentar interface pada Setup Mikrotik Baru (tertutup secara default), ditulis ke script lewat /interface set.

### Diubah

- Logika login: beranda kini terbuka untuk umum dan menampilkan username saat sudah login. Menu hanya meminta login bila diatur begitu di dashboard admin; yang sudah login bisa membuka semua menu.
- Menu beranda dibuat lebih ringkas: kartu kecil berisi ikon, judul, dan satu kalimat.
- Pilihan Type Mikrotik di Setup kini punya kolom cari.

## [1.1.0] - 2026-10-10

_Halaman Login Hotspot lebih lengkap_

### Ditambahkan

- Simpan dan muat desain halaman login hotspot ke database (butuh akun), termasuk logo dan gambar.
- Pratinjau bisa dialihkan ke ukuran HP, tablet, dan laptop; pratinjau tetap di tempat saat menu edit di kiri digulir.
- Warna form, kepekatan form sampai 0% (tembus pandang), lebar form yang bisa diatur, dan gambar di dalam form.
- Menu edit dikelompokkan jadi bagian yang bisa dibuka-tutup.

### Diubah

- Desain dipangkas menjadi Minimal (bawaan) dan Poster; pilihan Voucher, Korporat, dan Gelap Modern dihapus.
- Tabel paket dirombak: kepala berwarna, baris selang-seling, harga rata kanan.

### Diperbaiki

- Kartu form tidak lagi punya scroll sendiri saat isinya panjang; yang menggulir seluruh halaman.
- Daftar desain tersimpan langsung diperbarui setelah menyimpan, dengan pesan error yang jelas bila server menolak.

## [1.0.0] - 2026-09-30

_Login & riwayat konfigurasi di database_

### Ditambahkan

- Sistem login (username/password) khusus menu Setup Mikrotik Baru.
- Riwayat konfigurasi tersimpan di database MySQL — bisa dimuat ulang dari perangkat lain selama login dengan akun yang sama.
- Panel admin (/admin/users) untuk mendaftarkan akun pengguna baru.
- Peran Admin bisa melihat riwayat konfigurasi milik semua akun, tidak hanya miliknya sendiri.

### Diubah

- Menu Setup Mikrotik Baru kini wajib login. Load Balance & Fail Over dan Halaman Login Hotspot tetap bisa dipakai publik tanpa akun.
- Dialog Simpan/Muat menambah bagian "Riwayat di server" berdampingan dengan opsi lama "Tersimpan di browser ini".
- Script update server diganti nama dari `deploy.sh` jadi `update.sh`, sekaligus ditambah pra-pemeriksaan (`.env` ada, git bersih) dan pencatatan ke `update.log`.

## [0.7.0] - 2026-09-30

_Polish UI/UX_

### Diubah

- Landing page: hapus badge kicker dan teks gradient pada judul, sesuai prinsip desain yang lebih bersih.
- Gabungkan kartu menu "Load Balance PCC" dan "Fail Over" jadi satu kartu — sebelumnya keduanya mengarah ke halaman builder yang sama.
- Rapikan duplikasi kode: fungsi unduh file dan pewarnaan sintaks script dipindah jadi helper bersama (`lib/download.ts`, `lib/script-highlight.tsx`).

## [0.6.1] - 2026-08-15

_Perbaikan bug_

### Diperbaiki

- Modal tidak lagi merebut fokus balik ke tombol tutup di setiap ketikan.

## [0.6.0] - 2026-08-11

_Load Balance & Fail Over jadi menu sendiri_

### Ditambahkan

- Menu baru: Load Balance PCC multi-ISP dengan failover recursive gateway.
- Metode failover tambahan: Netwatch Ping dan Scheduler Check, selain Recursive Gateway.

### Diubah

- Halaman Login dipindah keluar dari wizard Setup jadi menu tersendiri.
- Load Balance (PCC) dan Failover kini independen — bisa diaktifkan salah satu atau keduanya.

## [0.5.0] - 2026-08-10

_Wireless, anti-tethering, desain Poster_

### Ditambahkan

- Section Wireless supaya hotspot di perangkat yang punya radio Wi-Fi (hAP, dst) benar-benar berfungsi.
- Anti-tethering lewat penurunan TTL ke klien.
- Desain halaman login "Poster", mengikuti tata letak PRONET.

## [0.4.0] - 2026-08-08

_BAST & halaman login jadi langkah sendiri_

### Ditambahkan

- Dokumen Berita Acara Serah Terima (BAST) untuk pelanggan.

### Diubah

- Editor halaman login dipisah jadi langkah tersendiri di wizard Setup.

## [0.3.0] - 2026-08-07

_PPPoE multi-profile, tema terang, preset siap pakai_

### Ditambahkan

- Dukungan banyak profile PPPoE dalam satu konfigurasi.
- Tema terang untuk UI generator.
- Konfigurasi siap pakai (preset) yang mencakup hotspot dan PPPoE.
- Model RB450Gx4 ditambahkan ke database perangkat.
- Pengaturan ukuran logo pada halaman login hotspot.

### Diperbaiki

- Pratinjau halaman login tidak lagi menggeser posisi scroll saat mengetik.

## [0.2.0] - 2026-08-06

_Database model & halaman login hotspot_

### Ditambahkan

- Branding Mikrosetting pada script hasil generate dan UI.
- Panduan deploy ke aaPanel (Node.js + PM2), termasuk `deploy.sh`.
- Database model Mikrotik diperluas menjadi 47 entri.
- Template halaman login hotspot dengan kustomisasi warna, logo, dan gambar latar.
- Paket hotspot lengkap sebagai satu folder (bukan hanya satu file HTML).

### Diubah

- Urutan wizard: manajemen user dipindah ke langkah terakhir, firewall default nonaktif.

### Diperbaiki

- Script hasil generate aman ditempel ulang di router yang sudah pernah dikonfigurasi.
- Berhenti mengirim parameter comment= ke menu Mikrotik yang menolaknya.

## [0.1.0] - 2026-08-05

_Rilis awal — Setup Mikrotik Baru_

### Ditambahkan

- Builder Setup Mikrotik Baru (menu pertama) — seluruh proses generate berjalan di browser.
- Alur wizard langkah-per-langkah untuk mengisi konfigurasi.
- Simpan & muat konfigurasi di penyimpanan browser (localStorage).
