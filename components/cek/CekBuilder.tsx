"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Cpu,
  Download,
} from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, CheckPill, EmptyState, Note } from "@/components/ui";
import { cn } from "@/lib/kelas";
import {
  BAGIAN_LABEL,
  buatScriptCek,
  OPSI_BAWAAN,
  perkiraanDetik,
  type Bagian,
} from "@/lib/cek/perintah";
import { bacaLaporan } from "@/lib/cek/parse";
import { analisa, ringkas, tidakDiperiksa, type Tingkat } from "@/lib/cek/analisa";

const SEMUA_BAGIAN = Object.keys(BAGIAN_LABEL) as Bagian[];

const GAYA: Record<Tingkat, { kotak: string; ikon: typeof AlertCircle; label: string }> = {
  kritis: {
    kotak: "border-bad/35 bg-bad/[0.07]",
    ikon: AlertCircle,
    label: "Perlu segera",
  },
  peringatan: {
    kotak: "border-warn/35 bg-warn/[0.07]",
    ikon: AlertTriangle,
    label: "Perlu diperiksa",
  },
  info: { kotak: "border-line bg-raised/50", ikon: AlertCircle, label: "Catatan" },
  baik: { kotak: "border-accent/30 bg-accent/[0.06]", ikon: Check, label: "Sehat" },
};

const TEKS: Record<Tingkat, string> = {
  kritis: "text-bad",
  peringatan: "text-warn",
  info: "text-muted",
  baik: "text-accent",
};

