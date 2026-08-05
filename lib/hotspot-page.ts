import type { ZipEntry } from "./zip";

/**
 * Paket halaman login hotspot RouterOS.
 *
 * Variabel bergaya $(nama) diproses oleh router saat halaman disajikan,
 * jadi berkas ini harus di-upload apa adanya ke folder "hotspot" pada
 * menu Files. Berkas md5.js bawaan router TIDAK diganti — dipakai oleh
 * mode autentikasi http-chap.
 */

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: #0b1220; color: #e7edf7;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  }
  .card {
    width: 100%; max-width: 380px; background: #111c2e; border: 1px solid #22314a;
    border-radius: 16px; padding: 28px;
  }
  h1 { margin: 0 0 6px; font-size: 20px; }
  p.sub { margin: 0 0 22px; font-size: 13px; color: #8ba0bd; line-height: 1.6; }
  label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8ba0bd; margin-bottom: 6px; }
  input[type=text], input[type=password] {
    width: 100%; padding: 11px 12px; margin-bottom: 16px; border-radius: 10px;
    border: 1px solid #22314a; background: #0b1220; color: #e7edf7; font-size: 15px; outline: none;
  }
  input[type=text]:focus, input[type=password]:focus { border-color: #38bdf8; }
  button, input[type=submit] {
    width: 100%; padding: 12px; border: 0; border-radius: 10px; cursor: pointer;
    background: #38bdf8; color: #06121c; font-size: 15px; font-weight: 600;
  }
  button:hover, input[type=submit]:hover { background: #7dd3fc; }
  .alert { background: rgba(248,113,113,.12); border: 1px solid rgba(248,113,113,.4); color: #fca5a5;
           padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
  .info { font-size: 12px; color: #5d708c; margin-top: 18px; line-height: 1.7; }
  .rows { font-size: 13px; color: #8ba0bd; line-height: 2; }
  .rows b { color: #e7edf7; font-weight: 600; }
  a { color: #38bdf8; }
</style>
</head>
<body>
<div class="card">
${body}
</div>
</body>
</html>
`;
}

export function buildHotspotPackage(siteName: string): ZipEntry[] {
  const name = siteName.trim() || "Hotspot";

  const login = shell(
    `Login ${name}`,
    `<h1>${name}</h1>
<p class="sub">Masuk dengan akun yang diberikan petugas untuk mulai menggunakan internet.</p>

$(if error)<div class="alert">$(error)</div>$(endif)

<form name="login" action="$(link-login-only)" method="post" $(if chap-id)onSubmit="return doLogin()"$(endif)>
  <input type="hidden" name="dst" value="$(link-orig)">
  <input type="hidden" name="popup" value="true">

  <label for="username">Username</label>
  <input id="username" type="text" name="username" autocomplete="username" autocapitalize="none" value="$(username)">

  <label for="password">Password</label>
  <input id="password" type="password" name="password" autocomplete="current-password">

  <input type="submit" value="Login">
</form>

<form name="sendin" action="$(link-login-only)" method="post" style="display:none">
  <input type="hidden" name="username">
  <input type="hidden" name="password">
  <input type="hidden" name="dst" value="$(link-orig)">
  <input type="hidden" name="popup" value="true">
</form>

<p class="info">Terhubung ke <b>$(hostname)</b> &middot; IP Anda $(ip-address)</p>

$(if chap-id)
<script type="text/javascript" src="/md5.js"></script>
<script type="text/javascript">
function doLogin() {
  document.sendin.username.value = document.login.username.value;
  document.sendin.password.value = hexMD5('$(chap-id)' + document.login.password.value + '$(chap-challenge)');
  document.sendin.submit();
  return false;
}
</script>
$(endif)`,
  );

  const alogin = shell(
    "Berhasil masuk",
    `<h1>Berhasil masuk</h1>
<p class="sub">Anda sudah terhubung ke internet. Halaman akan dialihkan otomatis.</p>
<div class="rows">
  <div>Username: <b>$(username)</b></div>
  <div>IP: <b>$(ip)</b></div>
</div>
<p class="info">Tidak dialihkan otomatis? <a href="$(link-redirect)">Klik di sini</a>.</p>
<script type="text/javascript">
setTimeout(function () { location.href = '$(link-redirect)'; }, 1200);
</script>`,
  );

  const status = shell(
    "Status koneksi",
    `<h1>Status koneksi</h1>
<p class="sub">Ringkasan pemakaian sesi Anda saat ini.</p>
<div class="rows">
  <div>Username: <b>$(username)</b></div>
  <div>IP: <b>$(ip)</b></div>
  <div>Lama terhubung: <b>$(uptime)</b></div>
  <div>Download: <b>$(bytes-in-nice)</b></div>
  <div>Upload: <b>$(bytes-out-nice)</b></div>
</div>
<p class="info"><a href="$(link-logout)">Keluar (logout)</a></p>`,
  );

  const logout = shell(
    "Anda telah keluar",
    `<h1>Anda telah keluar</h1>
<p class="sub">Sesi internet dihentikan. Terima kasih.</p>
<div class="rows">
  <div>Lama terhubung: <b>$(uptime)</b></div>
  <div>Download: <b>$(bytes-in-nice)</b></div>
  <div>Upload: <b>$(bytes-out-nice)</b></div>
</div>
<p class="info"><a href="$(link-login)">Masuk kembali</a></p>`,
  );

  const error = shell(
    "Terjadi kesalahan",
    `<h1>Terjadi kesalahan</h1>
<div class="alert">$(error)</div>
<p class="info"><a href="$(link-login)">Kembali ke halaman login</a></p>`,
  );

  const readme = `PAKET HALAMAN LOGIN HOTSPOT MIKROTIK
====================================
Dibuat oleh Generator Script Mikrotik untuk hotspot: ${name}

Isi paket:
  login.html   - halaman login utama (mendukung http-pap & http-chap)
  alogin.html  - halaman setelah login berhasil
  status.html  - status pemakaian sesi
  logout.html  - halaman setelah logout
  error.html   - halaman error

CARA UPLOAD
-----------
1. Ekstrak file zip ini di komputer Anda.
2. Buka Winbox > menu "Files".
3. Buka folder "hotspot" (folder ini otomatis dibuat setelah script hotspot
   dijalankan di router).
4. Drag & drop kelima berkas .html ke dalam folder "hotspot".
   Jika muncul konfirmasi menimpa berkas lama, pilih ya.
5. Buka browser dari perangkat klien, hotspot akan menampilkan halaman baru.
   Tekan Ctrl+F5 bila masih tampil halaman lama (cache browser).

CATATAN PENTING
---------------
- JANGAN menghapus berkas md5.js bawaan router. Berkas itu dipakai oleh
  metode autentikasi http-chap dan sudah dirujuk oleh login.html.
- Berkas bawaan lain (errors.txt, radvert.html, redirect.html, rlogin.html,
  folder img/ dan xml/) biarkan apa adanya.
- Sebelum menimpa, sebaiknya salin dulu folder "hotspot" sebagai cadangan:
  drag folder tersebut dari Files ke komputer Anda.
- Kode $(...) di dalam berkas HTML adalah variabel RouterOS. Jangan diubah
  atau dihapus bila tidak paham fungsinya.
`;

  return [
    { name: "login.html", content: login },
    { name: "alogin.html", content: alogin },
    { name: "status.html", content: status },
    { name: "logout.html", content: logout },
    { name: "error.html", content: error },
    { name: "PETUNJUK-UPLOAD.txt", content: readme },
  ];
}
