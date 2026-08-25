import Link from "next/link";
import { Download, FileText, Plus } from "@/components/icons";
import { daftarPesanan } from "@/lib/actions/licenses";
import { TEMPLATES } from "@/lib/license/templates";
import type { StatusPesanan } from "@/lib/license/pesanan";
import { Button, EmptyState } from "@/components/ui";

/**
 * `cn` sengaja TIDAK diimpor di sini. Berkas ini server component, sedangkan
 * components/ui bertanda "use client" — merender komponennya boleh, tapi
 * memanggil fungsinya dari server tidak. Kelasnya digabung dengan template
 * string biasa saja; di sini yang digabung memang hanya dua nilai tetap.
 */
const WARNA_STATUS: Record<StatusPesanan, string> = {
  draft: "border-line bg-raised text-muted",
  terkirim: "border-brand/30 bg-brand/[0.08] text-brand",
  aktif: "border-accent/30 bg-accent/[0.08] text-accent",
  batal: "border-bad/25 bg-bad/[0.07] text-bad",
};

export default async function LisensiPage() {
  const pesanan = await daftarPesanan();
  const namaTemplate = new Map(TEMPLATES.map((t) => [t.slug, t.nama]));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Pesanan Lisensi</h1>
          <p className="mt-1 text-sm text-muted">
            Satu pesanan menghasilkan satu folder login page siap upload ke MikroTik.
          </p>
        </div>
        <Link href="/lisensi/new">
          <Button variant="brand" size="sm">
            <Plus className="h-4 w-4" />
            Pesanan Baru
          </Button>
        </Link>
      </div>

      {pesanan.length === 0 ? (
        <div className="mt-8">
          <EmptyState>
            Belum ada pesanan. Tekan <b className="text-ink">Pesanan Baru</b> untuk membuat yang pertama.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {pesanan.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3.5"
            >
              <span className="font-mono text-xs text-faint">#{p.nomor}</span>

              <div className="min-w-[10rem] flex-1">
                <div className="text-sm font-medium text-ink">{p.nama_usaha}</div>
                <div className="text-xs text-faint">
                  {p.wa_tampil} · {namaTemplate.get(p.template_slug) ?? p.template_slug} ·{" "}
                  {p.license_packages.length} paket
                </div>
              </div>

              <div className="min-w-[9rem]">
                {p.lisensi_kunci ? (
                  <>
                    <div className="font-mono text-xs text-ink">{p.lisensi_kunci}</div>
                    <div className="truncate text-xs text-faint">{p.router_identity}</div>
                  </>
                ) : (
                  <span className="text-xs text-faint">kunci belum terbit</span>
                )}
              </div>

              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${WARNA_STATUS[p.status]}`}
              >
                {p.status}
              </span>

              <div className="flex items-center gap-1">
                <a href={`/lisensi/${p.id}/unduh`} title="Unduh folder">
                  <Button size="sm" ariaLabel="Unduh folder">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
                <Link href={`/lisensi/${p.id}/edit`} title="Buka pesanan">
                  <Button size="sm" variant="ghost" ariaLabel="Buka pesanan">
                    <FileText className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
