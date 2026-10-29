/**
 * Nomor HP Indonesia: 0812…, +62 812…, 62812…, dan 812… semuanya menjadi 62812…
 * Hasilnya dipakai untuk mencocokkan nomor yang diketik pelanggan dengan data admin.
 */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

/** Nomor wajar: diawali 62 dan 9–15 digit. */
export function isValidPhone(normalized: string): boolean {
  return /^62\d{8,13}$/.test(normalized);
}

/** Tampilan ramah: 6281234567890 → 0812-3456-7890. */
export function formatPhone(normalized: string): string {
  const local = normalized.startsWith("62") ? `0${normalized.slice(2)}` : normalized;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}