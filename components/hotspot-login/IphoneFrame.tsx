import type { ReactNode } from "react";

/** Tebal bingkai di sekeliling layar (px, pada skala 1:1). */
export const IPHONE_PAD = 16;

/**
 * Bingkai iPhone 13 untuk pratinjau: bodi baja dengan bezel hitam, sudut layar
 * membulat, notch lengkap dengan speaker & kamera, bilah status (jam, sinyal,
 * wifi, baterai), indikator home, dan tombol samping. Anak (iframe pratinjau)
 * mengisi layar 390 × 844 persis. Ukuran luar = layar + 2 × IPHONE_PAD.
 */
export function IphoneFrame({
  children,
  width = 390,
  height = 844,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
}) {
  const w = width + IPHONE_PAD * 2;
  const h = height + IPHONE_PAD * 2;

  const side = "absolute rounded-[2px] bg-[#34363b]";

  return (
    <div className="relative" style={{ width: w, height: h }} aria-hidden={false}>
      {/* tombol samping: silent, volume atas/bawah (kiri), power (kanan) */}
      <span className={`${side} -left-[3px] top-[104px] h-[26px] w-[4px]`} />
      <span className={`${side} -left-[3px] top-[160px] h-[54px] w-[4px]`} />
      <span className={`${side} -left-[3px] top-[226px] h-[54px] w-[4px]`} />
      <span className={`${side} -right-[3px] top-[188px] h-[88px] w-[4px]`} />

      {/* bodi baja + bezel hitam */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: 64,
          background: "linear-gradient(145deg,#5b5e66 0%,#24262b 38%,#17181b 62%,#4a4d55 100%)",
          boxShadow: "0 28px 60px -22px rgba(0,0,0,.6), inset 0 0 0 1.5px rgba(255,255,255,.18)",
        }}
      >
        <div className="absolute" style={{ inset: 3.5, borderRadius: 61, background: "#050506" }} />
      </div>

      {/* layar */}
      <div
        className="absolute overflow-hidden bg-black"
        style={{ left: IPHONE_PAD, top: IPHONE_PAD, width, height, borderRadius: 48 }}
      >
        {children}

        {/* bilah status: putih dengan blend "difference" supaya terbaca di latar terang maupun gelap */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 text-white"
          style={{ height: 47, mixBlendMode: "difference" }}
        >
          <span
            className="absolute text-center text-[15px] font-semibold tracking-tight"
            style={{ left: 0, width: 156, top: 14, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif" }}
          >
            9:41
          </span>
          <span className="absolute flex items-center gap-[5px]" style={{ right: 28, top: 17 }}>
            {/* sinyal */}
            <svg width="18" height="11" viewBox="0 0 18 11" fill="currentColor">
              <rect x="0" y="7" width="3" height="4" rx="0.8" />
              <rect x="5" y="5" width="3" height="6" rx="0.8" />
              <rect x="10" y="2.5" width="3" height="8.5" rx="0.8" />
              <rect x="15" y="0" width="3" height="11" rx="0.8" />
            </svg>
            {/* wifi */}
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M1.2 4.1a9.6 9.6 0 0 1 13.6 0" />
              <path d="M3.7 6.6a6.1 6.1 0 0 1 8.6 0" />
              <circle cx="8" cy="9.3" r="1.1" fill="currentColor" stroke="none" />
            </svg>
            {/* baterai */}
            <svg width="27" height="12" viewBox="0 0 27 12" fill="none">
              <rect x="0.5" y="0.5" width="22.5" height="11" rx="3.4" stroke="currentColor" opacity="0.45" />
              <rect x="2" y="2" width="19.5" height="8" rx="2.2" fill="currentColor" />
              <path d="M24.5 4v4c.9-.3 1.5-1.1 1.5-2s-.6-1.7-1.5-2Z" fill="currentColor" opacity="0.5" />
            </svg>
          </span>
        </div>

        {/* notch */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 bg-black"
          style={{ width: 164, height: 32, borderRadius: "0 0 22px 22px" }}
        >
          <span className="absolute left-1/2 top-[9px] -translate-x-1/2 rounded-full bg-[#1a1a1c]" style={{ width: 54, height: 5 }} />
          <span
            className="absolute rounded-full"
            style={{
              width: 10,
              height: 10,
              top: 8,
              left: "calc(50% + 44px)",
              background: "radial-gradient(circle at 35% 35%,#2c3a5a 0%,#0b0d14 65%)",
            }}
          />
        </div>

        {/* indikator home */}
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-white"
          style={{ bottom: 8, width: 134, height: 5, mixBlendMode: "difference" }}
        />
      </div>
    </div>
  );
}