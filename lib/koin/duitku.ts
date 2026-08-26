import { createHash } from "node:crypto";

/**
 * Duitku — pembuatan transaksi dan pemeriksaan callback.
 *
 * Seluruh berkas ini hanya boleh berjalan di server: API key Duitku adalah
 * rahasia yang, kalau bocor, membuat siapa pun bisa memalsukan callback
 * "pembayaran berhasil" dan menambah koin tanpa membayar.
 */

const ENDPOINT = {
  sandbox: "https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry",
  production: "https://passport.duitku.com/webapi/api/merchant/v2/inquiry",
} as const;

export type Lingkungan = keyof typeof ENDPOINT;

function md5(teks: string): string {
  return createHash("md5").update(teks, "utf8").digest("hex");
}

export interface KonfigurasiDuitku {
  merchantCode: string;
  apiKey: string;
  lingkungan: Lingkungan;
  /** Alamat aplikasi, dipakai menyusun URL callback & kembali. */
  baseUrl: string;
}

/**
 * Konfigurasi dari environment.
 *
 * Sengaja melempar, bukan mengembalikan nilai kosong: transaksi yang terlanjur
 * dibuat dengan merchant code kosong akan ditolak Duitku dengan pesan yang
 * membingungkan, jauh lebih sulit ditelusuri daripada gagal di sini.
 */
export function bacaKonfigurasi(): KonfigurasiDuitku {
  const merchantCode = process.env.DUITKU_MERCHANT_CODE ?? "";
  const apiKey = process.env.DUITKU_API_KEY ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const lingkungan: Lingkungan =
    process.env.DUITKU_ENV === "production" ? "production" : "sandbox";

  const kurang: string[] = [];
  if (!merchantCode) kurang.push("DUITKU_MERCHANT_CODE");
  if (!apiKey) kurang.push("DUITKU_API_KEY");
  if (!baseUrl) kurang.push("NEXT_PUBLIC_APP_URL");
  if (kurang.length > 0) {
    throw new Error(`Duitku belum dikonfigurasi: ${kurang.join(", ")} kosong.`);
  }

  return { merchantCode, apiKey, lingkungan, baseUrl: baseUrl.replace(/\/+$/, "") };
}

export function duitkuSiap(): boolean {
  return Boolean(
    process.env.DUITKU_MERCHANT_CODE &&
      process.env.DUITKU_API_KEY &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}

/* ------------------------------------------------------------------ *
 * Membuat transaksi
 * ------------------------------------------------------------------ */

export interface PermintaanTransaksi {
  merchantOrderId: string;
  /** Rupiah penuh, bukan sen. */
  jumlah: number;
  keterangan: string;
  email: string;
  namaPembeli: string;
  /** Kosong = pembeli memilih sendiri di halaman Duitku. */
  metode?: string;
}

export interface HasilTransaksi {
  reference: string;
  paymentUrl: string;
}

/** Tanda tangan pembuatan transaksi menurut dokumentasi Duitku v2. */
export function tandaTanganInquiry(
  cfg: KonfigurasiDuitku,
  merchantOrderId: string,
  jumlah: number,
): string {
  return md5(`${cfg.merchantCode}${merchantOrderId}${jumlah}${cfg.apiKey}`);
}

export async function buatTransaksi(
  cfg: KonfigurasiDuitku,
  minta: PermintaanTransaksi,
): Promise<HasilTransaksi> {
  const body = {
    merchantCode: cfg.merchantCode,
    paymentAmount: minta.jumlah,
    merchantOrderId: minta.merchantOrderId,
    productDetails: minta.keterangan,
    email: minta.email,
    customerVaName: minta.namaPembeli.slice(0, 20),
    paymentMethod: minta.metode || undefined,
    callbackUrl: `${cfg.baseUrl}/api/duitku/callback`,
    returnUrl: `${cfg.baseUrl}/login-page-hotspot/koin?topup=${encodeURIComponent(minta.merchantOrderId)}`,
    signature: tandaTanganInquiry(cfg, minta.merchantOrderId, minta.jumlah),
    expiryPeriod: 60,
  };

  const res = await fetch(ENDPOINT[cfg.lingkungan], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Jangan sampai satu permintaan menggantung menahan server action.
    signal: AbortSignal.timeout(20_000),
  });

  const teks = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(teks) as Record<string, unknown>;
  } catch {
    throw new Error(`Duitku membalas bukan JSON (${res.status}): ${teks.slice(0, 200)}`);
  }

  // statusCode "00" berarti berhasil; selain itu isinya pesan kesalahan.
  if (!res.ok || data.statusCode !== "00") {
    const pesan = typeof data.statusMessage === "string" ? data.statusMessage : teks.slice(0, 200);
    throw new Error(`Duitku menolak permintaan: ${pesan}`);
  }

  const reference = typeof data.reference === "string" ? data.reference : "";
  const paymentUrl = typeof data.paymentUrl === "string" ? data.paymentUrl : "";
  if (!paymentUrl) {
    throw new Error("Duitku tidak mengembalikan paymentUrl.");
  }

  return { reference, paymentUrl };
}

