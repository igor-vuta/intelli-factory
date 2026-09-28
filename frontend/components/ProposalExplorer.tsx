import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import type { MatchCandidate } from '../lib/authClient';
import { getLocaleFromQuery } from '../lib/i18n';
import {
  type Candidate,
  type Profile,
  WEIGHT_PROFILES,
  greedyPick,
  nonDominated,
  weightedPick,
  weightedScores,
} from '../lib/tradeoff';
import StatusBadge from './StatusBadge';
import TradeoffPlot from './TradeoffPlot';

const PROFILES: { id: Profile; label: string }[] = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'cost', label: 'Lowest cost' },
  { id: 'speed', label: 'Fastest' },
  { id: 'reliability', label: 'Most reliable' },
];

const DASH = '—';

const toNumber = (value: string | number | null | undefined) => {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
};

/** An open offer; `point` is present only when cost, days and reliability are all known. */
type Row = { candidate: MatchCandidate; point: Candidate | null };
type ScoredRow = Row & { point: Candidate };

function toRow(candidate: MatchCandidate): Row {
  const cost = toNumber(candidate.total_cost);
  const days = toNumber(candidate.delivery_days);
  const reliability = toNumber(candidate.reliability_score);
  return {
    candidate,
    point: cost == null || days == null || reliability == null ? null : { cost, days, reliability },
  };
}

/**
 * Compare the open offers for one request by cost, delivery time and reliability. Offers are
 * only compared within one currency; scores use the matching engine's weighted formula
 * (lib/tradeoff.ts). Every open offer can still be chosen through the existing select call.
 */
