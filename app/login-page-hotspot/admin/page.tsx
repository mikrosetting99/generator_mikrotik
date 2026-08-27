import Link from "next/link";
import { ArrowLeft, Plus, Trash } from "@/components/icons";
import { Button, EmptyState, Note } from "@/components/ui";
import { cn, controlBase } from "@/lib/kelas";
import {
  hapusPaket,
  sesuaikanKoin,
  simpanBiayaPesanan,
  simpanPaket,
  tambahPaket,
  ubahAktifAkun,
  ubahAktifPaket,
} from "@/lib/actions/admin";
import { apakahAdmin, daftarPelanggan, semuaPaket } from "@/lib/koin/admin";
import { biayaPesanan, rupiah, waktuSingkat } from "@/lib/koin/saldo";

export const metadata = {
  title: "Pengaturan — Login Page Hotspot",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const kolom = cn(controlBase, "h-10");

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; galat?: string }>;
}) {
  const { ok, galat } = await searchParams;

  /* Middleware sudah memastikan ada sesi; yang diperiksa di sini perannya.
     Penjagaan sebenarnya tetap di RLS — ini supaya pelanggan yang tersesat
     mendapat kalimat yang jelas, bukan layar penuh pesan izin ditolak. */
  if (!(await apakahAdmin())) {
    return (
      <div className="mx-auto max-w-md py-10">
        <h1 className="text-lg font-semibold text-ink">Khusus admin</h1>
        <p className="mt-2 text-sm text-muted">
          Halaman ini hanya untuk penerbit. Kembali ke{" "}
          <Link href="/login-page-hotspot" className="font-medium text-brand hover:underline">
            daftar pesanan
          </Link>
          .
        </p>
      </div>
    );
  }

  const [paket, biaya, pelanggan] = await Promise.all([
    semuaPaket(),
    biayaPesanan(),
    daftarPelanggan(),
  ]);

  return (
    <div>
      <Link
        href="/login-page-hotspot"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        Pesanan
      </Link>

      <h1 className="mt-4 text-lg font-semibold text-ink">Pengaturan</h1>
      <p className="mt-1 text-sm text-muted">
        Harga berlaku seketika untuk semua pelanggan — tidak perlu deploy ulang.
      </p>

      {galat && (
        <div className="mt-4">
          <Note tone="bad">{galat}</Note>
        </div>
      )}
      {ok && !galat && (
        <div className="mt-4">
          <Note>Tersimpan.</Note>
        </div>
      )}

      {/* ---------------------------------------------------- biaya pesanan */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">Biaya satu pesanan</h2>
        <p className="mt-1 text-sm text-muted">
          Koin yang dipotong setiap pelanggan menyimpan pesanan login page. Admin tidak dipotong.
        </p>

        <form action={simpanBiayaPesanan} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Koin</span>
            <input
              name="biaya"
              defaultValue={biaya}
              inputMode="numeric"
              className={cn(kolom, "w-40 font-mono")}
            />
          </label>
          <span className="pb-2.5 text-sm text-muted">= {rupiah(biaya)}</span>
          <Button type="submit" variant="brand" className="mb-0.5">
            Simpan
          </Button>
        </form>
      </section>

      {/* ----------------------------------------------------- paket topup */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-ink">Paket topup</h2>
        <p className="mt-1 text-sm text-muted">
          Yang tampil di halaman koin pelanggan. Kosongkan kolom koin saat menambah untuk mengikuti
          harganya (1 koin = Rp 1).
        </p>

        <div className="mt-3 grid gap-2">
          {paket.length === 0 && <EmptyState>Belum ada paket topup.</EmptyState>}

          {paket.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex flex-wrap items-end gap-3 rounded-xl border bg-surface px-4 py-3",
                p.aktif ? "border-line" : "border-dashed border-line/70 opacity-60",
              )}
            >
              <form action={simpanPaket} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={p.id} />
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Nama</span>
                  <input name="nama" defaultValue={p.nama} className={cn(kolom, "w-40")} />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Harga (Rp)</span>
                  <input
                    name="rupiah"
                    defaultValue={p.rupiah}
                    inputMode="numeric"
                    className={cn(kolom, "w-32 font-mono")}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Koin</span>
                  <input
                    name="koin"
                    defaultValue={p.koin}
                    inputMode="numeric"
                    className={cn(kolom, "w-32 font-mono")}
                  />
                </label>
                <Button type="submit" size="sm" className="mb-0.5">
                  Simpan
                </Button>
              </form>

              <form action={ubahAktifPaket} className="mb-0.5">
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="aktif" value={p.aktif ? "0" : "1"} />
                <Button type="submit" size="sm" variant="ghost">
                  {p.aktif ? "Sembunyikan" : "Tampilkan"}
                </Button>
              </form>

              <form action={hapusPaket} className="mb-0.5">
                <input type="hidden" name="id" value={p.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="danger"
                  className="px-3"
                  ariaLabel={`Hapus paket ${p.nama}`}
                  title={`Hapus paket ${p.nama}`}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ))}
        </div>

        <form
          action={tambahPaket}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-line px-4 py-3"
        >
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Nama</span>
            <input name="nama" placeholder="otomatis" className={cn(kolom, "w-40")} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Harga (Rp)</span>
            <input
              name="rupiah"
              inputMode="numeric"
              placeholder="50000"
              className={cn(kolom, "w-32 font-mono")}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Koin</span>
            <input
              name="koin"
              inputMode="numeric"
              placeholder="ikut harga"
              className={cn(kolom, "w-32 font-mono")}
            />
          </label>
          <Button type="submit" variant="brand" size="sm" className="mb-0.5">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </form>
      </section>

      {/* -------------------------------------------------------- pelanggan */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold text-ink">Pelanggan</h2>
        <p className="mt-1 text-sm text-muted">
          Beri koin dengan angka positif, tarik kembali dengan angka negatif. Semuanya masuk buku
          besar dan terlihat oleh pelanggan.
        </p>

        <div className="mt-3 grid gap-2">
          {pelanggan.length === 0 && <EmptyState>Belum ada akun.</EmptyState>}

          {pelanggan.map((u) => (
            <div
              key={u.id}
              className={cn(
                "flex flex-wrap items-end gap-3 rounded-xl border bg-surface px-4 py-3",
                u.aktif ? "border-line" : "border-dashed border-line/70 opacity-60",
              )}
            >
              <div className="min-w-[12rem] flex-1">
                <div className="text-sm font-medium text-ink">
                  {u.nama || "(tanpa nama)"}
                  {u.peran === "admin" && (
                    <span className="ml-2 rounded-md border border-brand/30 bg-brand/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-brand">
                      admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-faint">
                  {u.wa || "tanpa WA"} &middot; sejak {waktuSingkat(u.created_at)}
                </div>
              </div>

              <form action={sesuaikanKoin} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="user" value={u.id} />
                <input type="hidden" name="jenis" value="penyesuaian" />
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Koin</span>
                  <input
                    name="jumlah"
                    inputMode="numeric"
                    placeholder="+25000"
                    className={cn(kolom, "w-28 font-mono")}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">Alasan</span>
                  <input
                    name="keterangan"
                    placeholder="refund pesanan #12"
                    className={cn(kolom, "w-48")}
                  />
                </label>
                <Button type="submit" size="sm" className="mb-0.5">
                  Terapkan
                </Button>
              </form>

              {u.peran !== "admin" && (
                <form action={ubahAktifAkun} className="mb-0.5">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="aktif" value={u.aktif ? "0" : "1"} />
                  <Button type="submit" size="sm" variant="ghost">
                    {u.aktif ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
