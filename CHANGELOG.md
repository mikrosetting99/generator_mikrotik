# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id/).

> File ini dibuat otomatis dari `lib/changelog.ts` — jangan edit langsung di
> sini, edit sumbernya lalu jalankan `npm run changelog:generate`.

## [1.55.0] - 2026-10-29

_AI Mikrotik Engineer: Mikrotik tersimpan di akun dan status tersambung/offline otomatis_

### Ditambahkan

- Tambah Mikrotik disimpan di server per akun pengguna (tabel baru ai_routers): nama, IP publik atau domain, port, TLS, username, dan password. Password dienkripsi AES-256-GCM, tidak pernah dikirim kembali ke browser, dan router milik pengguna lain tidak bisa diakses. Tersedia tombol Uji koneksi sebelum menyimpan; saat mengubah, password boleh dikosongkan agar tetap memakai yang lama.
- Status tersambung atau tidak untuk semua Mikrotik diperiksa otomatis saat halaman dibuka dan tiap menit, juga lewat Periksa/Periksa semua. Statusnya: Tersambung (dengan waktu respons ms, identity, versi RouterOS, board, dan CPU), Offline (port ditolak atau tidak terjangkau), Tidak merespons (waktu habis), Login gagal, atau Alamat ditolak. Lencana tampil di daftar router, pilihan router aktif di atas chat, dan baris status di tab Monitoring beserta alasan kegagalannya.
- Tab Monitoring otomatis memantau semua router yang online tanpa perlu menekan Hubungkan. Router yang dipakai sebelumnya (disimpan di browser) diimpor otomatis ke akun satu kali.

### Diubah

- Perintah dan monitoring kini memakai routerId milik pengguna; kredensial router tidak lagi dikirim dari browser pada setiap permintaan. Menambah tema warna ok (hijau) untuk lencana tersambung.

## [1.54.0] - 2026-10-29

_AI Mikrotik Engineer: monitoring, banyak router, semua model; tampilan lebih rapi_

### Ditambahkan

- Tab Monitoring di AI Mikrotik Engineer: pembacaan langsung tiap 3/5/10/30 detik untuk semua router yang tersambung. Menampilkan CPU, memori, penyimpanan, suhu dan tegangan (bila ada sensor), jumlah hotspot aktif, PPP aktif, lease DHCP, dan koneksi firewall, grafik trafik unduh/unggah per interface, serta tabel semua interface dengan Rx/Tx. Bisa dijeda.
- Bisa menambah beberapa Mikrotik: daftar router (nama, IP publik/domain, port, TLS, username) dengan tombol Hubungkan, Putuskan, Ubah, dan Hapus. Router bertanda aktif menjadi sasaran perintah dari chat dan bisa diganti lewat pilihan di atas chat. Password tidak disimpan kecuali dicentang Simpan password. Pengaturan satu-router versi lama dipindahkan otomatis.
- Tombol Muat semua model memuat seluruh model yang tersedia untuk API key pada penyedia terpilih (Anthropic, OpenAI, Gemini, OpenRouter, DeepSeek, Groq, dan penyedia kompatibel OpenAI). Daftar tersimpan di browser dan dipakai sebagai saran pada kolom model.

### Diubah

- Dashboard Admin disamakan dengan aplikasi Pengaturan Odoo Enterprise: menu bagian di bilah atas, sidebar dengan ikon berwarna tiap menu dan penanda aktif, serta breadcrumb di panel kontrol.
- Beranda dan chat tidak lagi serba di tengah: sapaan, judul grup, ikon aplikasi, dan pesan chat kini rata kiri memakai lebar layar.

## [1.53.0] - 2026-10-29

_Tampilan seluruh aplikasi disamakan dengan Odoo 17 Enterprise_

### Diubah

- Bilah navigasi kini putih dengan garis tipis di bawah seperti Odoo Enterprise (sebelumnya ungu), lengkap dengan ikon grid aplikasi di kiri pada beranda dan Dashboard Admin. Berlaku di semua halaman, baik tema terang maupun gelap.
- Beranda menjadi menu aplikasi Odoo Enterprise: latar ungu bergradasi memenuhi layar, bilah navigasi transparan, dan tiap menu berupa ikon aplikasi kotak membulat berwarna dengan nama di bawahnya, tersusun di tengah per grup. Keterangan, jumlah pemakaian, dan status menu pindah ke tooltip; lencana kunci menandai menu yang perlu login. Sapaan, tombol CTA, cuplikan, dan keunggulan tetap mengikuti pengaturan admin.
- Kolom isian bergaya form Odoo: hanya garis bawah dengan latar transparan, garis menebal berwarna ungu saat fokus. Tombol memakai sudut kecil Odoo; tombol utama ungu solid dengan hover menggelap, tombol sekunder putih berpinggir tipis.

## [1.52.0] - 2026-10-29

_AI Mikrotik Engineer: tampilan chat disamakan dengan wyn.mikrosetting.com_

### Diubah

- Tata letak dua panel seperti wyn: riwayat percakapan di kiri (tombol Percakapan baru, daftar dengan judul dan jam, hapus per percakapan, tersimpan di browser) dan chat memenuhi layar di kanan. Di HP riwayat muncul sebagai panel geser lewat tombol Riwayat.
- Gelembung chat gaya wyn pada kolom tengah maksimal 860px: pesan pengguna berwarna brand di kanan, jawaban AI berlatar abu muda dengan garis tipis di kiri, blok kode gelap dengan tombol Jalankan dan Salin, serta catatan sistem berbentuk pil di tengah.
- Hasil perintah di router kini berupa baris yang bisa dilipat (Hasil di router · N perintah) dan terbuka otomatis bila ada yang gagal.
- Pengaturan Koneksi AI, Router, dan Skill pindah ke panel geser di kanan yang dibuka lewat tombol Pengaturan atau lencana di bagian atas chat (penyedia/model, status router, jumlah skill). Halaman chat memakai lebar penuh dan bar kirim di bawah dengan kolom yang membesar otomatis.

## [1.51.1] - 2026-10-29

_Halaman Login Hotspot: latar menyesuaikan ukuran HP_

### Diperbaiki

- Mode latar "Utuh + kabur" kini otomatis memenuhi layar saat HP dipegang tegak (layar lebih tinggi daripada lebar), pada desain Minimal dan Poster. Sebelumnya foto landscape hanya tampil sebagai pita kecil di tengah dengan sisa layar kabur. Laptop dan HP mendatar tetap utuh + kabur. Keterangan mode di editor diperbarui. Paket halaman login perlu diunduh ulang dan diunggah lagi ke router agar perubahan ini berlaku.

## [1.51.0] - 2026-10-29

_Menu baru: AI Mikrotik Engineer_

### Ditambahkan

- Menu AI Mikrotik Engineer (di grup Mikrotik bila ada, jika tidak di Konfigurasi): chat dengan AI untuk bertanya, menyusun script, dan memberi instruksi. Jawaban AI berisi blok perintah RouterOS yang bisa disalin atau dijalankan langsung di router.
- API AI bisa dipilih: Anthropic (Claude), OpenAI, Google Gemini, OpenRouter, DeepSeek, Groq, atau penyedia lain yang kompatibel dengan OpenAI (isi Base URL). Model bisa dipilih atau diketik sendiri. API key disimpan di browser pengguna dan hanya diteruskan server ke penyedia saat chat.
- Koneksi ke Mikrotik lewat API RouterOS (port 8728, atau 8729 dengan TLS) memakai IP publik atau domain. Klien API ditulis sendiri (tanpa pustaka tambahan) dan mendukung login RouterOS 6 dan 7. Perintah gaya CLI (print where, add, set, remove, enable, disable, [find ...]) diterjemahkan otomatis ke API.
- Skill dari skills.sh: tempel link skills.sh, URL GitHub, pemilik/repo, atau perintah npx skills add ... --skill nama. SKILL.md diambil dari GitHub, bisa diaktifkan atau dinonaktifkan, dan dikirim ke AI sebagai panduan tambahan. Skill disimpan di browser pengguna.
- Keamanan: perintah baca (print) bisa dijalankan otomatis dan hasilnya dianalisis AI; perintah yang mengubah konfigurasi selalu butuh persetujuan pengguna, perintah berisiko (reboot, user, service, paket) butuh persetujuan kedua, dan reset-configuration diblokir. Server hanya mau menyambung ke IP publik (alamat jaringan lokal ditolak), kredensial router tidak disimpan, dan jumlah permintaan per pengguna dibatasi.
- Menu ini wajib login dan secara bawaan hanya terlihat admin; admin bisa membukanya untuk pengguna di Dashboard Admin > Situs & Menu.

