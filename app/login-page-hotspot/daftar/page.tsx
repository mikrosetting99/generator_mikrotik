import { DaftarForm } from "@/components/login-page-hotspot/DaftarForm";
import { biayaPesanan } from "@/lib/koin/saldo";

export const metadata = {
  title: "Daftar — Login Page Hotspot",
  robots: { index: false, follow: false },
};

export default async function DaftarPage() {
  const biaya = await biayaPesanan();

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-lg font-semibold text-ink">Buat akun</h1>
      <p className="mt-1 text-sm text-muted">
        Setelah mendaftar, isi saldo koin lalu buat login page hotspot sendiri. 1 koin = Rp 1,
        dan satu pesanan {biaya.toLocaleString("id-ID")} koin.
      </p>
      <div className="mt-6">
        <DaftarForm />
      </div>
    </div>
  );
}
