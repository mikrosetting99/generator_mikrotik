"use client";

import { useActionState, useState } from "react";
import { Plus, Trash } from "@/components/icons";
import { Button, Panel, cn, controlBase } from "@/components/ui";
import { ImageField } from "@/components/login-page-hotspot/ImageField";
import { PilihTema } from "@/components/login-page-hotspot/PilihTema";
import { Pratinjau } from "@/components/login-page-hotspot/Pratinjau";
import { TEMPLATES, cariTemplate } from "@/lib/license/templates";
import type { PesananLengkap } from "@/lib/license/pesanan";

type Aksi = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

type BarisPaket = {
  nama: string;
  harga: string;
  meta_atas: string;
  meta_bawah: string;
  warna: string;
  rank: string;
};

const PAKET_KOSONG: BarisPaket = {
  nama: "",
  harga: "",
  meta_atas: "Masa aktif",
  meta_bawah: "",
  warna: "#3ea6ff",
  rank: "",
};

const CONTOH: BarisPaket[] = [
  { ...PAKET_KOSONG, nama: "6 JAM", harga: "3.000", meta_bawah: "6 jam", warna: "#5ad6c0" },
  { ...PAKET_KOSONG, nama: "1 HARI", harga: "5.000", meta_bawah: "1 hari", warna: "#46c6e0" },
  { ...PAKET_KOSONG, nama: "1 MINGGU", harga: "25.000", meta_bawah: "7 hari", warna: "#3ea6ff" },
  { ...PAKET_KOSONG, nama: "30 HARI", harga: "80.000", meta_bawah: "30 hari", warna: "#2f7fe8" },
];

const kolom = cn(controlBase, "h-11 sm:h-10");
const label = "text-xs font-medium text-muted";
const petunjuk = "text-xs leading-relaxed text-faint";

