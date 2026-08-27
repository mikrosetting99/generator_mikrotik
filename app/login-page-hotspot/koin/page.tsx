import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { TopupPanel } from "@/components/login-page-hotspot/TopupPanel";
import { EmptyState, Note } from "@/components/ui";
import { duitkuSiap } from "@/lib/koin/duitku";
import { adminSiap } from "@/lib/supabase/admin";
import {
  biayaPesanan,
  paketKoin,
  riwayatKoin,
  riwayatTopup,
  rupiah,
  saldoKoin,
  waktuSingkat,
} from "@/lib/koin/saldo";

export const metadata = {
  title: "Koin — Login Page Hotspot",
  robots: { index: false, follow: false },
};

/* Saldo berubah setiap kali callback pembayaran masuk, jadi halaman ini tidak
   boleh disajikan dari cache. */
export const dynamic = "force-dynamic";

const WARNA_STATUS: Record<string, string> = {
  menunggu: "border-warn/30 bg-warn/[0.08] text-warn",
  lunas: "border-accent/30 bg-accent/[0.08] text-accent",
  gagal: "border-bad/25 bg-bad/[0.07] text-bad",
  kedaluwarsa: "border-line bg-raised text-muted",
};

export default async function KoinPage({
  searchParams,
}: {
  searchParams: Promise<{ topup?: string }>;
}) {
  const { topup: kembaliDari } = await searchParams;

  const [saldo, paket, topups, riwayat, biaya] = await Promise.all([
    saldoKoin(),
    paketKoin(),
    riwayatTopup(),
    riwayatKoin(),
    biayaPesanan(),
  ]);
  const cukup = biaya > 0 ? Math.floor(saldo / biaya) : 0;
  const baru = kembaliDari ? topups.find((t) => t.merchant_order_id === kembaliDari) : undefined;

  return (
    <div>
      <Link
        href="/login-page-hotspot"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        Pesanan
      </Link>

      {/* --- saldo --- */}
      <div className="mt-4 rounded-2xl border border-line bg-surface px-5 py-6">
        <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
          Saldo koin
        </span>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-4xl font-bold tracking-tight text-ink">
            {saldo.toLocaleString("id-ID")}
          </span>
          <span className="text-sm text-muted">
            setara {rupiah(saldo)} &middot; cukup untuk {cukup.toLocaleString("id-ID")} pesanan
          </span>
        </div>
      </div>

      {/* --- kabar dari halaman pembayaran --- */}
      {baru && (
        <div className="mt-4">
          {baru.status === "lunas" ? (
            <Note>
              Pembayaran <span className="font-mono text-ink">{baru.merchant_order_id}</span> sudah
              masuk — {baru.koin} koin ditambahkan.
            </Note>
          ) : (
            <Note tone="warn">
              Pembayaran <span className="font-mono text-ink">{baru.merchant_order_id}</span> belum
              tercatat lunas. Koin masuk sendiri begitu Duitku mengirim konfirmasi — biasanya
              beberapa detik setelah pembayaran, tidak perlu mengulang topup. Muat ulang halaman ini
              untuk memeriksa.
            </Note>
          )}
        </div>
      )}

      {/* --- peringatan konfigurasi, hanya saat memang belum lengkap --- */}
      {!duitkuSiap() && (
        <div className="mt-4">
          <Note tone="bad">
            Duitku belum dikonfigurasi. Isi{" "}
            <span className="font-mono">DUITKU_MERCHANT_CODE</span>,{" "}
            <span className="font-mono">DUITKU_API_KEY</span>, dan{" "}
            <span className="font-mono">NEXT_PUBLIC_APP_URL</span> di{" "}
            <span className="font-mono">.env.local</span>, lalu build ulang.
          </Note>
        </div>
      )}
      {duitkuSiap() && !adminSiap() && (
        <div className="mt-4">
          <Note tone="bad">
            <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> masih kosong. Pembayaran
            bisa dibuat, tetapi koin <b>tidak akan pernah masuk</b> karena callback tidak punya hak
            menulis ke buku besar.
          </Note>
        </div>
      )}

      {/* --- topup --- */}
      <h2 className="mt-8 text-sm font-semibold text-ink">Tambah koin</h2>
      <p className="mt-1 text-sm text-muted">
        1 koin = Rp 1. Satu pesanan login page {biaya.toLocaleString("id-ID")} koin (
        {rupiah(biaya)}). Pembayaran lewat Duitku: QRIS, virtual account, dan e-wallet.
      </p>
      <div className="mt-4">
        <TopupPanel paket={paket} />
      </div>

      {/* --- riwayat topup --- */}
      <h2 className="mt-10 text-sm font-semibold text-ink">Riwayat pembayaran</h2>
      <div className="mt-3">
        {topups.length === 0 ? (
          <EmptyState>Belum ada topup.</EmptyState>
        ) : (
          <div className="grid gap-2">
            {topups.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <span className="font-mono text-xs text-faint">{t.merchant_order_id}</span>
                <span className="flex-1 text-sm text-ink">
                  {t.koin} koin &middot; {rupiah(t.rupiah)}
                  {t.metode && <span className="text-faint"> &middot; {t.metode}</span>}
                </span>
                <span className="text-xs text-faint">{waktuSingkat(t.created_at)}</span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                    WARNA_STATUS[t.status] ?? WARNA_STATUS.kedaluwarsa
                  }`}
                >
                  {t.status}
                </span>
                {t.status === "menunggu" && t.payment_url && (
                  <a
                    href={t.payment_url}
                    className="text-xs font-medium text-brand hover:underline"
                  >
                    Lanjut bayar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- buku besar --- */}
      <h2 className="mt-10 text-sm font-semibold text-ink">Riwayat koin</h2>
      <p className="mt-1 text-sm text-muted">
        Setiap penambahan dan pemakaian tercatat di sini dan tidak pernah dihapus.
      </p>
      <div className="mt-3">
        {riwayat.length === 0 ? (
          <EmptyState>Belum ada catatan koin.</EmptyState>
        ) : (
          <div className="grid gap-2">
            {riwayat.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3"
              >
                <span
                  className={`w-16 shrink-0 font-mono text-sm font-semibold ${
                    r.jumlah > 0 ? "text-accent" : "text-bad"
                  }`}
                >
                  {r.jumlah > 0 ? "+" : ""}
                  {r.jumlah}
                </span>
                <span className="flex-1 text-sm text-ink">{r.keterangan ?? r.jenis}</span>
                <span className="text-xs text-faint">{waktuSingkat(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