## [1.50.2] - 2026-10-29

_Script VPN: section form dipertegas_

### Diubah

- Kotak section pada form Script VPN dan kelompok nomor HP di daftar kini lebih tegas: border 2px, garis aksen tebal berwarna brand di sisi kiri, kepala section berlatar warna brand dengan garis bawah tebal, dan bayangan tipis. Garis pemisah antar baris, label (tebal dan lebih gelap), kartu rule port forward, dan hasil akses juga dipertegas agar jelas terlihat di mode terang.

## [1.50.1] - 2026-10-29

_Script VPN: IP lokal (gateway tunnel) mengikuti server yang dipilih_

### Diperbaiki

- Gateway tunnel yang dipantau Netwatch dan scheduler kini mengikuti server VPN: vpn-id1 memakai 10.202.0.1 dan vpn-sg1 memakai 10.102.0.1. Sebelumnya semua server memakai 10.202.0.1. Server manual tetap memakai 10.202.0.1 kecuali diisi sendiri di Pengaturan lanjutan. Contoh IP tunnel pelanggan pada port forward juga mengikuti jaringan server (10.102.0.17 untuk sg1).

## [1.50.0] - 2026-10-29

_Script VPN: pilih server VPN (domain dan IP publik)_

### Ditambahkan

- Form kini punya pilihan Server VPN: vpn-id1.mikrosetting.com (103.181.143.233) atau vpn-sg1.mikrosetting.com (103.250.11.78). Pilihan menentukan connect-to pada script, serta domain dan IP publik pada alamat akses via domain/via IP. Opsi Lainnya (isi manual) tersedia untuk server lain dengan domain dan IP sendiri.

### Diubah

- Kolom Server VPN dipindah dari Pengaturan lanjutan ke bagian utama Script VPN, dan kolom IP publik server di port forward dihapus karena mengikuti server yang dipilih.

## [1.49.0] - 2026-10-29

_VPN Remote: alamat akses via IP dan via domain muncul otomatis dari port forward_

### Diubah

- Pada kategori VPN Remote, kolom Winbox/API manual diganti hasil otomatis dari rule port forward. Tiap rule kini punya Port akses (port di server VPN yang dibuka pelanggan), Port tunnel, IP tujuan LAN, dan Port tujuan. Bagian Hasil akses di form menampilkan Akses via IP (IP publik server:port) dan Akses via domain (domain server:port) langsung saat rule diisi.
- IP publik server bisa diisi per link; kosong = 103.181.143.233 untuk server bawaan vpn-id1.mikrosetting.com. Domain mengikuti kolom Server VPN di Pengaturan lanjutan.
- Halaman pelanggan menampilkan kartu Akses via IP dan Akses via domain untuk tiap rule, masing-masing dengan tombol salin. Kategori lain tetap memakai kolom Winbox/API.

## [1.48.0] - 2026-10-29

_Script VPN: form menyesuaikan kategori, port forward dst-nat untuk VPN Remote_

### Ditambahkan

- Kategori VPN Remote kini punya bagian Port forward (dst-nat): admin mengisi IP tunnel pelanggan (mis. 10.202.0.17) dan daftar rule port tunnel → IP tujuan di LAN : port tujuan. Script pelanggan otomatis ditambah rule /ip firewall nat dst-nat (dengan remove [find comment=...] sebelum add, comment tunnel-nat-<ip>-<port>) setelah bagian scheduler. Kategori Mikhmon tetap tanpa dst-nat.
- Kolom form menyesuaikan kategori: Mikhmon menampilkan Link Mikhmon dan menyembunyikan dst-nat; VPN Remote menampilkan dst-nat dan menyembunyikan Link Mikhmon; kategori lain menampilkan semuanya. Jenis kategori dikenali dari namanya (mengandung "mikhmon" atau "remote").

### Diubah

- Alamat akses Winbox dan API boleh berupa IP publik atau domain, dengan port (mis. 103.1.2.3:8291 atau vpn.contoh.com:8291), dan kini divalidasi formatnya. Label di halaman pelanggan menjadi Alamat Winbox dan Alamat API.

## [1.47.1] - 2026-10-29

_Script VPN: daftar link dikelompokkan per nomor HP_

### Diubah

- Daftar link script kini dikelompokkan per nomor HP: tiap nomor punya kotak sendiri berisi nama pelanggan, jumlah script, dan semua link miliknya (judul, tipe VPN, kategori, tombol Link/WA/Ubah/Hapus).

## [1.47.0] - 2026-10-29

_Script VPN: daftar link di samping form_

### Diubah

- Daftar link script kini berada di sebelah kanan form Tambah/Ubah (layar lebar), bukan di bawahnya. Baris daftar berbentuk kartu ringkas: judul, tipe VPN, nomor HP, pelanggan, kategori, tanggal, dan tombol Link/WA/Ubah/Hapus. Di layar sempit daftar tetap di bawah form.

## [1.46.1] - 2026-10-29

_Script VPN: form admin dirapatkan_

### Diubah

- Form Tambah/Ubah link script dirapikan: baris lebih rapat, kolom label lebih sempit dan sejajar dengan isian, dan kotak grup dibatasi lebarnya sehingga isian tidak melebar sampai tepi layar.

## [1.46.0] - 2026-10-29

_Script VPN: form admin bergaya pengaturan Mikrotik (label kiri, isian kanan)_

### Diubah

- Form Tambah/Ubah link script kini tersusun seperti jendela pengaturan Winbox: tiap baris berisi label di kiri dan kolom isian di kanan, dikelompokkan dalam kotak Pelanggan, Script VPN, Akses router untuk pelanggan, dan Catatan. Di layar HP baris otomatis menumpuk (label di atas isian).

## [1.45.0] - 2026-10-29

_Static Routing: disamakan dengan script RAW acuan Buananet agar routing berlaku_

### Diperbaiki

- Address-list tiap aplikasi kini diisi lebih dulu dengan rentang IP (CIDR) YouTube/Google, TikTok, Facebook/Meta, dan WhatsApp, seperti script acuan. Sebelumnya daftar hanya terisi lewat rule RAW yang membaca TLS, sehingga koneksi awal belum ter-routing. Rule RAW tetap menambah IP baru yang terbaca. Opsi baru "Isi address-list dengan rentang IP aplikasi (CIDR)" aktif secara bawaan; opsi domain (FQDN) kini nonaktif secara bawaan.
- Pola nama host mengikuti acuan: tls-host=*youtube.com*, *.youtube.*, *.googlevideo.*, *.youtu.*, *.ytimg.*, *yt3.ggpht.com*, *youtubei.googleapis.com* (dan pola setara untuk TikTok, Facebook, WhatsApp) yang cocok untuk semua TLD. Mode content memakai potongan teks dari pola yang sama (mis. .youtube., .googlevideo.). Urutan argumen rule RAW sama dengan acuan: protocol=tcp, pencocok, dst-address-list=!LOCAL-IP, src-address-list=LOCAL-IP.
- Script kini aman dijalankan berulang: address-list, rule RAW, rute, dan rule mangle lama dihapus dulu sebelum ditambah (seperti rem [find …] pada acuan). Rule mangle dipindah ke paling atas dengan move … destination=0 menggantikan place-before=0, yang ditolak router bila daftar mangle masih kosong sehingga rule routing tidak terpasang.

## [1.44.0] - 2026-10-29

_Halaman script pelanggan: pilih SSTP/L2TP/OVPN, petunjuk laptop, dan dropdown per script_

### Ditambahkan

- Pelanggan bisa memilih sendiri tipe VPN (SSTP, L2TP, atau OVPN) di halaman link-nya; script dibuat ulang langsung sesuai pilihan, termasuk tombol salin dan unduh .rsc dengan nama berakhiran tipe yang dipilih. Admin menentukan tipe mana yang ditawarkan lewat tombol SSTP / L2TP / OVPN di formulir (bawaan ketiganya; tipe pertama menjadi pilihan awal), dan pratinjau di formulir punya pilihan tipe yang sama. Data lama otomatis menawarkan ketiganya.
- Di atas setiap script tampil petunjuk: "Silahkan copy dan paste script berikut ke New Terminal Mikrotik Anda, wajib pakai laptop."

### Diubah