export function LicenseForm({
  pesanan,
  action,
  submitLabel,
}: {
  pesanan?: PesananLengkap;
  action: Aksi;
  submitLabel: string;
}) {
  const [pesan, formAction, pending] = useActionState(action, undefined);

  const [slug, setSlug] = useState(pesanan?.template_slug ?? TEMPLATES[0].slug);
  const template = cariTemplate(slug);

  const [paket, setPaket] = useState<BarisPaket[]>(
    pesanan?.license_packages.length
      ? pesanan.license_packages.map((p) => ({
          nama: p.nama,
          harga: p.harga,
          meta_atas: p.meta_atas,
          meta_bawah: p.meta_bawah,
          warna: p.warna,
          rank: p.rank ?? "",
        }))
      : CONTOH
  );

  const ubah = (i: number, kunci: keyof BarisPaket, nilai: string) =>
    setPaket((lama) => lama.map((p, j) => (i === j ? { ...p, [kunci]: nilai } : p)));

  const berhasil = pesan?.startsWith("Tersimpan");

  return (
    <form action={formAction} className="grid gap-6">
      <Panel title="Pesanan" step="01" description="Identitas pembeli dan pilihan desain.">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className={label} htmlFor="nama_usaha">
              Nama usaha
            </label>
            <input
              id="nama_usaha"
              name="nama_usaha"
              defaultValue={pesanan?.nama_usaha}
              placeholder="WARUNG PAK BUDI"
              required
              className={kolom}
            />
            <p className={petunjuk}>
              Dipakai di judul tab, logo teks, kaki halaman, dan isi pesan WhatsApp.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className={label} htmlFor="kontak_nama">
                Nama pemesan
              </label>
              <input
                id="kontak_nama"
                name="kontak_nama"
                defaultValue={pesanan?.kontak_nama ?? ""}
                className={kolom}
              />
            </div>
            <div className="grid gap-1.5">
              <label className={label} htmlFor="wa">
                Nomor WhatsApp pembeli
              </label>
              <input
                id="wa"
                name="wa"
                defaultValue={pesanan?.wa_tampil ?? ""}
                placeholder="0821-9304-7243"
                required
                className={kolom}
              />
              <p className={petunjuk}>Boleh 08xx, 62xx, atau +62xx — dua bentuknya dibuat otomatis.</p>
            </div>
          </div>

          <div className="grid gap-2">
            <span className={label}>Login page</span>
            <PilihTema nilai={slug} onPilih={setSlug} />
          </div>
        </div>
      </Panel>

      <Panel title="Tampilan" step="02" description="Merek, gambar, dan warna tema.">
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className={label} htmlFor="tagline">
              Tagline di bawah logo
            </label>
            <input
              id="tagline"
              name="tagline"
              defaultValue={pesanan?.tagline ?? ""}
              placeholder={template.taglineAsli}
              className={kolom}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label className={label} htmlFor="merek_a">
                Logo teks — bagian putih
              </label>
              <input
                id="merek_a"
                name="merek_a"
                defaultValue={pesanan?.merek_a ?? ""}
                placeholder="WARUNG"
                className={kolom}
              />
            </div>
            <div className="grid gap-1.5">
              <label className={label} htmlFor="merek_b">
                Logo teks — bagian berwarna
              </label>
              <input
                id="merek_b"
                name="merek_b"
                defaultValue={pesanan?.merek_b ?? ""}
                placeholder="PAK BUDI"
                className={kolom}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="merek_spasi"
              defaultChecked={pesanan?.merek_spasi ?? true}
              className="h-4 w-4 accent-[color:var(--color-brand)]"
            />
            Beri spasi di antara kedua bagian
          </label>
          <p className={cn(petunjuk, "-mt-2")}>
            Kosongkan keduanya untuk memecah otomatis di spasi terakhir nama usaha.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <ImageField name="logo_data_url" label="Logo (opsional)" jenis="logo" defaultValue={pesanan?.logo_data_url} />
            <ImageField name="bg_data_url" label="Latar belakang (opsional)" jenis="latar" defaultValue={pesanan?.bg_data_url} />
          </div>
          <p className={cn(petunjuk, "-mt-2")}>
            {template.punyaLatarBawaan
              ? `Tanpa unggahan, latar bawaan tema ${template.nama} yang dipakai.`
              : "Tanpa unggahan, tema ini memakai hiasan gambar bawaannya sendiri."}{" "}
            Rasio 9:16 dipilih karena layar HP berkisar 0,45–0,56 — di rasio itu pemotongan
            kiri-kanannya paling kecil.
          </p>

          <div className="grid gap-2">
            <span className={label}>Warna tema</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {template.warna.map((slot) => (
                <div key={slot.kunci} className="grid gap-1.5">
                  <label className={petunjuk} htmlFor={`warna_${slot.kunci}`}>
                    {slot.label}
                  </label>
                  <input
                    id={`warna_${slot.kunci}`}
                    name={`warna_${slot.kunci}`}
                    type="color"
                    defaultValue={pesanan?.warna?.[slot.kunci] ?? slot.bawaan}
                    className="h-10 w-full cursor-pointer rounded-lg border border-line bg-canvas p-1"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Paket voucher"
        step="03"
        description={`Semua kartu berjajar satu baris supaya muat satu layar di HP. Maksimal ${template.maksKartu} paket.`}
        right={<span className="text-xs text-faint">{paket.length} paket</span>}
      >
        <div className="grid gap-3">
          {paket.map((p, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-line-soft bg-canvas/40 p-3">
              <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr_1fr_1fr_auto]">
                <div className="grid gap-1.5">
                  <label className={petunjuk}>Nama paket</label>
                  <input
                    name="paket_nama"
                    value={p.nama}
                    onChange={(e) => ubah(i, "nama", e.target.value)}
                    placeholder="1 HARI"
                    className={kolom}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className={petunjuk}>Harga</label>
                  <input
                    name="paket_harga"
                    value={p.harga}
                    onChange={(e) => ubah(i, "harga", e.target.value)}
                    placeholder="5.000"
                    className={kolom}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className={petunjuk}>Keterangan baris 1</label>
                  <input
                    name="paket_meta_atas"
                    value={p.meta_atas}
                    onChange={(e) => ubah(i, "meta_atas", e.target.value)}
                    placeholder="Masa aktif"
                    className={kolom}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className={petunjuk}>Baris 2</label>
                  <input
                    name="paket_meta_bawah"
                    value={p.meta_bawah}
                    onChange={(e) => ubah(i, "meta_bawah", e.target.value)}
                    placeholder="1 hari"
                    className={kolom}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    name="paket_warna"
                    type="color"
                    aria-label={`Warna kartu ${i + 1}`}
                    value={p.warna}
                    onChange={(e) => ubah(i, "warna", e.target.value)}
                    className="h-11 w-12 cursor-pointer rounded-lg border border-line bg-canvas p-1 sm:h-10"
                  />
                  <Button
                    variant="danger"
                    ariaLabel={`Hapus paket ${i + 1}`}
                    onClick={() => setPaket((lama) => lama.filter((_, j) => j !== i))}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pita tingkatan hanya ada di tema yang punya, seperti KAGE atau MYTHIC. */}
              {template.punyaRank ? (
                <div className="grid gap-1.5">
                  <label className={petunjuk}>
                    Pita tingkatan — kosongkan untuk memakai bawaan tema
                  </label>
                  <input
                    name="paket_rank"
                    value={p.rank}
                    onChange={(e) => ubah(i, "rank", e.target.value)}
                    placeholder="KAGE"
                    className={kolom}
                  />
                </div>
              ) : (
                <input type="hidden" name="paket_rank" value="" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-3">
          <Button
            size="sm"
            disabled={paket.length >= template.maksKartu}
            onClick={() => setPaket((lama) => [...lama, { ...PAKET_KOSONG }])}
          >
            <Plus className="h-4 w-4" />
            Tambah paket
          </Button>
        </div>
      </Panel>

      <Panel
        title="Rekening & catatan"
        step="04"
        optional
        description="Kotak rekening hanya tampil di tema yang punya tempatnya. Kosongkan nomornya untuk menyembunyikannya."
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <label className={label} htmlFor="bank_nama">
                Nama bank
              </label>
              <input
                id="bank_nama"
                name="bank_nama"
                defaultValue={pesanan?.bank_nama ?? ""}
                placeholder="BANK MANDIRI"
                className={kolom}
              />
            </div>
            <div className="grid gap-1.5">
              <label className={label} htmlFor="bank_nomor">
                Nomor rekening
              </label>
              <input
                id="bank_nomor"
                name="bank_nomor"
                defaultValue={pesanan?.bank_nomor ?? ""}
                className={kolom}
              />
            </div>
            <div className="grid gap-1.5">
              <label className={label} htmlFor="bank_atas_nama">
                Atas nama
              </label>
              <input
                id="bank_atas_nama"
                name="bank_atas_nama"
                defaultValue={pesanan?.bank_atas_nama ?? ""}
                className={kolom}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <div className="grid gap-1.5">
              <label className={label} htmlFor="catatan">
                Catatan internal
              </label>
              <textarea
                id="catatan"
                name="catatan"
                rows={3}
                defaultValue={pesanan?.catatan ?? ""}
                className={cn(controlBase, "resize-y py-2.5 leading-relaxed")}
              />
            </div>
            <div className="grid gap-1.5">
              <label className={label} htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={pesanan?.status ?? "draft"}
                className={cn(kolom, "cursor-pointer appearance-none pr-9")}
              >
                <option value="draft">Draft</option>
                <option value="terkirim">Terkirim ke pembeli</option>
                <option value="aktif">Aktif (lisensi terbit)</option>
                <option value="batal">Batal</option>
              </select>
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        title="Pratinjau"
        step="05"
        description="Diambil dari isian di atas, tanpa perlu menyimpan dulu. Dicetak dengan mesin yang sama dengan hasil unduhan."
      >
        <Pratinjau />
      </Panel>

      {pesan && (
        <p className={cn("text-sm", berhasil ? "text-accent" : "text-bad")}>{pesan}</p>
      )}

      <div>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? "Menyimpan…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
