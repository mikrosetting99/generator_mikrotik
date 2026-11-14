/**
 * Uji Network Monitoring Tahap 1 tanpa database dan tanpa router fisik:
 *  - aturan Analisa (CPU tinggi, WAN down, PPPoE turun, tidak terjangkau, API gagal) dan pemulihannya
 *  - trafik dari selisih counter (reset, reboot, celah)
 *  - status perangkat (kedaluwarsa, collector terputus, WAN belum terverifikasi)
 *  - alur collector ujung-ke-ujung melawan router tiruan yang berbicara protokol RouterOS API (TCP)
 *  - klaim paralel & temuan ganda, pemisahan data antartenant, kredensial tidak bocor
 * Jalankan: npx tsx scripts/test-nm.mts
 */
import assert from "node:assert/strict";
import net from "node:net";
import { encodeSentence, takeSentence, checkCertificate, normFingerprint } from "../lib/routeros-api";
import { counterRate, parseUptime } from "../lib/nm/traffic";
import { evaluate, findingKey, coversWindow } from "../lib/nm/rules";
import { buildDeviceView, staleAfterMs } from "../lib/nm/status";
import { DEFAULT_RULES, normalizeRules, type Sample } from "../lib/nm/types";
import { MemoryStore } from "../lib/nm/store-memory";
import { blankResult, pollDevice, runCycle, type CollectorDevice } from "../lib/nm/collector";
import { pollMikrotik } from "../lib/nm/poller";
import { checkPort, inCidrs, parseCidrs, resolveAllowedTarget } from "../lib/nm/allow";

process.env.VPN_SECRET ||= "uji-lokal-saja";
const { parseDeviceInput } = await import("../lib/nm/server");

let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
  } catch (e) {
    failures.push(`GAGAL: ${name}\n  ${(e as Error).stack?.split("\n").slice(0, 3).join("\n  ")}`);
  }
}

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 14, 3, 0, 0);
const base = (at: number, over: Partial<Sample> = {}): Sample => ({
  at,
  reachable: true,
  apiOk: true,
  cpu: 10,
  memPct: 40,
  uptimeSec: 1000 + (at - T0) / 1000,
  ppp: 100,
  hotspot: null,
  wan: [{ name: "ether1", found: true, running: true, disabled: false, rxByte: 0, txByte: 0, rxBps: 0, txBps: 0 }],
  error: "",
  ...over,
});
const series = (n: number, f: (i: number) => Partial<Sample>, start = T0) => Array.from({ length: n }, (_, i) => base(start + i * MIN, f(i)));
const ev = (samples: Sample[], active: Parameters<typeof evaluate>[0]["active"] = [], over: Partial<Parameters<typeof evaluate>[0]> = {}) =>
  evaluate({ deviceId: "d1", deviceName: "RB-Pusat", cfg: DEFAULT_RULES, intervalSec: 60, wanNames: ["ether1"], samples, active, now: samples[samples.length - 1].at + 1000, ...over });
const wan = (running: boolean) => [{ name: "ether1", found: true, running, disabled: false, rxByte: 0, txByte: 0, rxBps: 0, txBps: 0 }];

/* ------------------------------------------------------------------ trafik */

await test("counter: selisih normal → bit/detik", () => {
  assert.deepEqual(counterRate({ at: 0, uptimeSec: 100, byte: 1000 }, { at: 60_000, uptimeSec: 160, byte: 1000 + 7_500_000 }, 180_000), { bps: 1_000_000 });
});
await test("counter: reset, reboot, celah, dan sampel pertama tidak membuat lonjakan", () => {
  assert.equal(counterRate({ at: 0, uptimeSec: 100, byte: 9e9 }, { at: 60_000, uptimeSec: 160, byte: 5000 }, 180_000).gap, "reset");
  assert.equal(counterRate({ at: 0, uptimeSec: 9000, byte: 100 }, { at: 60_000, uptimeSec: 40, byte: 900 }, 180_000).gap, "reboot");
  assert.equal(counterRate({ at: 0, uptimeSec: 100, byte: 100 }, { at: 600_000, uptimeSec: 700, byte: 900 }, 180_000).gap, "stale");
  assert.equal(counterRate(null, { at: 1, uptimeSec: 1, byte: 1 }, 180_000).gap, "first");
  assert.equal(counterRate({ at: 0, uptimeSec: 1, byte: 0 }, { at: 1000, uptimeSec: 2, byte: 1e12 }, 180_000).gap, "implausible");
});
await test("uptime RouterOS v6/v7", () => {
  assert.equal(parseUptime("1w2d3h4m5s"), 604800 + 2 * 86400 + 3 * 3600 + 245);
  assert.equal(parseUptime("5d01:02:03"), 5 * 86400 + 3723);
  assert.equal(parseUptime("45s"), 45);
  assert.equal(parseUptime(""), null);
});

