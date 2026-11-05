/**
 * Uji MD4 dan NT-Password: vektor RFC 1320 dan hash NT yang sudah dikenal.
 * Jalankan: npx tsx scripts/test-nt-hash.mts
 */
import { md4, ntHash } from "../lib/nt-hash";

const hex = (b: Uint8Array) => Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("");
const enc = (s: string) => new TextEncoder().encode(s);

const md4Vectors: Array<[string, string]> = [
  ["", "31d6cfe0d16ae931b73c59d7e0c089c0"],
  ["a", "bde52cb31de33e46245e05fbdbd6fb24"],
  ["abc", "a448017aaf21d8525fc10ae87aa6729d"],
  ["message digest", "d9130a8164549fe818874806e1c7014b"],
  ["abcdefghijklmnopqrstuvwxyz", "d79e1c308aa5bbcdeea8ed63df412da9"],
  ["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", "043f8582f241db351ce627e153e7f0e4"],
  ["12345678901234567890123456789012345678901234567890123456789012345678901234567890", "e33b4ddc9c38f2199c3e7b164fcc0536"],
];

const ntVectors: Array<[string, string]> = [
  ["password", "8846F7EAEE8FB117AD06BDD830B7586C"],
  ["", "31D6CFE0D16AE931B73C59D7E0C089C0"],
];

let failed = 0;
for (const [input, want] of md4Vectors) {
  const got = hex(md4(enc(input)));
  if (got !== want) {
    failed++;
    console.error(`MD4 SALAH untuk "${input}": ${got} (seharusnya ${want})`);
  }
}
for (const [input, want] of ntVectors) {
  const got = ntHash(input);
  if (got !== want) {
    failed++;
    console.error(`NT SALAH untuk "${input}": ${got} (seharusnya ${want})`);
  }
}
if (failed) {
  console.error(`${failed} uji gagal.`);
  process.exit(1);
}
console.log(`Semua ${md4Vectors.length + ntVectors.length} uji MD4/NT-Password lulus.`);
