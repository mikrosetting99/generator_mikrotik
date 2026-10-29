"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Download, Lock, Terminal } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Field, Note, TextInput } from "@/components/ui";
import { downloadBlob } from "@/lib/download";
import { generateVpnScript, VPN_PROTOCOLS, type VpnNatRule, type VpnProtocol } from "@/lib/vpn-script";

interface Entry {
  token: string;
  category: string;
  title: string;
  username: string;
  password: string;
  /** Script manual, atau script bawaan admin untuk tipe VPN. */
  script: string;
  protocol: "" | VpnProtocol;
  offered: VpnProtocol[];
  ros: "v6" | "v7";
  vpnServer: string;
  gatewayIp: string;
  tunnelName: string;
  vpnPort: number;
  ipsecSecret: string;
  winbox: string;
  api: string;
  mikhmonUrl: string;
  tunnelIp: string;
  nat: VpnNatRule[];
  note: string;
  createdAt: string;
}

const PHONE_KEY = "vpn-phone";

function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          // clipboard diblokir: pengguna bisa menyalin manual
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Tersalin" : label}
    </Button>
  );
}

function Credential({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-muted">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-sm text-ink">{show ? value : "•".repeat(Math.min(12, Math.max(6, value.length)))}</code>
        {secret && (
          <Button size="sm" onClick={() => setShow((v) => !v)}>
            {show ? "Sembunyikan" : "Tampilkan"}
          </Button>
        )}
        <CopyButton text={value} />
      </div>
    </div>
  );
}