function download(teks: string, nama: string) {
  const url = URL.createObjectURL(new Blob([teks], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}

export function CekBuilder() {
  const [bagian, setBagian] = useState<Bagian[]>(OPSI_BAWAAN.bagian);
  const [wanTeks, setWanTeks] = useState("");
  const [jumlahPing, setJumlahPing] = useState(4);
  const [mentah, setMentah] = useState("");
  const [tersalin, setTersalin] = useState(false);

  const wan = useMemo(
    () => wanTeks.split(/[\s,;]+/).map((w) => w.trim()).filter(Boolean),
    [wanTeks],
  );

  const opsi = useMemo(
    () => ({ ...OPSI_BAWAAN, bagian, wan, jumlahPing }),
    [bagian, wan, jumlahPing],
  );
  const script = useMemo(() => buatScriptCek(opsi), [opsi]);

  /* Laporan dibaca ulang tiap ketikan. Isinya paling banter beberapa ratus
     baris, jadi tidak perlu ditunda — dan hasil yang muncul seketika membuat
     salinan yang kurang lengkap langsung ketahuan. */
  const hasil = useMemo(() => (mentah.trim() ? bacaLaporan(mentah) : null), [mentah]);
  const temuan = useMemo(() => (hasil?.ok ? analisa(hasil.laporan) : []), [hasil]);
  const hitung = useMemo(() => ringkas(temuan), [temuan]);
  const lewat = useMemo(() => (hasil?.ok ? tidakDiperiksa(hasil.laporan) : []), [hasil]);

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      setTersalin(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>
            <span className="h-5 w-px bg-line" />
            <div className="flex min-w-0 items-center gap-2">
              <Cpu className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Cek Mikrotik</h1>
              <span className="hidden text-xs text-faint lg:inline">by Mikrosetting.com</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-5 py-6 lg:grid-cols-2">
        {/* ------------------------------------------------ langkah 1 & 2 */}
        <div className="space-y-5">
          <section className="edge-light rounded-2xl border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 font-mono text-[11px] font-medium text-brand">
                  1
                </span>
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                  Pilih yang mau diperiksa
                </h2>
              </div>
            </header>

            <div className="px-5 py-5">
              <div className="flex flex-wrap gap-2">
                {SEMUA_BAGIAN.map((b) => (
                  <CheckPill
                    key={b}
                    active={bagian.includes(b)}
                    onClick={() =>
                      setBagian((lama) =>
                        lama.includes(b) ? lama.filter((x) => x !== b) : [...lama, b],
                      )
                    }
                  >
                    {BAGIAN_LABEL[b]}
                  </CheckPill>
                ))}
              </div>

              {bagian.includes("internet") && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                      Interface WAN
                    </span>
                    <input
                      value={wanTeks}
                      onChange={(e) => setWanTeks(e.target.value)}
                      placeholder="ether1, ether2"
                      className="h-10 w-full rounded-lg border border-line bg-canvas px-3 font-mono text-[13px] text-ink outline-none focus:border-brand"
                    />
                    <span className="text-xs text-faint">
                      Kosongkan bila belum tahu — router memilih jalurnya sendiri.
                    </span>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                      Paket ping per target
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={jumlahPing}
                      onChange={(e) => setJumlahPing(Number(e.target.value) || 4)}
                      className="h-10 w-full rounded-lg border border-line bg-canvas px-3 font-mono text-[13px] text-ink outline-none focus:border-brand"
                    />
                    <span className="text-xs text-faint">
                      Script berjalan sekitar {perkiraanDetik(opsi)} detik.
                    </span>
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="edge-light overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 font-mono text-[11px] font-medium text-brand">
                  2
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                    Jalankan di router pelanggan
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Paste di New Terminal — lewat Winbox, WebFig, atau SSH. Script ini hanya
                    membaca, tidak mengubah apa pun.
                  </p>
                </div>
              </div>
            </header>

            <pre className="max-h-[26vh] overflow-auto bg-code px-4 py-3 font-mono text-[11.5px] leading-[1.7]">
              {script}
            </pre>

            <div className="flex flex-wrap gap-2 border-t border-line-soft bg-canvas/40 px-4 py-3.5">
              <Button variant="primary" onClick={salin} className="flex-1">
                {tersalin ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {tersalin ? "Tersalin" : "Copy to Clipboard"}
              </Button>
              <Button onClick={() => download(script, "cek-mikrotik.rsc")}>
                <Download className="h-4 w-4" />
                .rsc
              </Button>
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------- langkah 3 */}
        <div className="space-y-5">
          <section className="edge-light rounded-2xl border border-line bg-surface">
            <header className="border-b border-line-soft px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 font-mono text-[11px] font-medium text-brand">
                  3
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                    Tempel hasilnya di sini
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    Blok seluruh keluaran terminal, salin, lalu tempel. Prompt dan perintah yang
                    ikut tersalin diabaikan sendiri.
                  </p>
                </div>
              </div>
            </header>

            <div className="px-5 py-5">
              <textarea
                value={mentah}
                onChange={(e) => setMentah(e.target.value)}
                spellCheck={false}
                placeholder={"MSCEK|1\nWAKTU|...\nIDENT|Router-Warnet\n..."}
                className="h-40 w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-relaxed text-ink outline-none focus:border-brand"
              />

              {hasil && !hasil.ok && (
                <div className="mt-3">
                  <Note tone="bad">{hasil.pesan}</Note>
                </div>
              )}
              {hasil?.ok && hasil.pesan && (
                <div className="mt-3">
                  <Note tone="warn">{hasil.pesan}</Note>
                </div>
              )}
            </div>
          </section>

          {/* ------------------------------------------------- langkah 4 */}
          {hasil?.ok && (
            <section className="edge-light rounded-2xl border border-line bg-surface">
              <header className="border-b border-line-soft px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-brand/25 bg-brand/10 font-mono text-[11px] font-medium text-brand">
                      4
                    </span>
                    <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                      Hasil & rekomendasi
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["kritis", "peringatan", "info", "baik"] as Tingkat[])
                      .filter((k) => hitung[k] > 0)
                      .map((k) => (
                        <span
                          key={k}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                            GAYA[k].kotak,
                            TEKS[k],
                          )}
                        >
                          {hitung[k]} {GAYA[k].label.toLowerCase()}
                        </span>
                      ))}
                  </div>
                </div>

                {hasil.laporan.sistem?.identity && (
                  <p className="mt-2 font-mono text-xs text-faint">
                    {hasil.laporan.sistem.identity} · {hasil.laporan.sistem.board} · RouterOS{" "}
                    {hasil.laporan.sistem.versi} · uptime {hasil.laporan.sistem.uptime}
                  </p>
                )}
              </header>

              <div className="space-y-3 px-5 py-5">
                {temuan.length === 0 && (
                  <EmptyState>
                    Tidak ada temuan dari bagian yang diperiksa.
                  </EmptyState>
                )}

                {temuan.map((x, i) => {
                  const g = GAYA[x.tingkat];
                  const Ikon = g.ikon;
                  return (
                    <article
                      key={`${x.judul}-${i}`}
                      className={cn("rounded-xl border px-4 py-3.5", g.kotak)}
                    >
                      <div className="flex items-start gap-2.5">
                        <Ikon className={cn("mt-0.5 h-4 w-4 shrink-0", TEKS[x.tingkat])} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <h3 className="text-sm font-semibold text-ink">{x.judul}</h3>
                            <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
                              {x.bagian}
                            </span>
                          </div>

                          <p className="mt-1 text-[13px] leading-relaxed text-muted">{x.terlihat}</p>
                          {x.sebab && (
                            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                              <span className="text-ink">Kenapa penting: </span>
                              {x.sebab}
                            </p>
                          )}
                          {x.saran && (
                            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                              <span className="text-ink">Saran: </span>
                              {x.saran}
                            </p>
                          )}
                          {x.perintah && (
                            <pre className="mt-2 overflow-x-auto rounded-lg bg-code px-3 py-2 font-mono text-[11.5px] text-ink">
                              {x.perintah}
                            </pre>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}

                {lewat.length > 0 && (
                  <Note>
                    Tidak diperiksa karena tidak ada datanya:{" "}
                    <span className="text-ink">{lewat.join(", ")}</span>. Router tanpa hotspot bukan
                    berarti hotspotnya sehat — bagian itu memang tidak diuji.
                  </Note>
                )}

                {hasil.laporan.takDikenal.length > 0 && (
                  <Note tone="warn">
                    {hasil.laporan.takDikenal.length} baris tidak dikenali pembaca ini. Kemungkinan
                    RouterOS versi berbeda; kirimkan laporannya bila ada yang terlewat.
                  </Note>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
