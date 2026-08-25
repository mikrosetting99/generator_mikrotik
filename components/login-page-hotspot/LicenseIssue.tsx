"use client";

import { useActionState } from "react";
import { Lock } from "@/components/icons";
import { Button, Panel, cn, controlBase } from "@/components/ui";
import type { PesananLengkap } from "@/lib/license/pesanan";

type Aksi = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

/**
 * Langkah kedua sebuah pesanan: menerbitkan kunci dari ID ROUTER.
 *
 * Terpisah dari form pesanan karena memang terjadi di waktu yang berbeda —
 * ID ROUTER baru ada setelah pembeli memasang berkasnya dan melihat layar
 * "LISENSI TIDAK AKTIF" di HP-nya.
 */
export function LicenseIssue({ pesanan, action }: { pesanan: PesananLengkap; action: Aksi }) {
  const [pesan, formAction, pending] = useActionState(action, undefined);
  const berhasil = pesan?.startsWith("Kunci terbit");

  return (
    <Panel
      title="Kunci lisensi"
      right={<Lock className="h-4 w-4 text-brand" />}
      description={
        pesanan.lisensi_kunci
          ? undefined
          : "Unduh dulu foldernya dan minta pembeli memasangnya — layar login akan menampilkan ID ROUTER yang perlu diisikan di bawah."
      }
    >
      {pesanan.lisensi_kunci && (
        <div className="mb-4 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
          <div className="font-mono text-lg font-semibold tracking-wide text-ink">
            {pesanan.lisensi_kunci}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            Terikat ke <b className="text-ink">{pesanan.router_identity}</b>
            {pesanan.lisensi_terbit_pada &&
              ` · terbit ${new Date(pesanan.lisensi_terbit_pada).toLocaleDateString("id-ID")}`}
          </div>
        </div>
      )}

      <form action={formAction} className="grid gap-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted" htmlFor="router_identity">
            ID ROUTER (System &gt; Identity)
          </label>
          <input
            id="router_identity"
            name="router_identity"
            defaultValue={pesanan.router_identity ?? ""}
            placeholder="MikroTik-WarungPakBudi"
            className={cn(controlBase, "h-11 font-mono text-[13px] sm:h-10")}
          />
          <p className="text-xs leading-relaxed text-faint">
            Salin persis dari layar pembeli — huruf besar-kecil berpengaruh. Kunci berlaku selamanya
            tapi hanya untuk router ini; kalau namanya diganti, terbitkan ulang di sini.
          </p>
        </div>

        {pesan && <p className={cn("text-sm", berhasil ? "text-accent" : "text-bad")}>{pesan}</p>}

        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Menerbitkan…" : pesanan.lisensi_kunci ? "Terbitkan Ulang" : "Terbitkan Kunci"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