/* ----------------------------------------------------------------- aturan */

await test("CPU tinggi: butuh sampel yang mencakup 5 menit penuh", () => {
  assert.equal(ev(series(5, () => ({ cpu: 95 }))).open.length, 0, "4 menit belum cukup");
  const r = ev(series(6, () => ({ cpu: 95 })));
  assert.equal(r.open.length, 1);
  assert.equal(r.open[0].rule, "cpu_high");
  assert.match(r.open[0].triggerValue, /95–95%.*6 sampel.*ambang 90%/);
  assert.equal(r.open[0].evidence.samples.length, 6);
  assert.equal(r.open[0].startedAt, T0);
});
await test("CPU tinggi: satu sampel di bawah ambang atau celah data membatalkan", () => {
  assert.equal(ev(series(6, (i) => ({ cpu: i === 3 ? 80 : 95 }))).open.length, 0);
  const gap = series(6, () => ({ cpu: 95 })).filter((_, i) => i !== 2 && i !== 3);
  assert.equal(ev(gap).open.length, 0, "celah 3 menit");
  assert.equal(coversWindow(gap, 5 * MIN, MIN), false);
});
await test("CPU tinggi: sampel kedaluwarsa tidak membuka maupun memulihkan", () => {
  const s = series(6, () => ({ cpu: 95 }));
  assert.equal(ev(s, [], { now: s[5].at + 10 * MIN }).open.length, 0);
});
await test("CPU tinggi: pulih saat sampel baru ≤ ambang", () => {
  const s = series(7, (i) => ({ cpu: i < 6 ? 95 : 40 }));
  const key = findingKey("d1", "cpu_high");
  const r = ev(s, [{ key, rule: "cpu_high", subject: "", startedAt: T0, evidence: { unit: "%", samples: [] } }]);
  assert.deepEqual(r.resolve.map((x) => x.key), [key]);
  assert.match(r.resolve[0].recovery, /CPU turun ke 40%/);
});
await test("WAN down: 3 pemeriksaan berturut-turut; dua belum cukup", () => {
  assert.equal(ev(series(4, (i) => ({ wan: wan(i < 2) }))).open.length, 0);
  const r = ev(series(5, (i) => ({ wan: wan(i < 2) })));
  assert.equal(r.open.length, 1);
  assert.equal(r.open[0].subject, "ether1");
  assert.equal(r.open[0].startedAt, T0 + 2 * MIN);
});
await test("WAN down: router tidak terjangkau di tengah memutus deret dan tidak dihitung down", () => {
  const s = series(5, (i) => (i === 3 ? { reachable: false, apiOk: false, wan: null, cpu: null, ppp: null } : { wan: wan(i < 2) }));
  assert.equal(ev(s).open.filter((f) => f.rule === "wan_down").length, 0);
});
await test("WAN down: tetap aktif saat router tidak terjangkau (belum terverifikasi), pulih saat up", () => {
  const key = findingKey("d1", "wan_down", "ether1");
  const act = [{ key, rule: "wan_down" as const, subject: "ether1", startedAt: T0, evidence: { unit: "status", samples: [] } }];
  const off = ev(series(3, () => ({ reachable: false, apiOk: false, wan: null, cpu: null, ppp: null })), act);
  assert.equal(off.resolve.length, 0);
  assert.ok(off.touch.includes(key));
  assert.deepEqual(ev(series(1, () => ({ wan: wan(true) })), act).resolve.map((x) => x.key), [key]);
});
await test("WAN yang dihapus dari pemantauan menutup temuannya", () => {
  const key = findingKey("d1", "wan_down", "ether9");
  const r = ev(series(1, () => ({})), [{ key, rule: "wan_down", subject: "ether9", startedAt: T0, evidence: { unit: "status", samples: [] } }]);
  assert.match(r.resolve.find((x) => x.key === key)!.recovery, /tidak lagi dipantau/);
});
await test("PPPoE turun >20% dalam 5 menit dengan minimal 20 sesi awal", () => {
  const r = ev(series(6, (i) => ({ ppp: i < 5 ? 100 : 75 })));
  assert.equal(r.open.length, 1);
  assert.equal(r.open[0].evidence.baseline, 100);
  assert.match(r.open[0].triggerValue, /100 → 75 sesi \(turun 25%/);
  assert.equal(ev(series(6, (i) => ({ ppp: i < 5 ? 100 : 80 }))).open.length, 0, "tepat 20% bukan 'lebih dari'");
  assert.equal(ev(series(6, (i) => ({ ppp: i < 5 ? 15 : 2 }))).open.length, 0, "awal < 20 sesi");
});
await test("PPPoE pulih saat kembali dalam 20% dari nilai awal temuan", () => {
  const key = findingKey("d1", "ppp_drop");
  const act = [{ key, rule: "ppp_drop" as const, subject: "pppoe", startedAt: T0, evidence: { unit: "sesi", baseline: 100, samples: [] } }];
  assert.equal(ev(series(1, () => ({ ppp: 79 })), act).resolve.length, 0);
  assert.equal(ev(series(1, () => ({ ppp: 85 })), act).resolve.length, 1);
});
await test("Tidak terjangkau vs API gagal dibedakan", () => {
  const down = ev(series(3, (i) => (i > 0 ? { reachable: false, apiOk: false, cpu: null, ppp: null, wan: null, error: "Tidak terjangkau: waktu habis" } : {})));
  assert.deepEqual(down.open.map((f) => f.rule), ["unreachable"]);
  assert.equal(down.open[0].startedAt, T0 + MIN);
  const api = ev(series(3, (i) => (i > 0 ? { apiOk: false, cpu: null, ppp: null, wan: null, error: "Login router gagal" } : {})));
  assert.deepEqual(api.open.map((f) => f.rule), ["api_error"]);
});
await test("Ambang bisa dikonfigurasi dan dibatasi rentangnya", () => {
  const cfg = normalizeRules({ cpuThreshold: 70, cpuMinutes: 2, wanChecks: 99, pppMinBase: "x" });
  assert.equal(cfg.cpuThreshold, 70);
  assert.equal(cfg.wanChecks, 20);
  assert.equal(cfg.pppMinBase, 20);
  assert.equal(ev(series(3, () => ({ cpu: 75 })), [], { cfg }).open.length, 1);
});

/* ----------------------------------------------------------------- status */

const devRow = (over: Partial<Parameters<typeof buildDeviceView>[0]> = {}) => ({
  id: "d1",
  name: "RB-Pusat",
  site: "Pusat",
  kind: "router",
  vendor: "mikrotik",
  host: "203.0.113.1",
  enabled: true,
  intervalSec: 60,
  wanInterfaces: "ether1",
  lastSampleAt: T0,
  state: {
    at: T0, reachable: true, reachVia: "tcp" as const, apiOk: true, error: "", identity: "RB", version: "7.15", board: "RB4011",
    uptimeSec: 100, cpu: 12, memPct: 30, ppp: 50, hotspot: null, sources: { ppp: null, hotspot: "Hotspot tidak tersedia" },
    wan: wan(true), interfaces: ["ether1"],
  },
  ...over,
});
await test("status: normal, kedaluwarsa, collector terputus", () => {
  const beat = { lastBeatAt: T0 };
  const ok = buildDeviceView(devRow(), [], beat, T0 + 30_000);
  assert.equal(ok.status, "online");
  assert.match(ok.indicator, /CPU 12% · RAM 30% · WAN up · PPPoE 50/);
  const stale = buildDeviceView(devRow(), [], beat, T0 + staleAfterMs(60) + 1);
  assert.equal(stale.status, "nodata");
  assert.match(stale.statusReason, /Data kedaluwarsa/);
  assert.equal(stale.metrics.cpu, null, "metrik basi tidak ditampilkan sebagai nilai terkini");
  assert.equal(stale.wan[0].state, "unverified");
  const gone = buildDeviceView(devRow(), [], { lastBeatAt: T0 - 10 * MIN }, T0 + staleAfterMs(60) + 1);
  assert.match(gone.statusReason, /collector berhenti mengirim data/);
});
await test("status: tidak terjangkau → Down dan WAN belum terverifikasi; API gagal → Peringatan", () => {
  const r = devRow();
  const down = buildDeviceView({ ...r, state: { ...r.state, reachable: false, apiOk: false, error: "Tidak terjangkau" } }, [], { lastBeatAt: T0 }, T0 + 1000);
  assert.equal(down.status, "down");
  assert.equal(down.wan[0].state, "unverified");
  const api = buildDeviceView({ ...r, state: { ...r.state, apiOk: false, error: "Login router gagal" } }, [], { lastBeatAt: T0 }, T0 + 1000);
  assert.equal(api.status, "warning");
  assert.equal(api.wan[0].state, "unknown");
  assert.equal(api.sources.api.ok, false);
});
await test("status: perangkat non-MikroTik / OLT → Data Tidak Tersedia, indikator 'Tidak tersedia'", () => {
  const v = buildDeviceView(devRow({ kind: "olt", vendor: "other", lastSampleAt: null, state: null }), [], null, T0);
  assert.equal(v.status, "nodata");
  assert.equal(v.indicator, "Tidak tersedia");
});

/* ------------------------------------------------------- jaringan & input */

await test("target collector: port dan jaringan privat dibatasi", async () => {
  delete process.env.NM_ALLOWED_PORTS;
  assert.equal(checkPort(8728), null);
  assert.equal(checkPort(6006), null, "port forwarding: semua port boleh secara bawaan");
  assert.match(checkPort(70000) ?? "", /1–65535/);
  process.env.NM_ALLOWED_PORTS = "8728,8729";
  assert.match(checkPort(6006) ?? "", /tidak diizinkan/);
  const c = parseCidrs("10.88.0.0/16, 300.1.1.1/8, 0.0.0.0/0");
  assert.equal(c.length, 1, "CIDR tidak valid dan /0 diabaikan");
  assert.ok(inCidrs("10.88.4.2", c));
  assert.ok(!inCidrs("10.89.0.1", c));
  delete process.env.AI_ALLOW_PRIVATE_HOSTS;
  await assert.rejects(resolveAllowedTarget("192.168.88.1", 8728), /jaringan privat/);
  await assert.rejects(resolveAllowedTarget("127.0.0.1", 8728), /jaringan privat/);
  process.env.NM_ALLOWED_NETWORKS = "10.88.0.0/16";
  assert.equal(await resolveAllowedTarget("10.88.0.5", 8728), "10.88.0.5");
  await assert.rejects(resolveAllowedTarget("10.88.0.5", 22), /Port 22/);
  delete process.env.NM_ALLOWED_PORTS;
  assert.equal(await resolveAllowedTarget("10.88.0.5", 6006), "10.88.0.5");
  delete process.env.NM_ALLOWED_NETWORKS;
});
await test("input perangkat divalidasi", () => {
  assert.equal(parseDeviceInput({ name: "", host: "1.1.1.1" }).ok, false);
  assert.equal(parseDeviceInput({ name: "A", host: "1.1.1.1", apiPort: 70000, username: "m" }).ok, false);
  assert.equal(parseDeviceInput({ name: "A", host: "1.1.1.1", username: "m", tlsFingerprint: "abc" }).ok, false);
  const ok = parseDeviceInput({ name: "A", host: "1.1.1.1", username: "m", wanInterfaces: ["ether1", "pppoe-out1", "ether1"], intervalSec: 5 });
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.data.wanInterfaces, "ether1,pppoe-out1");
    assert.equal(ok.data.intervalSec, 30, "interval dibatasi minimal 30 detik");
  }
  assert.ok(parseDeviceInput({ name: "OLT-1", kind: "olt", vendor: "other" }).ok, "OLT boleh tanpa kredensial (belum dipantau)");
});
await test("API-SSL: fingerprint dipin, CA tidak valid ditolak", () => {
  const fp = "AB:CD:" + "00:".repeat(29) + "EF";
  const sock = (authorized: boolean, f = fp) => ({ getPeerCertificate: () => ({ fingerprint256: f, subject: { CN: "router.example" }, subjectaltname: "DNS:router.example" }), authorized, authorizationError: authorized ? null : "SELF_SIGNED_CERT_IN_CHAIN" }) as never;
  assert.equal(checkCertificate(sock(false), "router.example", normFingerprint(fp)), null);
  assert.match(checkCertificate(sock(false, "11:22"), "router.example", fp) ?? "", /tidak cocok/);
  assert.match(checkCertificate(sock(false), "router.example", "") ?? "", /tidak tervalidasi.*SELF_SIGNED/);
  assert.equal(checkCertificate(sock(true), "router.example", ""), null);
  assert.match(checkCertificate(sock(true), "lain.example", "") ?? "", /Nama di sertifikat/);
});

