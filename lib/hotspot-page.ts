import { accentOn, adjustBrightness, blend, contrastRatio, derivePalette, isHexColor, mix, mutedOn, readableOn, rgba } from "./color";
import { BG_FITS, BG_POSITIONS, type HotspotPageConfig, type HotspotTemplateId, type VoucherPackage } from "./types-hotspot-login";
import type { ZipEntry } from "./zip";

/**
 * Paket halaman login hotspot RouterOS.
 *
 * Strukturnya mengikuti isi folder `hotspot` bawaan RouterOS: seluruh halaman
 * HTML dipakai bersama oleh semua desain, dan yang membedakan tema umumnya
 * hanya `style.css`. Menambah desain cukup menaruh satu style.css di
 * `public/hotspot-templates/<id>/` lalu mendaftarkannya pada TEMPLATES.
 *
 * Desain yang susunannya memang berbeda — bukan sekadar berbeda warna — boleh
 * membawa `login.html` sendiri di folder yang sama dan menandainya dengan
 * `ownLogin`. Halaman lainnya tetap memakai versi bersama.
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
  /** Desain ini memakai login.html miliknya sendiri, bukan versi bersama. */
  ownLogin?: boolean;
}

export const TEMPLATES: HotspotTemplate[] = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Kartu login sederhana di tengah layar. Cocok untuk hampir semua kebutuhan.",
    defaultPrimary: "#2563eb",
    defaultBg: "#eef2f7",
  },
  {
    id: "poster",
    name: "Poster",
    description:
      "Latar foto penuh, nama usaha berukuran besar, dan kartu harga berjajar. Gaya yang lazim dipakai RT/RW Net.",
    defaultPrimary: "#3d93ff",
    defaultBg: "#0e3a7d",
    ownLogin: true,
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
  let out = source;

  // Blok boleh bersarang — misalnya kolom bersyarat di dalam tabel bersyarat.
  // Satu kali jalan hanya menyentuh lapisan terluar, karena penggantian
  // dilanjutkan dari titik sesudah blok yang baru diganti. Karena itu diulang
  // sampai tidak ada lagi yang berubah, dengan batas kedalaman sebagai
  // pengaman.
  for (let depth = 0; depth < 8; depth += 1) {
    const next = out
      .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, body: string) =>
        vars[key] ? body : "",
      )
      .replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key: string, body: string) =>
        vars[key] ? "" : body,
      );
    if (next === out) break;
    out = next;
  }

  return out.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
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

export function formImageFileName(dataUrl: string): string {
  return imageFileName(dataUrl, "form-bg");
}

/**
 * Judul boleh dipecah dua warna dengan tanda "|", misalnya "PRO|NET".
 * Tandanya sendiri tidak pernah ikut tampil.
 */
