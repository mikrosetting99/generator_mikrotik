/**
 * Pembuat password acak untuk router. Memakai crypto browser, memuat huruf besar,
 * huruf kecil, angka, dan simbol (lolos pemeriksaan kekuatan di generator), serta
 * menghindari karakter yang membingungkan (0/O, 1/l/I) dan yang butuh escaping
 * di RouterOS (tanda kutip, backslash, $, spasi).
 */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGIT = "23456789";
const SYMBOL = "!@#%^*-_=+";

function pick(set: string): string {
  const buf = new Uint32Array(1);
  // Tolak nilai di ujung rentang agar sebarannya merata.
  const limit = Math.floor(0x100000000 / set.length) * set.length;
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return set[buf[0] % set.length];
}

export function generatePassword(length = 14): string {
  const size = Math.max(10, Math.min(32, length));
  const all = UPPER + LOWER + DIGIT + SYMBOL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < size) chars.push(pick(all));
  // Acak urutan (Fisher–Yates) agar karakter wajib tidak selalu di depan.
  for (let i = chars.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const k = buf[0] % (i + 1);
    [chars[i], chars[k]] = [chars[k], chars[i]];
  }
  return chars.join("");
}