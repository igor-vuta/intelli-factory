import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import TradeoffPlot from '../TradeoffPlot';
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
          <TradeoffPlot
            key={scenario.id}
            layout="wide"
            points={scenario.pool}
            currency="KZT"
            label={e(
              'Offers by total cost and delivery days. Use the arrow keys to move between offers.'
            )}
            current={active}
            onActive={setActive}
            classesOf={(i) => [
              front.has(i) && 'is-front',
              i === cheapest && 'is-cheapest',
              i === pick && 'is-pick',
              i === scenario.knee && 'is-knee',
            ]}
          />
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
