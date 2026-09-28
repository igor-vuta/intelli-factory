import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { getLocaleFromQuery } from '../lib/i18n';
import type { Candidate } from '../lib/tradeoff';

const W = 560;
const H = 320;
const PAD = { left: 72, right: 16, top: 16, bottom: 48 };

/**
 * Offers plotted by total cost (x) and delivery days (y), with reliability as dot size. Callers
 * decide what each dot means through `classesOf` (e.g. `is-front`, `is-pick`, `is-cheapest`);
 * the arrow keys walk the offers by cost and Enter selects the current one.
 */
export default function TradeoffPlot({
  points,
  currency,
  classesOf,
  current,
  label,
  onActive,
  onSelect,
}: {
  points: Candidate[];
  currency: string;
  classesOf: (index: number) => (string | false | null | undefined)[];
  /** The offer the keyboard starts from (the hovered, focused or selected one). */
  current: number | null;
  label: string;
  onActive?: (index: number | null) => void;
  onSelect?: (index: number) => void;
}) {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const scale = useMemo(() => {
    if (!points.length) return null;
    const costs = points.map((p) => p.cost);
    const days = points.map((p) => p.days);
    const rels = points.map((p) => p.reliability);
    const [c0, c1] = [Math.min(...costs), Math.max(...costs)];
    const [d0, d1] = [Math.min(...days), Math.max(...days)];
    const [r0, r1] = [Math.min(...rels), Math.max(...rels)];
    const padC = (c1 - c0) * 0.12 || c0 * 0.1 || 1;
    const padD = (d1 - d0) * 0.15 || 1;
    return {
      x: (v: number) =>
        PAD.left + ((v - (c0 - padC)) / (c1 - c0 + 2 * padC)) * (W - PAD.left - PAD.right),
      y: (v: number) =>
        H - PAD.bottom - ((v - (d0 - padD)) / (d1 - d0 + 2 * padD)) * (H - PAD.top - PAD.bottom),
      r: (v: number) => 6 + ((v - r0) / (r1 - r0 || 1)) * 6,
      xTicks: [c0 - padC / 2, (c0 + c1) / 2, c1 + padC / 2],
      yTicks: [Math.max(0, d0 - padD / 2), (d0 + d1) / 2, d1 + padD / 2],
    };
  }, [points]);
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
        {points.map((p, i) => (
          <g
            key={i}
            className={['offer', ...classesOf(i)].filter(Boolean).join(' ')}
            style={{ transform: `translate(${scale.x(p.cost)}px, ${scale.y(p.days)}px)` }}
            onPointerEnter={() => onActive?.(i)}
            onPointerLeave={() => onActive?.(null)}
            onClick={() => onSelect?.(i)}
          >
            <circle r={scale.r(p.reliability)} />
          </g>
        ))}
      </g>
    </svg>
  );
}
