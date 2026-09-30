import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { createLicenseOrder } from "@/lib/actions/licenses";
import { LicenseForm } from "@/components/login-page-hotspot/LicenseForm";

export default function PesananBaruPage() {
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

      <div className="mt-6">
        <LicenseForm action={createLicenseOrder} submitLabel="Simpan Pesanan" />
      </div>
    </div>
  );
}
