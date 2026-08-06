# Generator Script Mikrotik

Aplikasi web untuk membuat script konfigurasi RouterOS lewat form, tanpa perlu menghafal
sintaks CLI. Hasilnya tinggal di-copy-paste ke **New Terminal** Winbox/WebFig, atau diunduh
sebagai file `.rsc`.

Seluruh proses generate berjalan di browser — IP, password, dan data lain tidak pernah
dikirim ke server.

## Status menu

| Menu | Status |
|---|---|
| **Setup Mikrotik Baru** | ✅ Tersedia (`/setup`) |
| Load Balance PCC | Belum dikerjakan |
| Fail Over (Recursive Gateway / Netwatch) | Belum dikerjakan |

### Setup Mikrotik Baru

Builder modular mengikuti urutan section pada PRD:

1. **Type Mikrotik** — dipilih dari database model, lengkap dengan daftar interface bawaan
   dan metadata kompatibilitas RouterOS.
2. **RouterOS** — wajib dipilih sebelum section lain terbuka; opsi difilter sesuai model
   (device ARM64 baru hanya menawarkan v7).
3. **WAN** — bisa lebih dari satu; mode DHCP Client (dengan `add-default-route` dan
   `default-route-distance`) atau Static.
4. **DNS** — daftar server + `allow-remote-requests`.
5. **NAT** — masquerade global (`out-interface-list=WAN`) atau per interface.
6. **Bridge** *(opsional)* — beberapa bridge, pemilihan port member.
7. **VLAN** — banyak VLAN, dengan induk interface fisik atau bridge.
8. **IP Address** — per interface fisik/bridge/VLAN.
9. **IP Pool** — dengan pengisian otomatis dari subnet interface.
10. **DHCP Server** — network & gateway diisi otomatis dari IP address interface.
11. **IP Hotspot** — metode autentikasi http-pap/http-chap/mac-cookie/cookie, plus editor
    halaman login: 4 desain (Minimal, Voucher, Korporat, Gelap Modern), warna tema & latar
    bebas, unggah logo, mode Voucher/Member, teks berjalan, tabel harga paket, tautan trial,
    dan tombol WhatsApp. Pratinjau langsung, hasilnya satu folder `hotspot` lengkap
    dalam `.zip`.
12. **PPPoE Server** — profile, pool, rate limit, dan daftar PPP secret. Metode autentikasi
    tidak diekspos di form; script memakai bawaan RouterOS.
13. **Firewall Dasar** — proteksi chain input/forward, FastTrack, pembatasan layanan
    Winbox/SSH/WebFig, neighbor discovery, dan MAC server. **Mati secara default**,
    diaktifkan sendiri bila diperlukan.
14. **User Mikrotik** — ganti password admin dan tambah user baru (nama, password, group
    full/write/read, batas subnet login). Section terakhir, dan blok ini juga diletakkan
    paling akhir di script agar akses ke router tidak terputus di tengah eksekusi.

Perbedaan sintaks v6/v7 ditangani generator (mis. NTP client, parameter `hw-offload` pada
rule FastTrack).

Section ditampilkan satu per satu sebagai wizard dengan navigasi Kembali/Lanjut; rail kiri
berfungsi sebagai stepper sekaligus tombol lompat.

### Simpan & muat konfigurasi

Tombol **Simpan / Muat** di header membuka dialog dengan dua jalur:

- **Slot di browser** (`localStorage`) — beri nama, muat kembali kapan saja, hapus bila tidak
  dipakai. Nama yang sama menimpa entri sebelumnya.
- **File `.json`** — unduh untuk dipindah ke perangkat/teknisi lain, lalu muat lewat "Muat dari
  file".

Password admin dan PPPoE **tidak ikut tersimpan** kecuali toggle "Sertakan password" dinyalakan.
Saat memuat, konfigurasi dinormalisasi terhadap nilai default: field yang hilang diisi, field
asing dibuang, model/RouterOS yang tidak cocok direset, dan id tiap baris dibuat ulang — jadi
file lama tetap bisa dipakai meski bentuk konfigurasi berubah.

