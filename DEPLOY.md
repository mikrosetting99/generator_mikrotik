# Deploy ke aaPanel (Node.js + PM2)

Aplikasi dijalankan sebagai proses Node di port lokal, lalu Nginx aaPanel
meneruskan trafik domain ke port tersebut (reverse proxy).

Repo: `https://github.com/mikrosetting99/generator_mikrotik`

---

## 1. Persiapan di server (sekali saja)

**Node.js** — di aaPanel buka **App Store → Node.js Version Manager**, pasang
**Node 20 LTS atau lebih baru** (Next.js 15 butuh minimal Node 18.18; proyek ini
mensyaratkan ≥ 20.9).

**PM2** biasanya sudah ikut terpasang bersama Node Manager aaPanel. Cek lewat
Terminal aaPanel:

```bash
node -v      # harus v20.x atau lebih baru
npm -v
pm2 -v
```

**RAM** — build Next.js butuh sekitar 1 GB. Bila VPS hanya 1 GB, buat swap dulu
supaya build tidak gagal (OOM):

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 2. Ambil kode dari GitHub

Lewat Terminal aaPanel:

```bash
cd /www/wwwroot
git clone https://github.com/mikrosetting99/generator_mikrotik.git
cd generator_mikrotik
```

---

## 3. Database MySQL & environment

Menu **Setup Mikrotik Baru** dan **Login Page Hotspot** wajib login dan
memakai database MySQL yang sama (riwayat konfigurasi, akun pengguna,
pesanan lisensi). Menu **Load Balance & Fail Over**, **Halaman Login
Hotspot** (yang gratis), dan **Cek Mikrotik** tetap 100% jalan di browser
tanpa database dan tanpa login.

1. **Buat database di aaPanel** — menu **Database → Add database**, catat
   nama database, username, dan password yang dibuat.
2. **Buat file `.env`** di root proyek (tidak ikut ke Git):

   ```bash
   cp .env.example .env
   nano .env
   ```

   Isi minimal:

   ```env
   DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/NAMA_DATABASE"
   NEXTAUTH_SECRET="hasil dari: openssl rand -base64 32"
   NEXTAUTH_URL="https://generator.mikrosetting.com"
   SEED_ADMIN_USERNAME="admin"
   SEED_ADMIN_PASSWORD="password-kuat-untuk-admin-pertama"

   # Khusus menu Login Page Hotspot — lihat penjelasan di bawah
   MSLP_LICENSE_SALT="resep-rahasia-panjang"
   MSLP_LICENSOR_WA=6281112001036
   ```

   **`MSLP_LICENSE_SALT` harus sama persis** dengan `LIS_SALT` di dalam
   `login.html` yang sudah beredar di router pembeli. Kalau nilainya
   berubah, semua kunci yang pernah diterbitkan langsung mati dan tidak
   bisa ditarik kembali. Variabel ini hanya dibaca di sisi server dan
   tidak pernah ikut ke browser — jangan pernah diberi awalan
   `NEXT_PUBLIC_`.

   Opsional: `MSLP_ARSIP_DIR` untuk memindahkan lokasi arsip hasil cetak
   (lihat bagian **Dua folder yang diurus lewat File Manager aaPanel** di
   bawah); bawaannya `data/hasil` di dalam folder proyek.

3. **Pasang dependensi & jalankan migrasi:**

   ```bash
   npm ci
   npx prisma migrate deploy
   ```

   `npm ci` otomatis menjalankan `prisma generate` (lewat script `postinstall`).
   `prisma migrate deploy` membuat tabel `users` dan `saved_configs`.

4. **Buat akun admin pertama** (sekali saja — aman dijalankan ulang, entri
   yang sudah ada dilewati):

   ```bash
   npm run db:seed
   ```

   Login pertama pakai `SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD` di atas,
   lalu tambahkan akun teknisi lain lewat menu **Kelola Pengguna** (ikon di
   header Setup Mikrotik Baru, khusus admin) — untuk saat ini hanya admin
   yang bisa mendaftarkan akun baru.

5. **Build:**

   ```bash
   npm run build
   ```

   Kalau `npm run build` gagal dengan error Turbopack, pakai builder lama:

   ```bash
   npm run build:webpack
   ```

---

## 5. Jalankan dengan PM2

Repo sudah menyertakan `ecosystem.config.js` (port **3001**, hostname
`127.0.0.1` agar tidak bisa diakses langsung dari luar).

```bash
cd /www/wwwroot/generator_mikrotik
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # agar otomatis hidup lagi setelah server reboot
```

Cek:

```bash
pm2 status
curl -I http://127.0.0.1:3001        # harus HTTP/1.1 200 OK
pm2 logs generator-mikrotik --lines 50
```

> Bila port 3001 sudah dipakai aplikasi lain, ubah `PORT` di
> `ecosystem.config.js`, lalu `pm2 reload ecosystem.config.js --update-env`.

**Alternatif lewat menu aaPanel:** buka **Website → Node Project → Add Node
Project**, isi:
- Project directory: `/www/wwwroot/generator_mikrotik`
- Startup file / command: `npm` dengan argumen `start`
- Port: `3001`
- Node version: 20 LTS

Hasilnya sama — aaPanel memakai PM2 di belakang layar.

---

## 6. Domain & reverse proxy

1. **Website → Add site**, isi domain (mis. `generator.mikrosetting.com`).
   Jangan pilih PHP; root direktorinya tidak dipakai.
2. Buka situs itu → tab **Reverse Proxy → Add reverse proxy**:
   - Proxy name: `generator`
   - Target URL: `http://127.0.0.1:3001`
   - Send domain: `$host`
