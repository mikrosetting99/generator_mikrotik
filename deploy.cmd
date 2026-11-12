@echo off
rem Klik dua kali, atau jalankan "deploy.cmd" dari folder proyek. Lihat deploy.ps1 untuk pilihan.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
echo.
pause
