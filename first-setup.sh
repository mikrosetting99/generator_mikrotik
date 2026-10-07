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
# Kalau .env belum ada, skrip ini menanyakannya interaktif (termasuk opsi
# membuat database & user MySQL otomatis lewat mysql client) dan membuat
# NEXTAUTH_SECRET serta MSLP_LICENSE_SALT secara acak — tidak perlu lagi
# menjalankan openssl atau mengedit .env manual.
#
set -euo pipefail

cd "$(dirname "$0")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "GAGAL: $*"; exit 1; }

command -v node    >/dev/null || fail "node tidak ditemukan. Pasang Node 20 LTS lewat App Store -> Node.js Version Manager di aaPanel."
command -v npm     >/dev/null || fail "npm tidak ditemukan."
command -v pm2     >/dev/null || fail "pm2 tidak ditemukan (biasanya ikut terpasang bersama Node Manager aaPanel)."
command -v openssl >/dev/null || fail "openssl tidak ditemukan (dipakai membuat kunci acak)."

# --------------------------------------------------------------- .env
#
# Dikerjakan SEBELUM output dialihkan ke update.log di bawah — prompt
# interaktif bisa tidak muncul di terminal kalau stdout sudah disalurkan
# lewat pipe (tee).
if [ -f .env ]; then
  log ".env sudah ada, dipakai apa adanya."
  grep -q "ganti-dengan-string-acak-panjang" .env && fail "NEXTAUTH_SECRET di .env masih nilai contoh."
  grep -q 'mysql://user:password@' .env && fail "DATABASE_URL di .env masih nilai contoh."
  if grep -qE '^MSLP_LICENSE_SALT=("")?$' .env; then
    fail "MSLP_LICENSE_SALT di .env masih kosong. HARUS sama persis dengan LIS_SALT yang sudah beredar bila sudah pernah ada lisensi terbit — kalau belum pernah, isi dengan: openssl rand -hex 32"
  fi
else
  echo ""
  log "==> .env belum ada — dibuat interaktif sekarang."
  echo ""

  read -rp "Buat database & user MySQL otomatis lewat mysql client? [y/N]: " AUTO_DB
  if [[ "${AUTO_DB}" =~ ^[Yy]$ ]]; then
    command -v mysql >/dev/null || fail "mysql client tidak ditemukan — buat database manual lewat menu Database di aaPanel, lalu jalankan ulang skrip ini dan pilih \"n\"."

    read -rp "Host MySQL [127.0.0.1]: " DB_HOST; DB_HOST=${DB_HOST:-127.0.0.1}
    read -rp "Port MySQL [3306]: " DB_PORT; DB_PORT=${DB_PORT:-3306}
    read -rp "User root/admin MySQL [root]: " DB_ROOT_USER; DB_ROOT_USER=${DB_ROOT_USER:-root}
    read -rsp "Password root/admin MySQL: " DB_ROOT_PASS; echo
    read -rp "Nama database baru [generator_mikrotik]: " DB_NAME; DB_NAME=${DB_NAME:-generator_mikrotik}
    read -rp "Username database baru [generator_mikrotik]: " DB_USER; DB_USER=${DB_USER:-generator_mikrotik}
    DB_PASS=$(openssl rand -hex 16)

    log "==> Membuat database '${DB_NAME}' dan user '${DB_USER}'"
    mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_ROOT_USER}" -p"${DB_ROOT_PASS}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_HOST}';
FLUSH PRIVILEGES;
SQL
    log "==> Database dan user berhasil dibuat."
  else
    log "Pastikan database sudah dibuat lewat menu Database di aaPanel sebelum lanjut."
    read -rp "Host MySQL [127.0.0.1]: " DB_HOST; DB_HOST=${DB_HOST:-127.0.0.1}
    read -rp "Port MySQL [3306]: " DB_PORT; DB_PORT=${DB_PORT:-3306}
    read -rp "Nama database: " DB_NAME
    read -rp "Username database: " DB_USER
    read -rsp "Password database: " DB_PASS; echo
  fi

  read -rp "Domain situs, dengan https:// (mis. https://generator.mikrosetting.com): " SITE_URL
  read -rp "Username admin pertama [admin]: " ADMIN_USER; ADMIN_USER=${ADMIN_USER:-admin}
  read -rsp "Password admin pertama (minimal 8 karakter): " ADMIN_PASS; echo
  read -rp "Nomor WhatsApp penerbit lisensi, format 62xxx [6281112001036]: " LICENSOR_WA
  LICENSOR_WA=${LICENSOR_WA:-6281112001036}

  NEXTAUTH_SECRET=$(openssl rand -base64 32)
  MSLP_SALT=$(openssl rand -hex 32)

  cat > .env <<EOF
DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="${SITE_URL}"
SEED_ADMIN_USERNAME="${ADMIN_USER}"
SEED_ADMIN_PASSWORD="${ADMIN_PASS}"
MSLP_LICENSE_SALT="${MSLP_SALT}"
MSLP_LICENSOR_WA=${LICENSOR_WA}
EOF
  chmod 600 .env

  echo ""
  log "==> .env dibuat. NEXTAUTH_SECRET dan MSLP_LICENSE_SALT dibuat acak otomatis."
  echo "    Catat ini baik-baik, tidak ditampilkan lagi setelah ini:"
  echo "    MSLP_LICENSE_SALT=${MSLP_SALT}"
  if [[ "${AUTO_DB}" =~ ^[Yy]$ ]]; then
    echo "    Password database (${DB_USER}): ${DB_PASS}"
  fi
  echo "    (Semua nilai ini juga tersimpan di .env, bisa dibaca lagi lewat: cat .env)"
  echo ""
fi

# ----------------------------------------------------------- jalankan
exec > >(tee -a update.log) 2>&1

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
