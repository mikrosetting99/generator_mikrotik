#!/usr/bin/env bash
#
# Update aplikasi di server: tarik kode terbaru, build ulang, restart PM2.
# Jalankan dari folder proyek:  bash deploy.sh
#
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Menarik kode terbaru dari GitHub"
git pull --ff-only origin main

echo "==> Memasang dependensi (npm ci)"
npm ci

echo "==> Build produksi"
# Batasi memori Node agar tidak menghabiskan RAM VPS kecil.
NODE_OPTIONS="--max-old-space-size=1024" npm run build

echo "==> Restart PM2"
if pm2 describe generator-mikrotik > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi
pm2 save

echo "==> Selesai. Status:"
pm2 status generator-mikrotik
