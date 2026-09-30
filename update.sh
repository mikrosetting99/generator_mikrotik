#!/usr/bin/env bash
#
# Update aplikasi di server aaPanel: tarik kode terbaru, migrasi database,
# build ulang, restart PM2.
#
# Jalankan dari folder proyek:
#   bash update.sh
#
# Log tiap jalan ikut ditulis ke update.log (menumpuk, dilihat lewat
# `tail -f update.log` atau Terminal aaPanel).
#
set -euo pipefail

cd "$(dirname "$0")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "GAGAL: $*"; exit 1; }

exec > >(tee -a update.log) 2>&1

log "==> Mulai update"

# --------------------------------------------------------- pra-pemeriksaan
command -v git >/dev/null || fail "git tidak ditemukan."
command -v npm >/dev/null || fail "npm tidak ditemukan."
command -v pm2 >/dev/null || fail "pm2 tidak ditemukan."

if [ ! -f .env ]; then
  fail ".env belum ada. Salin dari .env.example lalu isi DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL (lihat DEPLOY.md bagian 3) sebelum update pertama kali."
fi

if [ -n "$(git status --porcelain)" ]; then
  fail "Ada perubahan lokal yang belum di-commit di server ini (git status kotor). Bersihkan dulu (git stash / git checkout .) sebelum menarik kode baru, supaya tidak konflik atau tertimpa."
fi

# --------------------------------------------------------------- update
log "==> Menarik kode terbaru dari GitHub"
git pull --ff-only origin main

log "==> Memasang dependensi (npm ci)"
npm ci

log "==> Menjalankan migrasi database"
npx prisma migrate deploy

log "==> Build produksi"
# Batasi memori Node agar tidak menghabiskan RAM VPS kecil.
NODE_OPTIONS="--max-old-space-size=1024" npm run build

log "==> Restart PM2"
if pm2 describe generator-mikrotik > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

log "==> Selesai. Status:"
pm2 status generator-mikrotik