- Tiap script di halaman pelanggan kini berupa dropdown: judul, penanda VPN/Mikhmon, dan panah di kepala; klik untuk membuka atau menutup isi (Mikhmon, kredensial, IP Winbox/API, pilihan tipe, dan script). Script yang dibuka lewat link langsung terbuka, yang lain tertutup.

## [1.43.0] - 2026-10-29

_Script VPN dibuat otomatis (SSTP/L2TP/OVPN), plus IP Winbox, IP API, dan link Mikhmon_

### Ditambahkan

- Menu Script VPN & Mikhmon Online: admin memilih tipe SSTP, L2TP, atau OVPN lalu cukup mengisi username dan password VPN. Script dibuat otomatis mengikuti bentuk script standar: interface client (dengan remove berdasarkan comment agar aman diulang), Netwatch ke gateway tunnel, dan scheduler yang mematikan lalu menyalakan interface bila gateway tidak bisa di-ping. Pratinjau script yang dilihat pelanggan tampil langsung di formulir.
- Pengaturan lanjutan (bawaan sudah sesuai): versi RouterOS pelanggan (6/7; v7 menambah type=simple pada Netwatch dan cipher aes256-cbc untuk OVPN), server VPN (bawaan vpn-id1.mikrosetting.com), gateway tunnel (bawaan 10.202.0.1), nama tunnel (bawaan dari username), port OVPN, dan IPsec secret untuk L2TP. Username dan password otomatis di-escape agar karakter khusus (kutip, $, ?, backslash) tidak merusak script. Pilihan "Manual / tanpa VPN" tetap ada untuk menempel script sendiri.
- Kolom baru untuk pelanggan: IP Winbox, IP API (alamat:port), dan Link Mikhmon online (harus http:// atau https://; link berbahaya seperti javascript: ditolak). Di halaman pelanggan tampil dengan tombol salin, dan link Mikhmon menjadi tombol "Buka Mikhmon Online". Daftar link admin menampilkan penanda tipe VPN dan Mikhmon.

## [1.42.0] - 2026-10-29

_Menu baru: Script VPN & Mikhmon Online (link pribadi per nomor HP)_

### Ditambahkan

- Menu Script VPN & Mikhmon Online (/vpn, grup Alat) untuk admin menyimpan username, password, dan script dari app.mikrosetting.com, lalu membuat link pribadi untuk pelanggan. Menu ini hanya untuk admin (disembunyikan dari user dan tamu) dan juga ada di sidebar Dashboard Admin.
- Kategori script dikelola admin: bawaan "Mikhmon online" dan "VPN Remote", bisa ditambah, diganti nama, dan dihapus (kategori yang masih dipakai tidak bisa dihapus). Hanya admin yang bisa menambah kategori dan link.
- Formulir admin: nomor HP (08…, +62…, atau 62… dianggap sama), nama pelanggan, kategori, judul, username, password, script, dan catatan. Setelah disimpan muncul link pelanggan dengan tombol Salin link, Salin pesan, dan Kirim lewat WhatsApp (pesan siap kirim ke nomor pelanggan). Daftar link bisa difilter per kategori dan dicari dengan nomor HP, nama, judul, atau username; tiap link bisa disalin, dikirim lewat WA, diubah (link tidak berubah), atau dihapus.
- Halaman pelanggan /script/<kode-acak>: pelanggan membuka link lalu memasukkan nomor HP-nya. Bila cocok, tampil seluruh script milik nomor itu (satu nomor boleh punya banyak link) dikelompokkan per kategori, dengan tombol salin untuk username, password, dan script serta unduh .rsc. Nomor HP yang tidak cocok ditolak dengan pesan yang sama dengan link salah, dan percobaan gagal dibatasi (8 kali per 15 menit per alamat IP dan per link). Halaman tidak diindeks mesin pencari.
- Password dan isi script disimpan terenkripsi (AES-256-GCM) di database. Kuncinya diturunkan dari VPN_SECRET di .env, atau NEXTAUTH_SECRET bila tidak diisi — jangan mengganti rahasia itu setelah data tersimpan karena data lama tidak akan bisa dibuka. Tabel baru dibuat otomatis oleh update.sh (prisma migrate deploy).

## [1.41.0] - 2026-10-27

_Static Routing: format RAW seperti Buananet, pilihan content/tls-host, bawaan baru_

### Diubah

- Rule RAW kini berformat satu rule per domain: action=add-dst-to-address-list, chain=prerouting, protocol=tcp, src-address-list=LOCAL-IP, dst-address-list=!LOCAL-IP (mode Address List), tanpa dst-port. Comment hanya ada di rule pertama tiap aplikasi sebagai judul grup (mis. "youtube - mikrosetting.com"), sama seperti tampilan Winbox pada contoh.
- Bawaan diubah: blokir QUIC, NAT masquerade, dan pembatasan FastTrack kini nonaktif. Isian lama di browser tidak dipulihkan agar bawaan baru berlaku.
- Script Hapus semua mengenali rule RAW dari nama address-list SR-* (karena rule setelah yang pertama tidak punya comment), selain dari comment lama.

### Ditambahkan

- Opsi "Cara RAW mengenali domain": content (bawaan; mencari teks domain di isi paket, berjalan di RouterOS 6 dan 7) atau tls-host (membaca nama host TLS dengan tls-host=*.domain; lebih ringan, butuh RouterOS 6.41+ dan tidak membaca TLS terfragmentasi/ECH).

## [1.40.3] - 2026-10-27

_Static Routing: comment rule memakai huruf kecil_

### Diubah

- Semua comment rule yang dihasilkan menu Static Routing Aplikasi kini ditulis huruf kecil semua, mis. "sr rute to-isp1 - by mikrosetting" dan "sr pelajari ip youtube (youtube.com) - by mikrosetting". Script Hapus semua mengenali comment huruf kecil maupun versi lama yang berhuruf besar, sehingga rule hasil script sebelumnya tetap ikut terhapus.

## [1.40.2] - 2026-10-26

_Static Routing: istilah "bibit" diganti domain (FQDN)_

### Diubah

- Di menu Static Routing Aplikasi, istilah "bibit" diganti dengan istilah yang umum: saklar kini berjudul "Isi address-list dari domain utama (FQDN)" dan komentar rule menjadi "SR domain <Aplikasi>" (sebelumnya "SR bibit …"). Fungsinya sama; penghapusan lewat tab Hapus semua tetap menjangkau rule lama karena memakai address-list SR-*.

## [1.40.1] - 2026-10-26

_Static Routing: kolom nama ISP menjadi nama routing mark_

### Diubah

- Di menu Static Routing Aplikasi, kolom "Nama" pada Jalur ISP diganti menjadi "Routing mark" dan nilainya dipakai apa adanya sebagai nama routing mark (v7: nama tabel routing), tanpa awalan sr- otomatis. Bawaannya sr-ISP1, sr-ISP2, …; bisa disamakan dengan Load Balance (mis. to-ISP1). Isian divalidasi (huruf, angka, titik, strip, underscore; tidak boleh kembar). Isian lama yang tersimpan di browser dikonversi otomatis.
- Tabel routing v7 kini dibuat hanya bila belum ada, jadi aman dipakai berdampingan dengan tabel Load Balance yang bernama sama.

## [1.40.0] - 2026-10-26

_Menu baru: Static Routing Aplikasi (RAW + mangle, RouterOS 6/7)_

### Ditambahkan

- Menu Static Routing Aplikasi (/static-routing, grup Konfigurasi) untuk mengarahkan YouTube, TikTok, Facebook (termasuk Messenger dan Instagram), WhatsApp, atau domain kustom lewat ISP tertentu. Tiap aplikasi diaktifkan dan dipetakan ke salah satu jalur ISP (nama, interface WAN, gateway; sampai 8 ISP).
- Cara kerja script: rule RAW (/ip firewall raw) membaca nama domain (SNI) pada paket TLS port 443 dengan content= lalu memasukkan IP tujuan ke address-list SR-<APLIKASI> secara dinamis (add-dst-to-address-list, masa simpan 6 jam–7 hari); mangle prerouting memberi routing-mark pada trafik LAN ke daftar itu; tiap ISP punya tabel/rute default sendiri dengan NAT masquerade per interface. Mendukung RouterOS 6 (routing-mark) dan 7 (/routing table + routing-table).
- Opsi: bibit address-list dari nama host utama (agar koneksi pertama sudah benar), blokir QUIC (UDP 443) ke IP aplikasi agar klien beralih ke TCP yang SNI-nya terbaca, NAT masquerade (dilewati bila sudah ada), pembatasan FastTrack ke koneksi tanpa mark, rule mangle di paling atas (place-before=0) agar mendahului PCC Load Balance, dan rute cadangan lewat ISP lain. Target trafik LAN bisa memakai Address List RFC1918, Interface List, atau Interface.
- Panel script dengan tab Script setup dan Hapus semua (menghapus hanya rule berkomentar SR … - By Mikrosetting dan address-list SR-*), validasi isian, peringatan (mis. Facebook dan WhatsApp berbagi IP Meta), salin dan unduh .rsc. Isian tersimpan di browser.

## [1.39.1] - 2026-10-26

_Jendela konfirmasi keluar kembali terlihat_

### Diperbaiki

- Jendela konfirmasi "Keluar dari akun?" tidak terlihat saat tombol Keluar di bilah ungu beranda diklik, karena jendela itu dirender di dalam header sehingga mewarisi warna header (teks putih di atas permukaan transparan). Semua jendela dialog kini dirender di luar header (portal ke body), jadi warnanya normal dan tidak terpengaruh letak pemanggilnya. Tombol "Ya, keluar" juga dibuat lebih jelas.

## [1.39.0] - 2026-10-26

_Menu tampil untuk user atau tidak, dan tema warna dari Dashboard Admin_

### Ditambahkan

- Pengaturan menu: kolom baru "User" di tabel Menu & grup (Dashboard Admin, Situs & Menu). Bila dimatikan, menu disembunyikan dari pengguna biasa dan tamu di beranda dan tidak bisa dibuka lewat alamatnya (tampil halaman "Menu tidak tersedia"); admin tetap melihat dan bisa membukanya, dengan label "disembunyikan dari user" di kartunya. Berbeda dari Tampil (menyembunyikan dari semua orang) dan Dev (menampilkan kartu terkunci).
- Tab baru "Tema & Tampilan" di Dashboard Admin: pilih tema warna siap pakai (Odoo ungu, Biru, Hijau, Oranye, Merah anggur, Abu gelap) atau atur warna utama dan warna aksen sendiri dengan pemilih warna dan kode hex. Ada pratinjau tema terang dan gelap, dan tombol kembali ke warna bawaan. Warna berlaku untuk seluruh aplikasi dan semua pengguna setelah Simpan (halaman dimuat ulang otomatis); di mode gelap warnanya dicerahkan otomatis agar terbaca. Background aplikasi dipindah ke tab ini.

## [1.38.0] - 2026-10-26

_Dashboard Admin bergaya aplikasi Pengaturan Odoo_

### Diubah

- Dashboard Admin disusun ulang seperti aplikasi Pengaturan Odoo: bilah ungu di atas, panel kontrol dengan breadcrumb (Dashboard Admin / halaman) dan tombol Lihat beranda, sidebar menu di kiri (di layar kecil menjadi deretan tab), dan isi di kanan. Menu sidebar: Ringkasan, Situs & Menu, Template Login, Galeri Gambar, Pengguna, Versi & Changelog; tiap menu punya alamatnya sendiri (/admin?tab=…).
- Bagian yang tadinya berupa dropdown kini menjadi blok pengaturan datar ala Odoo: kepala abu-abu berisi judul tebal dan keterangan, isi di atas permukaan putih, selalu terbuka.
- Ringkasan menampilkan kartu statistik berikon berwarna dan tabel Pemakaian menu (dengan bilah proporsi) serta pintasan. Halaman Pengguna kini memakai tampilan daftar Odoo: tabel dengan kepala abu-abu (Username, Nama, Peran, Dibuat, Konfigurasi), baris bergaris, dan sorotan saat disentuh.
- Kolom isian di seluruh aplikasi kini berlatar putih seperti Odoo.

## [1.37.1] - 2026-10-26

_Tampilan memenuhi lebar layar_

### Diubah

- Semua halaman (beranda, Setup, Load Balance, Halaman Login Hotspot, Cek Mikrotik, Autoflush DNS, Kalkulator IP, Hitung Bandwidth, Admin, Changelog) kini memenuhi lebar layar, bukan lagi dibatasi dan diposisikan di tengah. Header ungu juga selebar layar, dan kartu aplikasi di beranda bertambah kolom (hingga 6) di layar lebar.

## [1.37.0] - 2026-10-26

_Tampilan aplikasi diubah menjadi bergaya Odoo_

### Diubah

- Seluruh aplikasi memakai tampilan ala Odoo: warna utama ungu #714B67 dengan aksen teal #017E84, latar abu muda dengan kartu putih datar, sudut lebih kecil, tanpa efek cahaya/gradasi, dan font Roboto. Berlaku di mode terang dan gelap (ungu dicerahkan di mode gelap).
- Semua header halaman (Setup, Load Balance, Halaman Login Hotspot, Cek Mikrotik, Autoflush DNS, Kalkulator IP, Hitung Bandwidth, Admin, Changelog) kini berupa bilah navigasi ungu dengan teks putih.
- Beranda didesain ulang seperti layar aplikasi Odoo: bilah ungu di atas dengan ikon grid dan nama situs, lembar putih berisi judul dan cuplikan script, lalu bagian "Aplikasi" berisi ikon berwarna (persegi membulat) per menu dengan nama, deskripsi, jumlah pemakaian, dan label perlu login/pengembangan. Animasi muncul bertahap tetap ada.
- Tombol: aksi utama berwarna ungu datar, tombol sekunder putih bertepi abu seperti Odoo. Pengaturan menu, grup, mode pengembangan, dan login tetap dari Dashboard Admin; tampilan halaman login hotspot yang diunduh ke router tidak berubah.

## [1.36.2] - 2026-10-21

_Animasi muncul bertahap pada kartu menu_

### Ditambahkan

- Kartu menu di beranda kini muncul bertahap: tiap kartu naik sambil memudar masuk dengan jeda 55 ms dari kartu sebelumnya, lalu ikonnya membal sebentar. Judul grup dan label "Pilih menu" ikut naik halus. Animasi dimatikan otomatis bila perangkat memakai pengaturan "kurangi animasi".

## [1.36.1] - 2026-10-21

_Hitung Bandwidth: angka utama adalah kebutuhan puncak + cadangan_

### Diubah

- Di menu Hitung Bandwidth, angka besar yang disorot kini kebutuhan bandwidth (kebutuhan puncak + cadangan), mis. 216 Mbps. Paket ISP terdekat yang cukup (mis. 300 Mbps) dipindah menjadi keterangan kecil di bawahnya.

## [1.36.0] - 2026-10-21

_Menu baru: Hitung Bandwidth_

### Ditambahkan

- Menu Hitung Bandwidth (/hitung-bandwidth, grup Alat) untuk memperkirakan kebutuhan bandwidth ISP dari jumlah user PPPoE, Hotspot, dan IP DHCP. Tiap layanan punya banyak paket pembatasan (nama, download, upload, jumlah user), persen user online bersamaan, dan intensitas pemakaian dengan profil cepat Ringan/Sedang/Berat.
- Hasil langsung: paket ISP yang disarankan (dibulatkan ke ukuran lazim), kebutuhan puncak + cadangan (headroom), kebutuhan upload, rasio overbooking, kasus terburuk bila semua user penuh, porsi per layanan, rincian per paket, dan bagian tiap ISP untuk Load Balance (termasuk agar tetap cukup bila satu ISP mati). Ada peringatan bila overbooking terlalu tinggi atau isian belum lengkap.
- Asumsi bisa diatur: cadangan 0–200%, skenario jam sibuk Hemat/Normal/Aman, dan jumlah ISP 1–8.
- Perintah RouterOS siap salin untuk pembatasan tiap paket: /ppp profile (PPPoE), /ip hotspot user profile (Hotspot), dan tipe PCQ + simple queue per subnet (IP DHCP), dengan rate-limit upload/download.
- Isian tersimpan di browser (tidak dikirim ke server) dan menu bisa diatur dari Dashboard Admin seperti menu lain.

## [1.35.4] - 2026-10-20

_Load Balance 3–8 ISP: disamakan dengan script LB PCC standar_

### Diperbaiki

- Script Load Balance untuk 3 ISP ke atas kini memiliki jumlah rule yang sama dengan script LB PCC standar. Penyebab router terputus saat script ditempel adalah rute cadangan lintas ISP yang bertambah N×(N−1) (3 ISP = 6 rute, 8 ISP = 56 rute) dan tidak ada di script standar.

### Diubah

- Rute cadangan lintas ISP dijadikan opsi "Rute cadangan lintas ISP" di Pengaturan lanjutan, mati secara bawaan. Aktifkan hanya bila memerlukan failover untuk koneksi yang sudah dibagi PCC.

## [1.35.3] - 2026-10-18

_Halaman login: kartu tidak lagi bergantung pada animasi untuk muncul (iPhone)_

### Diperbaiki

- Animasi masuk kartu login sebelumnya memudar dari opacity 0. Browser mini iOS untuk captive portal bisa menunda animasi, sehingga kartu tetap tak terlihat dan halaman tampak kosong di iPhone padahal normal di Android. Animasi kini hanya bergeser 6 px tanpa mengubah opacity, jadi kartu selalu terlihat. Animasi centang di halaman Berhasil masuk juga tidak lagi mulai dari transparan. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.35.2] - 2026-10-18

