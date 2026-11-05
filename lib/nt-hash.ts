/**
 * NT-Password (MD4 dari password UTF-16LE) untuk FreeRADIUS. Dengan hash ini FreeRADIUS bisa
 * memeriksa MS-CHAPv2 (SSTP/L2TP) dan PAP (OVPN) tanpa password asli tersimpan di database radius.
 *
 * MD4 ditulis sendiri karena Node 17+ (OpenSSL 3) mematikan md4 di node:crypto secara bawaan.
 * Kebenarannya diuji scripts/test-nt-hash.mts terhadap vektor uji RFC 1320.
 */

const S = [3, 7, 11, 19, 3, 5, 9, 13, 3, 9, 11, 15];

const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

export function md4(input: Uint8Array): Uint8Array {
  const len = input.length;
  const padded = new Uint8Array(((len + 8) >> 6) * 64 + 64);
  padded.set(input);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  // Panjang dalam bit, little-endian 64-bit (cukup 53 bit untuk masukan sepanjang apa pun di sini).
  view.setUint32(padded.length - 8, (len * 8) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor((len * 8) / 2 ** 32), true);

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;
  const x = new Array<number>(16);

  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) x[i] = view.getUint32(off + i * 4, true);
    const [aa, bb, cc, dd] = [a, b, c, d];

    // Putaran 1
    for (let i = 0; i < 16; i++) {
      const f = (b & c) | (~b & d);
      const t = rotl((a + f + x[i]) | 0, S[i % 4]);
      [a, b, c, d] = [d, t, b, c];
    }
    // Putaran 2
    for (let i = 0; i < 16; i++) {
      const k = (i % 4) * 4 + (i >> 2);
      const g = (b & c) | (b & d) | (c & d);
      const t = rotl((a + g + x[k] + 0x5a827999) | 0, S[4 + (i % 4)]);
      [a, b, c, d] = [d, t, b, c];
    }
    // Putaran 3
    const order = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
    for (let i = 0; i < 16; i++) {
      const h = b ^ c ^ d;
      const t = rotl((a + h + x[order[i]] + 0x6ed9eba1) | 0, S[8 + (i % 4)]);
      [a, b, c, d] = [d, t, b, c];
    }

    a = (a + aa) | 0;
    b = (b + bb) | 0;
    c = (c + cc) | 0;
    d = (d + dd) | 0;
  }

  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a, b, c, d].forEach((w, i) => ov.setUint32(i * 4, w >>> 0, true));
  return out;
}

/** NT-Password untuk radcheck: 32 karakter hex huruf besar. */
export function ntHash(password: string): string {
  const utf16 = new Uint8Array(password.length * 2);
  for (let i = 0; i < password.length; i++) {
    const code = password.charCodeAt(i);
    utf16[i * 2] = code & 0xff;
    utf16[i * 2 + 1] = code >> 8;
  }
  return Array.from(md4(utf16), (v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