## Menjalankan

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build produksi
npm run lint
```

## Struktur

```
app/
  page.tsx            # landing: pilihan 3 menu
  setup/page.tsx      # menu 1
components/
  ui.tsx              # primitif form (Field, Select, Toggle, Panel, ...)
  setup/
    SetupBuilder.tsx   # state builder + layout + navigasi wizard
    sections.tsx       # seluruh section form menu 1
    ScriptPreview.tsx  # preview, copy, download .rsc & paket hotspot
    SaveLoadDialog.tsx # simpan/muat konfigurasi (browser & file .json)
lib/
  models.ts           # database model Mikrotik + kompatibilitas RouterOS
  types.ts            # bentuk konfigurasi builder
  defaults.ts         # nilai awal & pembuat baris list
  interfaces.ts       # turunan daftar interface (fisik, bridge, VLAN)
  net.ts              # helper IP/CIDR
  validate.ts         # validasi per section
  storage.ts          # simpan/muat + normalisasi konfigurasi
  color.ts            # turunan palet & jaminan kontras halaman login
  hotspot-page.ts     # registry template + renderer + pembangun paket login
  zip.ts              # penulis ZIP tanpa dependensi
  generator/
    script-builder.ts # penyusun teks script
    setup.ts          # generator menu 1
```

## Menambah desain halaman login

Paket yang diunduh adalah **satu folder `hotspot` lengkap**, siap menimpa isi folder
bawaan router — bukan tambalan sebagian:

```
login.html  alogin.html  status.html  logout.html  error.html
rlogin.html  redirect.html  radvert.html
errors.txt   md5.js   style.css   logo.png   PETUNJUK-UPLOAD.txt
```

Seluruh HTML dipakai bersama semua desain; yang membedakan tema **hanya `style.css`**.
Sumbernya:

```
public/hotspot-templates/
  _shared/          # semua halaman + md5.js + errors.txt
  minimal/style.css
  voucher/style.css
  korporat/style.css
  gelap/style.css
```

Untuk menambah desain baru: buat folder berisi `style.css` (pakai kelas yang sama
dengan tema lain), lalu daftarkan pada `TEMPLATES` di
[lib/hotspot-page.ts](lib/hotspot-page.ts) — id, nama, deskripsi, warna tema dan latar
default. Tidak perlu mengubah kode lain.

Placeholder yang tersedia:

| Placeholder | Isi |
|---|---|
| `{{TITLE}}` `{{SUBTITLE}}` `{{MARQUEE}}` `{{TERMS}}` `{{FOOTER}}` | teks dari form (sudah di-escape) |
| `{{LOGO}}` | nama berkas logo, mis. `logo.png` |
| `{{WA_LINK}}` `{{WA_LABEL}}` | tautan wa.me dan teks tombol |
| `{{START_MODE}}` `{{MODE_SWITCH}}` `{{TRIAL}}` | mode awal login & tombol opsional |
| `{{PACKAGES}}` `{{PACKAGE_ROWS}}` | tabel harga paket |
| `{{PRIMARY}}` `{{ON_PRIMARY}}` `{{BG}}` `{{SURFACE}}` `{{TEXT}}` `{{MUTED}}` `{{BORDER}}` | warna |
| `{{#KEY}}…{{/KEY}}` | tampil hanya bila terisi |
| `{{^KEY}}…{{/KEY}}` | tampil hanya bila kosong |

Variabel bergaya `$(...)` adalah milik RouterOS dan tidak disentuh renderer.

Warna latar boleh apa saja: warna teks, permukaan, dan garis dihitung dari
kecerahannya di [lib/color.ts](lib/color.ts), dengan jaminan kontras 4.5:1 untuk teks
utama dan 3:1 untuk teks sekunder.

## Catatan

- Section PPPoE Server masih mengikuti draft PRD 5.1(l) dan dapat berubah setelah
  spesifikasinya dikonfirmasi.
- Script selalu diawali peringatan untuk backup (`/system backup save`) dan diakhiri
  daftar perintah verifikasi.