3. **SSL → Let's Encrypt**, terbitkan sertifikat lalu aktifkan **Force HTTPS**.

Bila ingin menulis konfigurasi Nginx manual, isinya:

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

Aset statis (`/_next/static/...`) sudah dikirim Next.js dengan header cache
`immutable`, jadi tidak perlu aturan cache tambahan di Nginx.

---

## 7. Update setelah ada perubahan kode

Push dari lokal seperti biasa, lalu di server:

```bash
cd /www/wwwroot/generator_mikrotik
bash update.sh
```

`update.sh` melakukan: cek `.env` ada & git bersih → `git pull` → `npm ci` →
`prisma migrate deploy` → `build` → `pm2 reload` → `pm2 save`, dan
menampilkan status di akhir. Migrasi baru (file baru di
`prisma/migrations/`) otomatis ikut diterapkan setiap update; tidak perlu
langkah manual tambahan kecuali ada migrasi yang sengaja dibuat interaktif
di lokal.

Setiap jalan dicatat ke `update.log` di folder proyek (menumpuk seiring
waktu) — cek `tail -n 50 update.log` kalau update gagal dan pesan di
terminal sudah tergulung. Script berhenti (exit sebelum menyentuh apa pun)
bila:
- `.env` belum ada — isi dulu sesuai langkah 3 sebelum update pertama kali.
- Ada perubahan lokal belum ter-commit di server (`git status` kotor) — ini
  biasanya berarti ada yang mengedit file langsung di server, cek dulu
  sebelum menimpa dengan `git stash` atau `git checkout .`.

---

## Catatan

- **Environment variable wajib diisi** sejak menu Setup Mikrotik Baru dan
  Login Page Hotspot memakai MySQL + login: `DATABASE_URL`,
  `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `MSLP_LICENSE_SALT`, `MSLP_LICENSOR_WA`.
  Lihat langkah 3. Menu Load Balance & Fail Over, Halaman Login Hotspot
  (gratis), dan Cek Mikrotik tidak butuh apa pun dari ini — tetap murni
  jalan di browser pengunjung.
- **Firewall**: port 3001 tidak perlu dibuka ke publik. Cukup 80/443 untuk
  Nginx. Port MySQL (3306) juga sebaiknya tidak dibuka ke publik bila hanya
  diakses dari aplikasi ini di server yang sama (`127.0.0.1`).
- **Backup database**: `saved_configs` (riwayat Setup) dan `license_orders`
  (pesanan Login Page Hotspot) menyimpan data yang tidak ada duplikatnya di
  tempat lain — nomor telepon pelanggan, kadang password (bila pengguna
  memilih "Sertakan password"), dan kunci lisensi. Sertakan database ini
  dalam rutinitas backup aaPanel (**Database → Backup**), bukan hanya kode
  di Git.
- **Static export sudah tidak bisa lagi.** Dulu aplikasi ini murni berjalan
  di browser sehingga `output: "export"` masih mungkin. Sejak ada login dan
  Login Page Hotspot, aplikasi memakai middleware, database, dan route
  handler yang membaca folder `templates/` dari disk — semuanya menuntut
  proses Node yang hidup.
- `templates/` harus ikut ter-*deploy*. Route unduh membacanya saat diminta,
  bukan saat build, jadi folder itu harus ada di samping aplikasi di server.

---

## Dua folder yang diurus lewat File Manager aaPanel

**`templates/` — sumber login page.** Dibaca setiap kali ada permintaan cetak,
bukan saat build. Jadi menyunting `templates/MSLP-NARUTO/login.html` langsung
dari File Manager aaPanel akan langsung terpakai pada cetakan berikutnya —
tanpa `npm run build`, tanpa `pm2 reload`. Mengganti `img/bg.jpg` sebuah tema
juga cukup ditimpa di situ.

Menambah tema yang benar-benar baru tetap perlu satu entri di
`lib/license/templates.ts`, karena tiap tema punya slot warna dan ciri sendiri
(punya pita tingkatan atau tidak, punya latar bawaan atau tidak).

**`data/hasil/` — arsip hasil cetak.** Setiap kali tombol unduh ditekan,
salinan zip-nya ditulis di sini dengan nama `0007-Nama-Usaha-MSLP-NARUTO.zip`.
Satu pesanan satu berkas, ditimpa tiap unduhan — arsip yang beranak setiap
penekanan tombol akan memenuhi disk, dan yang lama tidak berguna karena
isinya selalu bisa dicetak ulang dari data pesanan.

Dua hal yang perlu diketahui:

- Folder ini **tidak punya alamat web**. Nginx aaPanel hanya meneruskan ke
  Next.js (`location / { proxy_pass ... }`), tidak melayani berkas dari disk.
  Jangan pernah memindahkannya ke dalam `public/`: isinya halaman berlisensi
  lengkap dengan kuncinya, dan di `public/` siapa pun yang menebak namanya
  bisa mengunduhnya.
- Isinya **tidak ikut git** dan tidak ikut backup kode. Kalau arsipnya
  dianggap penting, masukkan foldernya ke jadwal backup aaPanel. Kehilangannya
  tidak fatal — pesanannya ada di database dan bisa dicetak ulang kapan saja.

Kalau disk aplikasi sempit, arahkan ke tempat lain lewat `MSLP_ARSIP_DIR`,
misalnya `/www/backup/lisensi`. Pastikan pengguna yang menjalankan PM2 punya
izin tulis ke situ; kalau gagal menulis, unduhan tetap berhasil dan
kegagalannya hanya dicatat di `pm2 logs generator-mikrotik`.
