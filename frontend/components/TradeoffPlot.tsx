import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { getLocaleFromQuery } from '../lib/i18n';
import type { Candidate } from '../lib/tradeoff';

// `compact` sits in a workspace panel; `wide` is the landing figure, with more offers per scenario
// (smaller dots, tighter margins, more ticks).
const LAYOUTS = {
  compact: {
    width: 560,
    height: 320,
    pad: { left: 72, right: 16, top: 16, bottom: 48 },
    marginX: 0.12,
    marginY: 0.15,
    dotMin: 6,
    dotRange: 6,
    tickCount: 3,
  },
  wide: {
    width: 640,
    height: 420,
    pad: { left: 64, right: 20, top: 16, bottom: 52 },
    marginX: 0.06,
    marginY: 0.08,
    dotMin: 4,
    dotRange: 6,
    tickCount: 5,
  },
};

/** Round tick values (steps of 1, 2 or 5 × 10ⁿ, which the labels show exactly) inside [lo, hi],
 * never below zero. */
function ticks(lo: number, hi: number, count: number) {
  const raw = (hi - lo || 1) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const first = Math.max(0, Math.ceil(lo / step) * step);
  return Array.from({ length: Math.floor((hi - first) / step) + 1 }, (_, i) => first + i * step);
}

/**
 * Offers plotted by total cost (x) and delivery days (y), with reliability as dot size. Callers
 * decide what each dot means through `classesOf` (e.g. `is-front`, `is-pick`, `is-cheapest`;
 * `is-knee` also draws a ring); `current` is marked `is-active`. The arrow keys walk the offers by cost, Enter selects the current one and Escape clears it.
 */
export default function TradeoffPlot({
  points,
  currency,
  classesOf,
  current,
  label,
  onActive,
  onSelect,
  layout = 'compact',
}: {
  points: Candidate[];
  currency: string;
  classesOf: (index: number) => (string | false | null | undefined)[];
  /** The offer the keyboard starts from (the hovered, focused or selected one). */
  current: number | null;
  label: string;
  onActive?: (index: number | null) => void;
  onSelect?: (index: number) => void;
  layout?: keyof typeof LAYOUTS;
}) {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  const compact = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [locale]
  );
  const decimal = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale]
  );
  const L = LAYOUTS[layout];
  const { width: W, height: H, pad: PAD } = L;

  const scale = useMemo(() => {
    if (!points.length) return null;
    const costs = points.map((p) => p.cost);
    const days = points.map((p) => p.days);
    const rels = points.map((p) => p.reliability);
    const [c0, c1] = [Math.min(...costs), Math.max(...costs)];
    const [d0, d1] = [Math.min(...days), Math.max(...days)];
    const [r0, r1] = [Math.min(...rels), Math.max(...rels)];
    const padC = (c1 - c0) * L.marginX || c0 * 0.1 || 1;
    const padD = (d1 - d0) * L.marginY || 1;
    return {
      x: (v: number) =>
        L.pad.left +
        ((v - (c0 - padC)) / (c1 - c0 + 2 * padC)) * (L.width - L.pad.left - L.pad.right),
      y: (v: number) =>
        L.height -
        L.pad.bottom -
        ((v - (d0 - padD)) / (d1 - d0 + 2 * padD)) * (L.height - L.pad.top - L.pad.bottom),
      r: (v: number) => L.dotMin + ((v - r0) / (r1 - r0 || 1)) * L.dotRange,
      xTicks: ticks(c0 - padC, c1 + padC, L.tickCount),
      yTicks: ticks(d0 - padD, d1 + padD, L.tickCount),
    };
  }, [points, L]);
  const byCost = useMemo(
    () => points.map((_, i) => i).sort((a, b) => points[a].cost - points[b].cost),
    [points]
  );

  if (!scale) return null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="group"
      tabIndex={0}
      aria-label={label}
      onKeyDown={(event) => {
        const steps: Record<string, number> = {
          ArrowRight: 1,
          ArrowDown: 1,
          ArrowLeft: -1,
          ArrowUp: -1,
        };
        if (event.key === 'Escape') {
          onActive?.(null);
          return;
        }
        if (event.key === 'Enter' && current != null) {
          onSelect?.(current);
          return;
        }
        const step = steps[event.key];
        if (step === undefined) return;
        event.preventDefault();
        const at = current == null ? -1 : byCost.indexOf(current);
        onActive?.(byCost[Math.min(byCost.length - 1, Math.max(0, at + step))]);
      }}
      onBlur={() => onActive?.(null)}
    >
      <g className="chart-axis" aria-hidden="true">
        {scale.xTicks.map((t) => (
          <g key={`x${t}`} transform={`translate(${scale.x(t)} ${H - PAD.bottom})`}>
            <line y2={6} />
            <text y={22} textAnchor="middle">
              {compact.format(t)}
            </text>
          </g>
        ))}
        {scale.yTicks.map((t) => (
          <g key={`y${t}`} transform={`translate(${PAD.left} ${scale.y(t)})`}>
            <line x2={W - PAD.left - PAD.right} className="chart-gridline" />
            <text x={-10} dy="0.32em" textAnchor="end">
              {decimal.format(t)}
            </text>
          </g>
        ))}
        <text x={(W + PAD.left) / 2} y={H - 6} textAnchor="middle" className="chart-title">
          {`${e('Total cost')} (${currency})`}
        </text>
        <text
          transform={`translate(14 ${(H - PAD.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="chart-title"
        >
          {e('Delivery days')}
        </text>
      </g>
      <g aria-hidden="true">
        {points.map((p, i) => {
          const classes = ['offer', ...classesOf(i), i === current && 'is-active'].filter(Boolean);
          return (
            <g
              key={i}
              className={classes.join(' ')}
              style={{ transform: `translate(${scale.x(p.cost)}px, ${scale.y(p.days)}px)` }}
              onPointerEnter={() => onActive?.(i)}
              onPointerLeave={() => onActive?.(null)}
              onClick={() => onSelect?.(i)}
            >
              <circle r={scale.r(p.reliability)} />
              {classes.includes('is-knee') && (
                <circle className="knee-ring" r={scale.r(p.reliability) + 6} />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
