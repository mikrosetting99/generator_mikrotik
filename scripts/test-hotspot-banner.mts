/**
 * Uji banner Halaman Login Hotspot: letak, ukuran, dan berkas di dalam paket.
 * Jalankan: npx tsx scripts/test-hotspot-banner.mts [folder-keluaran-html]
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDefaultHotspotLoginConfig, normalizeHotspotPage } from "../lib/defaults-hotspot-login";
import { bannerFileName, renderTemplate, templateVars } from "../lib/hotspot-page";
import type { BannerPosition, HotspotPageConfig, HotspotTemplateId } from "../lib/types-hotspot-login";

const root = join(import.meta.dirname, "..", "public", "hotspot-templates");
const outDir = process.argv[2];
// Banner contoh 3:1 berwarna, sebagai SVG data URI.
const BANNER =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="1200" height="400" fill="#f97316"/><text x="600" y="230" font-size="120" text-anchor="middle" fill="#fff" font-family="sans-serif">PROMO 50%</text></svg>',
  ).toString("base64");

function render(page: HotspotPageConfig) {
  const login = readFileSync(join(root, page.template === "poster" ? "poster/login.html" : "_shared/login.html"), "utf8");
  const style = readFileSync(join(root, page.template, "style.css"), "utf8");
  const vars = { ...templateVars(page), LOGO: page.logoDataUrl, BG_IMAGE: page.bgImageDataUrl, FORM_IMAGE: page.formImageDataUrl, BANNER: page.bannerDataUrl };
  return {
    html: renderTemplate(login, vars).replace(/<link rel="stylesheet" href="style\.css">/, `<style>${renderTemplate(style, vars)}</style>`).replace(/\$\([^)]*\)/g, ""),
    pkgHtml: renderTemplate(login, templateVars(page)),
    css: renderTemplate(style, templateVars(page)),
  };
}

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok   ${name}`);
};

test("tanpa banner: tidak ada elemen maupun CSS banner", () => {
  for (const t of ["minimal", "poster"] as HotspotTemplateId[]) {
    const { pkgHtml, css } = render({ ...createDefaultHotspotLoginConfig(), template: t });
    assert.ok(!pkgHtml.includes('class="banner'), t);
    assert.ok(!css.includes(".banner"), t);
    assert.ok(!pkgHtml.includes("{{") && !css.includes("{{"), `${t}: placeholder tersisa`);
  }
});

for (const t of ["minimal", "poster"] as HotspotTemplateId[]) {
  for (const pos of ["above", "top", "bottom"] as BannerPosition[]) {
    test(`${t} · ${pos}: tepat satu banner di tempatnya`, () => {
      const page = { ...createDefaultHotspotLoginConfig(), template: t, title: "Warung Kopi", whatsapp: "081234567890", bannerDataUrl: BANNER, bannerPosition: pos, bannerHeight: pos === "bottom" ? 120 : 0, bannerWidth: pos === "above" ? 80 : 100 };
      const { html, pkgHtml, css } = render(page);
      assert.equal(pkgHtml.match(/class="banner /g)?.length, 1);
      assert.ok(pkgHtml.includes(`class="banner banner-${pos}" src="banner.svg"`));
      const at = pkgHtml.indexOf('class="banner ');
      const brand = pkgHtml.indexOf('class="box brandbox"');
      const login = pkgHtml.indexOf('name="login"');
      if (pos === "above") assert.ok(at < brand);
      if (pos === "top") assert.ok(at > brand && at < login);
      if (pos === "bottom") assert.ok(at > login);
      assert.match(css, new RegExp(`width: ${page.bannerWidth}%`));
      assert.match(css, pos === "bottom" ? /height: 120px/ : /height: auto/);
      assert.ok(!pkgHtml.includes("{{") && !css.includes("{{"));
      if (outDir) writeFileSync(join(outDir, `banner-${t}-${pos}.html`), html);
    });
  }
}

test("Minimal: logo dan banner sama-sama di atas form berada di satu baris .above", () => {
  const { pkgHtml } = render({ ...createDefaultHotspotLoginConfig(), logoDataUrl: BANNER, logoPosition: "above", bannerDataUrl: BANNER, bannerPosition: "above" });
  assert.equal(pkgHtml.match(/class="above"/g)?.length, 1);
  const block = pkgHtml.slice(pkgHtml.indexOf('class="above"'), pkgHtml.indexOf('id="main"'));
  assert.ok(block.includes("logo-above") && block.includes("banner-above"));
});

test("nilai di luar batas dirapikan; simpanan lama tanpa banner tetap terbaca", () => {
  const v = templateVars({ ...createDefaultHotspotLoginConfig(), bannerDataUrl: BANNER, bannerWidth: 5, bannerHeight: 9999, bannerRadius: -3 });
  assert.equal(v.BANNER_WIDTH, "30");
  assert.equal(v.BANNER_HEIGHT, "400px");
  assert.equal(v.BANNER_RADIUS, "0");
  const old = normalizeHotspotPage({ title: "Lama", template: "poster" });
  assert.equal(old.bannerDataUrl, "");
  assert.equal(old.bannerPosition, "top");
  assert.equal(bannerFileName("data:image/jpeg;base64,xx"), "banner.jpg");
});

console.log(`\n${passed} tes banner lolos`);