_Halaman login: jeda 3 detik dengan animasi saat kode voucher benar_

### Ditambahkan

- Setelah kode voucher benar (halaman Berhasil masuk), pengguna melihat animasi centang hijau, bilah waktu yang terisi selama 3 detik, dan hitung mundur "Kode voucher benar. Mengalihkan dalam N detik…" sebelum dialihkan otomatis. Tombol "Lanjutkan sekarang" tetap ada untuk melewati jeda, dan ada pengalihan cadangan 4 detik bila JavaScript mati. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.35.1] - 2026-10-18

_WhatsApp di halaman login menjadi teks tegas_

### Diubah

- WhatsApp di halaman login tidak lagi berupa tombol, melainkan teks tebal bergaris bawah di bawah form (tanpa ikon dan bingkai). Warna teks bisa dipilih (bawaan hijau yang menyesuaikan terang/gelapnya kartu, atau putih/hitam/warna lain) dan ukuran tulisannya 11–24 px. Pengaturan warna tombol dan tinggi tombol dihapus dari editor. Berlaku di desain Minimal dan Poster, juga di halaman logout dan error; paket halaman login perlu di-upload ulang ke router.

## [1.35.0] - 2026-10-18

_Halaman login: pesan error berjenis dan layar loading_

### Ditambahkan

