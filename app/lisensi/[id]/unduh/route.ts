import { NextResponse } from "next/server";
import { ambilPesanan } from "@/lib/actions/licenses";
import { cetakZip } from "@/lib/license/zip";
import { namaArsip, simpanArsip } from "@/lib/license/arsip";
import type { Pesanan } from "@/lib/license/build";

/**
 * Mencetak folder siap upload untuk satu pesanan.
 *
 * Berkasnya dirakit setiap kali diminta, bukan disimpan. Dengan begitu
 * pesanan yang dicetak ulang selalu memakai template versi terbaru, dan
 * tidak ada berkas basi yang menumpuk di storage.
 *
 * Middleware sudah menjaga seluruh /lisensi, jadi rute ini tidak memeriksa
 * sesi lagi — tapi kalau matcher di middleware.ts berubah, pemeriksaan itu
 * harus dipindahkan ke sini.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pesanan = await ambilPesanan(id);
  if (!pesanan) {
    return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  }

  const isi: Pesanan = {
    templateSlug: pesanan.template_slug,
    namaUsaha: pesanan.nama_usaha,
    merekA: pesanan.merek_a,
    merekB: pesanan.merek_b,
    merekSpasi: pesanan.merek_spasi,
    tagline: pesanan.tagline,
    footerTagline: pesanan.footer_tagline,
    waNomor: pesanan.wa_nomor,
    waTampil: pesanan.wa_tampil,
    paket: pesanan.license_packages.map((p) => ({
      nama: p.nama,
      harga: p.harga,
      metaAtas: p.meta_atas,
      metaBawah: p.meta_bawah,
      warna: p.warna,
      rank: p.rank,
    })),
    warna: pesanan.warna ?? {},
    logoDataUrl: pesanan.logo_data_url ?? "",
    bgDataUrl: pesanan.bg_data_url ?? "",
    bank: pesanan.bank_nomor
      ? {
          nama: pesanan.bank_nama ?? "",
          nomor: pesanan.bank_nomor,
          atasNama: pesanan.bank_atas_nama ?? "",
        }
      : null,
    routerIdentity: pesanan.router_identity,
  };

  try {
    const hasil = await cetakZip(isi, pesanan.nomor);

    /* Salinan untuk diambil lewat File Manager aaPanel. Sengaja tidak
       ditunggu hasilnya kalau gagal — lihat lib/license/arsip.ts. */
    await simpanArsip(namaArsip(pesanan.nomor, pesanan.nama_usaha, pesanan.template_slug), hasil.isi);

    return new NextResponse(new Uint8Array(hasil.isi), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${hasil.namaBerkas}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    /* Pemeriksaan menolak hasil cetak. Pesannya menyebut apa yang salah,
       dan itu memang untuk dibaca admin — bukan ditelan diam-diam. */
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
