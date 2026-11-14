import { shortDate } from "@/lib/usage-stats";

const fmt = (n: number) => n.toLocaleString("id-ID");

/** Skala sumbu yang enak dibaca: 1, 2, 5, 10, 20, 50, … */
function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 5, 10].find((s) => s * p >= v)!;
  return step * p;
}

/**
 * Batang harian satu seri (total pembukaan modul). Tiap hari punya area hover selebar kolom
 * dengan tooltip bawaan browser; sumbu dan grid dibuat samar.
 */
export function DailyBars({ days, values, label }: { days: string[]; values: number[]; label: string }) {
  const W = 640;
  const H = 180;
  const left = 34;
  const bottom = 22;
  const top = 8;
  const plotW = W - left - 4;
  const plotH = H - bottom - top;
  const max = niceMax(Math.max(0, ...values));
  const col = plotW / days.length;
  const barW = Math.max(col - 2, 1); // 2px celah antar batang
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={W - 4} y1={y(t)} y2={y(t)} className="stroke-line-soft" strokeWidth={1} />
          <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10px]">
            {fmt(t)}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const v = values[i];
        const x = left + i * col + 1;
        const h = Math.max((v / max) * plotH, v > 0 ? 2 : 0);
        const showLabel = i % 7 === (days.length - 1) % 7;
        return (
          <g key={d} className="group">
            <title>{`${shortDate(d)}: ${fmt(v)}× dibuka`}</title>
            {/* area hover selebar kolom, lebih besar dari batangnya */}
            <rect x={left + i * col} y={top} width={col} height={plotH} className="fill-transparent group-hover:fill-brand/[0.07]" />
            {h > 0 && <rect x={x} y={top + plotH - h} width={barW} height={h} rx={Math.min(2, barW / 2)} className="fill-brand group-hover:brightness-110" />}
            {showLabel && (
              <text
                x={i === days.length - 1 ? x + barW : x + barW / 2}
                y={H - 6}
                textAnchor={i === days.length - 1 ? "end" : "middle"}
                className="fill-faint text-[10px]"
              >
                {shortDate(d)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Garis tren kecil untuk satu modul; titik di ujung menandai hari ini. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const W = 96;
  const H = 24;
  const max = Math.max(1, ...values);
  const step = W / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => [i * step, H - 3 - (v / max) * (H - 6)] as const);
  const total = values.reduce((n, v) => n + v, 0);
  if (!total) return <span className="text-[11px] text-faint">—</span>;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="overflow-visible">
      <title>{label}</title>
      <polyline points={pts.map(([x, yy]) => `${x.toFixed(1)},${yy.toFixed(1)}`).join(" ")} fill="none" className="stroke-brand" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={2.5} className="fill-brand stroke-surface" strokeWidth={1.5} />
    </svg>
  );
}
