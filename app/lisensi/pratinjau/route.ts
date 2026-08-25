import { NextResponse } from "next/server";
import { bacaForm, bacaPaket, jadiPesanan } from "@/lib/license/form";
import { cetakPratinjau } from "@/lib/license/pratinjau";
import { pecahNomor } from "@/lib/license/nomor";

/**
 * Pratinjau halaman login dari isian form yang sedang diketik.
 *
 * Menerima FormData yang sama persis dengan yang dikirim ke aksi simpan, jadi
 * pesanan tidak perlu disimpan dulu untuk bisa dilihat. Tidak menyentuh basis
 * data sama sekali.
 *
 * Aturan validasinya sengaja lebih longgar daripada saat menyimpan: orang
 * menekan pratinjau justru di tengah pengisian, dan menolak menampilkan apa
 * pun hanya karena satu kolom belum terisi membuat fiturnya tidak berguna.
 * Yang kosong diisi contoh secukupnya.
 *
 * Middleware sudah menjaga seluruh /lisensi, jadi rute ini tidak memeriksa
 * sesi lagi — tapi kalau matcher di middleware.ts berubah, pemeriksaan itu
 * harus dipindahkan ke sini.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const isi = bacaForm(formData);
    const paket = bacaPaket(formData);

    if (!isi.nama_usaha) isi.nama_usaha = "NAMA USAHA";
    if (!isi.merek_a && !isi.merek_b) isi.merek_a = isi.nama_usaha;

    if (!paket.length) {
      paket.push({
        posisi: 0,
        nama: "1 HARI",
        harga: "5.000",
        meta_atas: "Masa aktif",
        meta_bawah: "1 hari",
        warna: "#3ea6ff",
        rank: null,
      });
    }

    let wa = { wa: "6281112001036", tampil: "0811-1200-1036" };
    try {
      wa = pecahNomor(String(formData.get("wa") ?? ""));
    } catch {
      /* Nomor belum lengkap saat mengetik — pakai contoh, jangan gagal. */
    }

    const html = await cetakPratinjau(jadiPesanan(isi, paket, wa, null));

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    /* Pemeriksaan hasil cetak menolak, atau jangkar template tidak ketemu.
       Pesannya ditampilkan apa adanya — ini justru saat paling berguna
       untuk tahu apa yang salah. */
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:24px;background:#111;color:#f87171;font:13px/1.7 ui-monospace,monospace">
       <b>Pratinjau gagal dibuat</b><br><br>${String((e as Error).message).replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</body>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}
