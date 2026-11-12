<#
  Deploy sekali jalan dari laptop (Windows):
    1. push branch yang sedang aktif ke GitHub main (hanya fast-forward)
    2. masuk ke server lewat SSH dan menjalankan update.sh

  Cara pakai (dari folder proyek):
    .\deploy.cmd                 push + deploy
    .\deploy.cmd -NoPush         hanya jalankan update.sh di server
    .\deploy.cmd -SetupKey       pasang kunci SSH supaya tidak ditanya password lagi
    .\deploy.cmd -Reconfigure    ganti alamat server yang tersimpan

  Alamat server disimpan di .deploy.local.json (tidak ikut di-commit).
#>
param(
  [switch]$NoPush,
  [switch]$SetupKey,
  [switch]$Reconfigure
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$ConfigFile = Join-Path $PSScriptRoot ".deploy.local.json"

function Say($text, $color = "Cyan") { Write-Host "==> $text" -ForegroundColor $color }
function Fail($text) { Write-Host "GAGAL: $text" -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------ alamat server
function Read-Config {
  if ((Test-Path $ConfigFile) -and -not $Reconfigure) {
    return Get-Content $ConfigFile -Raw | ConvertFrom-Json
  }
  Say "Alamat server belum diatur. Isi sekali saja, nanti tersimpan." "Yellow"
  $hostName = Read-Host "IP atau domain server (mis. 103.10.20.30)"
  if (-not $hostName) { Fail "Alamat server wajib diisi." }
  $user = Read-Host "User SSH [root]"
  if (-not $user) { $user = "root" }
  $port = Read-Host "Port SSH [22]"
  if (-not $port) { $port = "22" }
  $path = Read-Host "Folder proyek di server [/www/wwwroot/generator_mikrotik]"
  if (-not $path) { $path = "/www/wwwroot/generator_mikrotik" }
  $cfg = [pscustomobject]@{ host = $hostName.Trim(); user = $user.Trim(); port = [int]$port; path = $path.Trim() }
  [IO.File]::WriteAllText($ConfigFile, ($cfg | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
  Say "Tersimpan di .deploy.local.json" "Green"
  return $cfg
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  Fail "ssh tidak ditemukan. Pasang 'OpenSSH Client' di Settings > Apps > Optional features."
}
$cfg = Read-Config
$target = "$($cfg.user)@$($cfg.host)"
$sshArgs = @("-p", "$($cfg.port)", "-o", "ServerAliveInterval=30")

# --------------------------------------------------- pasang kunci SSH (sekali)
if ($SetupKey) {
  $key = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
  if (-not (Test-Path "$key.pub")) {
    Say "Membuat kunci SSH baru ($key)"
    New-Item -ItemType Directory -Force (Split-Path $key) | Out-Null
    & ssh-keygen -t ed25519 -f $key -N '""' -C "deploy-generator-mikrotik"
    if ($LASTEXITCODE -ne 0) { Fail "ssh-keygen gagal." }
  }
  Say "Mengirim kunci ke server. Masukkan password SSH server sekali ini saja."
  $pub = (Get-Content "$key.pub" -Raw).Trim()
  $remote = "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && (grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys)"
  & ssh @sshArgs $target $remote
  if ($LASTEXITCODE -ne 0) { Fail "Kunci gagal dipasang. Cek alamat, user, port, dan password." }
  Say "Kunci terpasang. Deploy berikutnya tidak perlu password." "Green"
  exit 0
}

# -------------------------------------------------------------- push ke main
if (-not $NoPush) {
  $branch = (git branch --show-current).Trim()
  if (-not $branch) { Fail "Tidak sedang di branch mana pun (detached HEAD)." }

  # Berkas yang belum pernah di-commit (mis. folder design/) dibiarkan; yang diubah wajib di-commit.
  $dirty = git status --porcelain --untracked-files=no
  if ($dirty) {
    Write-Host ($dirty -join "`n")
    Fail "Ada perubahan yang belum di-commit. Commit dulu, lalu jalankan lagi."
  }

  Say "Mengambil info terbaru dari GitHub"
  git fetch -q origin
  if ($LASTEXITCODE -ne 0) { Fail "git fetch gagal (cek internet / login GitHub)." }

  git merge-base --is-ancestor origin/main HEAD
  if ($LASTEXITCODE -ne 0) {
    Fail "main di GitHub punya commit yang belum ada di branch '$branch'. Jalankan 'git pull origin main' (atau rebase) dulu."
  }

  $ahead = (git rev-list --count origin/main..HEAD).Trim()
  if ($ahead -eq "0") {
    Say "Tidak ada commit baru; main di GitHub sudah sama. Lanjut deploy." "Yellow"
  } else {
    Say "Push $ahead commit dari '$branch' ke main"
    if ($branch -ne "main") {
      git push -q origin $branch
      if ($LASTEXITCODE -ne 0) { Fail "Push branch '$branch' gagal." }
    }
    git push origin "HEAD:main"
    if ($LASTEXITCODE -ne 0) { Fail "Push ke main gagal." }
  }
}

# ---------------------------------------------------------- update di server
Say "Menjalankan update.sh di $target ($($cfg.path))"
$started = Get-Date
& ssh @sshArgs -t $target "cd '$($cfg.path)' && bash update.sh"
$code = $LASTEXITCODE
$mins = [math]::Round(((Get-Date) - $started).TotalMinutes, 1)
if ($code -ne 0) {
  Fail "update.sh berhenti dengan kode $code setelah $mins menit. Lihat pesan di atas, atau 'tail -n 100 update.log' di server."
}
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
Say "Selesai dalam $mins menit. Versi $version sudah jalan di server." "Green"
Say "Bila tampilan masih lama: tekan Ctrl+F5 di browser." "Green"