- Pesan error di halaman login kini berjenis, dengan judul dan warna sendiri: "Server tidak merespons" (RADIUS timeout, oranye), "Voucher sudah digunakan" (batas sesi/perangkat, biru), "Voucher habis" (batas waktu atau kuota, kuning), dan "Kode tidak valid" (merah). Jenisnya dikenali dari pesan asli RouterOS, sehingga tetap benar walau teks di errors.txt diubah.
- Layar loading penuh (spinner di atas latar kabur) tampil setelah kode voucher diisi dan Login ditekan. Bila server lambat lebih dari 8 detik, teksnya berganti menjadi "Masih menunggu respons server…". Layar ditutup otomatis bila pengguna kembali dengan tombol Back. Tombol Login tetap berputar dan tidak bisa ditekan dua kali.

### Diubah

- errors.txt: pesan untuk RADIUS tidak merespons, voucher dipakai perangkat lain, voucher habis waktu, voucher habis kuota, dan kode tidak valid ditulis lebih jelas (kode tidak valid kini menyebut kemungkinan voucher sudah digunakan atau habis). Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.34.4] - 2026-10-17

_Load Balance: disamakan dengan script LB PCC yang terbukti jalan_

### Diperbaiki

- Mode IP Address List (RFC1918): rule mark-routing prerouting kini memakai src-address-list=LOCAL-IP dan dst-address-list=!LOCAL-IP, seperti rule PCC-nya. Sebelumnya hanya src-address-list.
- Mode target lokal bawaan diganti dari Interface (bridge-lan, hanya tebakan nama) menjadi IP Address List (RFC1918), yang tidak bergantung pada nama interface LAN. Nama LAN yang salah di mode Interface membuat rule PCC tidak pernah cocok sehingga tidak ada trafik yang dibagi.
- Rule WAN mark-connection dikembalikan ke chain input, sesuai pola yang terbukti jalan.
- Nama mark/routing table tidak lagi memakai strip: nama ISP "ISP 1" menjadi ISP1-conn dan to-ISP1 (sebelumnya ISP-1-conn dan to-ISP-1).

## [1.34.3] - 2026-10-17

_Load Balance: mark-connection WAN memakai prerouting_

### Diperbaiki

- Rule mangle yang menandai koneksi masuk dari WAN (ISPx-conn) kini memakai chain prerouting, bukan input. Dengan input, koneksi yang diteruskan ke LAN (port-forward/dst-nat) tidak ditandai sehingga balasannya bisa keluar lewat ISP yang salah; prerouting menangkap koneksi ke router sekaligus koneksi yang diteruskan.

## [1.34.2] - 2026-10-17

_Load Balance: FastTrack tidak lagi menggagalkan PCC_

### Diperbaiki

- Script Load Balance (PCC) kini membatasi rule FastTrack bawaan MikroTik ke koneksi tanpa mark (set connection-mark=no-mark pada rule fasttrack-connection). FastTrack yang melewati mangle adalah penyebab umum PCC tidak membagi trafik di router berkonfigurasi bawaan. Koneksi PCC selalu bermark ISPx-conn sehingga tetap diproses mangle, sedangkan trafik lain tetap ter-fasttrack.
- Script "Hapus semua" ikut mengembalikan rule FastTrack seperti semula (unset connection-mark).

## [1.34.1] - 2026-10-17

_Load Balance: perbaikan penyebab PCC tidak berjalan_

### Diperbaiki

- Mode Interface List: script kini membuat interface-list LAN bila belum ada. Sebelumnya rule mangle yang merujuk list yang tidak ada ditolak router, sehingga PCC tidak terpasang sama sekali. Interface LAN tetap harus dimasukkan sebagai member list (petunjuk perintahnya ada di script).
- RouterOS v7 dengan Recursive Gateway: rute per routing-table (to-ISPx) kini memakai gateway dengan akhiran @main agar next-hop rekursif dicari di tabel main. Tanpa ini rute di tabel ISP tidak bisa menemukan host-route cek dan trafik bertanda tidak punya jalan keluar.
- Script diakhiri daftar cek bila LB tidak berjalan: sumber trafik LAN, counter mangle, status rute, FastTrack, dan koneksi tiap ISP.

## [1.34.0] - 2026-10-17

_Load Balance: script hapus semua settingan_

### Ditambahkan

- Panel script Load Balance kini punya dua tab: "Script setup" dan "Hapus semua". Tab Hapus semua menghasilkan script yang membuang semua rule mangle (PCC, bypass lokal, bypass hotspot), NAT per ISP, route (recursive, per routing-mark, cadangan, default), tabel routing (v7), Netwatch/Scheduler/Script failover, dan address-list LOCAL-IP. Bisa disalin atau diunduh sebagai file -hapus.rsc, dan tidak bergantung pada kelengkapan form.
- Rule dikenali dari komentar khas Load Balance dan dari ciri-cirinya (nama connection-mark/routing-mark per ISP, interface, address-list), sehingga rule menu lain seperti NAT atau anti tethering dari Setup Mikrotik Baru tidak ikut terhapus.

### Diubah

- Baris penutup script setup Load Balance kini mengarahkan ke tab Hapus semua, menggantikan perintah pembersihan berbasis komentar yang bisa ikut menghapus rule menu lain.

## [1.33.1] - 2026-10-17

_Tampilan mode terang dipertegas_

### Diubah

- Mode terang di seluruh aplikasi dipertegas: latar halaman sedikit lebih gelap agar kartu putih menonjol, garis tepi dan pemisah lebih jelas, teks sekunder lebih gelap, kartu mendapat bayangan tipis, dan judul section (mis. NAMA & SAMBUTAN, KARTU FORM) memakai warna aksen penuh dan huruf tebal. Mode gelap tidak berubah.

## [1.33.0] - 2026-10-17

_Load Balance: format script dibuat ringkas seperti LB PCC standar_

### Diubah

