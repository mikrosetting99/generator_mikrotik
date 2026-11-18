/**
 * Uji Form Setting Mikrotik: validasi isian pelanggan dan konfigurasi Setup yang dihasilkan.
 * Jalankan: npx tsx scripts/test-setting-form.mts
 */
import assert from "node:assert/strict";
import { createDefaultHotspotLoginConfig } from "../lib/defaults-hotspot-login";
import { generateSetupScript } from "../lib/generator/setup";
import { MIKROTIK_MODELS } from "../lib/models";
import {
  applyToLoginPage,
  buildSetupConfig,
  isToken,
  PURPOSES,
  randomPassword,
  randomToken,
  slugName,
  validateRequest,
  type SettingRequestData,
} from "../lib/setting-request";
import { validateConfig } from "../lib/validate";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const hotspot = { purpose: "hotspot", modelId: "rbd52g-hap-ac2", businessName: "Warung Kopi Bu Sri", email: "Sri@Email.com ", phone: "0812-3456-7890", templateId: "" };

test("isian hotspot valid: telepon dinormalkan, email kecil", () => {
  const { data, errors } = validateRequest(hotspot);
  assert.deepEqual(errors, {});
  assert.equal(data.phone, "6281234567890");
  assert.equal(data.email, "sri@email.com");
  assert.equal(data.needs, "");
});

test("kolom wajib kosong ditolak per kolom", () => {
  const { errors } = validateRequest({ purpose: "pppoe" });
  assert.ok(errors.modelId && errors.email && errors.businessName && errors.phone);
  assert.ok(validateRequest({}).errors.purpose);
});

test("model, email, dan telepon tidak valid ditolak", () => {
  const { errors } = validateRequest({ ...hotspot, modelId: "rb9999", email: "bukan-email", phone: "123" });
  assert.ok(errors.modelId && errors.email && errors.phone);
});

test("kantor: butuh penjelasan, kolom hotspot dikosongkan", () => {
  const bad = validateRequest({ purpose: "kantor", modelId: "rb750gr3", email: "a@b.co", needs: "pendek" });
  assert.ok(bad.errors.needs);
  const ok = validateRequest({ purpose: "kantor", modelId: "rb750gr3", email: "a@b.co", needs: "20 PC, WiFi tamu terpisah, printer", businessName: "X", phone: "0812" });
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.data.businessName, "");
  assert.equal(ok.data.phone, "");
});

test("templateId hanya diterima untuk hotspot dan berbentuk id", () => {
  assert.equal(validateRequest({ ...hotspot, templateId: "clx9abcdefgh1234" }).data.templateId, "clx9abcdefgh1234");
  assert.equal(validateRequest({ ...hotspot, templateId: "../../etc" }).data.templateId, "");
  assert.equal(validateRequest({ ...hotspot, purpose: "pppoe", templateId: "clx9abcdefgh1234" }).data.templateId, "");
});

test("token dan password acak", () => {
  const t = randomToken();
  assert.ok(isToken(t));
  assert.notEqual(t, randomToken());
  assert.ok(!isToken("abc"));
  assert.match(randomPassword(), /^[A-Za-z2-9]{14}$/);
  assert.equal(slugName("Warung Kopi  Bu Sri!"), "Warung-Kopi-Bu-Sri");
});

test("semua type × semua peruntukan: script tanpa error validasi", () => {
  let n = 0;
  for (const model of MIKROTIK_MODELS) {
    for (const p of PURPOSES) {
      const { data, errors } = validateRequest({
        purpose: p.id,
        modelId: model.id,
        businessName: "Hotspot Maju Jaya",
        email: "admin@contoh.id",
        phone: "081234567890",
        needs: "Kantor 10 orang dengan WiFi",
      });
      assert.deepEqual(errors, {}, `${model.id}/${p.id}`);
      const config = buildSetupConfig(data, { routerPassword: "Abcdefgh234567" });
      const errs = validateConfig(config).filter((i) => i.level === "error");
      assert.deepEqual(errs, [], `${model.id}/${p.id}: ${errs.map((e) => e.message).join("; ")}`);
      const script = generateSetupScript(config);
      assert.ok(script.length > 200, `${model.id}/${p.id} script kosong`);
      if (p.id === "hotspot" || p.id === "hotspot-pppoe") assert.match(script, /\/ip hotspot/, `${model.id}/${p.id}`);
      if (p.id === "pppoe" || p.id === "hotspot-pppoe") assert.match(script, /pppoe-server/, `${model.id}/${p.id}`);
      n += 1;
    }
  }
  assert.ok(n >= 4 * 40);
});

