import Link from "next/link";
import { ArrowRight, Cpu, Lock, Route, Shield, Split, Terminal } from "@/components/icons";
import { ThemeToggle } from "@/components/ThemeToggle";

const MENUS = [
  {
    href: "/setup",
    step: "01",
    icon: Cpu,
    title: "Setup Mikrotik Baru",
    description:
      "Dari router kondisi default sampai siap dipakai: WAN, DNS, NAT, bridge, VLAN, IP address, pool, DHCP server, hotspot, PPPoE, dan firewall dasar.",
    points: [
      "Builder modular per section",
      "Sintaks menyesuaikan RouterOS v6 / v7",
      "Database model Mikrotik",
    ],
    ready: true,
  },
  {
    href: "/loadbalance",
    step: "02",
    icon: Split,
    title: "Load Balance PCC",
    description:
      "Gabungkan 2 ISP atau lebih agar beban trafik terbagi otomatis dengan metode Per Connection Classifier.",
    points: [
      "Mangle mark-connection & mark-routing",
      "Routing table per ISP",
      "Bobot distribusi per ISP",
    ],
    ready: true,
  },
  {
    href: "/loadbalance",
    step: "03",
    icon: Route,
    title: "Fail Over",
    description:
      "Pindah otomatis ke ISP cadangan saat jalur utama terputus, lewat Recursive Gateway — satu builder yang sama dengan Load Balance PCC.",
    points: [
      "Recursive gateway berjenjang",
      "Default route per routing-mark otomatis",
      "Kompatibel dengan Load Balance PCC",
    ],
    ready: true,
  },
  {
    href: "/login-page-hotspot",
    step: "04",
    icon: Lock,
    title: "Login Page Hotspot",
    description:
      "Cetak halaman login hotspot bertema lengkap dengan paket dan harga pembeli, lalu terbitkan kunci yang mengikat halaman itu ke router tujuan.",
    points: [
      "Enam tema, muat satu layar di HP",
      "Paket, warna, logo, dan latar dari form",
      "Kunci terikat ke identity router",
    ],
    ready: true,
    /* Bagian berbayar, bukan alat umum seperti menu lainnya.
       Ditandai supaya pengunjung tahu sebelum menekan dan mendarat di
       layar login — middleware yang menjaganya, bukan penandaan ini. */
    privat: true,
  },
];

