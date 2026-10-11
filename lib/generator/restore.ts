/**
 * Kepala untuk file .rsc yang diunduh, berisi cara memulihkan (restore) konfigurasi
 * dari file itu di router. Hanya ada di file unduhan — tampilan script di layar
 * tidak berubah.
 *
 * File .backup asli RouterOS berformat biner milik router dan hanya bisa dibuat
 * oleh RouterOS sendiri; export teks (.rsc) adalah format yang bisa dibuat di sini
 * dan dipulihkan dengan /import.
 */
export function restoreHeader(fileName: string): string {
  const name = fileName.replace(/[^\w.\-]/g, "_");
  return [
    "# ==============================================================",
    `# FILE RESTORE MIKROTIK  -  ${name}`,
    "# Format .rsc (teks RouterOS), dibuat oleh Generator Script Mikrotik.",
    "#",
    "# CARA RESTORE",
    "#  1. Winbox > Files > Upload, pilih file ini (atau drag & drop).",
    "#  2. Buka New Terminal, lalu jalankan:",
    `#       /import file-name=${name} verbose=yes`,
    "#     Perintah di dalamnya hanya menambah, jadi aman dijalankan ulang.",
    "#",
    "# RESTORE TOTAL (router dikembalikan bersih lalu langsung diisi file ini)",
    "#     MEMUTUS KONEKSI - jalankan sendiri dari konsol/Winbox MAC:",
    `#       /system reset-configuration no-defaults=yes skip-backup=yes run-after-reset=${name}`,
    "#",
    "# SETELAH BERHASIL - simpan sebagai file .backup asli milik router:",
    `#       /system backup save name=${name.replace(/\.rsc$/i, "")}`,
    "# ==============================================================",
    "",
    "",
  ].join("\n");
}