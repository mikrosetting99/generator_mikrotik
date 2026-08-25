import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "@/components/icons";
import { ambilPesanan, terbitkanLisensi, updateLicenseOrder } from "@/lib/actions/licenses";
import { LicenseForm } from "@/components/lisensi/LicenseForm";
import { LicenseIssue } from "@/components/lisensi/LicenseIssue";
import { Button, Note } from "@/components/ui";
import { jalurArsip } from "@/lib/license/arsip";

export default async function LisensiEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pesanan = await ambilPesanan(id);
  if (!pesanan) notFound();

  return (
    <div>
      <Link
        href="/lisensi"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-brand"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">
            Pesanan #{pesanan.nomor} — {pesanan.nama_usaha}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Setiap kali diunduh, berkasnya dicetak ulang dari data di halaman ini.
          </p>
        </div>
        <a href={`/lisensi/${pesanan.id}/unduh`}>
          <Button variant="primary">
            <Download className="h-4 w-4" />
            Unduh Folder
          </Button>
        </a>
      </div>

      <div className="mt-6 grid gap-6">
        <Note>
          Setiap kali diunduh, salinannya juga ditulis di server sebagai{" "}
          <code className="font-mono text-[11px] text-brand">
            {jalurArsip(pesanan.nomor, pesanan.nama_usaha, pesanan.template_slug)}
          </code>{" "}
          — bisa diambil lewat File Manager aaPanel. Berkasnya ditimpa tiap unduhan, dan folder itu
          tidak punya alamat web sehingga tidak bisa diunduh orang lain.
        </Note>

        <LicenseIssue pesanan={pesanan} action={terbitkanLisensi.bind(null, pesanan.id)} />
        <LicenseForm
          pesanan={pesanan}
          action={updateLicenseOrder.bind(null, pesanan.id)}
          submitLabel="Simpan Perubahan"
        />
      </div>
    </div>
  );
}
