"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Route } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import { Button, Field, Note, Panel, TextInput } from "@/components/ui";
import { calculate, intToIp, parseInput, prefixToMask, splitSubnets } from "@/lib/ip-calc";

const EXAMPLES = ["192.168.1.10/24", "10.0.0.1/8", "172.16.5.9/20", "192.168.88.1 255.255.255.0"];

function Row({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-right text-sm text-ink ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

export function IpCalculator() {
  const [input, setInput] = useState("192.168.1.10/24");
  const [parts, setParts] = useState("4");
  const [iface, setIface] = useState("ether2");
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => parseInput(input), [input]);
  const result = useMemo(() => (parsed.ok ? calculate(parsed.ip, parsed.prefix) : null), [parsed]);
  const split = useMemo(
    () => (parsed.ok ? splitSubnets(parsed.ip, parsed.prefix, Number(parts)) : null),
    [parsed, parts],
  );

  const snippet = result
    ? [
        `/ip address add address=${result.ip}/${result.prefix} interface=${iface || "ether2"}`,
        result.usableHosts > 2
          ? `/ip pool add name=pool-lan ranges=${intToIp((parsed.ok ? (parsed.ip & prefixToMask(parsed.prefix)) >>> 0 : 0) + (result.usableHosts > 20 ? 11 : 2))}-${result.lastHost}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard diblokir: pengguna bisa menyalin manual
    }
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-5 lg:px-8 py-3">
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
              <Route className="h-4 w-4 text-brand" />
              <h1 className="truncate text-sm font-semibold text-ink">Kalkulator IP</h1>
              <span className="hidden lg:inline-flex">
                <VersionBadge />
              </span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full space-y-5 px-5 lg:px-8 py-6">
        <Panel
          title="Alamat IP"
          description="Ketik alamat dengan prefix (192.168.1.10/24) atau dengan netmask (192.168.1.10 255.255.255.0). Hasil langsung dihitung."
        >
          <div className="space-y-3">
            <TextInput
              mono
              value={input}
              onChange={setInput}
              placeholder="192.168.1.10/24"
              invalid={!parsed.ok && input.trim() !== ""}
            />
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setInput(e)}
                  className="rounded-md border border-line-soft bg-canvas px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-brand/50 hover:text-ink"
                >
                  {e}
                </button>
              ))}
            </div>
            {!parsed.ok && input.trim() !== "" && <Note tone="bad">{parsed.error}</Note>}
          </div>
        </Panel>

        {result && (
          <>
            <Panel title="Hasil">
              <div className="grid gap-x-10 sm:grid-cols-2">
                <dl>
                  <Row label="Alamat IP" value={result.ip} />
                  <Row label="Network" value={`${result.network}/${result.prefix}`} />
                  <Row label="Broadcast" value={result.broadcast} />
                  <Row label="Netmask" value={result.netmask} />
                  <Row label="Wildcard" value={result.wildcard} />
                </dl>
                <dl>
                  <Row label="Host pertama" value={result.firstHost} />
                  <Row label="Host terakhir" value={result.lastHost} />
                  <Row label="Host yang bisa dipakai" value={result.usableHosts.toLocaleString("id-ID")} />
                  <Row label="Total alamat" value={result.totalAddresses.toLocaleString("id-ID")} />
                  <Row label="Kelas · Jenis" value={`${result.ipClass} · ${result.kind}`} mono={false} />
                </dl>
              </div>

              <div className="mt-4 space-y-1 overflow-x-auto rounded-xl border border-line-soft bg-code px-4 py-3 font-mono text-[11.5px] leading-relaxed text-muted">
                <div>
                  <span className="mr-2 inline-block w-14 text-faint">IP</span>
                  {result.ipBinary}
                </div>
                <div>
                  <span className="mr-2 inline-block w-14 text-faint">Mask</span>
                  {result.maskBinary}
                </div>
              </div>
            </Panel>

            <Panel title="Perintah RouterOS" description="Siap tempel di New Terminal Winbox. Sesuaikan nama interface.">
              <div className="space-y-3">
                <Field label="Interface">
                  <TextInput mono value={iface} onChange={setIface} placeholder="ether2" />
                </Field>
                <pre className="overflow-x-auto rounded-xl border border-line-soft bg-code px-4 py-3 font-mono text-[12px] leading-relaxed text-ink">
                  {snippet}
                </pre>
                <Button size="sm" onClick={copy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
              </div>
            </Panel>

            <Panel title="Bagi jadi subnet" description="Pecah jaringan di atas menjadi subnet sama besar.">
              <div className="space-y-3">
                <div className="max-w-xs">
                  <Field label="Jumlah subnet" hint="Dibulatkan ke pangkat dua (2, 4, 8, …).">
                    <TextInput mono value={parts} onChange={setParts} placeholder="4" />
                  </Field>
                </div>
                {split && !split.ok && <Note tone="warn">{split.error}</Note>}
                {split?.ok && (
                  <div className="overflow-x-auto rounded-xl border border-line-soft">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-raised/60 text-[10px] uppercase tracking-[0.09em] text-faint">
                        <tr>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Network</th>
                          <th className="px-3 py-2">Rentang host</th>
                          <th className="px-3 py-2">Broadcast</th>
                          <th className="px-3 py-2 text-right">Host</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-ink">
                        {split.subnets.map((s, i) => (
                          <tr key={s.network} className="border-t border-line-soft">
                            <td className="px-3 py-2 text-faint">{i + 1}</td>
                            <td className="px-3 py-2">
                              {s.network}/{s.prefix}
                            </td>
                            <td className="px-3 py-2 text-muted">{s.range}</td>
                            <td className="px-3 py-2 text-muted">{s.broadcast}</td>
                            <td className="px-3 py-2 text-right">{s.usable.toLocaleString("id-ID")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  );
}