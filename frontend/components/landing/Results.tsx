import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import { benchmark, deepMatchesFastRuns, totalRuns } from '../../lib/benchmarkShowcase';
import { getLocaleFromQuery } from '../../lib/i18n';

const ROWS = [
  { mode: 'greedy', name: 'Cheapest first' },
  { mode: 'fast', name: 'Weighted ranking' },
  { mode: 'deep', name: 'Genetic search' },
] as const;

export default function Results() {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  const format = useMemo(() => {
    const signed = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
      signDisplay: 'always',
    });
    const plain = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
    return {
      signedPct: (v: number) => `${signed.format(v)}%`,
      pct: (v: number) => `${plain.format(Math.abs(v))}%`,
      money: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      days: new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }),
      three: new Intl.NumberFormat(locale, { maximumFractionDigits: 3, minimumFractionDigits: 3 }),
      count: new Intl.NumberFormat(locale),
    };
  }, [locale]);
  const weighted = benchmark.summary.fast;

  const metrics = [
    { value: format.signedPct(weighted.fitnessChangePct), label: 'Composite fitness', key: true },
    { value: format.pct(weighted.daysChangePct), label: 'Faster delivery' },
    { value: format.signedPct(weighted.reliabilityChangePct), label: 'Reliability' },
    {
      value: format.signedPct(weighted.costChangePct),
      label: 'Cost',
      note: 'The price of faster, more reliable delivery.',
    },
  ];

  return (
    <section id="results" className="landing-section results" aria-labelledby="results-title">
      <div className="results-intro">
        <h2 id="results-title">{e('Measured, not claimed.')}</h2>
        <p className="landing-lead">
          {format.count.format(benchmark.scenarioCount)} {e('synthetic scenarios')},{' '}
          {format.count.format(benchmark.runsPerScenario)} {e('runs each')},{' '}
          {e('run on the production engine code. Compared with taking the cheapest offer:')}
        </p>
      </div>
      <div className="results-body">
        <dl className="results-metrics">
          {metrics.map((m) => (
            <div key={m.label} className={m.key ? 'is-key' : undefined}>
              <dt>{e(m.label)}</dt>
              <dd className="num">{m.value}</dd>
              {m.note && <dd className="results-note">{e(m.note)}</dd>}
            </div>
          ))}
        </dl>
        <table className="results-table">
          <caption className="sr-only">{e('Average of the chosen offer by method')}</caption>
          <thead>
            <tr>
              <th scope="col">{e('Method')}</th>
              <th scope="col">{e('Cost (KZT)')}</th>
              <th scope="col">{e('Days')}</th>
              <th scope="col">{e('Reliability')}</th>
              <th scope="col">{e('Fitness')}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ mode, name }) => {
              const s = benchmark.summary[mode];
              return (
                <tr key={mode}>
                  <th scope="row">{e(name)}</th>
                  <td>{format.money.format(s.cost)}</td>
                  <td>{format.days.format(s.days)}</td>
                  <td>{format.three.format(s.reliability)}</td>
                  <td>{format.three.format(s.fitness)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="results-footnote">
          {e('Genetic search chose the same offer as the weighted ranking in')}{' '}
          <span className="num">
            {format.count.format(deepMatchesFastRuns)} / {format.count.format(totalRuns)}
          </span>{' '}
          {e(
            'runs. Both use the same score; with 8 to 25 offers per scenario, ranking every offer already finds the best one.'
          )}
        </p>
      </div>
    </section>
  );
}
