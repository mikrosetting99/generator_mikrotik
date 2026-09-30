import { cariTemplate } from "./templates";
import type { Pesanan } from "./build";

/**
 * Pembacaan isian form pesanan.
 *
 * Dipakai bersama oleh aksi simpan dan rute pratinjau. Keduanya WAJIB membaca
 * dengan cara yang sama persis — pratinjau yang menafsirkan isian sedikit
 * berbeda dari yang disimpan adalah pratinjau yang berbohong, dan itu lebih
 * buruk daripada tidak ada pratinjau sama sekali.
 */

export function bacaForm(formData: FormData) {
  const namaUsaha = String(formData.get("nama_usaha") ?? "").trim();

  /* Kalau admin tidak memecah sendiri logo teksnya, dipecah di spasi
     terakhir — "WARUNG PAK BUDI" jadi "WARUNG" + "PAK BUDI". Nama tanpa
     spasi masuk seluruhnya ke bagian putih. */
  let merekA = String(formData.get("merek_a") ?? "").trim();
  let merekB = String(formData.get("merek_b") ?? "").trim();
  let merekSpasi = formData.get("merek_spasi") === "on";
  if (!merekA && !merekB) {
    const pisah = namaUsaha.lastIndexOf(" ");
    if (pisah > 0) {
      merekA = namaUsaha.slice(0, pisah);
      merekB = namaUsaha.slice(pisah + 1);
      merekSpasi = true;
    } else {
      merekA = namaUsaha;
      merekB = "";
      merekSpasi = false;
    }
  }

  const templateSlug = String(formData.get("template_slug") ?? "");
  const template = cariTemplate(templateSlug);

  const warna: Record<string, string> = {};
  for (const slot of template.warna) {
    const nilai = String(formData.get(`warna_${slot.kunci}`) ?? "").trim();
    if (nilai && /^#[0-9a-fA-F]{6}$/.test(nilai)) warna[slot.kunci] = nilai.toLowerCase();
  }

  const bankNomor = String(formData.get("bank_nomor") ?? "").trim();

  return {
    nama_usaha: namaUsaha,
    kontak_nama: String(formData.get("kontak_nama") ?? "").trim() || null,
    catatan: String(formData.get("catatan") ?? "").trim() || null,
    template_slug: templateSlug,
    merek_a: merekA,
    merek_b: merekB,
    merek_spasi: merekSpasi,
    tagline: String(formData.get("tagline") ?? "").trim() || template.taglineAsli,
    footer_tagline: String(formData.get("footer_tagline") ?? "").trim() || "Internet Hotspot Voucher",
    warna,
    bank_nama: bankNomor ? String(formData.get("bank_nama") ?? "").trim() || null : null,
    bank_nomor: bankNomor || null,
    bank_atas_nama: bankNomor ? String(formData.get("bank_atas_nama") ?? "").trim() || null : null,
    logo_data_url: String(formData.get("logo_data_url") ?? "").trim() || null,
    bg_data_url: String(formData.get("bg_data_url") ?? "").trim() || null,
    status: String(formData.get("status") ?? "draft"),
  };
}

export function bacaPaket(formData: FormData) {
  const nama = formData.getAll("paket_nama").map(String);
  const harga = formData.getAll("paket_harga").map(String);
  const metaAtas = formData.getAll("paket_meta_atas").map(String);
  const metaBawah = formData.getAll("paket_meta_bawah").map(String);
  const warna = formData.getAll("paket_warna").map(String);
  const rank = formData.getAll("paket_rank").map(String);

  return nama
    .map((n, i) => ({
      posisi: i,
      nama: n.trim(),
      harga: (harga[i] ?? "").trim(),
      meta_atas: (metaAtas[i] ?? "").trim(),
      meta_bawah: (metaBawah[i] ?? "").trim(),
      warna: /^#[0-9a-fA-F]{6}$/.test(warna[i] ?? "") ? warna[i].toLowerCase() : "#3ea6ff",
      rank: (rank[i] ?? "").trim() || null,
    }))
    .filter((p) => p.nama && p.harga)
    .map((p, i) => ({ ...p, posisi: i }));
}

/** Validasi yang berlaku untuk create maupun update. */
export function periksaForm(
  isi: ReturnType<typeof bacaForm>,
  paket: ReturnType<typeof bacaPaket>,
  nomorMentah: string
): string | null {
  if (!isi.nama_usaha) return "Nama usaha wajib diisi.";
  if (!isi.template_slug) return "Template belum dipilih.";
  if (!paket.length) return "Minimal satu paket harus diisi (nama dan harga).";

  const maks = cariTemplate(isi.template_slug).maksKartu;
  if (paket.length > maks) {
    return `Template ini paling banyak ${maks} paket supaya tetap muat satu layar di HP. Sekarang ${paket.length}.`;
  }
  if (!nomorMentah.trim()) return "Nomor WhatsApp wajib diisi.";
  return null;
}

/** Bentuk yang dipakai pencetak, dari hasil bacaForm dan bacaPaket. */
export function jadiPesanan(
  isi: ReturnType<typeof bacaForm>,
  paket: ReturnType<typeof bacaPaket>,
  wa: { wa: string; tampil: string },
  routerIdentity: string | null
): Pesanan {
  return {
    templateSlug: isi.template_slug,
    namaUsaha: isi.nama_usaha,
    merekA: isi.merek_a,
    merekB: isi.merek_b,
    merekSpasi: isi.merek_spasi,
    tagline: isi.tagline,
    footerTagline: isi.footer_tagline,
    waNomor: wa.wa,
    waTampil: wa.tampil,
    paket: paket.map((p) => ({
      nama: p.nama,
      harga: p.harga,
      metaAtas: p.meta_atas,
      metaBawah: p.meta_bawah,
      warna: p.warna,
      rank: p.rank,
    })),
    warna: isi.warna,
    bank: isi.bank_nomor
      ? { nama: isi.bank_nama ?? "", nomor: isi.bank_nomor, atasNama: isi.bank_atas_nama ?? "" }
      : null,
    logoDataUrl: isi.logo_data_url ?? "",
    bgDataUrl: isi.bg_data_url ?? "",
    routerIdentity,
  };
}
