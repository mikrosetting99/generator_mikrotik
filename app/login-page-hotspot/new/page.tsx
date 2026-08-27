import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { createLicenseOrder } from "@/lib/actions/licenses";
import { LicenseForm } from "@/components/login-page-hotspot/LicenseForm";
import { Note } from "@/components/ui";
import { biayaPesanan, rupiah, saldoKoin } from "@/lib/koin/saldo";

/* Saldo bisa berubah kapan saja lewat topup, jadi jangan disajikan dari cache
   — angka yang basi di sini berarti pelanggan mengisi form panjang lalu
   ditolak di ujung. */
export const dynamic = "force-dynamic";

export default async function PesananBaruPage() {
  const [saldo, biaya] = await Promise.all([saldoKoin(), biayaPesanan()]);
  const cukup = saldo >= biaya;

  return (
    <div>
      <Link
        href="/login-page-hotspot"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Link>

      <h1 className="mt-4 text-lg font-semibold text-ink">Pesanan Baru</h1>
      <p className="mt-1 text-sm text-muted">
        Isi identitas usaha dan daftar paketnya. Kunci lisensi diterbitkan belakangan, setelah pembeli
        memasang berkasnya dan melaporkan ID ROUTER.
      </p>

      {/* Biaya disebut sebelum form, bukan sesudahnya. Koin terpotong begitu
          pesanan disimpan, jadi pelanggan harus tahu sebelum mulai mengisi. */}
      {biaya > 0 && (
        <div className="mt-4">
          {cukup ? (
            <Note>
              Menyimpan pesanan ini memotong{" "}
              <b className="text-ink">{biaya.toLocaleString("id-ID")} koin</b> ({rupiah(biaya)}).
              Saldo Anda {saldo.toLocaleString("id-ID")} koin.
            </Note>
          ) : (
            <Note tone="warn">
              Saldo Anda {saldo.toLocaleString("id-ID")} koin, sedangkan satu pesanan butuh{" "}
              {biaya.toLocaleString("id-ID")} koin ({rupiah(biaya)}).{" "}
              <Link
                href="/login-page-hotspot/koin"
                className="font-medium text-brand hover:underline"
              >
                Isi saldo dulu
              </Link>{" "}
              agar isian Anda tidak terbuang saat disimpan.
            </Note>
          )}
        </div>
      )}

      <div className="mt-6">
        <LicenseForm action={createLicenseOrder} submitLabel="Simpan Pesanan" />
      </div>
    </div>
  );
}