/* ------------------------------------------- router tiruan (RouterOS API) */

interface FakeState {
  cpu: number;
  uptime: number;
  running: boolean;
  rx: number;
  tx: number;
  ppp: number;
  password: string;
}
function fakeRouter(st: FakeState) {
  const seen: string[] = [];
  const server = net.createServer((sock) => {
    let buf = Buffer.alloc(0);
    let authed = false;
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      for (let s = takeSentence(buf); s; s = takeSentence(buf)) {
        buf = Buffer.from(s.rest);
        const [cmd, ...args] = s.words;
        seen.push(cmd);
        const has = (w: string) => args.includes(w);
        const send = (...sentences: string[][]) => sock.write(Buffer.concat(sentences.map(encodeSentence)));
        if (cmd === "/login") {
          if (has("=name=monitor") && has(`=password=${st.password}`)) {
            authed = true;
            send(["!done"]);
          } else send(["!trap", "=message=invalid user name or password (6)"], ["!done"]);
        } else if (!authed) send(["!fatal", "not logged in"]);
        else if (cmd === "/system/identity/print") send(["!re", "=name=FAKE-RB"], ["!done"]);
        else if (cmd === "/system/resource/print")
          send(["!re", `=cpu-load=${st.cpu}`, "=free-memory=268435456", "=total-memory=1073741824", `=uptime=${Math.floor(st.uptime / 60)}m${st.uptime % 60}s`, "=version=7.15.3 (stable)", "=board-name=RB4011iGS+"], ["!done"]);
        else if (cmd === "/interface/print")
          send(
            ["!re", "=name=ether1", "=type=ether", `=running=${st.running}`, "=disabled=false", `=rx-byte=${st.rx}`, `=tx-byte=${st.tx}`],
            ["!re", "=name=bridge-lan", "=type=bridge", "=running=true", "=disabled=false", "=rx-byte=1", "=tx-byte=1"],
            ["!done"],
          );
        else if (cmd === "/ppp/active/print" && has("=count-only=") && has("?service=pppoe")) send(["!done", `=ret=${st.ppp}`]);
        else if (cmd === "/ip/hotspot/active/print") send(["!trap", "=message=no such command prefix"], ["!done"]);
        else send(["!trap", `=message=perintah tidak diizinkan di tiruan: ${cmd}`], ["!done"]);
      }
    });
  });
  return new Promise<{ port: number; seen: string[]; close: () => Promise<void> }>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, seen, close: () => new Promise((r) => server.close(() => r())) })),
  );
}

