/**
 * Penulis ZIP minimal (metode "store", tanpa kompresi).
 *
 * Dipakai untuk membungkus paket halaman login hotspot agar bisa diunduh
 * sebagai satu file — tanpa dependensi eksternal, semuanya di browser.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Waktu & tanggal dalam format MS-DOS yang dipakai ZIP. */
function dosStamp(date: Date): { time: number; date: number } {
  return {
    time:
      (Math.floor(date.getSeconds() / 2) & 0x1f) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getHours() & 0x1f) << 11),
    date:
      (date.getDate() & 0x1f) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      ((Math.max(0, date.getFullYear() - 1980) & 0x7f) << 9),
  };
}

class ByteWriter {
  private chunks: Uint8Array[] = [];
  length = 0;

  u16(value: number): this {
    return this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): this {
    return this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  push(bytes: Uint8Array): this {
    this.chunks.push(bytes);
    this.length += bytes.length;
    return this;
  }

  toBlobParts(): Uint8Array[] {
    return this.chunks;
  }
}

export interface ZipEntry {
  name: string;
  /** Isi berkas teks. Abaikan bila memakai `dataUrl`. */
  content?: string;
  /** Berkas biner (mis. logo) dalam bentuk data URI. */
  dataUrl?: string;
}

/** Mengubah data URI menjadi byte mentah untuk ditulis ke dalam zip. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : "";
  const header = comma >= 0 ? dataUrl.slice(0, comma) : "";

  if (!header.includes(";base64")) {
    return new TextEncoder().encode(decodeURIComponent(payload));
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createZip(entries: ZipEntry[], date = new Date()): Blob {
  const encoder = new TextEncoder();
  const stamp = dosStamp(date);
  const body = new ByteWriter();
  const central = new ByteWriter();
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = entry.dataUrl
      ? dataUrlToBytes(entry.dataUrl)
      : encoder.encode(entry.content ?? "");
    const crc = crc32(dataBytes);

    // Local file header
    body.u32(0x04034b50);
    body.u16(20); // versi minimum
    body.u16(0x0800); // nama file UTF-8
    body.u16(0); // metode: store
    body.u16(stamp.time).u16(stamp.date);
    body.u32(crc).u32(dataBytes.length).u32(dataBytes.length);
    body.u16(nameBytes.length).u16(0);
    body.push(nameBytes).push(dataBytes);

    // Central directory header
    central.u32(0x02014b50);
    central.u16(20).u16(20);
    central.u16(0x0800).u16(0);
    central.u16(stamp.time).u16(stamp.date);
    central.u32(crc).u32(dataBytes.length).u32(dataBytes.length);
    central.u16(nameBytes.length).u16(0).u16(0);
    central.u16(0).u16(0).u32(0);
    central.u32(offset);
    central.push(nameBytes);

    offset = body.length;
  }

  const end = new ByteWriter();
  end.u32(0x06054b50);
  end.u16(0).u16(0);
  end.u16(entries.length).u16(entries.length);
  end.u32(central.length).u32(body.length);
  end.u16(0);

  return new Blob(
    [...body.toBlobParts(), ...central.toBlobParts(), ...end.toBlobParts()] as BlobPart[],
    { type: "application/zip" },
  );
}
