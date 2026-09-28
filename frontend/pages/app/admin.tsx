import SelectField from '../../components/SelectField';
import CategoryProposalPanel from '../../components/CategoryProposalPanel';
import StatusBadge from '../../components/StatusBadge';
import RecordRow, { RecordDetail } from '../../components/RecordRow';
import { useExpandedRecords } from '../../hooks/useExpandedRecords';
import TablePager from '../../components/TablePager';
import TradeoffPlot from '../../components/TradeoffPlot';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import WorkspaceExperience from '../../components/WorkspaceExperience';
import { workspacePath } from '../../lib/navigation';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../lib/authClient';

import {
  listRequests,
  logout,
  me,
  optimizeCompare,
  seedLargeScale,
  type OptimizeCompareResponse,
  type OptimizePriority,
  type RequestSummary,
} from '../../lib/authClient';
import { formatDateTime, formatMoney, formatQuantityWithUnit } from '../../lib/formatting';
import { statusLabel } from '../../lib/status';
import {
  nonDominated,
  weightedScores,
  WEIGHT_PROFILES,
  type Candidate,
  type Weights,
} from '../../lib/tradeoff';
import { getLocaleFromQuery } from '../../lib/i18n';

const REQUESTS_PAGE_SIZE = 5;

export default function AdminWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const e = useExperienceCopy();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsQuery, setRequestsQuery] = useState('');
  const [requestsStatusFilter, setRequestsStatusFilter] = useState('ALL');
  const [requestsCurrencyFilter, setRequestsCurrencyFilter] = useState('ALL');
  const [requestsCustomerFilter, setRequestsCustomerFilter] = useState('ALL');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [profile, setProfile] = useState<OptimizePriority>('balanced');
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<OptimizeCompareResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'greedy' | 'fast' | 'deep'>('deep');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [activePoint, setActivePoint] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'ADMIN') {
          await router.replace(workspacePath(auth.user.role, locale));
          return;
        }

        const [rows] = await Promise.all([listRequests()]);
        if (!cancelled) {
          setRequests(rows);
        }
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load admin workspace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  async function handleLogout() {
    try {
      await logout();
      await router.push(`/login?lang=${locale}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not log out. Please try again.');
    }
  }

  async function handleCompare() {
    setCompareError(null);
    setCompareData(null);

    if (!selectedRequestId.trim()) {
      setCompareError('Select a request to compare');
      return;
    }

    setComparing(true);
    try {
      const data = await optimizeCompare(selectedRequestId.trim(), profile);
      setCompareData(data);
      setActiveTab('deep');
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Comparison request failed');
    } finally {
      setComparing(false);
    }
  }

  // Re-run comparison automatically on change.
  useEffect(() => {
    if (!compareData || !selectedRequestId.trim() || comparing) return;
    let cancelled = false;
    setComparing(true);
    setCompareError(null);
    optimizeCompare(selectedRequestId.trim(), profile)
      .then((data) => {
        if (!cancelled) {
          setCompareData(data);
          setActiveTab('deep');
        }
      })
      .catch((err) => {
        if (!cancelled)
          setCompareError(err instanceof Error ? err.message : 'Comparison request failed');
      })
      .finally(() => {
        if (!cancelled) setComparing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleSeedLargeScale() {
    setSeedLoading(true);
    setSeedMessage(null);
    try {
      const result = await seedLargeScale();
      setSeedMessage(
        `✓ ${result.message} - ${result.candidates_created} candidates created. Reload the page to see the new request.`
      );
      const rows = await listRequests();
      setRequests(rows);
    } catch (err) {
      setSeedMessage(`Error: ${err instanceof Error ? err.message : 'Seed failed'}`);
    } finally {
      setSeedLoading(false);
    }
  }

  const statusStats = useMemo(() => {
    const summary = {
      total: requests.length,
      pending: 0,
      pairing: 0,
      matched: 0,
      cancelled: 0,
      completed: 0,
    };

    for (const row of requests) {
      if (row.status === 'PENDING') summary.pending += 1;
      if (row.status === 'PAIRING_IN_PROGRESS') summary.pairing += 1;
      if (row.status === 'MATCHED') summary.matched += 1;
      if (row.status === 'CANCELLED') summary.cancelled += 1;
      if (row.status === 'COMPLETED') summary.completed += 1;
    }

    return summary;
  }, [requests]);

  // The whole pool (plus any pick not in it) for the trade-off chart, its real three-objective
  // front, and where each strategy's top pick sits.
  const plot = useMemo(() => {
    if (!compareData) return null;
    const ids: string[] = [];
    const points: Candidate[] = [];
    const add = (o: {
      id: string;
      total_cost: number;
      delivery_days: number;
      reliability: number;
    }) => {
      if (ids.includes(o.id)) return;
      ids.push(o.id);
      points.push({ cost: o.total_cost, days: o.delivery_days, reliability: o.reliability });
    };
    compareData.pool.forEach(add);
    (['greedy', 'fast', 'deep'] as const).forEach((k) => compareData[k].forEach(add));
    if (!points.length) return null;
    const pick = (k: 'greedy' | 'fast' | 'deep') => {
      const top = compareData[k][0];
      return top ? ids.indexOf(top.id) : -1;
    };
    // Greedy ranks by cost alone and returns no score. When the response carries the whole pool,
    // lib/tradeoff (the engine's own formula) scores its pick so all three can be compared.
    const complete = compareData.pool.length === compareData.candidate_pool_size;
    const scores = complete
      ? weightedScores(
          compareData.pool.map((o) => ({
            cost: o.total_cost,
            days: o.delivery_days,
            reliability: o.reliability,
          })),
          compareData.weights
        )
      : null;
    const scoreOf = (id: string) => {
      const at = compareData.pool.findIndex((o) => o.id === id);
      return scores && at >= 0 ? scores[at] : null;
    };
    return {
      points,
      scoreOf,
      front: new Set(nonDominated(points)),
      picks: { greedy: pick('greedy'), fast: pick('fast'), deep: pick('deep') },
      currency: compareData.fast[0]?.currency_code ?? compareData.greedy[0]?.currency_code ?? 'EUR',
    };
  }, [compareData]);
  useEffect(() => setActivePoint(null), [compareData]);
  const weightsText = (w: Weights) =>
    `${e('cost')} ${Math.round(w.cost * 100)}% · ${e('time')} ${Math.round(w.time * 100)}% · ${e('reliability')} ${Math.round(w.reliability * 100)}%`;

  const requestStatusOptions = useMemo(
    () => Array.from(new Set(requests.map((row) => row.status))).sort(),
    [requests]
  );

  const requestCurrencyOptions = useMemo(
    () => Array.from(new Set(requests.map((row) => row.preferred_currency_code))).sort(),
    [requests]
  );

  const requestCustomerOptions = useMemo(
    () => Array.from(new Set(requests.map((row) => row.customer_profile_id))).sort(),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const q = requestsQuery.trim().toLowerCase();
    return requests.filter((row) => {
      const matchesQuery =
        !q ||
        row.id.toLowerCase().includes(q) ||
        row.customer_profile_id.toLowerCase().includes(q) ||
        (row.requested_name_text ?? '').toLowerCase().includes(q) ||
        (row.item_name ?? '').toLowerCase().includes(q);
      const matchesStatus = requestsStatusFilter === 'ALL' || row.status === requestsStatusFilter;
      const matchesCurrency =
        requestsCurrencyFilter === 'ALL' || row.preferred_currency_code === requestsCurrencyFilter;
      const matchesCustomer =
        requestsCustomerFilter === 'ALL' || row.customer_profile_id === requestsCustomerFilter;
      return matchesQuery && matchesStatus && matchesCurrency && matchesCustomer;
    });
  }, [
    requests,
    requestsQuery,
    requestsStatusFilter,
    requestsCurrencyFilter,
    requestsCustomerFilter,
  ]);

  const requestsTotalPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE));

  const paginatedRequests = useMemo(() => {
    const start = (requestsPage - 1) * REQUESTS_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [filteredRequests, requestsPage]);

  useEffect(() => {
    if (requestsPage > requestsTotalPages) setRequestsPage(requestsTotalPages);
  }, [requestsPage, requestsTotalPages]);

  const requestRecords = useExpandedRecords(
    filteredRequests.map((row) => row.id),
    REQUESTS_PAGE_SIZE,
    setRequestsPage
  );

  const STRATEGIES = [
    {
      key: 'greedy',
      name: 'Greedy',
      how: 'Takes the cheapest offer; the baseline.',
    },
    {
      key: 'fast',
      name: 'Fast',
      how: 'Ranks the whole pool by the weighted score.',
    },
    {
      key: 'deep',
      name: 'Deep',
      how: 'A genetic search (DEAP) over the same weighted score, so it can match Fast but not beat it.',
    },
  ] as const;
  const PROFILES: { id: OptimizePriority; label: string }[] = [
    { id: 'balanced', label: 'Balanced' },
    { id: 'cost', label: 'Lowest cost' },
    { id: 'speed', label: 'Fastest' },
    { id: 'reliability', label: 'Most reliable' },
  ];
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const score = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const requestName = (row: RequestSummary) =>
    row.item_name ?? row.requested_name_text ?? e('Supply request');
  const statusCounts = requestStatusOptions.map(
    (status) =>
      `${requests.filter((row) => row.status === status).length} ${statusLabel(locale, status)}`
  );

  return (
    <WorkspaceExperience
      role="admin"
      loading={loading}
      error={error}
      counts={[statusStats.total, statusStats.pairing, statusStats.completed]}
      items={requests.map((row) => ({
        id: row.id,
        title: requestName(row),
        status: row.status,
        detail: formatQuantityWithUnit(row.quantity, row.quantity_unit),
      }))}
      onLogout={handleLogout}
    >
      <div className="workspace-panels">
        <CategoryProposalPanel locale={locale} admin />
        <section data-section="operations" className="surface-1 rounded-2xl p-6 sm:p-8">
          <h2 id="requests" className="text-lg font-semibold">
            {e('All requests')}
          </h2>
          {!loading && (
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))] num">
              {statusCounts.join(' · ')}
            </p>
          )}

          {loading && <p className="mt-4 text-[rgb(var(--muted))]">{e('Loading workspace…')}</p>}

          {!loading && !error && (
            <>
              <div className="table-filters table-filters-4">
                <input
                  type="search"
                  aria-label={e('Search reference, customer or item')}
                  value={requestsQuery}
                  onChange={(e) => setRequestsQuery(e.target.value)}
                  placeholder={e('Search reference, customer or item')}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <SelectField
                  aria-label={e('Status')}
                  value={requestsStatusFilter}
                  onChange={(e) => setRequestsStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All statuses')}</option>
                  {requestStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(locale, status)}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  aria-label={e('Currency')}
                  value={requestsCurrencyFilter}
                  onChange={(e) => setRequestsCurrencyFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All currencies')}</option>
                  {requestCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  aria-label={e('Customer')}
                  value={requestsCustomerFilter}
                  onChange={(e) => setRequestsCustomerFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All customers')}</option>
                  {requestCustomerOptions.map((customerId) => (
                    <option key={customerId} value={customerId}>
                      {e('Customer')} {customerId.slice(0, 8)}
                    </option>
                  ))}
                </SelectField>
              </div>

              {filteredRequests.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {requests.length === 0
                    ? e('No requests available.')
                    : e('No requests match current filters.')}
                </p>
              ) : (
                <>
                  <div
                    className="record-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={e('All requests')}
                  >
                    <table className="record-table">
                      <thead>
                        <tr>
                          <th>{e('Item')}</th>
                          <th>{e('Customer')}</th>
                          <th>{e('Quantity')}</th>
                          <th>{e('Status')}</th>
                          <th>{e('Created')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRequests.map((row) => (
                          <RecordRow
                            key={row.id}
                            id={row.id}
                            open={requestRecords.isOpen(row.id)}
                            onToggle={() => requestRecords.toggle(row.id)}
                            colSpan={5}
                            title={requestName(row)}
                            subtitle={<small className="font-mono">{row.id.slice(0, 8)}</small>}
                            detail={
                              <RecordDetail
                                facts={[
                                  [e('Reference'), <code key="ref">{row.id}</code>],
                                  [
                                    e('Customer'),
                                    <code key="customer">{row.customer_profile_id}</code>,
                                  ],
                                  [e('Category'), row.category_name],
                                  [
                                    e('Quantity'),
                                    formatQuantityWithUnit(row.quantity, row.quantity_unit),
                                  ],
                                  [e('Currency'), row.preferred_currency_code],
                                  [e('Status'), statusLabel(locale, row.status)],
                                  [e('Created'), formatDateTime(locale, row.created_at)],
                                ]}
                                actions={
                                  row.status === 'PAIRING_IN_PROGRESS' ? (
                                    <button
                                      type="button"
                                      className="if-button if-button-primary"
                                      onClick={() => {
                                        setSelectedRequestId(row.id);
                                        setCompareData(null);
                                        document
                                          .getElementById('optimization')
                                          ?.scrollIntoView({ block: 'start' });
                                      }}
                                    >
                                      {e('Compare strategies')}
                                    </button>
                                  ) : undefined
                                }
                              />
                            }
                          >
                            <td data-label={e('Customer')} className="font-mono text-xs">
                              {row.customer_profile_id.slice(0, 8)}
                            </td>
                            <td data-label={e('Quantity')} className="num">
                              {formatQuantityWithUnit(row.quantity, row.quantity_unit)}
                              <small>{row.preferred_currency_code}</small>
                            </td>
                            <td data-label={e('Status')}>
                              <StatusBadge status={row.status} />
                            </td>
                            <td data-label={e('Created')}>
                              {formatDateTime(locale, row.created_at)}
                            </td>
                          </RecordRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePager
                    page={requestsPage}
                    pageSize={REQUESTS_PAGE_SIZE}
                    total={filteredRequests.length}
                    onPage={setRequestsPage}
                  />
                </>
              )}

              <div className="optimisation-panel">
                <div className="section-heading-row">
                  <div>
                    <h2 id="optimization" className="text-lg font-semibold">
                      {e('Compare the optimisation strategies')}
                    </h2>
                    <p className="mt-0.5 max-w-prose text-xs text-[rgb(var(--muted))]">
                      {e(
                        'Run Greedy, Fast and Deep on the same candidate pool for one request and see where each pick sits among all the offers.'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={seedLoading}
                    onClick={handleSeedLargeScale}
                    className="if-button"
                  >
                    {seedLoading ? e('Generating…') : e('Generate a 150-offer test request')}
                  </button>
                </div>

                {seedMessage && (
                  <p
                    role="status"
                    className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                      seedMessage.startsWith('Error')
                        ? 'bg-danger/10 text-danger'
                        : 'bg-success/10 text-success'
                    }`}
                  >
                    {seedMessage}
                  </p>
                )}

                <div className="optimisation-controls">
                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                      {e('Request collecting proposals')}
                    </label>
                    <SelectField
                      aria-label={e('Request collecting proposals')}
                      value={selectedRequestId}
                      onChange={(e) => {
                        setSelectedRequestId(e.target.value);
                        setCompareData(null);
                        setCompareError(null);
                      }}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="">{e('Select a request…')}</option>
                      {requests
                        .filter((r) => r.status === 'PAIRING_IN_PROGRESS')
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {requestName(r)} · {r.id.slice(0, 8)}
                          </option>
                        ))}
                    </SelectField>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                      {e('What matters most')}
                    </label>
                    <SelectField
                      aria-label={e('What matters most')}
                      value={profile}
                      onChange={(e) => setProfile(e.target.value as OptimizePriority)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      {PROFILES.map(({ id, label }) => (
                        <option key={id} value={id}>
                          {e(label)} · {weightsText(WEIGHT_PROFILES[id])}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  <button
                    type="button"
                    disabled={comparing || !selectedRequestId}
                    onClick={handleCompare}
                    className="if-button if-button-primary"
                  >
                    {comparing ? e('Running the three strategies…') : e('Run the comparison')}
                  </button>
                </div>

                {compareError && (
                  <p
                    role="alert"
                    className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
                  >
                    {compareError}
                  </p>
                )}

                {compareData && plot && (
                  <div className="optimisation-results">
                    <p className="text-sm text-[rgb(var(--muted))] num">
                      {e('Offers in the pool')}: {compareData.candidate_pool_size} ·{' '}
                      {weightsText(compareData.weights)}
                    </p>

                    <div className="record-scroll">
                      <table className="record-table strategy-table">
                        <caption className="sr-only">{e('Each strategy’s top pick')}</caption>
                        <thead>
                          <tr>
                            <th>{e('Strategy')}</th>
                            <th>{e('Total cost')}</th>
                            <th>{e('Delivery days')}</th>
                            <th>{e('Reliability')}</th>
                            <th>{e('Weighted score')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {STRATEGIES.map(({ key, name, how }) => {
                            const best = compareData[key][0];
                            const sameAsFast =
                              key !== 'fast' && best && best.id === compareData.fast[0]?.id;
                            return (
                              <tr key={key} data-strategy={key}>
                                <td className="record-title">
                                  <span className="strategy-swatch" aria-hidden="true" />
                                  {e(name)}
                                  <small>{e(how)}</small>
                                  {sameAsFast && <small>{e('Same offer as Fast.')}</small>}
                                </td>
                                <td data-label={e('Total cost')} className="num">
                                  {best
                                    ? formatMoney(locale, best.total_cost, best.currency_code)
                                    : '—'}
                                </td>
                                <td data-label={e('Delivery days')} className="num">
                                  {best ? decimal.format(best.delivery_days) : '—'}
                                </td>
                                <td data-label={e('Reliability')} className="num">
                                  {best ? percent.format(best.reliability) : '—'}
                                </td>
                                <td data-label={e('Weighted score')} className="num">
                                  {!best
                                    ? '—'
                                    : key === 'greedy'
                                      ? (plot.scoreOf(best.id) ?? null) == null
                                        ? '—'
                                        : score.format(plot.scoreOf(best.id)!)
                                      : score.format(best.fitness_score ?? 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {plot.points.length < 2 && (
                      <p className="text-sm text-[rgb(var(--muted))]">
                        {e('Only one offer so far, so there is no trade-off to chart yet.')}
                      </p>
                    )}
                    {plot.points.length >= 2 && (
                      <figure className="proposal-chart optimisation-chart">
                        <TradeoffPlot
                          points={plot.points}
                          currency={plot.currency}
                          label={e(
                            'All offers in the pool by total cost and delivery days, with each strategy’s pick marked. Use the arrow keys to move between offers.'
                          )}
                          current={activePoint}
                          classesOf={(i) => [
                            plot.front.has(i) && 'is-front',
                            i === plot.picks.greedy && 'is-cheapest',
                            i === plot.picks.fast && 'is-pick',
                            i === plot.picks.deep && i !== plot.picks.fast && 'is-deep',
                          ]}
                          onActive={setActivePoint}
                        />
                        <figcaption className="proposal-legend">
                          <span className="legend-cheapest">{e('Greedy pick')}</span>
                          <span className="legend-pick">
                            {plot.picks.deep === plot.picks.fast
                              ? e('Fast and Deep pick')
                              : e('Fast pick')}
                          </span>
                          {plot.picks.deep !== plot.picks.fast && (
                            <span className="legend-deep">{e('Deep pick')}</span>
                          )}
                          <span className="legend-front">{e('Not beaten on all three')}</span>
                          <span>{e('Bigger dot: more reliable')}</span>
                        </figcaption>
                        <p className="proposal-readout" aria-live="polite">
                          {activePoint != null
                            ? `${formatMoney(locale, plot.points[activePoint].cost, plot.currency)}, ${decimal.format(plot.points[activePoint].days)} ${e('days')}, ${e('reliability')} ${percent.format(plot.points[activePoint].reliability)}`
                            : ''}
                        </p>
                      </figure>
                    )}

                    <div
                      className="strategy-tabs"
                      role="tablist"
                      aria-label={e('Ranked offers by strategy')}
                    >
                      {STRATEGIES.map(({ key, name }) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          id={`strategy-tab-${key}`}
                          aria-selected={activeTab === key}
                          aria-controls="strategy-ranking"
                          onClick={() => setActiveTab(key)}
                        >
                          {e(name)}
                        </button>
                      ))}
                    </div>
                    <div
                      id="strategy-ranking"
                      role="tabpanel"
                      aria-labelledby={`strategy-tab-${activeTab}`}
                      className="record-scroll"
                      tabIndex={0}
                    >
                      {compareData[activeTab].length === 0 ? (
                        <p className="px-3 py-6 text-sm text-[rgb(var(--muted))]">
                          {e('No solutions returned for this strategy.')}
                        </p>
                      ) : (
                        <table className="record-table">
                          <thead>
                            <tr>
                              <th>{e('Rank')}</th>
                              <th>{e('Total cost')}</th>
                              <th>{e('Delivery days')}</th>
                              <th>{e('Reliability')}</th>
                              <th>{e('Weighted score')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {compareData[activeTab].map((sol) => (
                              <tr key={sol.id}>
                                <td className="record-title num">
                                  #{sol.rank}
                                  <small className="font-mono">{sol.id.slice(0, 8)}</small>
                                </td>
                                <td data-label={e('Total cost')} className="num">
                                  {formatMoney(locale, sol.total_cost, sol.currency_code)}
                                </td>
                                <td data-label={e('Delivery days')} className="num">
                                  {decimal.format(sol.delivery_days)}
                                </td>
                                <td data-label={e('Reliability')} className="num">
                                  {percent.format(sol.reliability)}
                                </td>
                                <td data-label={e('Weighted score')} className="num">
                                  {score.format(sol.fitness_score ?? 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </WorkspaceExperience>
  );
}