await test("collector ujung-ke-ujung: normal → CPU tinggi → WAN down → PPPoE turun → reboot → pulih", async () => {
  const PASSWORD = "rahasia-UJI-7c1";
  const st: FakeState = { cpu: 12, uptime: 3600, running: true, rx: 1_000_000, tx: 500_000, ppp: 120, password: PASSWORD };
  const router = await fakeRouter(st);
  try {
    const store = new MemoryStore();
    store.addDevice({ id: "dA", userId: "userA", name: "RB-Pusat", host: "127.0.0.1", apiPort: router.port, passwordEnc: "sealed", wanInterfaces: "ether1,ether9" }, { site: "Pusat" });
    let now = T0;
    const deps = {
      store,
      now: () => now,
      poll: (d: CollectorDevice) => pollMikrotik({ ip: "127.0.0.1", host: d.host, port: d.apiPort, tls: false, fingerprint: "", username: d.username, password: PASSWORD }, { ping: async () => false }),
    };
    const opts = { collectorId: "uji", startedAt: T0, concurrency: 2, version: "uji" };
    const step = async (mut: (s: FakeState) => void = () => {}) => {
      mut(st);
      st.uptime += 60;
      st.rx += 75_000_000; // 10 Mbps
      st.tx += 7_500_000; // 1 Mbps
      const r = await runCycle(deps, opts);
      now += MIN;
      return r;
    };

    assert.equal((await step()).polled, 1);
    let s = store.samples.get("dA")!;
    assert.equal(s[0].cpu, 12);
    assert.equal(s[0].ppp, 120);
    assert.equal(s[0].wan![0].rxBps, null, "sampel pertama: belum ada selisih");
    assert.equal(s[0].wan![1].found, false, "ether9 tidak ada di router");
    const state = store.devices.get("dA")!.state!;
    assert.equal(state.hotspot, null);
    assert.match(state.sources.hotspot ?? "", /Hotspot tidak tersedia/);
    assert.deepEqual(state.interfaces, ["ether1", "bridge-lan"]);

    await step();
    s = store.samples.get("dA")!;
    assert.equal(s[1].wan![0].rxBps, 10_000_000);
    assert.equal(s[1].wan![0].txBps, 1_000_000);

    // CPU 97% selama 6 sampel → temuan CPU tinggi tepat satu.
    for (let i = 0; i < 6; i++) await step((x) => (x.cpu = 97));
    let act = store.findingsFor("userA").filter((f) => f.status === "active");
    assert.deepEqual(act.map((f) => f.rule), ["cpu_high"]);
    await step((x) => (x.cpu = 98));
    assert.equal(store.findingsFor("userA").filter((f) => f.rule === "cpu_high").length, 1, "tidak ada duplikat saat kondisi berlanjut");
    await step((x) => (x.cpu = 30));
    const cpuF = store.findingsFor("userA").find((f) => f.rule === "cpu_high")!;
    assert.equal(cpuF.status, "resolved");
    assert.match(cpuF.recovery, /CPU turun ke 30%/);

    // WAN ether1 down 3× → temuan; reboot (uptime turun + counter reset) tidak membuat lonjakan.
    for (let i = 0; i < 3; i++) await step((x) => (x.running = false));
    act = store.findingsFor("userA").filter((f) => f.status === "active");
    assert.deepEqual(act.map((f) => `${f.rule}:${f.subject}`), ["wan_down:ether1"]);
    await step((x) => {
      x.running = true;
      x.uptime = 5;
      x.rx = 0;
      x.tx = 0;
    });
    s = store.samples.get("dA")!;
    assert.equal(s[s.length - 1].wan![0].rxBps, null, "reboot: celah, bukan lonjakan");
    assert.equal(store.findingsFor("userA").find((f) => f.rule === "wan_down")!.status, "resolved");

    // PPPoE 120 → 80 (turun 33%).
    for (let i = 0; i < 5; i++) await step();
    await step((x) => (x.ppp = 80));
    assert.ok(store.findingsFor("userA").some((f) => f.rule === "ppp_drop" && f.status === "active"));
    await step((x) => (x.ppp = 118));
    assert.equal(store.findingsFor("userA").find((f) => f.rule === "ppp_drop")!.status, "resolved");

    // Password salah → router terjangkau, API gagal → temuan "gagal mengambil metrik", bukan Down.
    st.password = "diganti";
    await step();
    await step();
    act = store.findingsFor("userA").filter((f) => f.status === "active");
    assert.deepEqual(act.map((f) => f.rule), ["api_error"]);
    const last = store.devices.get("dA")!.state!;
    assert.equal(last.reachable, true);
    assert.equal(last.apiOk, false);
    assert.deepEqual(last.interfaces, ["ether1", "bridge-lan"], "daftar interface dipertahankan saat API gagal");
    st.password = PASSWORD;
    await step();
    assert.equal(store.findingsFor("userA").filter((f) => f.status === "active").length, 0);

    // Hanya perintah baca yang dikirim.
    assert.ok(router.seen.every((c) => c === "/login" || c.endsWith("/print")), `perintah: ${[...new Set(router.seen)].join(", ")}`);
    // Kredensial tidak ada di sampel, state, atau temuan.
    assert.ok(!JSON.stringify([...store.samples.values(), [...store.devices.values()].map((d) => d.state), store.findings]).includes(PASSWORD));
    assert.ok(store.beats.get("uji"));
  } finally {
    await router.close();
  }
});