const SAMPLE = [
  { text: "# NAT untuk semua WAN", kind: "comment" },
  { text: "/ip firewall nat", kind: "path" },
  { text: "add chain=srcnat action=masquerade \\", kind: "cmd" },
  { text: "    out-interface-list=WAN", kind: "cmd" },
  { text: "", kind: "blank" },
  { text: "# Tolak akses dari internet ke router", kind: "comment" },
  { text: "/ip firewall filter", kind: "path" },
  { text: "add chain=input action=drop \\", kind: "cmd" },
  { text: "    in-interface-list=WAN", kind: "cmd" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Cahaya ambien di belakang hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 20% 0%, rgba(56,189,248,0.16), transparent 70%), radial-gradient(45% 55% at 78% 8%, rgba(34,197,94,0.12), transparent 70%)",
        }}
      />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-x-0 top-0 h-[560px]" />

      <div className="relative mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
        <div className="mb-6 flex justify-end">
          <ThemeToggle />
        </div>

        {/* ---------------------------------------------------------- hero */}
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <header className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1.5 font-mono text-xs text-brand backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              RouterOS v6 &amp; v7
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-[3.25rem]">
              Generator Script
              <span className="block bg-gradient-to-r from-brand via-brand to-accent bg-clip-text text-transparent">
                Mikrotik
              </span>
            </h1>
            <p className="mt-2.5 text-sm text-faint">
              by{" "}
              <a
                href="https://mikrosetting.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline decoration-line underline-offset-4 transition-colors hover:text-brand hover:decoration-brand/50"
              >
                Mikrosetting.com
              </a>
            </p>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Isi form, salin script, tempel ke <span className="text-ink">New Terminal</span>{" "}
              Mikrotik. Tidak perlu menghafal sintaks CLI.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/setup"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-[color:var(--color-accent-ink)] shadow-[0_14px_40px_-16px_rgba(34,197,94,0.85)] transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                Mulai Setup Mikrotik Baru
                <ArrowRight className="h-4 w-4" />
              </Link>
              <span className="inline-flex items-center gap-2 text-xs text-faint">
                <Lock className="h-3.5 w-3.5" />
                Diproses di browser, tanpa kirim data
              </span>
            </div>
          </header>

          {/* Cuplikan hasil */}
          <div className="animate-rise edge-light overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-50px_rgba(0,0,0,1)]">
            <div className="flex items-center gap-3 border-b border-line-soft bg-canvas/60 px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-bad/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warn/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-accent/60" />
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                <Terminal className="h-3.5 w-3.5 text-faint" />
                setup-mikrotik-kantor.rsc
              </span>
            </div>
            <pre className="overflow-x-auto bg-code px-4 py-4 font-mono text-[11.5px] leading-[1.75]">
              {SAMPLE.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-4 shrink-0 select-none text-right text-faint/40">{i + 1}</span>
                  <span
                    className={
                      line.kind === "comment"
                        ? "text-faint/80"
                        : line.kind === "path"
                          ? "text-brand"
                          : "text-muted"
                    }
                  >
                    {line.text || " "}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* --------------------------------------------------------- menu */}
        <h2 className="mt-20 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Pilih menu
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {MENUS.map((menu) => {
            const Glyph = menu.icon;
            const card = (
              <div
                className={`edge-light group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-all duration-300 ${
                  menu.ready
                    ? "hover:-translate-y-1 hover:border-brand/50 hover:shadow-[0_24px_60px_-36px_rgba(56,189,248,0.6)]"
                    : "opacity-55"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors duration-300 ${
                      menu.ready
                        ? "border-brand/25 bg-brand/10 text-brand group-hover:border-brand/50"
                        : "border-line bg-raised text-faint"
                    }`}
                  >
                    <Glyph className="h-5 w-5" />
                  </span>
                  {menu.privat ? (
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                      khusus admin
                    </span>
                  ) : menu.ready ? (
                    <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                      siap
                    </span>
                  ) : (
                    <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
                      segera
                    </span>
                  )}
                </div>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-faint">{menu.step}</span>
                  <h3 className="text-lg font-semibold tracking-tight text-ink">{menu.title}</h3>
                </div>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">
                  {menu.description}
                </p>

                <ul className="mt-5 space-y-2 border-t border-line-soft pt-4">
                  {menu.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-xs text-faint">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/60" />
                      {point}
                    </li>
                  ))}
                </ul>

                {menu.ready && (
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                    {menu.privat ? "Buka generator" : "Mulai konfigurasi"}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                )}
              </div>
            );

            return menu.ready ? (
              <Link key={menu.title} href={menu.href} className="block">
                {card}
              </Link>
            ) : (
              <div key={menu.title}>{card}</div>
            );
          })}
        </div>

        {/* ------------------------------------------------------ jaminan */}
        <section className="mt-16 grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3 sm:p-8">
          {[
            {
              icon: Shield,
              title: "Validasi otomatis",
              body: "Format IP/CIDR, VLAN ID 1–4094, pool yang dirujuk, dan bentrok interface diperiksa sebelum script dibuat.",
            },
            {
              icon: Terminal,
              title: "Script berkomentar",
              body: "Setiap blok perintah diberi penjelasan bahasa Indonesia, plus daftar perintah untuk memverifikasi hasil.",
            },
            {
              icon: Lock,
              title: "Data tidak dikirim",
              body: "Seluruh proses generate berjalan di browser. IP, password, dan konfigurasi tidak pernah meninggalkan perangkat Anda.",
            },
          ].map((item) => {
            const Glyph = item.icon;
            return (
              <div key={item.title}>
                <Glyph className="h-5 w-5 text-brand" />
                <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
              </div>
            );
          })}
        </section>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-6 text-xs text-faint">
          <span>Backup router sebelum menjalankan script apa pun.</span>
          <span>
            Generator Script Mikrotik by{" "}
            <a
              href="https://mikrosetting.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-brand"
            >
              Mikrosetting.com
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}
