# FreeRADIUS untuk akun VPN pelanggan

FreeRADIUS memeriksa login PPP (SSTP/L2TP/OVPN) dari setiap Mikrotik CHR. Data akun dikelola di
aplikasi (menu **Script VPN & Mikhmon Online → Akun VPN / Server VPN / Paket**), lalu dibaca
FreeRADIUS lewat view di database aplikasi. Tidak ada sinkronisasi terpisah.

```
CHR ── UDP 1812/1813 ──► FreeRADIUS (Docker, jaringan host) ──► MySQL aaPanel
                                                                 ├─ view radius_nas / radius_check / radius_reply
                                                                 └─ tabel radacct (accounting)
```

## 1. Prasyarat

- Docker CE + plugin compose di server aaPanel.
- Migrasi `*_vpn_radius` sudah jalan (`bash update.sh` menjalankannya). Migrasi ini membuat view,
  jadi user MySQL aplikasi butuh hak `CREATE VIEW`. User buatan aaPanel biasanya punya
  `ALL PRIVILEGES` pada databasenya; cek dengan `SHOW GRANTS;` bila ragu.
- `VPN_RADIUS_IP` di `.env` aplikasi diisi IP publik server ini, lalu aplikasi di-restart.

## 2. User MySQL khusus FreeRADIUS

Jalankan di MySQL (phpMyAdmin aaPanel atau `mysql -u root -p`). Ganti nama database bila berbeda
dan isi password acak:

```sql
CREATE USER 'radius'@'127.0.0.1' IDENTIFIED BY 'GANTI-PASSWORD-ACAK';
GRANT SELECT ON generator_mikrotik.radius_nas   TO 'radius'@'127.0.0.1';
GRANT SELECT ON generator_mikrotik.radius_check TO 'radius'@'127.0.0.1';
GRANT SELECT ON generator_mikrotik.radius_reply TO 'radius'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON generator_mikrotik.radacct TO 'radius'@'127.0.0.1';
FLUSH PRIVILEGES;
```

FreeRADIUS tidak bisa membaca tabel aplikasi lain (pengguna, password terenkripsi, dan sebagainya).

## 3. Menjalankan

```bash
cd /www/wwwroot/generator_mikrotik/deploy/radius
cp .env.example .env      # isi RADIUS_DB_PASSWORD dan RADIUS_TEST_SECRET
docker compose up -d --build
docker logs -f mikrosetting-radius
```

Untuk melihat setiap permintaan secara rinci saat uji coba:

```bash
docker compose stop
docker compose run --rm freeradius freeradius -X
```

## 4. Firewall

FreeRADIUS memakai jaringan host, jadi firewall server biasa (aaPanel / ufw) yang menjaganya:

- UDP **1812** dan **1813**: hanya dari IP publik setiap CHR.
- Bila provider VPS punya firewall sendiri (security group), buka port yang sama untuk IP CHR saja.

## 5. Menambah server VPN (CHR)

1. Tambahkan di aplikasi: **Server VPN → Tambah server VPN**.
2. Klik **Script CHR**, tempel di terminal CHR.
3. Restart FreeRADIUS agar CHR baru dikenali (daftar NAS hanya dibaca saat mulai):
   `docker restart mikrosetting-radius`

Hal yang sama berlaku setelah **Ganti secret** atau mengubah IP publik server.

## 6. Uji tahap 1

1. Buat paket dengan batas kecepatan, lalu buat satu akun VPN berstatus **Aktif**.
2. Tempel script client akun itu di router uji. Di CHR, `/ppp active print` harus menampilkan
   akun dengan IP tunnel yang sama dengan di aplikasi.
3. `/queue simple print` di CHR menampilkan antrean dinamis dengan batas kecepatan paket.
4. Setelah 5–10 menit, akun tampil **online** di daftar akun aplikasi (dari radacct).
5. Ubah status akun ke **Ditangguhkan**, putuskan sesinya di CHR: login ulang harus ditolak.
6. Login akun yang sama dari router kedua harus ditolak (satu akun satu sesi).
7. Coba login akun server A lewat server B: harus ditolak.

## Catatan

- **BlastRADIUS (CVE-2024-3596).** Image memakai FreeRADIUS 3.2.5, yang membawa perbaikannya.
  Periksa juga versi RouterOS setiap CHR: versi yang mengirim `Message-Authenticator` disarankan.
  Saat uji `freeradius -X`, pastikan tidak ada peringatan tentang Message-Authenticator dari CHR.
- **Konfigurasi belum diuji di server sungguhan.** Berkas di folder ini ditulis tanpa akses ke
  server; jalankan `freeradius -X` pada uji pertama dan perbaiki bila ada galat parsing.
- Mengubah status atau masa aktif berlaku pada login berikutnya. Pemutusan sesi yang sedang
  berjalan (CoA/Disconnect) dikerjakan di tahap berikutnya.
- L2TP dengan IPsec: script client dari menu Akun VPN belum mengisi IPsec secret.
