import { derivePalette, isHexColor, rgba } from "./color";
import type { HotspotPageConfig, HotspotTemplateId } from "./types";
import type { ZipEntry } from "./zip";

/**
 * Paket halaman login hotspot RouterOS.
 *
 * Strukturnya mengikuti isi folder `hotspot` bawaan RouterOS: seluruh halaman
 * HTML dipakai bersama oleh semua desain, dan yang membedakan tema hanyalah
 * `style.css`. Menambah desain baru cukup menaruh satu style.css di
 * `public/hotspot-templates/<id>/` lalu mendaftarkannya pada TEMPLATES.
 *
 * Variabel bergaya `$(nama)` diproses router saat halaman disajikan, jadi
 * berkas harus di-upload apa adanya ke folder "hotspot" pada File List.
 */

export { isHexColor };

export interface HotspotTemplate {
  id: HotspotTemplateId;
  name: string;
  description: string;
  defaultPrimary: string;
  defaultBg: string;
}

export const TEMPLATES: HotspotTemplate[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Kartu login sederhana di tengah layar. Cocok untuk hampir semua kebutuhan.",
    defaultPrimary: "#2563eb",
    defaultBg: "#ffffff",
  },
  {
    id: "voucher",
    name: "Voucher",
    description: "Bergaya tiket dengan kepala berwarna. Cocok untuk warnet dan RT/RW Net.",
    defaultPrimary: "#f59e0b",
    defaultBg: "#ffffff",
  },
  {
    id: "korporat",
    name: "Korporat",
    description: "Dua kolom di layar lebar: identitas usaha di kiri, form login di kanan.",
    defaultPrimary: "#2563eb",
    defaultBg: "#ffffff",
  },
  {
    id: "gelap",
    name: "Gelap Modern",
    description: "Kartu mengambang dengan cahaya ambien mengikuti warna tema.",
    defaultPrimary: "#a78bfa",
    defaultBg: "#07070d",
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

/**
 * Mengisi placeholder pada template.
 * - `{{KEY}}`             → nilai
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

/** Nama berkas gambar di dalam folder hotspot, mengikuti tipe berkasnya. */
export function imageFileName(dataUrl: string, base: string): string {
  const match = /^data:image\/(png|jpeg|jpg|gif|svg\+xml|webp);/i.exec(dataUrl);
  const ext = (match?.[1] ?? "png").toLowerCase();
  return `${base}.${ext === "svg+xml" ? "svg" : ext === "jpeg" ? "jpg" : ext}`;
}

export function logoFileName(dataUrl: string): string {
  return imageFileName(dataUrl, "logo");
}

export function bgFileName(dataUrl: string): string {
  return imageFileName(dataUrl, "background");
}

export function templateVars(page: HotspotPageConfig): Record<string, string> {
  const template = getTemplate(page.template);
  const primary = isHexColor(page.primaryColor) ? page.primaryColor.trim() : template.defaultPrimary;
  const bgColor = isHexColor(page.bgColor) ? page.bgColor.trim() : template.defaultBg;
  const palette = derivePalette(bgColor, primary);
  const title = page.title.trim();

  const rows = page.packages
    .filter((p) => p.name.trim() || p.duration.trim() || p.price.trim())
    .map(
      (p) =>
        `      <tr><td>${escapeHtml(p.name.trim())}</td>` +
        `<td>${escapeHtml(p.duration.trim())}</td>` +
        `<td>${escapeHtml(p.price.trim())}</td></tr>`,
    );

  return {
    // Judul hanya tampil bila diisi — nama/identity router sengaja tidak dipakai.
    TITLE: escapeHtml(title),
    PAGE_TITLE: escapeHtml(title || "Hotspot"),
    SUBTITLE: escapeHtml(page.subtitle.trim()),
    MARQUEE: escapeHtml(page.marquee.trim()),
    TERMS: escapeHtml(page.terms.trim()),
    FOOTER: escapeHtml(page.footer.trim()),
    LOGO: page.logoDataUrl ? logoFileName(page.logoDataUrl) : "",
    LOGO_HEIGHT: String(Math.round(Math.max(40, Math.min(260, page.logoHeight || 130)))),
    BG_IMAGE: page.bgImageDataUrl ? bgFileName(page.bgImageDataUrl) : "",
    OVERLAY: rgba(bgColor, Math.max(0, Math.min(90, page.bgOverlay)) / 100),
    WA_LINK: whatsappLink(page.whatsapp),
    WA_LABEL: escapeHtml(page.whatsappLabel.trim() || "Hubungi admin"),
    START_MODE: page.loginMode === "member" ? "member" : "voucher",
    MODE_SWITCH: page.showModeSwitch ? "1" : "",
    TRIAL: page.showTrial ? "1" : "",
    PACKAGES: rows.length > 0 ? "1" : "",
    PACKAGE_ROWS: rows.join("\n"),
    PRIMARY: primary,
    ON_PRIMARY: palette.onPrimary,
    FOCUS_RING: rgba(primary, 0.28),
    BG: palette.bg,
    SURFACE: palette.surface,
    TEXT: palette.text,
    MUTED: palette.muted,
    BORDER: palette.border,
  };
}

/* --------------------------------------------------------- pengambilan */

/** Halaman yang dipakai bersama semua desain, ikut diisi placeholder. */
const SHARED_PAGES = [
  "login.html",
  "alogin.html",
  "status.html",
  "logout.html",
  "error.html",
  "rlogin.html",
  "redirect.html",
  "radvert.html",
];

/** Berkas yang disalin apa adanya tanpa substitusi. */
const VERBATIM_FILES = ["md5.js", "errors.txt"];

const cache = new Map<string, string>();

async function fetchTemplateFile(path: string): Promise<string> {
  const cached = cache.get(path);
  if (cached !== undefined) return cached;

  const response = await fetch(`/hotspot-templates/${path}`);
  if (!response.ok) {
    throw new Error(`Gagal memuat berkas template: ${path} (${response.status})`);
  }
  const text = await response.text();
  cache.set(path, text);
  return text;
}

/** Isi login.html mentah — dipakai juga oleh pratinjau. */
export function fetchLoginTemplate(): Promise<string> {
  return fetchTemplateFile("_shared/login.html");
}

/** Isi style.css sebuah desain — dipakai juga oleh pratinjau. */
export function fetchStyle(id: HotspotTemplateId): Promise<string> {
  return fetchTemplateFile(`${id}/style.css`);
}

function readmeText(page: HotspotPageConfig, logoFile: string, bgFile: string): string {
  const template = getTemplate(page.template);
  const link = whatsappLink(page.whatsapp);

  return `PAKET HALAMAN LOGIN HOTSPOT MIKROTIK
====================================
Dibuat oleh Generator Script Mikrotik by Mikrosetting.com
Untuk hotspot : ${page.title.trim() || "(tanpa nama)"}
Desain        : ${template.name}
Mode awal     : ${page.loginMode === "member" ? "Member" : "Voucher"}

ISI PAKET
---------
  login.html     halaman login (mode voucher & member, http-pap + http-chap)
  alogin.html    halaman setelah login berhasil
  status.html    status pemakaian: kuota, sisa waktu, MAC, tombol logout
  logout.html    halaman setelah logout
  error.html     halaman error
  rlogin.html    pemicu pengalihan ke halaman login
  redirect.html  pengalihan setelah login
  radvert.html   halaman advertisement
  errors.txt     teks pesan error berbahasa Indonesia
  style.css      seluruh tampilan & warna — cukup berkas ini yang diubah
  md5.js         dipakai metode autentikasi http-chap${logoFile ? `\n  ${logoFile}       logo yang Anda unggah` : ""}${bgFile ? `\n  ${bgFile}  gambar latar yang Anda unggah` : ""}

CARA UPLOAD
-----------
1. Ekstrak file zip ini di komputer Anda.
2. Buka Winbox > menu "Files".
3. Buka folder "hotspot" (otomatis dibuat setelah script hotspot dijalankan).
4. Sebelum menimpa, salin dulu folder "hotspot" sebagai cadangan: drag folder
   tersebut dari Files ke komputer Anda.
5. Drag & drop SELURUH berkas di paket ini ke dalam folder "hotspot".
   Bila muncul konfirmasi menimpa berkas lama, pilih ya.
6. Buka browser dari perangkat klien. Tekan Ctrl+F5 bila masih tampil halaman
   lama karena cache browser.

CATATAN
-------
- Berkas bawaan yang tidak ada di paket ini (lv/, xml/, img/, flogin.html)
  biarkan apa adanya — tidak mengganggu.
- Kode $(...) di dalam berkas HTML adalah variabel RouterOS. Jangan diubah
  atau dihapus bila tidak paham fungsinya.
- Ingin mengubah warna belakangan? Cukup edit bagian :root di style.css.
- Mode voucher menyembunyikan kolom password dan mengisinya otomatis sama
  dengan kode voucher, jadi pengguna cukup memasukkan satu kode.
${
  link
    ? `- Tombol WhatsApp mengarah ke ${link}. Agar bisa dibuka SEBELUM pengguna
  login, domain WhatsApp harus masuk walled garden — rule-nya sudah ikut
  digenerate di script .rsc bagian hotspot.\n`
    : ""
}`;
}

/** Membangun seluruh isi paket zip halaman login. */
export async function buildHotspotPackage(page: HotspotPageConfig): Promise<ZipEntry[]> {
  const vars = templateVars(page);

  const [pages, style, verbatim] = await Promise.all([
    Promise.all(SHARED_PAGES.map((file) => fetchTemplateFile(`_shared/${file}`))),
    fetchStyle(page.template),
    Promise.all(VERBATIM_FILES.map((file) => fetchTemplateFile(`_shared/${file}`))),
  ]);

  const entries: ZipEntry[] = [
    ...SHARED_PAGES.map((file, i) => ({ name: file, content: renderTemplate(pages[i], vars) })),
    { name: "style.css", content: renderTemplate(style, vars) },
    ...VERBATIM_FILES.map((file, i) => ({ name: file, content: verbatim[i] })),
  ];

  const logoFile = page.logoDataUrl ? logoFileName(page.logoDataUrl) : "";
  if (logoFile) {
    entries.push({ name: logoFile, dataUrl: page.logoDataUrl });
  }

  const bgFile = page.bgImageDataUrl ? bgFileName(page.bgImageDataUrl) : "";
  if (bgFile) {
    entries.push({ name: bgFile, dataUrl: page.bgImageDataUrl });
  }

  entries.push({ name: "PETUNJUK-UPLOAD.txt", content: readmeText(page, logoFile, bgFile) });
  return entries;
}
