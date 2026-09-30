"use server";

import type { LicenseOrder as PrismaLicenseOrder, LicensePackage as PrismaLicensePackage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bacaForm, bacaPaket, periksaForm } from "@/lib/license/form";
import { buatKunci, bacaSalt, rapikanIdentity } from "@/lib/license/key";
import { pecahNomor } from "@/lib/license/nomor";
import type { LicensePackage, PesananLengkap } from "@/lib/license/pesanan";
import { prisma } from "@/lib/prisma";

/**
 * Dulu bentuk baris ini datang langsung dari Supabase (kolom snake_case).
 * Prisma/MySQL memakai camelCase, tapi seluruh lib/license/* dan halaman
 * /login-page-hotspot sudah ditulis mengharapkan bentuk snake_case — jadi
 * diterjemahkan di sini saja, satu tempat, daripada menyunting setiap
 * pemakainya.
 */
function toPesanan(row: PrismaLicenseOrder & { packages: PrismaLicensePackage[] }): PesananLengkap {
  return {
    id: row.id,
    nomor: row.nomor,
    nama_usaha: row.namaUsaha,
    kontak_nama: row.kontakNama,
    catatan: row.catatan,
    template_slug: row.templateSlug,
    merek_a: row.merekA,
    merek_b: row.merekB,
    merek_spasi: row.merekSpasi,
    tagline: row.tagline,
    footer_tagline: row.footerTagline,
    wa_nomor: row.waNomor,
    wa_tampil: row.waTampil,
    warna: (row.warna as Record<string, string> | null) ?? {},
    bank_nama: row.bankNama,
    bank_nomor: row.bankNomor,
    bank_atas_nama: row.bankAtasNama,
    logo_data_url: row.logoDataUrl,
    bg_data_url: row.bgDataUrl,
    router_identity: row.routerIdentity,
    lisensi_kunci: row.lisensiKunci,
    lisensi_terbit_pada: row.lisensiTerbitPada ? row.lisensiTerbitPada.toISOString() : null,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    license_packages: row.packages
      .slice()
      .sort((a, b) => a.posisi - b.posisi)
      .map(
        (p): LicensePackage => ({
          id: p.id,
          order_id: p.orderId,
          posisi: p.posisi,
          nama: p.nama,
          harga: p.harga,
          meta_atas: p.metaAtas,
          meta_bawah: p.metaBawah,
          warna: p.warna,
          rank: p.rank,
        }),
      ),
  };
}

/* ------------------------------------------------------------------ *
 * Membaca
 * ------------------------------------------------------------------ */

