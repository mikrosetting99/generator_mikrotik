/**
 * Uji hitungan pemakaian modul per hari (Dashboard Admin).
 * Jalankan: npx tsx scripts/test-usage-stats.mts
 */
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { buildUsageStats, lastDays, shortDate, USAGE_DAYS, wibDay } from "../lib/usage-stats";

// tsx memakai JSX klasik (tsconfig jsx: preserve), jadi komponen butuh React global
(globalThis as { React?: typeof React }).React = React;
const { DailyBars, Sparkline } = await import("../components/admin/UsageCharts");
const { createElement } = React;

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`GAGAL: ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

test("tanggal WIB, bukan UTC", () => {
  // 18:30 UTC = 01:30 WIB keesokan harinya
  assert.equal(wibDay(new Date("2026-11-13T18:30:00Z")), "2026-11-14");
  assert.equal(wibDay(new Date("2026-11-13T16:59:00Z")), "2026-11-13");
});

test("lastDays melewati batas bulan dan tahun", () => {
  assert.deepEqual(lastDays(3, "2026-03-01"), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.deepEqual(lastDays(2, "2027-01-01"), ["2026-12-31", "2027-01-01"]);
  assert.equal(lastDays(USAGE_DAYS, "2026-11-14").length, 30);
});

test("ringkasan hari ini, 7 hari, 30 hari, dan total per hari", () => {
  const s = buildUsageStats(
    [
      { menuId: "setup", day: "2026-11-14", count: 5 },
      { menuId: "setup", day: "2026-11-10", count: 3 },
      { menuId: "setup", day: "2026-10-20", count: 2 },
      { menuId: "setup", day: "2026-09-01", count: 100 }, // di luar 30 hari
      { menuId: "cek", day: "2026-11-08", count: 4 }, // tepat 7 hari termasuk hari ini
      { menuId: "cek", day: "2026-11-07", count: 1 }, // hari ke-8
    ],
    "2026-11-14",
    "2026-09-01",
  );
  assert.deepEqual(
    { today: s.perMenu.setup.today, d7: s.perMenu.setup.d7, d30: s.perMenu.setup.d30 },
    { today: 5, d7: 8, d30: 10 },
  );
  assert.equal(s.perMenu.cek.d7, 4);
  assert.equal(s.perMenu.cek.d30, 5);
  assert.equal(s.today, 5);
  assert.equal(s.d7, 12);
  assert.equal(s.d30, 15);
  assert.equal(s.totals.at(-1), 5);
  assert.equal(s.days.at(-1), "2026-11-14");
  assert.equal(s.since, "2026-09-01");
  assert.equal(buildUsageStats([], "2026-11-14").d30, 0);
});

test("grafik dirender tanpa error, tooltip per hari", () => {
  const s = buildUsageStats([{ menuId: "setup", day: "2026-11-14", count: 7 }], "2026-11-14");
  const bars = renderToStaticMarkup(createElement(DailyBars, { days: s.days, values: s.totals, label: "x" }));
  assert.match(bars, /<title>14 Nov: 7× dibuka<\/title>/);
  assert.equal((bars.match(/<title>/g) ?? []).length, 30);
  assert.ok(!/NaN/.test(bars));
  const empty = renderToStaticMarkup(createElement(DailyBars, { days: s.days, values: s.days.map(() => 0), label: "x" }));
  assert.ok(!/NaN/.test(empty));
  assert.match(renderToStaticMarkup(createElement(Sparkline, { values: s.perMenu.setup.series, label: "y" })), /polyline/);
  assert.match(renderToStaticMarkup(createElement(Sparkline, { values: [], label: "y" })), /—/);
  assert.equal(shortDate("2026-11-14"), "14 Nov");
});

if (!process.exitCode) console.log(`Semua ${passed} uji pemakaian modul lulus.`);