/** Satu script sebagai dropdown: judul di kepala, isi (kredensial, pilihan tipe VPN, script) di dalam. */
function EntryDropdown({ entry, opened }: { entry: Entry; opened: boolean }) {
  const isVpn = Boolean(entry.protocol);
  const [choice, setChoice] = useState<VpnProtocol>(entry.protocol || "sstp");

  // Script dibuat di browser dengan fungsi yang sama dengan server, sesuai tipe yang dipilih pelanggan.
  const script = useMemo(
    () =>
      isVpn
        ? generateVpnScript({
            protocol: choice,
            ros: entry.ros,
            server: entry.vpnServer,
            tunnel: entry.tunnelName,
            gateway: entry.gatewayIp,
            user: entry.username,
            password: entry.password,
            ipsecSecret: entry.ipsecSecret,
            port: entry.vpnPort,
            tunnelIp: entry.tunnelIp,
            nat: entry.nat,
          })
        : entry.script,
    [isVpn, choice, entry],
  );

  const fileName = `${entry.title.replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase() || "script"}${isVpn ? `-${choice}` : ""}.rsc`;

  return (
    <details open={opened} className="group border-b border-line-soft last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-brand/[0.05] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-base font-semibold text-ink">{entry.title}</span>
          {isVpn && (
            <span className="rounded-md bg-raised px-2 py-0.5 font-mono text-[11px] font-medium uppercase text-muted">VPN</span>
          )}
          {entry.mikhmonUrl && <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Mikhmon</span>}
          {opened && <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[11px] font-medium text-brand">link ini</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-line-soft bg-canvas/40 px-5 py-4">
        {entry.mikhmonUrl && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-brand/40 bg-brand/[0.06] p-3">
            <a
              href={entry.mikhmonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-[color:var(--color-brand-ink)] transition-all hover:brightness-110"
            >
              Buka Mikhmon Online
            </a>
            <CopyButton text={entry.mikhmonUrl} label="Salin link" />
            <span className="min-w-0 basis-full break-all font-mono text-[11px] text-muted sm:basis-auto">{entry.mikhmonUrl}</span>
          </div>
        )}

        {(entry.username || entry.password) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.username && <Credential label={isVpn ? "Username VPN" : "Username"} value={entry.username} />}
            {entry.password && <Credential label={isVpn ? "Password VPN" : "Password"} value={entry.password} secret />}
          </div>
        )}

        {(entry.winbox || entry.api) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {entry.winbox && <Credential label="Alamat Winbox" value={entry.winbox} />}
            {entry.api && <Credential label="Alamat API" value={entry.api} />}
          </div>
        )}

        {script.trim() && (
          <div className="space-y-3">
            {isVpn && entry.offered.length > 1 && (
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.09em] text-muted">Pilih tipe VPN</p>
                <div role="radiogroup" aria-label="Tipe VPN" className="flex flex-wrap gap-2">
                  {VPN_PROTOCOLS.filter((p) => entry.offered.includes(p.id)).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={choice === p.id}
                      onClick={() => setChoice(p.id)}
                      className={`min-h-10 rounded-full border px-5 font-mono text-sm font-semibold transition-colors ${
                        choice === p.id
                          ? "border-brand bg-brand text-[color:var(--color-brand-ink)]"
                          : "border-line bg-surface text-muted hover:border-brand/50 hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-md border border-warn/40 bg-warn/[0.08] px-3.5 py-3 text-sm leading-relaxed text-ink">
              Silahkan copy dan paste script berikut ke <b className="font-semibold">New Terminal Mikrotik</b> Anda,{" "}
              <b className="font-semibold">wajib pakai laptop</b>.
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.09em] text-muted">
                  <Terminal className="h-3.5 w-3.5" /> Script{isVpn ? ` ${choice.toUpperCase()}` : ""}
                </span>
                <span className="flex gap-2">
                  <CopyButton text={script} label="Salin script" />
                  <Button size="sm" onClick={() => downloadBlob(new Blob([script], { type: "text/plain;charset=utf-8" }), fileName)}>
                    <Download className="h-3.5 w-3.5" /> .rsc
                  </Button>
                </span>
              </div>
              <pre className="max-h-72 overflow-auto rounded-md border border-line-soft bg-code px-3 py-3 font-mono text-[12px] leading-relaxed text-ink">
                {script}
              </pre>
            </div>
          </div>
        )}

        {entry.note && <p className="text-xs leading-relaxed text-muted">{entry.note}</p>}
      </div>
    </details>
  );
}

/**
 * Halaman pelanggan: link dari admin + nomor HP membuka username, password, dan script.
 * Isinya baru diminta ke server setelah nomor HP dimasukkan.
 */
export function CustomerScriptView({ token, siteName }: { token: string; siteName: string }) {
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<{ customer: string; opened: string; entries: Entry[] } | null>(null);
  const tried = useRef(false);

  const unlock = async (number: string, remember = true) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/vpn/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, phone: number }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.entries) {
        setError(body?.error ?? `Gagal membuka (kode ${res.status}).`);
        try {
          sessionStorage.removeItem(PHONE_KEY);
        } catch {
          // abaikan
        }
        return;
      }
      setData(body);
      if (remember) {
        try {
          sessionStorage.setItem(PHONE_KEY, number);
        } catch {
          // abaikan
        }
      }
    } catch {
      setError("Gagal menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setBusy(false);
    }
  };

  // Muat ulang halaman dalam sesi yang sama tidak perlu mengetik nomor lagi.
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    try {
      const saved = sessionStorage.getItem(PHONE_KEY);
      if (saved) {
        setPhone(saved);
        void unlock(saved, false);
      }
    } catch {
      // abaikan
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya sekali saat halaman dibuka
  }, []);

  const groups = data
    ? [...new Set(data.entries.map((e) => e.category))].map((category) => ({
        category,
        entries: data.entries.filter((e) => e.category === category),
      }))
    : [];

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Lock className="h-4 w-4 text-brand" />
            <h1 className="truncate text-sm font-semibold text-ink">{siteName}</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
        {!data ? (
          <section className="mx-auto max-w-md overflow-hidden rounded-md border border-line bg-surface shadow-sm">
            <div className="border-b border-line bg-raised px-5 py-3">
              <h2 className="text-sm font-bold text-ink">Script VPN & Mikhmon Online</h2>
              <p className="mt-0.5 text-xs text-muted">Masukkan nomor HP Anda untuk membuka link ini.</p>
            </div>
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (phone.trim()) void unlock(phone.trim());
              }}
            >
              <Field label="Nomor HP" hint="Nomor yang didaftarkan ke admin, mis. 081234567890.">
                <TextInput type="text" mono value={phone} onChange={setPhone} placeholder="08xxxxxxxxxx" className="h-11" />
              </Field>
              {error && <Note tone="bad">{error}</Note>}
              <Button type="submit" variant="primary" className="w-full" disabled={busy || !phone.trim()}>
                {busy ? "Memeriksa…" : "Buka script saya"}
              </Button>
              <p className="text-xs leading-relaxed text-faint">
                Link ini bersifat pribadi. Jangan dibagikan ke orang lain karena berisi akses ke router Anda.
              </p>
            </form>
          </section>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-ink">{data.customer ? `Halo, ${data.customer}` : "Script Anda"}</h2>
              <p className="mt-1 text-sm text-muted">Klik judul script untuk membuka atau menutup isinya.</p>
            </div>

            {groups.map((group) => (
              <section key={group.category} className="overflow-hidden rounded-md border border-line bg-surface shadow-sm">
                <div className="border-b border-line bg-raised px-5 py-2.5">
                  <h3 className="text-sm font-bold text-ink">{group.category}</h3>
                </div>
                <div>
                  {group.entries.map((entry) => (
                    <EntryDropdown key={entry.token} entry={entry} opened={entry.token === data.opened} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
