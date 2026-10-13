/**
 * Kompres gambar di browser sebelum dipakai: diperkecil dan disimpan ulang
 * sebagai JPEG sampai ukurannya masuk batas. Router punya flash kecil, dan
 * foto dari kamera bisa berukuran beberapa MB.
 */

export interface CompressResult {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  originalBytes: number;
  /** false = gambar sudah cukup kecil dan dipakai apa adanya. */
  compressed: boolean;
}

/** Batas ukuran berkas asli yang masih mau dibaca (di atas ini browser bisa kehabisan memori). */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak bisa dibaca."));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal mengompres gambar."))), "image/jpeg", quality),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca hasil kompresi."));
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return blobToDataUrl(file);
}

/**
 * Perkecil sisi terpanjang sampai `maxEdge`, lalu turunkan kualitas JPEG
 * bertahap; bila masih terlalu besar, perkecil ukurannya lagi. Gambar yang
 * sudah memenuhi batas tidak disentuh sama sekali.
 */
export async function compressImage(
  file: File,
  { maxBytes, maxEdge }: { maxBytes: number; maxEdge: number },
): Promise<CompressResult> {
  const img = await loadImage(file);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

  if (file.size <= maxBytes && longEdge <= maxEdge) {
    return {
      dataUrl: await fileToDataUrl(file),
      bytes: file.size,
      width: img.naturalWidth,
      height: img.naturalHeight,
      originalBytes: file.size,
      compressed: false,
    };
  }

  let scale = Math.min(1, maxEdge / longEdge);
  let best: { blob: Blob; w: number; h: number } | null = null;

  for (let round = 0; round < 9; round += 1) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser tidak mendukung kompresi gambar.");
    // JPEG tidak punya transparansi: latar putih agar PNG transparan tidak jadi hitam.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.44, 0.36]) {
      const blob = await toBlob(canvas, quality);
      best = { blob, w, h };
      if (blob.size <= maxBytes) {
        return {
          dataUrl: await blobToDataUrl(blob),
          bytes: blob.size,
          width: w,
          height: h,
          originalBytes: file.size,
          compressed: true,
        };
      }
    }
    scale *= 0.85; // masih terlalu besar: ukurannya dikecilkan lagi
  }

  // Tetap melebihi batas setelah semua usaha: pakai hasil terkecil dan biarkan pemanggil memutuskan.
  const last = best!;
  return {
    dataUrl: await blobToDataUrl(last.blob),
    bytes: last.blob.size,
    width: last.w,
    height: last.h,
    originalBytes: file.size,
    compressed: true,
  };
}