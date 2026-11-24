/**
 * Uji tombol "Coba gratis" Halaman Login Hotspot.
 * Jalankan: npx tsx scripts/test-hotspot-trial.mts [folder-keluaran-html]
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createDefaultHotspotLoginConfig, normalizeHotspotPage } from "../lib/defaults-hotspot-login";
import { durationLabel, isRosDuration, renderTemplate, templateVars, trialAutoNote, trialCommand } from "../lib/hotspot-page";
import type { HotspotPageConfig, HotspotTemplateId } from "../lib/types-hotspot-login";

const root = join(import.meta.dirname, "..", "public", "hotspot-templates");
const outDir = process.argv[2];

function render(page: HotspotPageConfig) {
  const login = readFileSync(join(root, page.template === "poster" ? "poster/login.html" : "_shared/login.html"), "utf8");
  const style = readFileSync(join(root, page.template, "style.css"), "utf8");
  const vars = templateVars(page);
  const html = renderTemplate(login, vars);
  const css = renderTemplate(style, vars);
  // Versi pratinjau: kondisi router dibuang, seperti buildPreviewHtml.
  const preview = html
    .replace(/<link rel="stylesheet" href="style\.css">/, `<style>${css}</style>`)
    .replace(/\$\(if error\)[\s\S]*?\$\(endif\)/g, "")
    .replace(/\$\(if chap-id\)[\s\S]*?\$\(endif\)/g, "")
    .replace(/\$\(if trial == 'yes'\)/g, "")
    .replace(/\$\(endif\)/g, "")
    .replace(/\$\([^)]*\)/g, "");
  return { html, css, preview };
}

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed += 1;
  console.log(`ok   ${name}`);
};

test("bawaan mati: tidak ada tombol coba gratis", () => {
  const page = createDefaultHotspotLoginConfig();
  assert.equal(page.showTrial, false);
  for (const t of ["minimal", "poster"] as HotspotTemplateId[]) {
    assert.ok(!render({ ...page, template: t }).html.includes("trialbtn"), t);
  }
  // Simpanan lama tanpa kolom trial tetap terbaca dengan bawaan.
  const old = normalizeHotspotPage({ title: "Lama", showTrial: true });
  assert.equal(old.showTrial, true);
  assert.equal(old.trialUptime, "30m");
  assert.equal(old.trialReset, "1d");
});

for (const t of ["minimal", "poster"] as HotspotTemplateId[]) {
  test(`${t}: tombol aktif, dibungkus kondisi trial router, link login trial`, () => {
    const page = { ...createDefaultHotspotLoginConfig(), template: t, title: "Warung Kopi", showTrial: true };
    const { html, css, preview } = render(page);
    assert.equal(html.match(/class="trialbtn"/g)?.length, 1);
    const at = html.indexOf('class="trialbtn"');
    assert.ok(html.lastIndexOf("$(if trial == 'yes')", at) > html.lastIndexOf("$(endif)", at), "harus di dalam $(if trial == 'yes')");
    assert.match(html, /href="\$\(link-login-only\)\?dst=\$\(link-orig-esc\)&amp;username=T-\$\(mac-esc\)"/);
    assert.match(html, /<span class="tl">Coba gratis<\/span>/);
    assert.match(html, /<span class="tn">Gratis 30 menit, sekali per hari<\/span>/);
    assert.match(css, /\.trialbtn \{/);
    assert.ok(!html.includes("{{") && !css.includes("{{"));
    if (outDir) writeFileSync(join(outDir, `trial-${t}.html`), preview);
  });
}

test("tulisan & keterangan sendiri di-escape, $( tidak dibaca router", () => {
  const { html } = render({ ...createDefaultHotspotLoginConfig(), showTrial: true, trialLabel: "<b>Gratis</b> $(x)", trialNote: "15 menit" });
  assert.match(html, /&lt;b&gt;Gratis&lt;\/b&gt; \$ \(x\)/);
  assert.match(html, /<span class="tn">15 menit<\/span>/);
});

test("format waktu RouterOS dan keterangan otomatis", () => {
  assert.ok(isRosDuration("45m") && isRosDuration("1h30m") && isRosDuration("1d"));
  assert.ok(!isRosDuration("30") && !isRosDuration("1 jam") && !isRosDuration(""));
  assert.equal(durationLabel("1h30m"), "1 jam 30 menit");
  const base = { ...createDefaultHotspotLoginConfig(), showTrial: true };
  assert.equal(trialAutoNote({ ...base, trialUptime: "1h", trialReset: "7d" }), "Gratis 1 jam, sekali per minggu");
  assert.equal(trialAutoNote({ ...base, trialUptime: "15m", trialReset: "12h" }), "Gratis 15 menit, sekali tiap 12 jam");
  // Isian tidak valid kembali ke bawaan, tidak pernah masuk ke perintah router.
  assert.equal(trialAutoNote({ ...base, trialUptime: "abc", trialReset: "" }), "Gratis 30 menit, sekali per hari");
});

test("perintah router: login-by memuat trial, lama & jeda sesuai isian", () => {
  const cmd = trialCommand({ ...createDefaultHotspotLoginConfig(), trialUptime: "15m", trialReset: "12h" });
  assert.equal(
    cmd,
    '/ip hotspot profile set [find where name~"hsprof"] login-by=http-chap,http-pap,trial trial-uptime-limit=15m trial-uptime-reset=12h trial-user-profile=default',
  );
  assert.ok(!trialCommand({ ...createDefaultHotspotLoginConfig(), trialUptime: "1m; /system reset" }).includes("reset-configuration"));
  assert.match(trialCommand({ ...createDefaultHotspotLoginConfig(), trialUptime: "1m; /system reboot" }), /trial-uptime-limit=30m /);
});

console.log(`\n${passed} tes coba gratis lolos`);
