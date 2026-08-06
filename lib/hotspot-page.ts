import type { HotspotPageConfig, HotspotPageMode, HotspotTemplateId } from "./types";
import type { ZipEntry } from "./zip";

/**
 * Paket halaman login hotspot RouterOS.
 *
 * Berkas HTML-nya tersimpan di `public/hotspot-templates/` dan diambil oleh
 * browser saat pengguna mengunduh paket, lalu placeholder `{{...}}` diganti
 * nilai dari form. Menambah desain baru cukup menaruh berkas login.html baru
 * di sana dan mendaftarkannya pada TEMPLATES di bawah.
 *
 * Variabel bergaya `$(nama)` diproses oleh router saat halaman disajikan,
 * jadi berkas harus di-upload apa adanya ke folder "hotspot" pada File List.
 * Berkas md5.js bawaan router TIDAK diganti — dipakai mode http-chap.
 */

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export interface HotspotTemplate {
  id: HotspotTemplateId;
  name: string;
  description: string;
  defaultPrimary: string;
  palettes: Record<HotspotPageMode, Palette>;
}

const DARK: Palette = {
  bg: "#0b1220",
  surface: "#111c2e",
  text: "#e7edf7",
  muted: "#8ba0bd",
  border: "#22314a",
};

const LIGHT: Palette = {
  bg: "#eef2f7",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#d8e0ea",
};

export const TEMPLATES: HotspotTemplate[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Kartu login sederhana di tengah layar. Cocok untuk hampir semua kebutuhan.",
    defaultPrimary: "#38bdf8",
    palettes: { gelap: DARK, terang: LIGHT },
  },
  {
    id: "voucher",
    name: "Voucher",
    description: "Bergaya tiket dengan garis sobek. Cocok untuk warnet dan RT/RW Net penjual voucher.",
    defaultPrimary: "#f59e0b",
    palettes: {
      gelap: { ...DARK, bg: "#0f1424", surface: "#161f36" },
      terang: { ...LIGHT, bg: "#fdf4e3" },
    },
  },
  {
    id: "korporat",
    name: "Korporat",
    description: "Dua kolom: identitas usaha di kiri, form login di kanan. Cocok untuk kantor dan hotel.",
    defaultPrimary: "#22c55e",
    palettes: {
      gelap: { ...DARK, bg: "#0a1017", surface: "#101a26" },
      terang: LIGHT,
    },
  },
  {
    id: "gelap",
    name: "Gelap Modern",
    description: "Latar gelap dengan cahaya ambien mengikuti warna tema. Terlihat premium di ponsel.",
    defaultPrimary: "#a78bfa",
    palettes: {
      gelap: { bg: "#07070d", surface: "#12121d", text: "#f1f1f8", muted: "#9b9bb4", border: "#26263a" },
      terang: LIGHT,
    },
  },
];

export function getTemplate(id: HotspotTemplateId): HotspotTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/* ------------------------------------------------------------- renderer */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

/**
 * Mengisi placeholder pada template.
 * - `{{KEY}}`            → nilai
 * - `{{#KEY}}...{{/KEY}}` → tampil hanya bila nilainya terisi
 * - `{{^KEY}}...{{/KEY}}` → tampil hanya bila nilainya kosong
 */
export function renderTemplate(source: string, vars: Record<string, string>): string {
  return source
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, body: string) =>
      vars[key] ? body : "",
    )
    .replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, body: string) =>
      vars[key] ? "" : body,
    )
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** 08123... / +62812... / 62812... → 62812... */
export function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function whatsappLink(value: string): string {
  const number = normalizeWhatsapp(value);
  return number ? `https://wa.me/${number}` : "";
}

/** Nama berkas logo di dalam folder hotspot, mengikuti tipe gambarnya. */
export function logoFileName(dataUrl: string): string {
  const match = /^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp);/i.exec(dataUrl);
  const ext = (match?.[1] ?? "png").toLowerCase();
  return `logo.${ext === "svg+xml" ? "svg" : ext === "jpeg" ? "jpg" : ext}`;
}