- Hasil script Load Balance ditulis ulang dengan format ringkas: header ringkasan (tanggal, RouterOS, jumlah ISP, Recursive Gateway, Bandwidth Ratio, tipe PCC, target lokal), lalu perintah dikelompokkan per menu (address-list, nat, routing table, route, mangle) dengan baris add biasa tanpa pembungkus "buat bila belum ada".
- Isi mangle mengikuti pola standar: bypass hotspot (nonaktif), bypass trafik lokal di lima chain, mark-connection di chain input per WAN, mark-routing output, PCC mark-connection (dst-address-type=!local), lalu mark-routing prerouting. Address-list LOCAL-IP (RFC1918) dan NAT dengan dst-address-list=!LOCAL-IP kini selalu dibuat di semua mode target lokal.
- Route: cek recursive (scope/target-scope 10), route per routing-mark, dan default route memakai scope/target-scope 30 dengan check-gateway=ping. Nama mark mempertahankan huruf asli nama ISP (mis. ISP1-conn, to-ISP1). Bila failover aktif, rute cadangan lintas ISP untuk tiap routing-mark ditambahkan di bawah rute utama.
- Karena memakai add biasa, menjalankan script dua kali akan menggandakan rule — bersihkan dulu dengan perintah di baris penutup script bila perlu mengulang.

## [1.32.0] - 2026-10-16

_Setup Mikrotik Baru: NAT tanpa out-interface, user superadmin, generate password_

### Ditambahkan

- NAT: pilihan cakupan baru "Global tanpa out-interface — action masquerade saja". Menulis satu rule chain=srcnat action=masquerade tanpa out-interface (dilindungi pemeriksaan agar tidak dobel bila rule yang sama sudah ada), cocok untuk WAN yang sering berganti atau banyak ISP.
- User Mikrotik: tombol Tambah User kini langsung mengisi nama "superadmin" (group full) untuk user pertama.
- Password admin dan password user punya tombol Generate (acak 14 karakter: huruf besar-kecil, angka, simbol; tanpa karakter membingungkan atau yang butuh escaping), Tampilkan/Sembunyikan, dan Salin. Password hasil generate otomatis ditampilkan agar bisa dicatat sebelum script dijalankan.

## [1.31.3] - 2026-10-16

_Ubah nama interface nonaktif secara bawaan_

### Diubah

- Di menu Nama Interface (Setup Mikrotik Baru) kini ada saklar "Ubah nama interface" yang mati secara bawaan: kolom nama terkunci dan menampilkan nama bawaan (ether1, ether2, dst), dan script tidak menulis perintah ganti nama. Aktifkan saklar bila ingin mengganti nama; komentar interface tetap bisa diisi kapan saja.

## [1.31.2] - 2026-10-15

_Kartu paket lebih tegas, tombol Template jelas terlihat_

### Diubah

- Desain daftar paket "Kartu" (desain Minimal) dirancang ulang: kepala kartu berwarna dengan nama paket, harga besar tebal, rincian durasi dan masa aktif dengan ikon, bingkai tebal dan bayangan. Kartu tersusun rapi dua atau tiga per baris menyesuaikan lebar layar. Warna tabel dan warna font tetap bisa diatur. Paket halaman login perlu di-upload ulang ke router.

### Diperbaiki

- Tombol "Template" (admin) di daftar desain tersimpan terasa tidak berfungsi karena formulirnya muncul di bawah daftar, di luar layar. Formulir kini muncul tepat di bawah desain yang diklik, dan pesan hasilnya digulir ke tampilan.

## [1.31.1] - 2026-10-15

_Bagian Nama & sambutan selalu terbuka saat menu dimasuki_

### Diperbaiki

- Di Halaman Login Hotspot, bagian "Nama & sambutan" kini dipastikan terbuka otomatis saat menu pertama kali dimasuki. Status buka-tutup dipegang aplikasi, bukan browser, sehingga tidak ikut terbawa dari halaman yang dipulihkan dari cache.

## [1.31.0] - 2026-10-15

_Background aplikasi dari dashboard admin, Pengaturan umum dirapikan_

### Ditambahkan

- Dashboard Admin: bagian baru "Background aplikasi". Admin menambah gambar (JPG/PNG/WEBP, maks 400 KB) ke galeri, memilih satu dengan tombol Pakai, dan mengatur lapisan warna tema 0–90% agar tulisan tetap terbaca. Background berlaku di seluruh halaman aplikasi, lengkap dengan pratinjau, dan bisa dilepas kapan saja. Pilihan berlaku setelah menekan Simpan.

### Diubah

- Bagian "Pengaturan umum" ditata ulang menjadi kartu: Identitas situs (logo + nama) dan Tombol WhatsApp berdampingan, lalu Teks halaman utama selebar penuh, masing-masing dengan judul dan penjelasan singkat.

## [1.30.0] - 2026-10-15

_Setup Mikrotik Baru: menu Nama Interface_

### Diubah

- Ganti nama interface kini punya menu sendiri, "Nama Interface", tepat setelah Firewall & TTL (sebelum User Mikrotik). Komentar interface ikut pindah ke menu ini.
- Kolom nama sudah terisi nama bawaan (ether1, ether2, ether3, dst) dan bisa langsung diedit; port yang namanya tidak diubah tidak ikut diganti di script. Ada ringkasan jumlah nama/komentar yang diatur dan tombol "Kembalikan semua ke nama bawaan".

## [1.29.1] - 2026-10-14

_Form nama interface selalu terlihat_

### Diubah

- Form "Nama & komentar interface" di Setup Mikrotik Baru tidak lagi tersembunyi dalam lipatan: tampil langsung dengan judul sendiri di bawah daftar port setelah Type Mikrotik dipilih.

## [1.29.0] - 2026-10-14

_Setup Mikrotik Baru: ganti nama interface_

### Ditambahkan

- Di bagian Type Mikrotik, "Komentar interface" menjadi "Nama & komentar interface": tabel per port dengan kolom Nama baru dan Komentar, label peran (WAN 1, Bridge ...), saran nama, dan pemeriksaan langsung bila nama kembar atau memuat karakter terlarang. Spasi otomatis diganti strip.
- Seluruh form dan isi script tetap memakai nama bawaan (ether1, dst). Perintah ganti nama ditulis di bagian paling akhir script, sebelum catatan penutup, sehingga semua setting sebelumnya tidak terlewat; RouterOS memperbarui rujukannya sendiri. Validasi juga menolak nama yang bentrok dengan interface lain atau dengan nama bridge/VLAN di script.

## [1.28.0] - 2026-10-14

_Tombol WhatsApp didesain ulang, widget jam dihapus_

### Diubah

- Tombol WhatsApp di halaman login kini berwarna hijau WhatsApp penuh dengan bayangan, bukan lagi tombol bergaris. Warna tombol, warna tulisan, tinggi tombol (32–72 px), dan ukuran tulisan (11–24 px) bisa diatur di bagian WhatsApp. Warna tulisan otomatis menyesuaikan bila tidak dipilih. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.
- Widget jam di halaman login dihapus.

## [1.27.1] - 2026-10-14

_Warna font tabel paket bisa diubah_

### Ditambahkan

- Pilihan "Warna font tabel" di bagian Tabel harga paket. Mengubah warna tulisan di kepala tabel, isi baris, kartu, dan lencana harga (desain Minimal) serta kartu harga (desain Poster). Kosong = otomatis menyesuaikan warna tabel. Paket halaman login perlu di-upload ulang ke router.

## [1.27.0] - 2026-10-14

_Widget jam di halaman login_

### Ditambahkan

- Bagian baru "Widget" di editor Halaman Login Hotspot: jam digital yang bisa diletakkan di pojok kiri atas, atas tengah, atau pojok kanan atas. Pilihan tambahan: tampilkan detik dan tampilkan hari/tanggal. Jam memakai waktu perangkat pengguna dan warnanya mengikuti tema halaman. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.26.0] - 2026-10-14

_Pengaturan Mode login dan Tombol dipisah, desain daftar paket bisa dipilih_

### Diubah

- Bagian "Mode login & tombol" dipecah menjadi dua: "Mode login" (mode saat halaman dibuka, tombol pilihan Voucher/Member, tautan coba gratis) dan "Tombol" (warna tombol Voucher, kecerahan, warna tombol Login, warna font tombol).

### Ditambahkan

- Pilihan "Desain daftar paket" di bagian Tabel harga paket: Tabel (kepala berwarna, baris selang-seling), Kartu (kotak harga berdampingan), atau Daftar (baris dengan lencana harga). Warna tabel harga ikut diterapkan. Berlaku di desain Minimal; desain Poster tetap memakai kartu harga. Paket halaman login perlu di-upload ulang ke router.

## [1.25.1] - 2026-10-14

_Kode voucher bisa huruf kapital_

### Diperbaiki

