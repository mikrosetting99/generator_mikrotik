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
11. **IP Hotspot** — metode autentikasi http-pap/http-chap/mac-cookie/cookie, plus paket
    halaman login yang diunduh terpisah sebagai `.zip`.
12. **PPPoE Server** — profile, pool, autentikasi, dan daftar PPP secret.
13. **Firewall Dasar** — proteksi chain input/forward, FastTrack, pembatasan layanan
    Winbox/SSH/WebFig, neighbor discovery, dan MAC server.

Perbedaan sintaks v6/v7 ditangani generator (mis. NTP client, parameter `hw-offload` pada
rule FastTrack).

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
    SetupBuilder.tsx  # state builder + layout + navigasi section
    sections.tsx      # seluruh section form menu 1
    ScriptPreview.tsx # preview, copy, download .rsc & paket hotspot
lib/
  models.ts           # database model Mikrotik + kompatibilitas RouterOS
  types.ts            # bentuk konfigurasi builder
  defaults.ts         # nilai awal & pembuat baris list
  interfaces.ts       # turunan daftar interface (fisik, bridge, VLAN)
  net.ts              # helper IP/CIDR
  validate.ts         # validasi per section
  hotspot-page.ts     # berkas halaman login hotspot
  zip.ts              # penulis ZIP tanpa dependensi
  generator/
    script-builder.ts # penyusun teks script
    setup.ts          # generator menu 1
```

## Catatan

- Section PPPoE Server masih mengikuti draft PRD 5.1(l) dan dapat berubah setelah
  spesifikasinya dikonfirmasi.
- Script selalu diawali peringatan untuk backup (`/system backup save`) dan diakhiri
  daftar perintah verifikasi.