export function templateVars(
  page: HotspotPageConfig,
  fallbackTitle: string,
): Record<string, string> {
  const template = getTemplate(page.template);
  const palette = template.palettes[page.mode] ?? template.palettes.gelap;
  const primary = isHexColor(page.primaryColor) ? page.primaryColor.trim() : template.defaultPrimary;
  const link = whatsappLink(page.whatsapp);

  return {
    TITLE: escapeHtml(page.title.trim() || fallbackTitle || "Hotspot"),
    SUBTITLE: escapeHtml(page.subtitle.trim()),
    TERMS: escapeHtml(page.terms.trim()),
    FOOTER: escapeHtml(page.footer.trim()),
    LOGO: page.logoDataUrl ? logoFileName(page.logoDataUrl) : "",
    WA_LINK: link,
    WA_LABEL: escapeHtml(page.whatsappLabel.trim() || "Hubungi admin"),
    PRIMARY: primary,
    BG: palette.bg,
    SURFACE: palette.surface,
    TEXT: palette.text,
    MUTED: palette.muted,
    BORDER: palette.border,
  };
}

/* --------------------------------------------------------- pengambilan */

const SHARED_FILES = ["alogin.html", "status.html", "logout.html", "error.html"];
const cache = new Map<string, string>();

async function fetchTemplateFile(path: string): Promise<string> {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  const response = await fetch(`/hotspot-templates/${path}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat template: ${path} (${response.status})`);
  }
  const text = await response.text();
  cache.set(path, text);
  return text;
}

/** Isi login.html mentah — dipakai juga oleh pratinjau. */
export function fetchLoginTemplate(id: HotspotTemplateId): Promise<string> {
  return fetchTemplateFile(`${id}/login.html`);
}

function readmeText(title: string, page: HotspotPageConfig, logoFile: string): string {
  const template = getTemplate(page.template);
  const link = whatsappLink(page.whatsapp);

  return `PAKET HALAMAN LOGIN HOTSPOT MIKROTIK
====================================
Dibuat oleh Generator Script Mikrotik by Mikrosetting.com
Untuk hotspot: ${title}
Desain        : ${template.name} (${page.mode})

Isi paket:
  login.html   - halaman login utama (mendukung http-pap & http-chap)
  alogin.html  - halaman setelah login berhasil
  status.html  - status pemakaian sesi
  logout.html  - halaman setelah logout
  error.html   - halaman error${logoFile ? `\n  ${logoFile}     - logo yang Anda unggah` : ""}

CARA UPLOAD
-----------
1. Ekstrak file zip ini di komputer Anda.
2. Buka Winbox > menu "Files".
3. Buka folder "hotspot" (folder ini otomatis dibuat setelah script hotspot
   dijalankan di router).
4. Drag & drop seluruh berkas${logoFile ? " (termasuk berkas logo)" : ""} ke dalam folder "hotspot".
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
${
  link
    ? `- Tombol WhatsApp mengarah ke ${link}. Agar bisa dibuka SEBELUM pengguna
  login, domain WhatsApp harus masuk walled garden — rule-nya sudah ikut
  digenerate di script .rsc bagian hotspot.\n`
    : ""
}`;
}

/** Membangun seluruh isi paket zip halaman login. */
export async function buildHotspotPackage(
  page: HotspotPageConfig,
  fallbackTitle: string,
): Promise<ZipEntry[]> {
  const vars = templateVars(page, fallbackTitle);
  const title = page.title.trim() || fallbackTitle || "Hotspot";

  const [login, ...shared] = await Promise.all([
    fetchLoginTemplate(page.template),
    ...SHARED_FILES.map((file) => fetchTemplateFile(`_shared/${file}`)),
  ]);

  const entries: ZipEntry[] = [
    { name: "login.html", content: renderTemplate(login, vars) },
    ...SHARED_FILES.map((file, i) => ({
      name: file,
      content: renderTemplate(shared[i], vars),
    })),
  ];

  const logoFile = page.logoDataUrl ? logoFileName(page.logoDataUrl) : "";
  if (logoFile) {
    entries.push({ name: logoFile, dataUrl: page.logoDataUrl });
  }

  entries.push({ name: "PETUNJUK-UPLOAD.txt", content: readmeText(title, page, logoFile) });
  return entries;
}
