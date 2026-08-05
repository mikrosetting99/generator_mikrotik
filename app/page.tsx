import Link from "next/link";

const MENUS = [
  {
    href: "/setup",
    step: "01",
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
    href: "#",
    step: "02",
    title: "Load Balance PCC",
    description:
      "Gabungkan 2 ISP atau lebih agar beban trafik terbagi otomatis dengan metode Per Connection Classifier.",
    points: [
      "Mangle mark-connection & mark-routing",
      "Routing table per ISP",
      "Bobot distribusi per ISP",
    ],
    ready: false,
  },
  {
    href: "#",
    step: "03",
    title: "Fail Over",
    description:
      "Pindah otomatis ke ISP cadangan saat jalur utama terputus, lewat Recursive Gateway maupun Netwatch.",
    points: [
      "Recursive gateway berjenjang",
      "Netwatch on-up / on-down",
      "Kompatibel dengan Load Balance PCC",
    ],
    ready: false,
  },
];

export default function Home() {
  return (
    <main className="bg-grid min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
        <header className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-good" />
            RouterOS v6 &amp; v7
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Generator Script Mikrotik
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Isi form, salin script, tempel ke <span className="text-ink">New Terminal</span>{" "}
            Mikrotik. Tidak perlu menghafal sintaks CLI. Seluruh proses berjalan di browser
            Anda — IP dan password tidak pernah dikirim ke server.
          </p>
        </header>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {MENUS.map((menu) => {
            const card = (
              <div
                className={
                  "group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition " +
                  (menu.ready ? "hover:border-brand/60 hover:bg-raised" : "opacity-60")
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-faint">{menu.step}</span>
                  {menu.ready ? (
                    <span className="rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-good">
                      siap
                    </span>
                  ) : (
                    <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-faint">
                      segera
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-ink">{menu.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                  {menu.description}
                </p>
                <ul className="mt-5 space-y-1.5 border-t border-line-soft pt-4">
                  {menu.points.map((point) => (
                    <li key={point} className="flex gap-2 text-xs text-faint">
                      <span className="text-brand">›</span>
                      {point}
                    </li>
                  ))}
                </ul>
                {menu.ready && (
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                    Mulai konfigurasi
                    <span className="transition group-hover:translate-x-0.5">→</span>
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

        <section className="mt-14 grid gap-4 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-3">
          {[
            {
              title: "Validasi otomatis",
              body: "Format IP/CIDR, VLAN ID 1–4094, pool yang dirujuk, dan bentrok interface diperiksa sebelum script dibuat.",
            },
            {
              title: "Script berkomentar",
              body: "Setiap blok perintah diberi penjelasan bahasa Indonesia, plus daftar perintah untuk memverifikasi hasil.",
            },
            {
              title: "Copy atau unduh .rsc",
              body: "Salin langsung ke New Terminal, atau unduh sebagai file .rsc untuk diimpor lewat Winbox/FTP.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
