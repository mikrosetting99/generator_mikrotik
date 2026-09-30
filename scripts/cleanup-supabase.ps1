# Hapus sisa file Supabase/koin/Duitku yang sudah tidak dipakai setelah
# migrasi ke NextAuth + Prisma/MySQL.
#
# Jalankan dari root proyek:
#   powershell -ExecutionPolicy Bypass -File scripts/cleanup-supabase.ps1
#
# Aman dijalankan berkali-kali — path yang sudah tidak ada dilewati saja.
# Setelah ini selesai, jalankan `npm run build` untuk memastikan tidak ada
# lagi error "Module not found: Can't resolve '@supabase/...'".

$paths = @(
  "lib\supabase",
  "lib\koin",
  "lib\actions\koin.ts",
  "lib\actions\fitur.ts",
  "lib\actions\admin.ts",
  "lib\actions\auth.ts",
  "components\GerbangFitur.tsx",
  "components\login-page-hotspot\TopupPanel.tsx",
  "components\login-page-hotspot\DaftarForm.tsx",
  "components\login-page-hotspot\LoginForm.tsx",
  "app\login-page-hotspot\koin",
  "app\login-page-hotspot\daftar",
  "app\login-page-hotspot\login",
  "app\login-page-hotspot\admin",
  "app\api\duitku",
  "supabase"
)

foreach ($p in $paths) {
  if (Test-Path $p) {
    Remove-Item $p -Recurse -Force
    Write-Host "removed: $p"
  } else {
    Write-Host "not found (skip): $p"
  }
}

Write-Host ""
Write-Host "Selesai. Jalankan 'npm run build' untuk memastikan semua bersih."
