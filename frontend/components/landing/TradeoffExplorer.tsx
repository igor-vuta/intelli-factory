import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import { type Scenario, benchmark, scenarios } from '../../lib/benchmarkShowcase';
import { getLocaleFromQuery } from '../../lib/i18n';
import {
  WEIGHT_PROFILES,
  type Weights,
  greedyPick,
  weightedPick,
  weightedScores,
} from '../../lib/tradeoff';

const STEPS = [
  {
    title: 'All offers',
    body: 'Each dot is one complete offer: a factory’s goods plus a logistics quote. Bigger dots are more reliable.',
  },
  {
    title: 'Cheapest first',
    body: 'The greedy baseline takes the lowest total cost and ignores delivery time and reliability.',
  },
  {
    title: 'Weighted choice',
    body: 'The engine scales cost, days and reliability across the offers and weighs them. Move the weights to see the choice change.',
  },
  {
    title: 'The trade-off front',
    body: 'Highlighted offers are not beaten on all three objectives by any other. The knee is the most balanced of them, computed here in your browser.',
  },
] as const;

const W = 640;
const H = 420;
const PAD = { left: 64, right: 20, top: 16, bottom: 52 };

type WeightKey = keyof Weights;
const WEIGHT_KEYS: WeightKey[] = ['cost', 'time', 'reliability'];
const WEIGHT_LABELS: Record<WeightKey, string> = {
  cost: 'Cost',
  time: 'Delivery time',
  reliability: 'Reliability',
};

/** Moves one weight and rescales the other two so the three always sum to 1, like the engine's. */
function rebalance(weights: Weights, key: WeightKey, value: number): Weights {
  const others = WEIGHT_KEYS.filter((k) => k !== key);
  const rest = others.reduce((sum, k) => sum + weights[k], 0);
  const next = { ...weights, [key]: value };
  for (const k of others)
    next[k] = rest > 0 ? ((1 - value) * weights[k]) / rest : (1 - value) / others.length;
  return next;
}

function ticks(lo: number, hi: number, count = 5) {
  const span = hi - lo || 1;
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const first = Math.ceil(lo / step) * step;
  return Array.from({ length: Math.floor((hi - first) / step) + 1 }, (_, i) => first + i * step);
}