test("hAP ac² hotspot: WAN ether1, LAN pengelola ether2, radio masuk bridge-hotspot", () => {
  const { data } = validateRequest(hotspot);
  const c = buildSetupConfig(data, { routerPassword: "Abcdefgh234567" });
  assert.equal(c.ros, "v7");
  assert.equal(c.wans[0].iface, "ether1");
  assert.equal(c.system.identity, "Router-Warung-Kopi-Bu-Sri");
  assert.equal(c.system.adminPassword, "Abcdefgh234567");
  assert.deepEqual(c.bridges.find((b) => b.name === "bridge-lan")?.ports, ["ether2"]);
  assert.deepEqual(c.bridges.find((b) => b.name === "bridge-hotspot")?.ports, ["ether3", "ether4", "ether5", "wlan1", "wlan2"]);
  assert.equal(c.wireless.radios[0].ssid, "Warung Kopi Bu Sri");
  assert.equal(c.wireless.radios[0].security, "open");
  assert.ok(c.hotspots[0].whatsappWalledGarden);
  assert.equal(c.firewall.mgmtSubnet, "192.168.10.0/24");
});

test("hEX hotspot + PPPoE: port dibagi dua", () => {
  const { data } = validateRequest({ ...hotspot, purpose: "hotspot-pppoe", modelId: "rb750gr3" });
  const c = buildSetupConfig(data, { routerPassword: "Abcdefgh234567" });
  assert.deepEqual(c.bridges.map((b) => [b.name, b.ports]), [
    ["bridge-lan", ["ether2"]],
    ["bridge-hotspot", ["ether3", "ether4"]],
    ["bridge-pppoe", ["ether5"]],
  ]);
  assert.equal(c.pppoe.iface, "bridge-pppoe");
  assert.equal(c.pppoe.secrets.length, 0);
});

test("perangkat v6-only memakai RouterOS v6; hAP ax lite (1 port) tetap valid", () => {
  const v6 = MIKROTIK_MODELS.find((m) => !m.supports.includes("v7"));
  if (v6) assert.equal(buildSetupConfig({ ...validateRequest({ ...hotspot, modelId: v6.id }).data }, { routerPassword: "x" }).ros, "v6");
  const c = buildSetupConfig(validateRequest({ ...hotspot, modelId: "l41g-hap-ax-lite" }).data, { routerPassword: "Abcdefgh234567" });
  assert.deepEqual(c.bridges.map((b) => b.ports), [["wifi1"]]);
});

test("kantor: WiFi WPA2, catatan kebutuhan masuk BAST", () => {
  const { data } = validateRequest({ purpose: "kantor", modelId: "rbd52g-hap-ac2", email: "a@b.co", needs: "Butuh WiFi kantor 15 orang" });
  const c = buildSetupConfig(data, { routerPassword: "Abcdefgh234567", wifiPassword: "WifiKantor123" });
  assert.equal(c.wireless.radios[0].security, "wpa2");
  assert.equal(c.wireless.radios[0].password, "WifiKantor123");
  assert.equal(c.handover.notes, "Butuh WiFi kantor 15 orang");
  assert.equal(c.hotspots.length, 0);
  assert.equal(c.pppoe.enabled, false);
});

test("login page: nama usaha & WhatsApp dipasang", () => {
  const { data } = validateRequest(hotspot);
  const page = applyToLoginPage(createDefaultHotspotLoginConfig(), data as SettingRequestData);
  assert.equal(page.title, "Warung Kopi Bu Sri");
  assert.equal(page.whatsapp, "6281234567890");
  assert.equal(page.whatsappEnabled, true);
});

console.log(`\n${passed} tes lolos`);
