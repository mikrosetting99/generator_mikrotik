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
npm ci
npm run build
```

Kalau `npm run build` gagal dengan error Turbopack, pakai builder lama:

```bash
npm run build:webpack
```

---

## 3. Jalankan dengan PM2

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

## 4. Domain & reverse proxy

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

## 5. Update setelah ada perubahan kode

Push dari lokal seperti biasa, lalu di server:

```bash
cd /www/wwwroot/generator_mikrotik
bash deploy.sh
```

`deploy.sh` melakukan: `git pull` → `npm ci` → `build` → `pm2 reload` → `pm2 save`,
dan menampilkan status di akhir.

---

## Catatan

- **Tidak ada environment variable** yang perlu diisi. Aplikasi tidak memakai
  database, API key, maupun layanan eksternal — semua generate script berjalan
  di browser pengunjung.
- **Firewall**: port 3001 tidak perlu dibuka ke publik. Cukup 80/443 untuk Nginx.
- Aplikasi ini sebenarnya bisa juga di-*static export* (`output: "export"`) dan
  dilayani Nginx tanpa Node sama sekali, karena tidak ada API route maupun server
  action. Opsi itu lebih hemat resource bila suatu saat ingin dipindahkan.
