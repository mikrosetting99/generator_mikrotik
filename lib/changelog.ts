/**
 * Satu-satunya sumber data changelog — dipakai oleh halaman /changelog dan
 * oleh `npm run changelog:generate` untuk menulis ulang CHANGELOG.md.
 * Versi aplikasi (dipakai VersionBadge) selalu mengikuti entri paling atas.
 */

export type ChangeType = "added" | "changed" | "fixed";

export interface ChangeGroup {
  type: ChangeType;
  items: string[];
}

export interface Release {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  changes: ChangeGroup[];
}

export const CHANGE_TYPE_LABEL: Record<ChangeType, string> = {
  added: "Ditambahkan",
  changed: "Diubah",
  fixed: "Diperbaiki",
};

/** Terbaru di paling atas. */
export const CHANGELOG: Release[] = [
  {
    version: "1.0.0",
    date: "2026-09-30",
    title: "Login & riwayat konfigurasi di database",
    changes: [
      {
        type: "added",
        items: [
          "Sistem login (username/password) khusus menu Setup Mikrotik Baru.",
          "Riwayat konfigurasi tersimpan di database MySQL — bisa dimuat ulang dari perangkat lain selama login dengan akun yang sama.",
          "Panel admin (/admin/users) untuk mendaftarkan akun pengguna baru.",
          "Peran Admin bisa melihat riwayat konfigurasi milik semua akun, tidak hanya miliknya sendiri.",
        ],
      },
      {
        type: "changed",
        items: [
          "Menu Setup Mikrotik Baru kini wajib login. Load Balance & Fail Over dan Halaman Login Hotspot tetap bisa dipakai publik tanpa akun.",
          "Dialog Simpan/Muat menambah bagian \"Riwayat di server\" berdampingan dengan opsi lama \"Tersimpan di browser ini\".",
          "Script update server diganti nama dari `deploy.sh` jadi `update.sh`, sekaligus ditambah pra-pemeriksaan (`.env` ada, git bersih) dan pencatatan ke `update.log`.",
        ],
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-09-30",
    title: "Polish UI/UX",
    changes: [
      {
        type: "changed",
        items: [
          "Landing page: hapus badge kicker dan teks gradient pada judul, sesuai prinsip desain yang lebih bersih.",
          "Gabungkan kartu menu \"Load Balance PCC\" dan \"Fail Over\" jadi satu kartu — sebelumnya keduanya mengarah ke halaman builder yang sama.",
          "Rapikan duplikasi kode: fungsi unduh file dan pewarnaan sintaks script dipindah jadi helper bersama (`lib/download.ts`, `lib/script-highlight.tsx`).",
        ],
      },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-08-15",
    title: "Perbaikan bug",
    changes: [
      {
        type: "fixed",
        items: ["Modal tidak lagi merebut fokus balik ke tombol tutup di setiap ketikan."],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-08-11",
    title: "Load Balance & Fail Over jadi menu sendiri",
    changes: [
      {
        type: "added",
        items: [
          "Menu baru: Load Balance PCC multi-ISP dengan failover recursive gateway.",
          "Metode failover tambahan: Netwatch Ping dan Scheduler Check, selain Recursive Gateway.",
        ],
      },
      {
        type: "changed",
        items: [
          "Halaman Login dipindah keluar dari wizard Setup jadi menu tersendiri.",
          "Load Balance (PCC) dan Failover kini independen — bisa diaktifkan salah satu atau keduanya.",
        ],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-08-10",
    title: "Wireless, anti-tethering, desain Poster",
    changes: [
      {
        type: "added",
        items: [
          "Section Wireless supaya hotspot di perangkat yang punya radio Wi-Fi (hAP, dst) benar-benar berfungsi.",
          "Anti-tethering lewat penurunan TTL ke klien.",
          "Desain halaman login \"Poster\", mengikuti tata letak PRONET.",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-08-08",
    title: "BAST & halaman login jadi langkah sendiri",
    changes: [
      { type: "added", items: ["Dokumen Berita Acara Serah Terima (BAST) untuk pelanggan."] },
      { type: "changed", items: ["Editor halaman login dipisah jadi langkah tersendiri di wizard Setup."] },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-08-07",
    title: "PPPoE multi-profile, tema terang, preset siap pakai",
    changes: [
      {
        type: "added",
        items: [
          "Dukungan banyak profile PPPoE dalam satu konfigurasi.",
          "Tema terang untuk UI generator.",
          "Konfigurasi siap pakai (preset) yang mencakup hotspot dan PPPoE.",
          "Model RB450Gx4 ditambahkan ke database perangkat.",
          "Pengaturan ukuran logo pada halaman login hotspot.",
        ],
      },
      {
        type: "fixed",
        items: ["Pratinjau halaman login tidak lagi menggeser posisi scroll saat mengetik."],
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-08-06",
    title: "Database model & halaman login hotspot",
    changes: [
      {
        type: "added",
        items: [
          "Branding Mikrosetting pada script hasil generate dan UI.",
          "Panduan deploy ke aaPanel (Node.js + PM2), termasuk `deploy.sh`.",
          "Database model Mikrotik diperluas menjadi 47 entri.",
          "Template halaman login hotspot dengan kustomisasi warna, logo, dan gambar latar.",
          "Paket hotspot lengkap sebagai satu folder (bukan hanya satu file HTML).",
        ],
      },
      {
        type: "changed",
        items: ["Urutan wizard: manajemen user dipindah ke langkah terakhir, firewall default nonaktif."],
      },
      {
        type: "fixed",
        items: [
          "Script hasil generate aman ditempel ulang di router yang sudah pernah dikonfigurasi.",
          "Berhenti mengirim parameter comment= ke menu Mikrotik yang menolaknya.",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-08-05",
    title: "Rilis awal — Setup Mikrotik Baru",
    changes: [
      {
        type: "added",
        items: [
          "Builder Setup Mikrotik Baru (menu pertama) — seluruh proses generate berjalan di browser.",
          "Alur wizard langkah-per-langkah untuk mengisi konfigurasi.",
          "Simpan & muat konfigurasi di penyimpanan browser (localStorage).",
        ],
      },
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;