await test("port ditutup: host menolak (RST) = terjangkau tetapi API gagal", async () => {
  const router = await fakeRouter({ cpu: 1, uptime: 1, running: true, rx: 0, tx: 0, ppp: 0, password: "x" });
  const port = router.port;
  await router.close();
  const r = await pollMikrotik({ ip: "127.0.0.1", host: "127.0.0.1", port, tls: false, fingerprint: "", username: "monitor", password: "x" }, { ping: async () => false });
  assert.equal(r.reachable, true);
  assert.equal(r.apiOk, false);
  assert.match(r.error, /ditolak/);
});

await test("router tidak terjangkau → temuan, pulih saat kembali; collector berhenti → kedaluwarsa", async () => {
  const store = new MemoryStore();
  store.addDevice({ id: "dB", userId: "userA", name: "RB-Cabang", wanInterfaces: "ether1" });
  let now = T0;
  let up = false;
  const deps = { store, now: () => now, poll: async () => (up ? { ...blankResult(""), reachable: true, reachVia: "tcp" as const, apiOk: true, cpu: 5, interfaces: [{ name: "ether1", type: "ether", running: true, disabled: false, rxByte: 1, txByte: 1 }] } : blankResult("Tidak terjangkau: waktu habis")) };
  const d = store.devices.get("dB")!;
  for (let i = 0; i < 3; i++) {
    await pollDevice(deps, d);
    now += MIN;
  }
  const f = store.findingsFor("userA");
  assert.deepEqual(f.map((x) => x.rule), ["unreachable"]);
  const view = buildDeviceView({ ...d, lastSampleAt: d.lastSampleAt, state: d.state }, f, { lastBeatAt: now }, now);
  assert.equal(view.status, "down");
  assert.equal(view.wan[0].state, "unverified");
  up = true;
  await pollDevice(deps, d);
  assert.equal(store.findingsFor("userA")[0].status, "resolved");
  assert.match(store.findingsFor("userA")[0].recovery, /kembali terjangkau/);
  // Collector berhenti 10 menit.
  const later = now + 10 * MIN;
  const stale = buildDeviceView({ ...d, lastSampleAt: d.lastSampleAt, state: d.state }, [], { lastBeatAt: now }, later);
  assert.equal(stale.status, "nodata");
  assert.match(stale.statusReason, /kedaluwarsa.*collector berhenti/);
});