- Kolom kode voucher di halaman login tidak lagi memaksa huruf kecil, jadi voucher/username berhuruf kapital (atau campuran) bisa diketik dan dipakai login. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.25.0] - 2026-10-14

_Pratinjau HP berbentuk iPhone_

### Diubah

- Pratinjau mode HP di editor Halaman Login Hotspot kini berbentuk iPhone sungguhan: bodi logam dengan sudut membulat, notch dengan speaker dan kamera, status bar (jam, sinyal, Wi-Fi, baterai), tombol samping, dan indikator home di bawah. Ukuran layar tetap 390 × 844 dan otomatis menyesuaikan area pratinjau; Tablet dan Laptop tidak berubah.

## [1.24.0] - 2026-10-14

_Template default, placeholder, dan petunjuk login bisa diatur_

### Ditambahkan

- Admin bisa menetapkan satu template sebagai default: tombol "Jadikan default" / "Lepas default" di daftar Template (editor dan Dashboard Admin). Siapa pun yang membuka Halaman Login Hotspot langsung memulai dari desain itu; template default tampil paling atas dengan label "default".
- Bagian baru "Petunjuk & placeholder": kalimat petunjuk di atas kolom login (mode Voucher dan Member, mis. "Masukkan kode voucher, lalu klik Login.") beserta warnanya, dan placeholder kolom kode voucher, username, dan password. Bila dikosongkan, memakai teks bawaan tiap desain. Teks yang diketik diamankan (tanda kutip dan tag HTML tidak merusak halaman). Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.23.0] - 2026-10-14

_Logo dan Background terpisah, sudut form bisa diatur_

### Ditambahkan

- Pengaturan "Sudut form (border radius)" 0–40 px di bagian Kartu form: 0 membuat kartu siku-siku, makin besar makin membulat. Berlaku di desain Minimal; paket halaman login perlu di-upload ulang ke router.

### Diubah

- Bagian "Background & Logo" dipecah menjadi dua menu: "Logo" (unggah, galeri admin, letak, tinggi) dan "Background" (warna latar halaman, gambar latar, kepekatan lapisan, mode, dan fokus gambar). Pengaturan gambar di dalam form dipindah ke bagian Kartu form.

## [1.22.1] - 2026-10-14

_IP cek berurutan 1.1.1.1 – 1.1.1.8_

### Diubah

- IP/DNS cek jalur di Load Balance kini berurutan penuh: 1.1.1.1, 1.1.1.2, 1.1.1.3, … sampai 1.1.1.8 untuk ISP ke-1 sampai ke-8 (sebelumnya ISP ke-4 dst. memakai resolver publik lain).

## [1.22.0] - 2026-10-14

_Load Balance: Interface List, isian berurutan, target cek 1.1.1.x_

### Ditambahkan

- Target lokal kini punya tiga pilihan: Interface, Interface List (rule PCC memakai in-interface-list), dan Address List (RFC1918).

### Diubah

- Isian jalur ISP terisi berurutan sejak awal: ether1 / 192.168.1.1 / 1.1.1.1, ether2 / 192.168.2.1 / 1.1.1.2, ether3 / 192.168.3.1 / 1.1.1.3, dan seterusnya, sehingga tinggal memilih versi RouterOS. Tombol "Kosongkan" mengosongkan semua isian, dan "Reset" mengembalikan isian berurutan.
- Target cek jalur (IP/DNS) memakai 1.1.1.1, 1.1.1.2, 1.1.1.3; ISP ke-4 dan seterusnya memakai resolver publik lain (8.8.8.8, 9.9.9.9, dst.) karena alamat 1.1.1.4 ke atas tidak dijamin menjawab ping.

## [1.21.1] - 2026-10-14

_Tampilan Load Balance lebih simpel_

### Diubah

- Halaman Load Balance dibuat lebih ringkas: empat kartu saklar diganti deretan tombol kecil (Load balance, Failover, Rasio bandwidth, NAT), pilihan Target lokal jadi dua tombol, dan pengaturan yang jarang dipakai (metode PCC, metode failover, interval, prioritas cadangan) disembunyikan di "Pengaturan lanjutan".
- Jalur ISP kini berupa tabel satu baris per ISP (WAN, Gateway, Mbps, IP cek) sehingga semua ISP terlihat sekaligus; kolom Mbps dan IP cek hanya muncul bila fiturnya aktif.

## [1.21.0] - 2026-10-14

_Load Balance PCC + Failover jadi generator satu layar_

### Diubah

- Halaman Load Balance PCC + Failover dirombak dari wizard bertahap menjadi generator satu layar: pengaturan dan kartu jalur ISP di kiri, script hasil yang ikut berubah saat mengisi di kanan.

### Ditambahkan

- Jumlah jalur WAN (2–8 ISP) dipilih langsung; ISP yang sudah diisi tidak hilang saat jumlah diubah.
- Target lokal bisa berupa Interface LAN atau IP Address List (RFC1918): mode address list membuat daftar LOCAL-IP, memakai src/dst address-list di rule PCC, dan membatasi NAT ke tujuan di luar jaringan lokal.
- Rasio bandwidth: isi kecepatan tiap ISP (Mbps) dan beban dibagi sesuai perbandingannya (maksimal 10 bagian per ISP agar rule mangle tetap wajar), menggantikan isian bobot manual.

## [1.20.2] - 2026-10-14

_Autoflush DNS lebih rapi_

### Diubah

- Autoflush DNS: komentar scheduler di router kini "Autoflush DNS cache - By Mikrosetting"; tombol pilihan cepat (6 jam, 12 jam, dst.) dihapus — interval diisi manual; dan tata letak diratakan: panel Jadwal flush dan Cara pakai berakhir sejajar di bawah.

## [1.20.1] - 2026-10-14

_Keterangan perlu login di kartu menu_

### Ditambahkan

- Kartu menu di beranda yang diatur wajib login kini diberi keterangan "perlu login" (dengan ikon gembok), sehingga pengunjung tahu sebelum menekannya. Pengunjung yang sudah login melihat keterangan yang lebih redup.

## [1.20.0] - 2026-10-13

_Menu Autoflush DNS_

### Ditambahkan

- Menu baru Autoflush DNS (/autoflush-dns): membuat scheduler Mikrotik yang menjalankan /ip dns cache flush secara berkala. Interval (menit/jam/hari/minggu) dan jam mulai bisa diatur, ada pilihan cepat (tiap 6 jam, 12 jam, harian 03:00, mingguan), opsi menimpa scheduler lama, dan opsi mencatat setiap flush ke log. Hasilnya script siap tempel (v6 dan v7) atau file .rsc.
- Menu ini masuk ke grup Mikrotik bila grup itu ada, dan ke grup Konfigurasi bila belum; urutan dan grupnya tetap bisa diatur dari Dashboard Admin.

## [1.19.0] - 2026-10-13

_Batas gambar 300 KB, daftar template dirapikan, pengaturan warna berurutan_

### Diubah

- Fitur kompres otomatis gambar latar dihapus. Batas ukuran semua gambar yang diunggah (latar, logo, gambar form, dan galeri admin) kini 300 KB; gambar yang lebih besar ditolak dengan pesan ukuran.
- Daftar template dirapikan: jendela lebih lebar dengan kartu tiga kolom yang seragam — thumbnail besar di atas, lalu nama, jenis desain, contoh warna, keterangan, tombol Pratinjau dan Pakai, dan baris aksi admin (Timpa, Hapus) di bawahnya.
- Pengaturan di editor diurutkan agar tiap warna tepat di bawah pengaturan yang diwarnainya: Nama hotspot → Warna nama hotspot → Teks sambutan → Warna teks sambutan; Mode login → Warna tombol Voucher → Kecerahan → Warna tombol Login → Warna font tombol; Warna latar halaman di bagian Background & Logo; dan Warna font umum di bagian terakhir.

## [1.18.0] - 2026-10-13

_Kompres otomatis gambar latar, batas 200 KB_

### Ditambahkan

- Gambar latar yang diunggah dikompres otomatis di browser: diperkecil (sisi terpanjang maks 1920 px) dan disimpan ulang sebagai JPEG sampai maksimal 200 KB, lalu ditampilkan catatan hasilnya (mis. 2,6 MB → 141 KB). Gambar yang sudah di bawah 200 KB dipakai apa adanya. Berlaku juga untuk unggahan latar oleh admin ke galeri.

### Diubah

- Batas ukuran gambar latar kini 200 KB (sebelumnya 600 KB), termasuk untuk galeri latar admin. Berkas asli yang diterima hingga 25 MB.

