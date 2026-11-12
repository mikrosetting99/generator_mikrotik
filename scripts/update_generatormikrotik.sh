#!/usr/bin/env bash
#
# Deploy update Generator Mikrotik di server aaPanel, satu baris:
#
#   cd /www/wwwroot/generator_mikrotik && bash scripts/update_generatormikrotik.sh
#
# Isinya sama dengan update.sh di folder proyek (tarik kode main, npm ci, migrasi
# database, build, restart PM2); nama ini hanya menyamakan dengan proyek lain.
#
set -euo pipefail
exec bash "$(cd "$(dirname "$0")/.." && pwd)/update.sh" "$@"