await test("worker paralel: klaim mencegah polling ganda dan activeKey mencegah temuan ganda", async () => {
  const store = new MemoryStore();
  store.addDevice({ id: "dC", userId: "userA", name: "RB-X" });
  let polls = 0;
  const deps = { store, now: () => T0, poll: async () => (polls++, blankResult("Tidak terjangkau")) };
  const opts = { collectorId: "w", startedAt: T0, concurrency: 4, version: "uji" };
  const [a, b] = await Promise.all([runCycle(deps, opts), runCycle({ ...deps }, { ...opts, collectorId: "w2" })]);
  assert.equal(polls, 1);
  assert.equal(a.polled + b.polled, 1);
  const dev = store.devices.get("dC")!;
  const draft = { key: findingKey("dC", "unreachable"), rule: "unreachable" as const, subject: "", summary: "x", triggerValue: "x", startedAt: T0, evidence: { unit: "", samples: [] } };
  const results = await Promise.all([store.openFinding(dev, draft, T0), store.openFinding(dev, draft, T0)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(store.findings.filter((x) => x.activeKey === draft.key).length, 1);
});

await test("pemisahan tenant: temuan dan perangkat hanya terlihat oleh pemiliknya", async () => {
  const store = new MemoryStore();
  store.addDevice({ id: "a1", userId: "userA", name: "A-Router" });
  store.addDevice({ id: "b1", userId: "userB", name: "B-Router" });
  let now = T0;
  const deps = { store, now: () => now, poll: async () => blankResult("Tidak terjangkau") };
  for (let i = 0; i < 3; i++) {
    await runCycle(deps, { collectorId: "t", startedAt: T0, concurrency: 2, version: "uji" });
    now += MIN;
  }
  const fa = store.findingsFor("userA");
  const fb = store.findingsFor("userB");
  assert.equal(fa.length, 1);
  assert.equal(fb.length, 1);
  assert.ok(fa.every((f) => f.deviceId === "a1") && fb.every((f) => f.deviceId === "b1"));
  assert.deepEqual(store.devicesFor("userB").map((d) => d.id), ["b1"]);
});

for (const f of failures) console.error(f);
if (failures.length) {
  console.error(`${failures.length} uji gagal, ${passed} lulus.`);
  process.exit(1);
}
console.log(`Semua ${passed} uji Network Monitoring lulus.`);
