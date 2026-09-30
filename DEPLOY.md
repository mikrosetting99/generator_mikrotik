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

## 3. Database MySQL & environment (khusus Setup Mikrotik Baru)

Menu **Setup Mikrotik Baru** kini wajib login, dan riwayat konfigurasinya
disimpan di MySQL. Menu **Load Balance & Fail Over** dan **Halaman Login
Hotspot** tetap 100% jalan di browser tanpa database.

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
   ```

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

- **Environment variable wajib diisi** sejak menu Setup Mikrotik Baru memakai
  MySQL + login: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. Lihat
  langkah 3. Menu Load Balance & Fail Over dan Halaman Login Hotspot tidak
  butuh apa pun dari ini — keduanya tetap murni jalan di browser pengunjung.
- **Firewall**: port 3001 tidak perlu dibuka ke publik. Cukup 80/443 untuk
  Nginx. Port MySQL (3306) juga sebaiknya tidak dibuka ke publik bila hanya
  diakses dari aplikasi ini di server yang sama (`127.0.0.1`).
- **Backup database**: `saved_configs` menyimpan riwayat konfigurasi router
  pelanggan (kadang termasuk password bila pengguna memilih "Sertakan
  password"). Sertakan database ini dalam rutinitas backup aaPanel
  (**Database → Backup**), bukan hanya kode di Git.
