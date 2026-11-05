/**
 * Uji logika murni VPN RADIUS: subnet, pembagian IP tunnel, batas kecepatan, isian, dan script CHR.
 * Jalankan: npx tsx scripts/test-vpn-radius.mts
 */
import assert from "node:assert/strict";
import {
  generateChrScript,
  nextFreeIp,
  parseSubnet,
  rateLimitValue,
  readPackageInput,
  readServerInput,
  subnetCapacity,
  subnetContains,
} from "../lib/vpn-radius";

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

test("subnet /16", () => {
  const s = parseSubnet("10.202.0.0/16");
  assert.equal(subnetCapacity(s), 65533);
  assert.ok(subnetContains(s, "10.202.0.1"));
  assert.ok(subnetContains(s, "10.202.255.254"));
  assert.ok(!subnetContains(s, "10.202.255.255"), "broadcast bukan host");
  assert.ok(!subnetContains(s, "10.202.0.0"), "network bukan host");
  assert.ok(!subnetContains(s, "10.203.0.1"));
});

test("subnet bukan awal blok ditolak", () => {
  assert.throws(() => parseSubnet("10.202.0.5/16"), /awal blok, mis\. 10\.202\.0\.0\/16/);
  assert.throws(() => parseSubnet("10.0.0.0/8"), /antara \/16 dan \/29/);
  assert.throws(() => parseSubnet("10.202.0.0"), /alamat\/prefix/);
});

test("IP tunnel berikutnya melewati gateway dan yang terpakai", () => {
  const s = parseSubnet("10.202.0.0/16");
  assert.equal(nextFreeIp(s, "10.202.0.1", []), "10.202.0.2");
  assert.equal(nextFreeIp(s, "10.202.0.1", ["10.202.0.2", "10.202.0.3"]), "10.202.0.4");
  assert.equal(nextFreeIp(s, "10.202.0.1", ["10.202.0.3"]), "10.202.0.2", "celah diisi lebih dulu");
  assert.equal(nextFreeIp(s, "10.202.0.1", ["10.202.0.255"].concat(Array.from({ length: 253 }, (_, i) => `10.202.0.${i + 2}`))), "10.202.1.0", "melewati batas oktet");
});

test("subnet penuh mengembalikan null", () => {
  const s = parseSubnet("10.9.0.0/29"); // host .1–.6
  assert.equal(nextFreeIp(s, "10.9.0.1", ["10.9.0.2", "10.9.0.3", "10.9.0.4", "10.9.0.5", "10.9.0.6"]), null);
});

test("Mikrotik-Rate-Limit: rx=upload, tx=download dari sisi server", () => {
  assert.equal(rateLimitValue(5120, 10240), "5M/10M");
  assert.equal(rateLimitValue(512, 2048), "512k/2M");
  assert.equal(rateLimitValue(0, 10240), "0/10M");
  assert.equal(rateLimitValue(0, 0), "");
});

const SERVER = {
  name: "VPN Indonesia 1",
  location: "Jakarta",
  domain: "VPN-ID1.mikrosetting.com",
  publicIp: "103.181.143.233",
  subnet: "10.202.0.0/16",
  gatewayIp: "10.202.0.1",
  protocols: ["l2tp", "sstp"],
  rosVersion: "v7",
  capacity: 500,
};

test("isian server sah dirapikan", () => {
  const r = readServerInput(SERVER);
  assert.ok("data" in r, "error" in r ? r.error : "");
  assert.equal(r.data.domain, "vpn-id1.mikrosetting.com");
  assert.deepEqual(r.data.protocols, ["sstp", "l2tp"], "urutan mengikuti daftar protokol");
});

test("isian server ditolak bila tidak masuk akal", () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ ...SERVER, domain: "vpn1" }, /nama domain/],
    [{ ...SERVER, publicIp: "103.181.143" }, /IPv4/],
    [{ ...SERVER, gatewayIp: "10.203.0.1" }, /di dalam subnet/],
    [{ ...SERVER, protocols: [] }, /minimal satu protokol/],
    [{ ...SERVER, subnet: "10.9.0.0/29", gatewayIp: "10.9.0.1", capacity: 6 }, /melebihi jumlah IP/],
  ];
  for (const [input, msg] of cases) {
    const r = readServerInput(input);
    assert.ok("error" in r, `seharusnya ditolak: ${JSON.stringify(input)}`);
    assert.match(r.error, msg);
  }
});

test("isian paket", () => {
  const ok = readPackageInput({ name: "Basic", priceIdr: 25000, durationDays: 30, uploadKbps: 5120, downloadKbps: 10240, portForwards: 0, maxAccounts: 2, protocols: ["sstp"] });
  assert.ok("data" in ok, "error" in ok ? ok.error : "");
  const bad = readPackageInput({ name: "X", priceIdr: 1, durationDays: 0, uploadKbps: 0, downloadKbps: 0, portForwards: 0, maxAccounts: 1, protocols: ["sstp"] });
  assert.ok("error" in bad && /Masa aktif/.test(bad.error));
});

test("script CHR", () => {
  const script = generateChrScript({ serverName: "VPN-1", rosVersion: "v6", protocols: ["sstp", "l2tp", "ovpn"], gatewayIp: "10.202.0.1", radiusIp: "203.0.113.10", radiusSecret: "Abc123" });
  assert.match(script, /\/radius add service=ppp address=203\.0\.113\.10 secret="Abc123"/);
  assert.match(script, /\/ppp aaa set use-radius=yes accounting=yes interim-update=5m/);
  assert.match(script, /local-address=10\.202\.0\.1/);
  assert.match(script, /sstp-server server set .*authentication=mschap2/);
  assert.match(script, /ovpn-server server set enabled=yes/);
  assert.match(script, /dst-port=3799 src-address=!203\.0\.113\.10 action=drop/);
  const v7 = generateChrScript({ serverName: "VPN-2", rosVersion: "v7", protocols: ["ovpn"], gatewayIp: "10.102.0.1", radiusIp: "203.0.113.10", radiusSecret: "x" });
  assert.doesNotMatch(v7, /^\/interface ovpn-server/m, "RouterOS 7: OVPN diatur manual");
  assert.doesNotMatch(v7, /sstp-server/);
});

if (!process.exitCode) console.log(`Semua ${passed} uji VPN RADIUS lulus.`);