## [1.17.0] - 2026-10-13

_Thumbnail dan pratinjau template_

### Ditambahkan

- Daftar template menampilkan thumbnail halaman login sungguhan (dimuat saat kartunya terlihat), lengkap dengan nama, keterangan, dan warna utama.
- Tombol Pratinjau membuka pratinjau besar yang bisa dicoba (HP iPhone 13 atau Laptop), dengan tombol "Pakai template ini".

## [1.16.1] - 2026-10-13

_Jadikan desain tersimpan sebagai template_

### Ditambahkan

- Alur membuat template: rancang halaman login, simpan ke database lewat Simpan / Muat, lalu admin menekan tombol "Template" pada desain tersimpan itu untuk menjadikannya template bagi semua pengguna. Hanya admin yang melihat tombol ini; desain tersimpan aslinya tidak berubah.

## [1.16.0] - 2026-10-13

_Template Halaman Login Hotspot siap pakai_

### Ditambahkan

- Template siap pakai: admin merancang desain di editor lalu menerbitkannya lewat tombol Template (seluruh pengaturan, termasuk logo dan latar, ikut tersimpan). Siapa pun, juga tanpa login, bisa memuat template itu ke editor lalu menyesuaikannya.
- Admin bisa menimpa isi template dengan desain yang sedang dibuka, atau menghapusnya, dari tombol Template maupun dari bagian "Template Halaman Login Hotspot" di Dashboard Admin.

## [1.15.1] - 2026-10-12

_Tombol Voucher dan Member satu warna_

### Diubah

- Tombol Voucher dan Member kini sama-sama berwarna tombol Voucher. Yang dipilih tampil penuh, bercincin, tulisan tebal, dan bertanda centang; yang tidak dipilih dipudarkan. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.15.0] - 2026-10-12

_Warna font umum dan warna teks sambutan_

### Ditambahkan

- "Warna font" untuk seluruh tulisan di halaman login (label, tabel, catatan, footer, kolom isian, dan tombol outline), terpisah dari nama hotspot, teks sambutan, teks berjalan, dan tulisan di dalam tombol berwarna yang masing-masing punya pengaturan sendiri.
- "Warna teks sambutan" di bagian Nama & sambutan. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.14.1] - 2026-10-12

_Warna font tombol bisa diatur_

### Ditambahkan

- Warna font di dalam tombol berwarna (tombol Login dan tombol Voucher/Member yang aktif) bisa dipilih sendiri, atau dikembalikan ke otomatis (hitam/putih sesuai warna tombol). Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.14.0] - 2026-10-12

_Warna tabel harga, teks berjalan tanpa latar_

### Ditambahkan

- Warna tabel harga bisa dipilih sendiri (kepala tabel di desain Minimal, kartu harga di desain Poster); tulisannya menyesuaikan otomatis agar terbaca. Bila tidak dipilih, ikut warna tombol Voucher.
- Teks berjalan bisa dibuat tanpa warna latar (hanya tulisan, otomatis mengikuti warna teks kartu), dan warna font-nya bisa dipilih sendiri. Paket halaman login perlu di-upload ulang ke router.

## [1.13.1] - 2026-10-12

_Form tidak lagi terdorong ke bawah oleh logo_

### Diperbaiki

- Saat logo diletakkan di atas form, kartu form tetap tepat di tengah layar: logo menempati ruang kosong di atasnya (dan footer di luar form di ruang kosong bawahnya) sehingga tidak mendorong form ke bawah. Paket halaman login perlu di-upload ulang ke router.

## [1.13.0] - 2026-10-12

_Letak logo dan footer, saklar WhatsApp_

### Ditambahkan

- Logo bisa diletakkan di dalam kartu form atau di atas kartu (di luar form).
- Teks footer bisa diletakkan di dalam kartu form atau di bawah kartu (di luar form); di atas gambar latar footer diberi alas gelap tipis agar terbaca.
- Tombol WhatsApp punya saklar tampil/sembunyi tanpa menghapus nomornya. Pengaturan WhatsApp dan "Catatan & footer" kini dipisah menjadi dua bagian. Letak logo dan footer berlaku di desain Minimal; paket halaman login perlu di-upload ulang ke router.

### Diubah

- Bagian "Gambar" di editor diganti namanya menjadi "Background & Logo".

## [1.12.0] - 2026-10-12

_Warna teks berjalan sendiri, warna tombol Voucher, latar bawaan baru_

### Ditambahkan

- Teks berjalan punya warna sendiri: warna bar (bawaan abu kebiruan gelap #1e293b) dan warna tulisan (otomatis terbaca, atau pilih sendiri), tidak lagi mengikuti warna tema.

### Diubah

- Pengaturan "Warna tema" diganti "Warna tombol Voucher" (beserta kecerahannya). Warna ini dipakai tombol Voucher/Member yang aktif, dan tetap menjadi dasar warna judul tabel, tautan, serta tombol Login bila warna tombol Login tidak dipilih sendiri.
- Warna latar halaman bawaan kini #eef2f7.

## [1.11.0] - 2026-10-12

_Teks berjalan bisa dimatikan dan dipindah, pengaturan tampilan dipisah_

### Ditambahkan

- Teks berjalan di Halaman Login Hotspot kini punya saklar tampil/sembunyi (teksnya tidak terhapus) dan pilihan letak: di atas atau di bawah form. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

### Diubah

- Bagian "Tampilan" di editor dipecah jadi tiga bagian terpisah yang bisa dibuka-tutup: "Nama & sambutan", "Warna", dan "Kartu form".

## [1.10.0] - 2026-10-12

_Warna nama hotspot dan tombol Login_

### Ditambahkan

- Warna tulisan nama hotspot dan warna tombol Login bisa dipilih sendiri di Halaman Login Hotspot (warna siap pakai atau bebas), atau dikembalikan ke otomatis. Warna tulisan di dalam tombol menyesuaikan sendiri agar terbaca. Berlaku di desain Minimal dan Poster; paket halaman login perlu di-upload ulang ke router.

## [1.9.0] - 2026-10-12

_Garis tepi form login bisa diatur_

### Ditambahkan

- Pengaturan "Garis tepi form" di Halaman Login Hotspot: tebal 0–8 px (0 = tanpa garis) dan warna garis sendiri, atau otomatis mengikuti warna tema. Berlaku di desain Minimal; paket halaman login perlu di-upload ulang ke router.

## [1.8.1] - 2026-10-12

_Kartu login tanpa garis tebal di atas_

### Diubah

- Garis aksen tebal di sisi atas kartu form login dihapus; kartu kembali berbingkai tipis rata di semua sisi. Paket halaman login perlu di-upload ulang ke router.

## [1.8.0] - 2026-10-12

_Kecerahan warna tema bisa diatur_

### Ditambahkan

- Slider "Kecerahan warna tema" (50–150%) di Halaman Login Hotspot: menggelapkan atau menerangkan warna tema yang dipilih tanpa mengganti warnanya, lengkap dengan contoh warna hasil dan tombol atur ulang 100%. Warna teks di atas tombol dan tabel menyesuaikan otomatis agar tetap terbaca.

## [1.7.3] - 2026-10-12

_Warna tema lebih menyatu di halaman login_

### Diubah

- Desain Minimal: warna tema kini juga dipakai di judul, tautan, judul tabel, garis bingkai kartu (dengan aksen tebal di atas kartu), dan garis tombol Voucher/Member — bukan hanya tombol dan tabel. Paket halaman login perlu di-upload ulang ke router.

### Diperbaiki

- Warna tema yang terang (kuning, biru langit) tidak lagi membuat judul dan tautan sulit dibaca di atas kartu putih: untuk teks, warna otomatis digelapkan secukupnya sampai kontrasnya cukup. Footer tidak lagi dipudarkan.

## [1.7.2] - 2026-10-12

_Halaman login tanpa alamat IP_

### Diubah

- Tulisan "IP Anda …" di bawah form login dihapus dari desain Minimal dan Poster. Teks footer tetap tampil bila diisi. Paket halaman login perlu di-upload ulang ke router.

## [1.7.1] - 2026-10-12

_Bawaan baru Halaman Login Hotspot_

### Diubah

- Nilai bawaan desain baru: lebar form 390 px, kepekatan lapisan gelap latar 0%, dan mode gambar latar "Penuh". Desain yang sudah tersimpan tetap memakai nilainya sendiri.

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
