"use client";

import { useRef, useState } from "react";
import { Download, FileText } from "@/components/icons";
import { Button, Field, Note, TextInput, Toggle } from "@/components/ui";
import { buildHandoverDocument } from "@/lib/handover";
import type { SetupConfig } from "@/lib/types";

/** Textarea sederhana; hanya dipakai di dialog ini. */
function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-faint/70 hover:border-line/80 focus:border-brand focus:shadow-[0_0_0_3px_rgba(56,189,248,0.14)]"
    />
  );
}

export function HandoverDialog({
  config,
  patch,
}: {
  config: SetupConfig;
  patch: (partial: Partial<SetupConfig>) => void;
}) {
  const h = config.handover;
  const setHandover = (partial: Partial<typeof h>) =>
    patch({ handover: { ...h, ...partial } });

  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState("");

  /**
   * Dokumen dicetak lewat iframe tersembunyi, bukan jendela baru — jendela baru
   * kerap diblokir browser, dan iframe juga menjaga tampilan aplikasi tidak
   * ikut terbawa ke hasil cetak.
   */
  const print = () => {
    setError("");
    try {
      frameRef.current?.remove();

      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.srcdoc = buildHandoverDocument(config);

      frame.onload = () => {
        const win = frame.contentWindow;
        if (!win) {
          setError("Browser menolak membuka dokumen. Coba matikan pemblokir konten.");
          return;
        }
        win.focus();
        win.print();
      };

      document.body.appendChild(frame);
      frameRef.current = frame;
    } catch {
      setError("Gagal menyiapkan dokumen.");
    }
  };

  /** Cadangan bila pengguna ingin menyimpan berkasnya dulu. */
  const downloadHtml = () => {
    const blob = new Blob([buildHandoverDocument(config)], {
      type: "text/html;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `BAST-${(h.customerName.trim() || "pelanggan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const grid2 = "grid gap-4 sm:grid-cols-2";

  return (
    <div className="space-y-5">
      <div className={grid2}>
        <Field label="Nomor dokumen" hint="Kosongkan bila tidak memakai penomoran.">
          <TextInput
            value={h.docNumber}
            onChange={(docNumber) => setHandover({ docNumber })}
            placeholder="001/BAST/MS/2026"
          />
        </Field>
        <Field label="Tanggal" hint="Kosong = tanggal saat dokumen dicetak.">
          <input
            type="date"
            value={h.date}
            onChange={(e) => setHandover({ date: e.target.value })}
            className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-200 hover:border-line/80 focus:border-brand focus:shadow-[0_0_0_3px_rgba(56,189,248,0.14)] sm:h-10"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-line-soft bg-raised/50 p-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
          Pelanggan
        </span>
        <div className={`mt-3.5 ${grid2}`}>
          <Field label="Nama pelanggan">
            <TextInput
              value={h.customerName}
              onChange={(customerName) => setHandover({ customerName })}
              placeholder="Warnet Kita"
            />
          </Field>
          <Field label="Telepon">
            <TextInput
              value={h.customerPhone}
              onChange={(customerPhone) => setHandover({ customerPhone })}
              placeholder="081234567890"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Alamat">
            <TextInput
              value={h.customerAddress}
              onChange={(customerAddress) => setHandover({ customerAddress })}
              placeholder="Jl. Merdeka No. 10, Bandung"
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-line-soft bg-raised/50 p-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand/80">
          Pelaksana
        </span>
        <div className={`mt-3.5 ${grid2}`}>
          <Field label="Nama perusahaan" hint="Kosong = Mikrosetting.com">
            <TextInput
              value={h.companyName}
              onChange={(companyName) => setHandover({ companyName })}
              placeholder="Mikrosetting.com"
            />
          </Field>
          <Field label="Nama teknisi">
            <TextInput
              value={h.technicianName}
              onChange={(technicianName) => setHandover({ technicianName })}
              placeholder="Budi Santoso"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field
            label="Nomor seri perangkat"
            hint="Ada di stiker bawah router, atau lewat /system routerboard print."
          >
            <TextInput
              mono
              value={h.serialNumber}
              onChange={(serialNumber) => setHandover({ serialNumber })}
              placeholder="HFX09ABCDEF"
            />
          </Field>
        </div>
      </div>

      <Field label="Lingkup pekerjaan">
        <TextArea
          value={h.scope}
          onChange={(scope) => setHandover({ scope })}
          placeholder="Instalasi dan konfigurasi router, pemasangan hotspot, pengujian koneksi."
        />
      </Field>

      <Field label="Catatan tambahan" hint="Opsional — misalnya masa garansi atau kesepakatan lain.">
        <TextArea
          value={h.notes}
          onChange={(notes) => setHandover({ notes })}
          placeholder="Garansi konfigurasi 30 hari sejak tanggal serah terima."
          rows={2}
        />
      </Field>

      <Toggle
        checked={h.includeCredentials}
        onChange={(includeCredentials) => setHandover({ includeCredentials })}
        label="Cantumkan password di dokumen"
        hint="Pelanggan biasanya perlu password admin. Matikan bila dokumen akan digandakan atau diarsipkan pihak lain."
      />

      {error && <Note tone="bad">{error}</Note>}

      <Note>
        Tombol di bawah membuka dialog cetak browser. Pilih tujuan{" "}
        <span className="text-ink">Save as PDF</span> untuk menyimpan berkas PDF, atau pilih
        printer untuk langsung mencetak lembar tanda tangan.
      </Note>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={print}>
          <FileText className="h-4 w-4" />
          Cetak / Simpan PDF
        </Button>
        <Button onClick={downloadHtml} title="Simpan berkas HTML untuk diedit atau dicetak nanti">
          <Download className="h-4 w-4" />
          Unduh HTML
        </Button>
      </div>
    </div>
  );
}