function plainTitle(title: string): string {
  // Tandanya dibuang, bukan diganti spasi — agar hasilnya sama persis dengan
  // yang terbaca di layar: "PRO|NET" tetap PRONET, "PRO | NET" tetap berjarak.
  return title.replace(/\|/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Spasi di sekitar tanda sengaja dipertahankan apa adanya: "PRO|NET" menyatu
 * menjadi PRONET, sedangkan "PRO | NET" tetap berjarak satu spasi karena HTML
 * merapatkan spasi berlebih sendiri.
 */
function titleHtml(title: string): string {
  const cut = title.indexOf("|");
  const head = cut >= 0 ? title.slice(0, cut) : title;
  const tail = cut >= 0 ? title.slice(cut + 1) : "";
  return (
    `<span class="t1">${escapeHtml(head)}</span>` +
    (tail.trim() ? `<span class="t2">${escapeHtml(tail)}</span>` : "")
  );
}

/** Ikon jam & kalender pada kartu harga desain Poster. */
const ICON_DURATION =
  '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5 V13 L15 15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 2.5 h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_VALIDITY =
  '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10 h18 M8 3 v4 M16 3 v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="7" y="13" width="4" height="3" rx="1" fill="currentColor"/></svg>';

function cardRow(label: string, value: string, icon: string): string {
  return (
    `        <div class="row"><span class="txt">` +
    `<span class="lbl">${escapeHtml(label)}</span>` +
    `<span class="val">${escapeHtml(value)}</span></span>${icon}</div>`
  );
}

/** Satu kartu harga untuk desain Poster. */
function packageCard(pkg: VoucherPackage): string {
  const rows: string[] = [];
  if (pkg.duration.trim()) rows.push(cardRow("Durasi", pkg.duration.trim(), ICON_DURATION));
  if (pkg.validity.trim()) rows.push(cardRow("Masa aktif", pkg.validity.trim(), ICON_VALIDITY));

  const panel =
    rows.length > 0 ? `      <div class="panel">\n${rows.join('\n        <div class="sep"></div>\n')}\n      </div>` : "";

  return (
    `      <div class="card">\n` +
    `        <div class="h">${escapeHtml(pkg.name.trim() || "Harga")}</div>\n` +
    `        <div class="price">${escapeHtml(pkg.price.trim())}</div>\n` +
    (panel ? `${panel}\n` : "") +
    `      </div>`
  );
}

export function templateVars(page: HotspotPageConfig): Record<string, string> {
  const template = getTemplate(page.template);
  const primary = adjustBrightness(
    isHexColor(page.primaryColor) ? page.primaryColor.trim() : template.defaultPrimary,
    Math.max(50, Math.min(150, Number(page.primaryBrightness) || 100)),
  );
  const bgColor = isHexColor(page.bgColor) ? page.bgColor.trim() : template.defaultBg;
  const palette = derivePalette(bgColor, primary);
  // Kartu dipilih dari arah yang paling menjauh dari latar. Menebak lewat
  // "gelap atau terang" saja meleset pada warna mid-tone seperti hijau, yang
  // sama-sama dekat ke putih maupun hitam.
  const cardLight = mix(bgColor, 0.86);
  const cardDark = mix(bgColor, -0.78);
  const card =
    contrastRatio(cardLight, bgColor) >= contrastRatio(cardDark, bgColor) ? cardLight : cardDark;
  const title = page.title.trim();

  // Kartu form: warna sendiri bila dipilih, dan teks/garis/kolomnya dihitung
  // ulang dari warna itu agar tetap terbaca di atas kartu terang maupun gelap.
  const formColor = isHexColor(page.formBgColor ?? "") ? page.formBgColor.trim() : "";
  const rawOpacity = Number(page.formBgOpacity);
  const formOpacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(100, rawOpacity)) : 100;
  const hasFormImage = Boolean(page.formImageDataUrl);
  const baseForm = formColor || palette.surface;
  // Yang terlihat di balik kartu menentukan terbaca-tidaknya teks: kartu
  // tembus pandang menampilkan warna latar halaman, sedangkan bila ada gambar
  // di dalam kartu, lapisan warna kartulah yang menjaga keterbacaan.
  const seen = hasFormImage || formOpacity >= 100 ? baseForm : blend(bgColor, baseForm, formOpacity / 100);
  const customForm = Boolean(formColor) || formOpacity < 100 || hasFormImage;
  const formText = customForm ? readableOn(seen) : palette.text;
  const formIsDark = customForm ? formText !== readableOn("#ffffff") : palette.isDark;
  const formBorder = customForm ? mix(seen, formIsDark ? 0.18 : -0.14) : palette.border;
  const formField = customForm ? rgba(mix(seen, formIsDark ? 0.07 : -0.04), Math.max(formOpacity, 55) / 100) : palette.bg;

  const titleCustom = isHexColor(page.titleColor ?? "") ? page.titleColor.trim() : "";
  const buttonBg = isHexColor(page.buttonColor ?? "") ? page.buttonColor.trim() : primary;

  const marqueeBg = isHexColor(page.marqueeBgColor ?? "") ? page.marqueeBgColor.trim() : "#1e293b";
  const marqueeFg = isHexColor(page.marqueeTextColor ?? "") ? page.marqueeTextColor.trim() : readableOn(marqueeBg);

  const packages = page.packages.filter(
    (p) => p.name.trim() || p.duration.trim() || p.validity.trim() || p.price.trim(),
  );
  // Kolom masa aktif baru ditampilkan bila memang ada yang mengisinya, supaya
  // tabel tidak menyisakan kolom kosong pada pemakaian yang sederhana.
  const anyValidity = packages.some((p) => p.validity.trim());

  const rows = packages.map(
    (p) =>
      `      <tr><td>${escapeHtml(p.name.trim())}</td>` +
      `<td>${escapeHtml(p.duration.trim())}</td>` +
      (anyValidity ? `<td>${escapeHtml(p.validity.trim())}</td>` : "") +
      `<td>${escapeHtml(p.price.trim())}</td></tr>`,
  );

  return {
    // Judul hanya tampil bila diisi — nama/identity router sengaja tidak dipakai.
    TITLE: escapeHtml(plainTitle(title)),
    TITLE_HTML: titleHtml(title),
    PAGE_TITLE: escapeHtml(plainTitle(title) || "Hotspot"),
    SUBTITLE: escapeHtml(page.subtitle.trim()),
    MARQUEE: escapeHtml(page.marquee.trim()),
    // Teks berjalan hanya tampil bila diaktifkan dan ada isinya; letaknya di atas atau di bawah form.
    MARQUEE_BG: marqueeBg,
    MARQUEE_FG: marqueeFg,
    MARQUEE_FG_POSTER: isHexColor(page.marqueeTextColor ?? "") ? page.marqueeTextColor.trim() : "var(--text)",
    MARQUEE_TOP: page.marqueeEnabled !== false && page.marquee.trim() && page.marqueePosition !== "bottom" ? "1" : "",
    MARQUEE_BOTTOM: page.marqueeEnabled !== false && page.marquee.trim() && page.marqueePosition === "bottom" ? "1" : "",
    TERMS: escapeHtml(page.terms.trim()),
    FOOTER: escapeHtml(page.footer.trim()),
    // Footer di dalam kartu form (bawaan) atau di bawah kartu, di luar form.
    FOOTER_INSIDE: page.footer.trim() && page.footerPosition !== "outside" ? "1" : "",
    FOOTER_OUTSIDE: page.footer.trim() && page.footerPosition === "outside" ? "1" : "",
    LOGO: page.logoDataUrl ? logoFileName(page.logoDataUrl) : "",
    // Logo di dalam kartu form (bawaan) atau di atas kartu, di luar form.
    LOGO_INSIDE: page.logoDataUrl && page.logoPosition !== "above" ? "1" : "",
    LOGO_ABOVE: page.logoDataUrl && page.logoPosition === "above" ? "1" : "",
    LOGO_HEIGHT: String(Math.round(Math.max(40, Math.min(260, page.logoHeight || 130)))),
    BG_IMAGE: page.bgImageDataUrl ? bgFileName(page.bgImageDataUrl) : "",
    // Desain Poster dulu selalu "center top" — itu tetap bawaannya.
    BG_POSITION:
      template.id === "poster" && page.bgPosition === "center"
        ? "center top"
        : (BG_POSITIONS.find((p) => p.value === page.bgPosition)?.css ?? "center"),
    BG_SIZE: BG_FITS.find((f) => f.value === page.bgFit)?.css ?? "cover",
    // Mode "utuh + kabur": gambar utuh di tengah, sisanya diisi salinan yang dikaburkan.
    BG_BLUR: page.bgFit === "blur" ? "1" : "",
    OVERLAY: rgba(bgColor, Math.max(0, Math.min(90, page.bgOverlay)) / 100),
    WA_LINK: page.whatsappEnabled === false ? "" : whatsappLink(page.whatsapp),
    WA_LABEL: escapeHtml(page.whatsappLabel.trim() || "Hubungi admin"),
    START_MODE: page.loginMode === "member" ? "member" : "voucher",
    MODE_SWITCH: page.showModeSwitch ? "1" : "",
    TRIAL: page.showTrial ? "1" : "",
    PACKAGES: packages.length > 0 ? "1" : "",
    PACKAGE_VALIDITY: anyValidity ? "1" : "",
    PACKAGE_ROWS: rows.join("\n"),
    PACKAGE_CARDS: packages.map(packageCard).join("\n"),
    PRIMARY: primary,
    PRIMARY_DARK: mix(primary, -0.34),
    ON_PRIMARY: palette.onPrimary,
    FOCUS_RING: rgba(primary, 0.28),
    // Kartu harga desain Poster sengaja melawan arah latar supaya menonjol di
    // atas foto — latar gelap mendapat kartu terang, dan sebaliknya.
    CARD: card,
    ON_CARD: readableOn(card),
    CARD_MUTED: mutedOn(card),
    BG: palette.bg,
    SURFACE: palette.surface,
    FORM_BG: formOpacity < 100 ? rgba(baseForm, formOpacity / 100) : baseForm,
    FORM_WIDTH: String(Math.round(Math.max(300, Math.min(720, Number(page.formWidth) || 390)))),
    FORM_IMAGE: hasFormImage ? formImageFileName(page.formImageDataUrl) : "",
    FORM_TEXT: formText,
    FORM_MUTED: customForm ? mutedOn(seen) : palette.muted,
    FORM_BORDER: formBorder,
    // Warna tema yang terbaca sebagai teks di atas kartu (judul, tautan, harga),
    // dan garis kartu yang diberi semburat warna tema.
    PRIMARY_TEXT: accentOn(seen, primary),
    PRIMARY_LINE: blend(formBorder, primary, 0.55),
    // Warna nama hotspot dan tombol Login: pilihan sendiri, atau otomatis mengikuti tema.
    TITLE_COLOR: titleCustom || accentOn(seen, primary),
    TITLE_T1: titleCustom || "var(--text)",
    TITLE_T2: titleCustom || "var(--primary)",
    BUTTON_BG: buttonBg,
    BUTTON_BG_DARK: mix(buttonBg, -0.34),
    BUTTON_TEXT: readableOn(buttonBg),
    // Garis tepi kartu form: tebal 0–8 px (0 = tanpa garis); warna sendiri bila dipilih.
    FORM_BORDER_WIDTH: String(
      Number.isFinite(Number(page.formBorderWidth))
        ? Math.max(0, Math.min(8, Math.round(Number(page.formBorderWidth))))
        : 1,
    ),
    FORM_BORDER_LINE: isHexColor(page.formBorderColor ?? "")
      ? page.formBorderColor.trim()
      : blend(formBorder, primary, 0.55),
    FORM_FIELD: formField,
    TEXT: palette.text,
    MUTED: palette.muted,
    BORDER: palette.border,
  };
}

/* --------------------------------------------------------- pengambilan */

/** Halaman yang ikut diisi placeholder. login.html bisa ditimpa per desain. */
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

/**
 * Isi login.html mentah milik sebuah desain — dipakai juga oleh pratinjau.
 *
 * Desain bertanda `ownLogin` memakai berkasnya sendiri; sisanya memakai versi
 * bersama. Sengaja dibaca dari penanda, bukan dengan mencoba mengambil berkas
 * lalu menunggu 404 — percobaan yang gagal menyisakan error di konsol browser
 * dan menunda pratinjau tanpa alasan.
 */
export function fetchLoginTemplate(id: HotspotTemplateId): Promise<string> {
  return fetchTemplateFile(getTemplate(id).ownLogin ? `${getTemplate(id).id}/login.html` : "_shared/login.html");
}

/** Isi style.css sebuah desain — dipakai juga oleh pratinjau. */
export function fetchStyle(id: HotspotTemplateId): Promise<string> {
  return fetchTemplateFile(`${getTemplate(id).id}/style.css`);
}

function readmeText(page: HotspotPageConfig, logoFile: string, bgFile: string, formFile: string): string {
  const template = getTemplate(page.template);
  const link = page.whatsappEnabled === false ? "" : whatsappLink(page.whatsapp);

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
  md5.js         dipakai metode autentikasi http-chap${logoFile ? `\n  ${logoFile}       logo yang Anda unggah` : ""}${bgFile ? `\n  ${bgFile}  gambar latar yang Anda unggah` : ""}${formFile ? `\n  ${formFile}  gambar di dalam kartu form yang Anda unggah` : ""}

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
    Promise.all(
      SHARED_PAGES.map((file) =>
        file === "login.html"
          ? fetchLoginTemplate(page.template)
          : fetchTemplateFile(`_shared/${file}`),
      ),
    ),
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

  const formFile = page.formImageDataUrl ? formImageFileName(page.formImageDataUrl) : "";
  if (formFile) {
    entries.push({ name: formFile, dataUrl: page.formImageDataUrl });
  }

  entries.push({ name: "PETUNJUK-UPLOAD.txt", content: readmeText(page, logoFile, bgFile, formFile) });
  return entries;
}
