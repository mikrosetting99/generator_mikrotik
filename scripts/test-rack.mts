/**
 * Uji logika simulasi rack: penempatan, ringkasan, peringatan, dan perapian data impor.
 * Jalankan: npx tsx scripts/test-rack.mts
 */
import assert from "node:assert/strict";
import {
  billOfMaterials,
  canPlace,
  deviceAt,
  DEVICE_LIBRARY,
  deviceFromTemplate,
  exampleRack,
  firstFit,
  normalizeRack,
  rackWarnings,
  summarize,
  type RackDevice,
  type RackState,
} from "../lib/rack";

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

const dev = (over: Partial<RackDevice>): RackDevice => ({
  id: Math.random().toString(36),
  name: "X",
  kind: "server",
  u: 1,
  pos: 1,
  watts: 0,
  kg: 0,
  upsWatts: 0,
  depthMm: 300,
  note: "",
  ...over,
});
const rack = (devices: RackDevice[], over: Partial<RackState> = {}): RackState => ({
  name: "T",
  heightU: 12,
  maxKg: 100,
  maxWatts: 1000,
  voltage: 220,
  depthMm: 1000,
  devices,
  ...over,
});

test("kedalaman: tidak muat, kabel sempit, dan muat", () => {
  // rack 600 mm → muat sampai 500 mm
  const r = (depthMm: number, watts = 100) => rackWarnings(...withSummary(rack([dev({ name: "Server dalam", depthMm, watts })], { depthMm: 600 })));
  assert.ok(r(700).some((w) => w.tone === "bad" && /Server dalam lebih dalam dari ruang rack \(500 mm/.test(w.text)));
  assert.ok(r(450).some((w) => w.tone === "warn" && /kabel/.test(w.text)), "sisa 50 mm");
  assert.ok(!r(450, 0).some((w) => /kabel/.test(w.text)), "perangkat pasif tanpa kabel power");
  assert.ok(!r(350).some((w) => /kedalaman|lebih dalam|kabel/.test(w.text)));
});

test("kedalaman: data lama tanpa kedalaman memakai nilai bawaan jenis", () => {
  const r = normalizeRack({ devices: [{ id: "a", kind: "server", u: 1, pos: 1 }, { id: "b", kind: "patch", u: 1, pos: 2, depthMm: 90 }] });
  assert.equal(r.depthMm, 1000);
  assert.equal(r.devices[0].depthMm, 750);
  assert.equal(r.devices[1].depthMm, 90);
  assert.equal(normalizeRack({ depthMm: 99999 }).depthMm, 1500);
  assert.equal(normalizeRack({ depthMm: 10 }).depthMm, 250);
});

test("canPlace: batas rack dan tabrakan", () => {
  const r = rack([dev({ id: "a", u: 2, pos: 5 })]); // menempati U5-6
  assert.ok(canPlace(r, 1, 4));
  assert.ok(canPlace(r, 1, 7));
  assert.ok(!canPlace(r, 1, 5));
  assert.ok(!canPlace(r, 1, 6));
  assert.ok(!canPlace(r, 2, 4), "U4-5 menimpa U5");
  assert.ok(canPlace(r, 2, 5, "a"), "boleh menimpa dirinya sendiri saat dipindah");
  assert.ok(!canPlace(r, 2, 12), "U12-13 keluar rack 12U");
  assert.ok(canPlace(r, 1, 12));
  assert.ok(!canPlace(r, 1, 0));
});

test("firstFit dari bawah dan dari atas", () => {
  const r = rack([dev({ u: 1, pos: 1 }), dev({ u: 1, pos: 12 })]);
  assert.equal(firstFit(r, 2, false), 2);
  assert.equal(firstFit(r, 2, true), 10);
  assert.equal(firstFit(rack([dev({ u: 12, pos: 1 })]), 1, false), null);
});

test("deviceAt", () => {
  const a = dev({ id: "a", u: 3, pos: 4 });
  assert.equal(deviceAt([a], 6)?.id, "a");
  assert.equal(deviceAt([a], 7), undefined);
});

test("templat: UPS dari bawah, switch dari atas", () => {
  const r = rack([]);
  const ups = deviceFromTemplate(r, DEVICE_LIBRARY.find((t) => t.id === "ups-3u")!);
  const sw = deviceFromTemplate(r, DEVICE_LIBRARY.find((t) => t.id === "switch-24")!);
  assert.equal(ups?.pos, 1);
  assert.equal(sw?.pos, 12);
});

test("ringkasan daya, arus, panas, berat, UPS", () => {
  const s = summarize(rack([dev({ u: 2, watts: 440, kg: 20 }), dev({ kind: "ups", u: 2, pos: 3, kg: 25, upsWatts: 1000 })]));
  assert.equal(s.usedU, 4);
  assert.equal(s.freeU, 8);
  assert.equal(s.watts, 440);
  assert.equal(s.amps, 2);
  assert.equal(Math.round(s.btu), 1501);
  assert.equal(s.kg, 45);
  assert.equal(s.upsLoadPct, 44);
});

test("peringatan berat, daya, UPS, dan perangkat berat di atas", () => {
  const over = rackWarnings(...withSummary(rack([dev({ watts: 1200, kg: 150 })])));
  assert.ok(over.some((w) => w.tone === "bad" && /beban maksimal rack/.test(w.text)));
  assert.ok(over.some((w) => w.tone === "bad" && /kapasitas listrik/.test(w.text)));
  assert.ok(over.some((w) => w.tone === "info" && /Belum ada UPS/.test(w.text)));

  const ups = rackWarnings(...withSummary(rack([dev({ watts: 900 }), dev({ kind: "ups", pos: 2, upsWatts: 1000 })])));
  assert.ok(ups.some((w) => w.tone === "warn" && /UPS terbebani 90%/.test(w.text)));

  const high = rackWarnings(...withSummary(rack([dev({ name: "Server berat", kg: 30, pos: 11 })])));
  assert.ok(high.some((w) => /Server berat .* bagian atas/.test(w.text)));
  const low = rackWarnings(...withSummary(rack([dev({ name: "Server berat", kg: 30, pos: 1 })])));
  assert.ok(!low.some((w) => /bagian atas/.test(w.text)));
});

test("normalizeRack membuang perangkat bertabrakan dan di luar rack", () => {
  const r = normalizeRack({
    heightU: 10,
    devices: [
      { id: "a", u: 2, pos: 1, kind: "server" },
      { id: "b", u: 1, pos: 2, kind: "switch" },
      { id: "c", u: 3, pos: 9, kind: "server" },
      { id: "d", u: 1, pos: 10, kind: "aneh", name: "Perangkat X" },
    ],
  });
  assert.deepEqual(r.devices.map((d) => d.id), ["a", "d"]);
  assert.equal(r.devices[1].kind, "other");
  assert.equal(normalizeRack(null).heightU, 42);
  assert.equal(normalizeRack({ heightU: 500 }).heightU, 52);
});

test("contoh rack sah dan daftar perangkat", () => {
  const ex = exampleRack();
  assert.equal(normalizeRack(JSON.parse(JSON.stringify(ex))).devices.length, ex.devices.length, "contoh tidak bertabrakan");
  const bom = billOfMaterials(ex);
  assert.match(bom, /^Rack NOC 1 — 42U/);
  assert.match(bom, /U1-3\s+UPS 3U 3000VA/);
  const s = summarize(ex);
  assert.ok(s.upsLoadPct !== null && s.upsLoadPct < 100, "contoh tidak melebihi UPS");
});

function withSummary(r: RackState): [RackState, ReturnType<typeof summarize>] {
  return [r, summarize(r)];
}

if (!process.exitCode) console.log(`Semua ${passed} uji rack lulus.`);
