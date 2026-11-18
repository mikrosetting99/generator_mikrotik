"use client";

import { useEffect, useState } from "react";
import { Check, Cpu, Lock } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui";
import { getModel } from "@/lib/models";
import { formatPhone } from "@/lib/phone";
import { PURPOSE_LABEL, type RequestStatus, type SettingRequestData } from "@/lib/setting-request";
import { RequestForm, type SubmitResult } from "./RequestForm";

type State =
  | { kind: "loading" }
  | { kind: "missing"; message: string }
  | { kind: "ready"; status: RequestStatus; submitted: boolean; locked: boolean; data: SettingRequestData };

function Summary({ data }: { data: SettingRequestData }) {
  const rows: [string, string][] = [
    ["Peruntukan", data.purpose ? PURPOSE_LABEL[data.purpose] : "-"],
    ["Type MikroTik", getModel(data.modelId)?.name ?? "-"],
  ];
  if (data.purpose !== "kantor") {
    rows.push(["Nama usaha", data.businessName], ["No. telepon admin", data.phone ? formatPhone(data.phone) : "-"]);
  }
  rows.push(["Email", data.email]);
  return (
    <dl className="divide-y divide-line-soft rounded-xl border border-line bg-canvas/40">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words font-medium text-ink">{v}</dd>
        </div>
      ))}
      {data.purpose === "kantor" && data.needs && (
        <div className="px-4 py-2.5 text-sm">
          <dt className="text-muted">Kebutuhan</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-ink">{data.needs}</dd>
        </div>
      )}
    </dl>
  );
}

/** Halaman publik yang dibuka pelanggan dari link yang dikirim admin. */
export function CustomerForm({ token, siteName }: { token: string; siteName: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/setting-form/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!active) return;
        if (!r.ok || !d?.data) setState({ kind: "missing", message: d?.error ?? "Link tidak bisa dibuka." });
        else setState({ kind: "ready", status: d.status, submitted: d.submitted, locked: d.locked, data: d.data });
      })
      .catch(() => active && setState({ kind: "missing", message: "Gagal menghubungi server. Periksa koneksi lalu muat ulang." }));
    return () => {
      active = false;
    };
  }, [token]);

  const submit = async (data: SettingRequestData): Promise<SubmitResult> => {
    try {
      const res = await fetch(`/api/setting-form/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, error: d?.error ?? `Gagal mengirim (kode ${res.status}).`, errors: d?.errors };
      setState({ kind: "ready", status: "masuk", submitted: true, locked: false, data: d.data });
      setEditing(false);
      setJustSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return { ok: true };
    } catch {
      return { ok: false, error: "Gagal menghubungi server. Coba lagi." };
    }
  };

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Cpu className="h-4 w-4 shrink-0 text-brand" />
            <span className="truncate text-sm font-semibold text-ink">{siteName}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10">
        {state.kind === "loading" && <p className="py-16 text-center text-sm text-faint">Memuat form…</p>}

        {state.kind === "missing" && (
          <div className="mx-auto max-w-sm py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-muted">
              <Lock className="h-5 w-5" />
            </span>
            <h1 className="mt-5 text-lg font-semibold text-ink">Form tidak tersedia</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{state.message} Minta link baru ke admin bila perlu.</p>
          </div>
        )}

        {state.kind === "ready" && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="border-b border-line-soft px-5 py-4 sm:px-6">
              <h1 className="text-lg font-semibold tracking-tight text-ink">Form Setting MikroTik</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Isi kebutuhan router Anda. Admin akan menyiapkan konfigurasi MikroTik
                {state.data.purpose === "kantor" ? "" : " dan halaman login hotspot"} berdasarkan isian ini.
              </p>
            </div>

            <div className="px-5 py-5 sm:px-6">
              {state.submitted && !editing ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/[0.08] px-4 py-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[color:var(--color-accent-ink)]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <div className="text-sm leading-relaxed">
                      <p className="font-semibold text-ink">{justSent ? "Terima kasih, data terkirim." : "Data sudah kami terima."}</p>
                      <p className="text-muted">
                        {state.locked
                          ? "Admin sudah menyelesaikan setting untuk permintaan ini."
                          : "Admin akan segera menghubungi Anda. Masih bisa diubah selama belum dikerjakan."}
                      </p>
                    </div>
                  </div>
                  <Summary data={state.data} />
                  {!state.locked && (
                    <Button onClick={() => setEditing(true)} className="w-full">
                      Ubah data
                    </Button>
                  )}
                </div>
              ) : (
                <RequestForm initial={state.data} submitLabel={state.submitted ? "Simpan perubahan" : "Kirim"} onSubmit={submit} />
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
