#!/usr/bin/env bash
#
# Setup PERTAMA KALI di server aaPanel — jalankan sekali saja, setelah
# git clone dan sebelum situs pertama kali dibuka. Untuk update berikutnya
# pakai update.sh, bukan skrip ini.
#
# Jalankan dari folder proyek:
#   cd /www/wwwroot/generator_mikrotik
#   bash first-setup.sh
#
set -euo pipefail

cd "$(dirname "$0")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "GAGAL: $*"; exit 1; }

exec > >(tee -a update.log) 2>&1

log "==> Setup pertama kali"

# --------------------------------------------------------- pra-pemeriksaan
command -v node >/dev/null || fail "node tidak ditemukan. Pasang Node 20 LTS lewat App Store -> Node.js Version Manager di aaPanel."
command -v npm  >/dev/null || fail "npm tidak ditemukan."
command -v pm2  >/dev/null || fail "pm2 tidak ditemukan (biasanya ikut terpasang bersama Node Manager aaPanel)."

if [ ! -f .env ]; then
  cp .env.example .env
  fail ".env baru dibuat dari .env.example, tapi isinya masih contoh. Edit dulu (nano .env): isi DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, MSLP_LICENSE_SALT, MSLP_LICENSOR_WA, SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD — lihat DEPLOY.md bagian 3 — lalu jalankan ulang: bash first-setup.sh"
fi

# Validasi kasar: tolak kalau nilai contoh belum diganti, daripada gagal
# belakangan dengan error database yang membingungkan.
if grep -q "ganti-dengan-string-acak-panjang" .env; then
  fail "NEXTAUTH_SECRET di .env masih nilai contoh. Isi dengan hasil: openssl rand -base64 32"
fi
if grep -q 'mysql://user:password@' .env; then
  fail "DATABASE_URL di .env masih nilai contoh. Isi dengan kredensial database yang sudah dibuat lewat aaPanel (Database -> Add database)."
fi
if grep -qE '^MSLP_LICENSE_SALT=("")?$' .env; then
  fail "MSLP_LICENSE_SALT di .env masih kosong. HARUS sama persis dengan LIS_SALT di login.html yang sudah beredar — lihat DEPLOY.md bagian 3."
fi

# --------------------------------------------------------------- setup
log "==> Memasang dependensi (npm ci)"
npm ci

log "==> Menjalankan migrasi database (membuat semua tabel)"
npx prisma migrate deploy

log "==> Membuat akun admin pertama (aman diulang, dilewati bila sudah ada)"
npm run db:seed

log "==> Build produksi"
NODE_OPTIONS="--max-old-space-size=1024" npm run build

log "==> Menjalankan lewat PM2"
if pm2 describe generator-mikrotik > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

log "==> Selesai. Status:"
pm2 status generator-mikrotik

cat <<'EOF'

Langkah yang TERSISA lewat menu aaPanel (bukan terminal):
  1. Website -> Add site, isi domain (mis. generator.mikrosetting.com).
  2. Buka situs itu -> Reverse Proxy -> Add reverse proxy, target
     http://127.0.0.1:3001.
  3. SSL -> Let's Encrypt, terbitkan sertifikat, aktifkan Force HTTPS.
  4. Login ke /login pakai SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD dari
     .env, lalu ganti passwordnya sendiri kalau perlu.

Untuk update kode berikutnya, cukup:
  bash update.sh
EOF