export async function daftarPesanan(): Promise<PesananLengkap[]> {
  const rows = await prisma.licenseOrder.findMany({
    include: { packages: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPesanan);
}

export async function ambilPesanan(id: string): Promise<PesananLengkap | null> {
  const row = await prisma.licenseOrder.findUnique({
    where: { id },
    include: { packages: true },
  });
  return row ? toPesanan(row) : null;
}

/* ------------------------------------------------------------------ *
 * Menulis
 * ------------------------------------------------------------------ */

export async function createLicenseOrder(_prev: string | undefined, formData: FormData) {
  const isi = bacaForm(formData);
  const paket = bacaPaket(formData);
  const nomorMentah = String(formData.get("wa") ?? "");

  const salah = periksaForm(isi, paket, nomorMentah);
  if (salah) return salah;

  let nomor;
  try {
    nomor = pecahNomor(nomorMentah);
  } catch (e) {
    return (e as Error).message;
  }

  const created = await prisma.licenseOrder.create({
    data: {
      namaUsaha: isi.nama_usaha,
      kontakNama: isi.kontak_nama,
      catatan: isi.catatan,
      templateSlug: isi.template_slug,
      merekA: isi.merek_a,
      merekB: isi.merek_b,
      merekSpasi: isi.merek_spasi,
      tagline: isi.tagline,
      footerTagline: isi.footer_tagline,
      waNomor: nomor.wa,
      waTampil: nomor.tampil,
      warna: isi.warna,
      bankNama: isi.bank_nama,
      bankNomor: isi.bank_nomor,
      bankAtasNama: isi.bank_atas_nama,
      logoDataUrl: isi.logo_data_url,
      bgDataUrl: isi.bg_data_url,
      packages: {
        create: paket.map((p) => ({
          posisi: p.posisi,
          nama: p.nama,
          harga: p.harga,
          metaAtas: p.meta_atas,
          metaBawah: p.meta_bawah,
          warna: p.warna,
          rank: p.rank,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/login-page-hotspot");
  redirect(`/login-page-hotspot/${created.id}/edit`);
}

export async function updateLicenseOrder(id: string, _prev: string | undefined, formData: FormData) {
  const isi = bacaForm(formData);
  const paket = bacaPaket(formData);
  const nomorMentah = String(formData.get("wa") ?? "");

  const salah = periksaForm(isi, paket, nomorMentah);
  if (salah) return salah;

  let nomor;
  try {
    nomor = pecahNomor(nomorMentah);
  } catch (e) {
    return (e as Error).message;
  }

  try {
    await prisma.licenseOrder.update({
      where: { id },
      data: {
        namaUsaha: isi.nama_usaha,
        kontakNama: isi.kontak_nama,
        catatan: isi.catatan,
        templateSlug: isi.template_slug,
        merekA: isi.merek_a,
        merekB: isi.merek_b,
        merekSpasi: isi.merek_spasi,
        tagline: isi.tagline,
        footerTagline: isi.footer_tagline,
        waNomor: nomor.wa,
        waTampil: nomor.tampil,
        warna: isi.warna,
        bankNama: isi.bank_nama,
        bankNomor: isi.bank_nomor,
        bankAtasNama: isi.bank_atas_nama,
        logoDataUrl: isi.logo_data_url,
        bgDataUrl: isi.bg_data_url,
        // Baris paket tidak punya makna sendiri di luar pesanannya, jadi
        // menulis ulang seluruhnya lebih sederhana daripada mencocokkan satu
        // per satu.
        packages: {
          deleteMany: {},
          create: paket.map((p) => ({
            posisi: p.posisi,
            nama: p.nama,
            harga: p.harga,
            metaAtas: p.meta_atas,
            metaBawah: p.meta_bawah,
            warna: p.warna,
            rank: p.rank,
          })),
        },
      },
    });
  } catch (e) {
    return (e as Error).message;
  }

  revalidatePath("/login-page-hotspot");
  revalidatePath(`/login-page-hotspot/${id}/edit`);
  return "Tersimpan.";
}

/**
 * Menerbitkan kunci dari ID ROUTER yang dilaporkan pembeli.
 *
 * Sengaja terpisah dari penyimpanan pesanan: ID ROUTER baru diketahui setelah
 * pembeli memasang berkasnya, jadi ini selalu langkah kedua. Menerbitkan ulang
 * dengan ID berbeda diperbolehkan — pembeli yang mengganti nama routernya
 * butuh kunci baru, dan itu bukan pelanggaran.
 */
export async function terbitkanLisensi(id: string, _prev: string | undefined, formData: FormData) {
  const identity = rapikanIdentity(String(formData.get("router_identity") ?? ""));
  if (!identity) return "ID ROUTER belum diisi.";
  if (identity.startsWith("$(")) {
    return "Itu bukan ID ROUTER, melainkan tulisan mentah dari template. Pembeli harus menyalin yang tampil di layar HP.";
  }

  let kunci: string;
  try {
    kunci = buatKunci(identity, bacaSalt());
  } catch (e) {
    return (e as Error).message;
  }

  try {
    await prisma.licenseOrder.update({
      where: { id },
      data: {
        routerIdentity: identity,
        lisensiKunci: kunci,
        lisensiTerbitPada: new Date(),
        status: "aktif",
      },
    });
  } catch (e) {
    return (e as Error).message;
  }

  revalidatePath("/login-page-hotspot");
  revalidatePath(`/login-page-hotspot/${id}/edit`);
  return `Kunci terbit: ${kunci}`;
}

export async function deleteLicenseOrder(id: string) {
  await prisma.licenseOrder.delete({ where: { id } });
  revalidatePath("/login-page-hotspot");
}
