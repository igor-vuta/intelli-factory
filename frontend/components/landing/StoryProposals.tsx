import { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import { heroScenario } from '../../lib/benchmarkShowcase';
import { getLocaleFromQuery } from '../../lib/i18n';
import { WEIGHT_PROFILES, weightedScores } from '../../lib/tradeoff';

const LETTERS = 'ABCDE';

/**
 * The list the workflow story ends on: real proposals from a benchmark scenario, with the
 * engine's balanced pick as one entry among trade-off alternatives.
 */
export default function StoryProposals({ className }: { className?: string }) {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  const rows = useMemo(() => {
    const { pool, front, picks } = heroScenario;
    const scores = weightedScores(pool, WEIGHT_PROFILES.balanced);
    const byScore = pool.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
    // The engine's pick, then the other trade-off offers, then the next best by score.
    const chosen = [picks.fast];
    for (const i of [...front, ...byScore]) {
      if (chosen.length === 5) break;
      if (!chosen.includes(i)) chosen.push(i);
    }
    // Listed in the order the offers arrived, as the customer would see them.
    return chosen.sort((a, b) => a - b).map((i) => ({ ...pool[i], balanced: i === picks.fast }));
  }, []);
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });

  return (
    <figure className={['story-proposals', className].filter(Boolean).join(' ')}>
      <figcaption>{e('Proposals for this request')}</figcaption>
      <ol>
        {rows.map((row, i) => (
          <li key={i} className={row.balanced ? 'is-balanced' : undefined}>
            <span className="story-proposal-name">
              {e('Offer')} {LETTERS[i]}
            </span>
            <span className="num">{money.format(row.cost)}</span>
            <span className="num">
              {decimal.format(row.days)} {e('days')}
            </span>
            <span className="num">{percent.format(row.reliability)}</span>
            {row.balanced && <strong className="story-proposal-tag">{e('Balanced pick')}</strong>}
          </li>
        ))}
      </ol>
      <p className="story-proposal-source">
        {e('Real engine output from benchmark scenario')} #{heroScenario.id}
      </p>
    </figure>
  );
}