export default function TradeoffExplorer({ initial }: { initial: Scenario }) {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  const [index, setIndex] = useState(() => scenarios.indexOf(initial));
  const [step, setStep] = useState(0);
  const [weights, setWeights] = useState<Weights>(WEIGHT_PROFILES.balanced);
  const [active, setActive] = useState<number | null>(null);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const scenario = scenarios[index];

  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'KZT',
        maximumFractionDigits: 0,
      }),
    [locale]
  );
  const compact = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [locale]
  );
  const decimal = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale]
  );
  const score = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
    [locale]
  );
  const percent = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale]
  );

  const view = useMemo(() => {
    const { pool } = scenario;
    const costs = pool.map((c) => c.cost);
    const days = pool.map((c) => c.days);
    const rels = pool.map((c) => c.reliability);
    const [c0, c1] = [Math.min(...costs), Math.max(...costs)];
    const [d0, d1] = [Math.min(...days), Math.max(...days)];
    const [r0, r1] = [Math.min(...rels), Math.max(...rels)];
    const padC = (c1 - c0) * 0.06 || 1;
    const padD = (d1 - d0) * 0.08 || 1;
    const x = (v: number) =>
      PAD.left + ((v - (c0 - padC)) / (c1 - c0 + 2 * padC)) * (W - PAD.left - PAD.right);
    const y = (v: number) =>
      H - PAD.bottom - ((v - (d0 - padD)) / (d1 - d0 + 2 * padD)) * (H - PAD.top - PAD.bottom);
    const r = (v: number) => 4 + ((v - r0) / (r1 - r0 || 1)) * 6;
    return {
      x,
      y,
      r,
      xTicks: ticks(c0 - padC, c1 + padC),
      yTicks: ticks(d0 - padD, d1 + padD),
    };
  }, [scenario]);

  const scores = useMemo(() => weightedScores(scenario.pool, weights), [scenario, weights]);
  const pick = useMemo(() => weightedPick(scenario.pool, weights), [scenario, weights]);
  const cheapest = greedyPick(scenario.pool);
  const front = useMemo(() => new Set(scenario.front), [scenario]);
  const isEngineDefault = WEIGHT_KEYS.every(
    (k) => Math.abs(weights[k] - benchmark.weights[k]) < 0.005
  );

  // On wide screens scrolling through the step texts moves the pinned chart along; with reduced
  // motion or on narrow screens (chart above the steps) the steps change only when chosen.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 1024px)').matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setStep(Number((entry.target as HTMLElement).dataset.step));
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const describe = (i: number) => {
    const c = scenario.pool[i];
    const tags = [
      i === cheapest && e('cheapest'),
      i === pick && e('weighted pick'),
      i === scenario.knee && e('knee'),
      front.has(i) && e('on the trade-off front'),
    ].filter(Boolean);
    return `${e('Offer')} ${i + 1}: ${money.format(c.cost)}, ${decimal.format(c.days)} ${e('days')}, ${e('reliability')} ${percent.format(c.reliability)}, ${e('score')} ${score.format(scores[i])}${tags.length ? ` (${tags.join(', ')})` : ''}`;
  };

  const shown = active ?? (step >= 2 ? pick : step === 1 ? cheapest : null);

  return (
    <section id="tradeoffs" className="landing-section tradeoffs" aria-labelledby="tradeoffs-title">
      <div className="tradeoffs-text">
        <h2 id="tradeoffs-title">{e('Every order is a trade-off.')}</h2>
        <p className="landing-lead">
          {e(
            'Cost, delivery time and reliability pull in different directions. Here is one real benchmark scenario, offer by offer.'
          )}
        </p>
        <ol className="tradeoffs-steps">
          {STEPS.map((s, k) => (
            <li
              key={s.title}
              data-step={k}
              ref={(node) => {
                stepRefs.current[k] = node;
              }}
              className={k === step ? 'is-active' : undefined}
            >
              <button
                type="button"
                className="tradeoffs-step-button"
                aria-pressed={k === step}
                onClick={() => setStep(k)}
              >
                <span className="tradeoffs-step-number num" aria-hidden="true">
                  {k + 1}
                </span>
                <span>{e(s.title)}</span>
              </button>
              <p>{e(s.body)}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="tradeoffs-figure">
        <figure className={`tradeoffs-chart step-${step}`}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="group"
            tabIndex={0}
            aria-label={e(
              'Offers by total cost and delivery days. Use the arrow keys to move between offers.'
            )}
            onKeyDown={(event) => {
              const order = scenario.pool
                .map((c, i) => [c.cost, i])
                .sort((a, b) => a[0] - b[0])
                .map(([, i]) => i);
              const at = order.indexOf(active ?? order[0]);
              const next =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? order[Math.min(order.length - 1, at + (active === null ? 0 : 1))]
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? order[Math.max(0, at - 1)]
                    : event.key === 'Escape'
                      ? null
                      : undefined;
              if (next === undefined) return;
              event.preventDefault();
              setActive(next);
            }}
            onBlur={() => setActive(null)}
          >
            <g className="chart-axis" aria-hidden="true">
              {view.xTicks.map((t) => (
                <g key={`x${t}`} transform={`translate(${view.x(t)} ${H - PAD.bottom})`}>
                  <line y2={6} />
                  <text y={22} textAnchor="middle">
                    {compact.format(t)}
                  </text>
                </g>
              ))}
              {view.yTicks.map((t) => (
                <g key={`y${t}`} transform={`translate(${PAD.left} ${view.y(t)})`}>
                  <line x2={W - PAD.left - PAD.right} className="chart-gridline" />
                  <text x={-10} dy="0.32em" textAnchor="end">
                    {decimal.format(t)}
                  </text>
                </g>
              ))}
              <text x={(W + PAD.left) / 2} y={H - 8} textAnchor="middle" className="chart-title">
                {e('Total cost (KZT)')}
              </text>
              <text
                transform={`translate(16 ${(H - PAD.bottom) / 2}) rotate(-90)`}
                textAnchor="middle"
                className="chart-title"
              >
                {e('Delivery days')}
              </text>
            </g>
            <g aria-hidden="true">
              {scenario.pool.map((c, i) => {
                const classes = [
                  'offer',
                  front.has(i) && 'is-front',
                  i === cheapest && 'is-cheapest',
                  i === pick && 'is-pick',
                  i === scenario.knee && 'is-knee',
                  i === active && 'is-active',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <g
                    key={`${scenario.id}-${i}`}
                    className={classes}
                    style={{ transform: `translate(${view.x(c.cost)}px, ${view.y(c.days)}px)` }}
                    onPointerEnter={() => setActive(i)}
                    onPointerLeave={() => setActive(null)}
                  >
                    <circle r={view.r(c.reliability)} />
                    {i === scenario.knee && (
                      <circle className="knee-ring" r={view.r(c.reliability) + 6} />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
          <figcaption className="tradeoffs-readout" aria-live="polite">
            {shown === null ? e('Hover or focus an offer to see its numbers.') : describe(shown)}
          </figcaption>
        </figure>

        <div className="tradeoffs-controls">
          <fieldset className="weights" disabled={step < 2}>
            <legend>
              {e('Weights')}
              {isEngineDefault && <span className="weights-default">{e('engine default')}</span>}
            </legend>
            {WEIGHT_KEYS.map((k) => (
              <label key={k} className="weight">
                <span>
                  {e(WEIGHT_LABELS[k])} <span className="num">{percent.format(weights[k])}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={weights[k]}
                  onChange={(event) =>
                    setWeights(rebalance(weights, k, Number(event.target.value)))
                  }
                />
              </label>
            ))}
            <button
              type="button"
              className="if-link"
              onClick={() => setWeights(WEIGHT_PROFILES.balanced)}
              disabled={isEngineDefault}
            >
              {e('Reset to engine default')}
            </button>
          </fieldset>

          <div className="scenario-nav">
            <p className="num">
              {e('Scenario')} {scenario.id} / {benchmark.scenarioCount} · {scenario.pool.length}{' '}
              {e('offers')}
            </p>
            <button
              type="button"
              className="if-icon-button"
              aria-label={e('Previous scenario')}
              onClick={() => setIndex((index - 1 + scenarios.length) % scenarios.length)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="if-icon-button"
              aria-label={e('Next scenario')}
              onClick={() => setIndex((index + 1) % scenarios.length)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