export default function ProposalExplorer({
  candidates,
  selecting,
  onChoose,
}: {
  candidates: MatchCandidate[];
  selecting: string | null;
  onChoose: (candidateId: string) => void;
}) {
  const e = useExperienceCopy();
  const locale = getLocaleFromQuery(useRouter().query.lang);
  const [profile, setProfile] = useState<Profile>('balanced');
  const [chosenCurrency, setChosenCurrency] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useMemo(
    () => candidates.filter((c) => c.status === 'PENDING' || c.status === 'ACCEPTED').map(toRow),
    [candidates]
  );
  const accepted = open.find((r) => r.candidate.status === 'ACCEPTED') ?? null;

  // Offers can be quoted in different currencies; only like is compared with like.
  const currencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of open) {
      counts.set(r.candidate.currency_code, (counts.get(r.candidate.currency_code) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
  }, [open]);
  const currency =
    chosenCurrency && currencies.includes(chosenCurrency)
      ? chosenCurrency
      : (accepted?.candidate.currency_code ?? currencies[0] ?? 'EUR');

  const rows = useMemo(
    () => open.filter((r) => r.candidate.currency_code === currency),
    [open, currency]
  );
  const scored = useMemo(() => rows.filter((r): r is ScoredRow => r.point != null), [rows]);
  const points = useMemo(() => scored.map((r) => r.point), [scored]);
  const scores = useMemo(() => weightedScores(points, WEIGHT_PROFILES[profile]), [points, profile]);
  const scoreOf = (row: Row) => {
    const index = scored.findIndex((r) => r.candidate.id === row.candidate.id);
    return index < 0 ? null : scores[index];
  };
  const recommended = scored.length ? scored[weightedPick(points, WEIGHT_PROFILES[profile])] : null;
  const cheapest = scored.length ? scored[greedyPick(points)] : null;
  const front = useMemo(() => new Set(nonDominated(points)), [points]);

  const selected =
    rows.find((r) => r.candidate.id === (selectedId ?? accepted?.candidate.id)) ??
    recommended ??
    rows[0] ??
    null;
  const shown = scored.find((r) => r.candidate.id === activeId) ?? selected;

  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const rating = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const moneyOrDash = (value: string | null) =>
    toNumber(value) != null ? money.format(Number(value)) : DASH;

  if (!rows.length) return null;

  const describe = (r: Row) =>
    `${r.candidate.factory_legal_name ?? e('Factory')} + ${r.candidate.logist_legal_name ?? e('Carrier')}: ${
      r.point
        ? `${money.format(r.point.cost)}, ${decimal.format(r.point.days)} ${e('days')}, ${e('reliability')} ${percent.format(r.point.reliability)}`
        : e('figures incomplete')
    }`;

  const selectedScore = selected ? scoreOf(selected) : null;

  return (
    <div className="proposal-explorer">
      <div className="proposal-layout">
        <div className="proposal-main">
          <div className="proposal-controls">
            {currencies.length > 1 && (
              <div className="proposal-profiles" role="radiogroup" aria-label={e('Currency')}>
                {currencies.map((code) => (
                  <label key={code} className="proposal-profile">
                    <input
                      type="radio"
                      name="proposal-currency"
                      value={code}
                      checked={currency === code}
                      onChange={() => {
                        setChosenCurrency(code);
                        setSelectedId(null);
                      }}
                    />
                    <span translate="no">{code}</span>
                  </label>
                ))}
              </div>
            )}
            {scored.length > 1 && (
              <div
                className="proposal-profiles"
                role="radiogroup"
                aria-label={e('What matters most')}
              >
                {PROFILES.map(({ id, label }) => (
                  <label key={id} className="proposal-profile">
                    <input
                      type="radio"
                      name="proposal-profile"
                      value={id}
                      checked={profile === id}
                      onChange={() => {
                        setProfile(id);
                        setSelectedId(null);
                      }}
                    />
                    <span>{e(label)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {currencies.length > 1 && (
            <p className="proposal-note">
              {e('Offers in different currencies are compared separately.')}
            </p>
          )}

          {scored.length > 0 && (
            <figure className="proposal-chart">
              <TradeoffPlot
                points={points}
                currency={currency}
                label={e(
                  'Offers by total cost and delivery days. Use the arrow keys to move between offers.'
                )}
                current={shown ? scored.indexOf(shown as ScoredRow) : null}
                classesOf={(i) => [
                  front.has(i) && 'is-front',
                  scored[i] === recommended && 'is-pick',
                  scored[i] === cheapest && 'is-cheapest',
                  scored[i] === selected && 'is-selected',
                ]}
                onActive={(i) => setActiveId(i == null ? null : scored[i].candidate.id)}
                onSelect={(i) => setSelectedId(scored[i].candidate.id)}
              />
              <figcaption className="proposal-legend">
                <span className="legend-pick">{e('Recommended')}</span>
                <span className="legend-cheapest">{e('Cheapest')}</span>
                <span className="legend-front">{e('Not beaten on all three')}</span>
                <span>{e('Bigger dot: more reliable')}</span>
              </figcaption>
              <p className="proposal-readout" aria-live="polite">
                {shown ? describe(shown) : ''}
              </p>
            </figure>
          )}

          <div
            className="proposal-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={e('All complete offers')}
          >
            <table className="proposal-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">{e('Select')}</span>
                  </th>
                  <th scope="col">{e('Factory')}</th>
                  <th scope="col">{e('Carrier')}</th>
                  <th scope="col">{e('Total')}</th>
                  <th scope="col">{e('Days')}</th>
                  <th scope="col">{e('Reliability')}</th>
                  <th scope="col">{e('Score')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const score = scoreOf(r);
                  return (
                    <tr
                      key={r.candidate.id}
                      className={r === selected ? 'is-selected' : undefined}
                      onClick={() => setSelectedId(r.candidate.id)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="proposal"
                          aria-label={describe(r)}
                          checked={r === selected}
                          onChange={() => setSelectedId(r.candidate.id)}
                        />
                      </td>
                      <th scope="row">{r.candidate.factory_legal_name ?? DASH}</th>
                      <td>{r.candidate.logist_legal_name ?? DASH}</td>
                      <td>{moneyOrDash(r.candidate.total_cost)}</td>
                      <td>{r.point ? decimal.format(r.point.days) : DASH}</td>
                      <td>{r.point ? percent.format(r.point.reliability) : DASH}</td>
                      <td>{score != null ? Math.round(score * 100) : DASH}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {scored.length < rows.length && (
            <p className="proposal-note">
              {e('Not scored, figures incomplete')}: {rows.length - scored.length}
            </p>
          )}
        </div>

        {selected && (
          <aside className="proposal-detail" aria-label={e('Selected offer')}>
            <div className="proposal-detail-head">
              {selected === recommended && (
                <span className="proposal-flag">{e('Recommended for you')}</span>
              )}
              {selected.candidate.status === 'ACCEPTED' && <StatusBadge status="ACCEPTED" />}
            </div>
            <dl className="proposal-parties">
              <div>
                <dt>{e('Factory')}</dt>
                <dd>
                  {selected.candidate.factory_legal_name ?? DASH}
                  {selected.candidate.factory_avg_rating != null && (
                    <span className="proposal-rating">
                      ★ {rating.format(selected.candidate.factory_avg_rating)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>{e('Carrier')}</dt>
                <dd>
                  {selected.candidate.logist_legal_name ?? DASH}
                  {selected.candidate.logist_avg_rating != null && (
                    <span className="proposal-rating">
                      ★ {rating.format(selected.candidate.logist_avg_rating)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="proposal-total">
              <span>{e('Total')}</span>
              <strong className="num">{moneyOrDash(selected.candidate.total_cost)}</strong>
            </p>
            <dl className="proposal-facts">
              <div>
                <dt>{e('Delivery')}</dt>
                <dd className="num">{moneyOrDash(selected.candidate.delivery_price)}</dd>
              </div>
              <div>
                <dt>{e('Delivery days')}</dt>
                <dd className="num">
                  {selected.point ? decimal.format(selected.point.days) : DASH}
                </dd>
              </div>
              <div>
                <dt>{e('Reliability')}</dt>
                <dd className="num">
                  {selected.point ? percent.format(selected.point.reliability) : DASH}
                </dd>
              </div>
              <div>
                <dt>{e('Score')}</dt>
                <dd className="num">
                  {selectedScore != null ? `${Math.round(selectedScore * 100)} / 100` : DASH}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="if-button if-button-primary proposal-choose"
              disabled={
                selecting != null ||
                (accepted != null && accepted.candidate.id !== selected.candidate.id) ||
                selected.candidate.status === 'ACCEPTED'
              }
              onClick={() => onChoose(selected.candidate.id)}
            >
              {selected.candidate.status === 'ACCEPTED'
                ? e('Chosen')
                : selecting === selected.candidate.id
                  ? e('Choosing…')
                  : e('Choose this proposal')}
            </button>
            <p className="proposal-note">
              {e(
                'Scores use the platform’s matching formula for the priority above. You sign the contract next.'
              )}
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