/* ------------------------------------------------------------------ *
 * Callback
 * ------------------------------------------------------------------ */

export interface IsiCallback {
  merchantCode: string;
  amount: string;
  merchantOrderId: string;
  signature: string;
  resultCode: string;
  reference?: string;
  paymentCode?: string;
}

/**
 * Tanda tangan callback memakai susunan yang BERBEDA dari inquiry:
 * merchantCode + amount + merchantOrderId + apiKey.
 *
 * Perbedaan urutan ini gampang terlewat, dan akibatnya fatal ke dua arah —
 * salah susun berarti semua callback sah ditolak, atau lebih buruk, pengecekan
 * yang selalu lolos.
 */
export function tandaTanganCallback(
  cfg: KonfigurasiDuitku,
  isi: Pick<IsiCallback, "amount" | "merchantOrderId">,
): string {
  return md5(`${cfg.merchantCode}${isi.amount}${isi.merchantOrderId}${cfg.apiKey}`);
}

/** Perbandingan yang tidak membocorkan posisi karakter yang berbeda. */
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i += 1) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

export interface HasilPeriksa {
  sah: boolean;
  alasan?: string;
}

/**
 * Memeriksa keaslian callback.
 *
 * Tanpa ini, siapa pun yang menebak alamat /api/duitku/callback bisa mengirim
 * "pembayaran berhasil" untuk nomor topup mana pun dan mendapat koin gratis.
 */
export function periksaCallback(cfg: KonfigurasiDuitku, isi: IsiCallback): HasilPeriksa {
  if (!isi.merchantOrderId) return { sah: false, alasan: "merchantOrderId kosong" };
  if (!isi.signature) return { sah: false, alasan: "signature kosong" };

  if (isi.merchantCode !== cfg.merchantCode) {
    return { sah: false, alasan: "merchantCode tidak cocok" };
  }

  const harapan = tandaTanganCallback(cfg, isi);
  if (!samaAman(harapan.toLowerCase(), isi.signature.toLowerCase())) {
    return { sah: false, alasan: "signature tidak cocok" };
  }

  return { sah: true };
}

/** resultCode "00" berarti lunas; "01" masih diproses; selainnya gagal. */
export function bacaHasil(resultCode: string): "lunas" | "menunggu" | "gagal" {
  if (resultCode === "00") return "lunas";
  if (resultCode === "01") return "menunggu";
  return "gagal";
}

/**
 * Nomor pesanan untuk Duitku. Harus unik selamanya — nomor yang terpakai ulang
 * membuat callback lama mengkredit topup baru.
 */
export function nomorTopup(): string {
  const waktu = Date.now().toString(36).toUpperCase();
  const acak = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TP${waktu}${acak}`;
}
