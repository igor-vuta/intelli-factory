import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  compareBaselines,
  getComparisonCatalog,
  listRequests,
  logout,
  me,
  type BaselineComparePriority,
  type BaselineCompareResponse,
  optimizeSupply,
  type OptimizeSolution,
  type RequestSummary,
} from '../../lib/authClient';
import { formatQuantityWithUnit } from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

const REQUESTS_PAGE_SIZE = 5;

export default function AdminWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsQuery, setRequestsQuery] = useState('');
  const [requestsStatusFilter, setRequestsStatusFilter] = useState('ALL');
  const [requestsCurrencyFilter, setRequestsCurrencyFilter] = useState('ALL');
  const [requestsCustomerFilter, setRequestsCustomerFilter] = useState('ALL');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [optimizeMode, setOptimizeMode] = useState<'fast' | 'deep'>('fast');
  const [priority, setPriority] = useState<BaselineComparePriority>('balanced');
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<BaselineCompareResponse | null>(null);
  const [optimizerResult, setOptimizerResult] = useState<OptimizeSolution | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'ADMIN') {
          await router.replace(`/login?lang=${locale}`);
          return;
        }

        const [rows] = await Promise.all([listRequests(), getComparisonCatalog()]);
        if (!cancelled) {
          setRequests(rows);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : 'Failed to load admin workspace'
          );
        }
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
    await logout();
    await router.push(`/login?lang=${locale}`);
  }

  async function handleCompare(event: FormEvent) {
    event.preventDefault();
    setCompareError(null);

    if (!selectedRequestId.trim()) {
      setCompareError('Select a request to compare');
      return;
    }

    setComparing(true);
    try {
      const [baseline, optimized] = await Promise.all([
        compareBaselines({ request_id: selectedRequestId.trim(), priority }),
        optimizeSupply({ request_id: selectedRequestId.trim(), mode: optimizeMode }),
      ]);

      const bestSolution = optimized.solutions?.[0];
      if (!bestSolution) {
        throw new Error('Optimizer returned no solutions for this request');
      }

      setCompareResult(baseline);
      setOptimizerResult(bestSolution);
    } catch (err) {
      setCompareResult(null);
      setOptimizerResult(null);
      setCompareError(err instanceof Error ? err.message : 'Comparison request failed');
    } finally {
      setComparing(false);
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

  const comparisonRows = useMemo(() => {
    if (!compareResult) return [];

    const rows = [
      {
        label: 'Greedy',
        total_cost: compareResult.greedy.total_cost,
        delivery_days: compareResult.greedy.delivery_days,
        reliability_score: compareResult.greedy.reliability_score,
      },
      {
        label: 'Heuristic',
        total_cost: compareResult.heuristic.total_cost,
        delivery_days: compareResult.heuristic.delivery_days,
        reliability_score: compareResult.heuristic.reliability_score,
      },
    ];

    if (optimizerResult) {
      rows.push({
        label: 'Optimizer',
        total_cost: optimizerResult.total_cost,
        delivery_days: optimizerResult.delivery_days,
        reliability_score: optimizerResult.reliability,
      });
    }

    return rows;
  }, [compareResult, optimizerResult]);

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

  const winners = useMemo(() => {
    if (comparisonRows.length === 0) return null;

    const byCost = [...comparisonRows].sort((a, b) => a.total_cost - b.total_cost)[0];
    const bySpeed = [...comparisonRows].sort((a, b) => a.delivery_days - b.delivery_days)[0];
    const byReliability = [...comparisonRows].sort(
      (a, b) => b.reliability_score - a.reliability_score
    )[0];

    return {
      byCost,
      bySpeed,
      byReliability,
    };
  }, [comparisonRows]);

  return (
    <main
      className={`${THEME_CLASSES[theme]} min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))]"
          >
            <Image
              src="/presets/logo.svg"
              alt="Intelli-Factory logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
              unoptimized
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
            <span>{copy.brand}</span>
          </Link>

          <button type="button" onClick={handleLogout} className="btn btn-ghost text-sm">
            {copy.logout}
          </button>
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">Admin Overview</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            Track request pipeline and status distribution.
          </p>

          {loading && <p className="mt-4 text-[rgb(var(--muted))]">Loading workspace...</p>}
          {error && (
            <p className="mt-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          {!loading && !error && (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                  <p className="text-xs text-[rgb(var(--muted))]">Total</p>
                  <p className="text-xl font-semibold">{statusStats.total}</p>
                </div>
                <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                  <p className="text-xs text-[rgb(var(--muted))]">Pending</p>
                  <p className="text-xl font-semibold text-amber-300">{statusStats.pending}</p>
                </div>
                <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                  <p className="text-xs text-[rgb(var(--muted))]">Pairing</p>
                  <p className="text-xl font-semibold text-sky-300">{statusStats.pairing}</p>
                </div>
                <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                  <p className="text-xs text-[rgb(var(--muted))]">Matched</p>
                  <p className="text-xl font-semibold text-emerald-300">{statusStats.matched}</p>
                </div>
                <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                  <p className="text-xs text-[rgb(var(--muted))]">Cancelled</p>
                  <p className="text-xl font-semibold text-red-300">{statusStats.cancelled}</p>
                </div>
                <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                  <p className="text-xs text-[rgb(var(--muted))]">Completed</p>
                  <p className="text-xl font-semibold text-emerald-300">{statusStats.completed}</p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <div className="mb-3 grid gap-2 sm:grid-cols-4">
                  <input
                    type="text"
                    value={requestsQuery}
                    onChange={(e) => setRequestsQuery(e.target.value)}
                    placeholder="Search ID/customer/item"
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  />
                  <select
                    value={requestsStatusFilter}
                    onChange={(e) => setRequestsStatusFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">All statuses</option>
                    {requestStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={requestsCurrencyFilter}
                    onChange={(e) => setRequestsCurrencyFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">All currencies</option>
                    {requestCurrencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                  <select
                    value={requestsCustomerFilter}
                    onChange={(e) => setRequestsCustomerFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">All customers</option>
                    {requestCustomerOptions.map((customerId) => (
                      <option key={customerId} value={customerId}>
                        {customerId.slice(0, 8)}...
                      </option>
                    ))}
                  </select>
                </div>

                {filteredRequests.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[rgb(var(--stroke))] px-4 py-6 text-sm text-[rgb(var(--muted))]">
                    {requests.length === 0
                      ? 'No requests available.'
                      : 'No requests match current filters.'}
                  </p>
                ) : (
                  <>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                      <th className="py-2 pr-3">Request ID</th>
                      <th className="py-2 pr-3">Customer Profile</th>
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">Currency</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((row) => (
                      <tr key={row.id} className="border-b border-[rgb(var(--stroke))]/40">
                        <td className="py-2 pr-3 font-mono text-xs">{row.id.slice(0, 8)}...</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {row.customer_profile_id.slice(0, 8)}
                          ...
                        </td>
                        <td className="py-2 pr-3">
                          {row.requested_name_text || row.item_id || 'N/A'}
                        </td>
                        <td className="py-2 pr-3">
                          {formatQuantityWithUnit(row.quantity, row.quantity_unit)}
                        </td>
                        <td className="py-2 pr-3">{row.preferred_currency_code}</td>
                        <td className="py-2 pr-3">{row.status}</td>
                        <td className="py-2">{new Date(row.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                  <span>
                    Showing {(requestsPage - 1) * REQUESTS_PAGE_SIZE + 1}
                    {' - '}
                    {Math.min(requestsPage * REQUESTS_PAGE_SIZE, filteredRequests.length)} of{' '}
                    {filteredRequests.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={requestsPage <= 1}
                      onClick={() => setRequestsPage((prev) => Math.max(1, prev - 1))}
                      className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span>
                      Page {requestsPage} / {requestsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={requestsPage >= requestsTotalPages}
                      onClick={() => setRequestsPage((prev) => Math.min(requestsTotalPages, prev + 1))}
                      className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
                </>
                )}
              </div>

              <div className="mt-8 border-t border-[rgb(var(--stroke))] pt-6">
                <h2 className="text-xl font-semibold">Baseline Comparison</h2>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                  Compare greedy, heuristic, and DEAP optimizer outputs side-by-side on real data.
                </p>

                <form onSubmit={handleCompare} className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">Request ID</label>
                    <select
                      value={selectedRequestId}
                      onChange={(e) => setSelectedRequestId(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    >
                      <option value="">Select a request…</option>
                      {requests
                        .filter((r) => r.status === 'PAIRING_IN_PROGRESS')
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.id.slice(0, 8)}… – {r.requested_name_text || r.item_name || r.item_id || 'N/A'} ({r.status})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as BaselineComparePriority)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="balanced">balanced</option>
                      <option value="cost">cost</option>
                      <option value="speed">speed</option>
                      <option value="reliability">reliability</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">Optimizer Mode</label>
                    <select
                      value={optimizeMode}
                      onChange={(e) => setOptimizeMode(e.target.value as 'fast' | 'deep')}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="fast">fast (heuristic)</option>
                      <option value="deep">deep (GA/NSGA-II)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={comparing || !selectedRequestId}
                    className="btn btn-primary text-sm sm:col-span-4"
                  >
                    {comparing ? 'Running comparison…' : 'Run Comparison'}
                  </button>
                </form>

                {compareError && (
                  <p className="mt-3 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
                    {compareError}
                  </p>
                )}

                {compareResult && (
                  <>
                    {winners && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        <p className="rounded-lg border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
                          Lowest cost:{' '}
                          <span className="text-[rgb(var(--text))]">{winners.byCost.label}</span>
                        </p>
                        <p className="rounded-lg border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
                          Fastest delivery:{' '}
                          <span className="text-[rgb(var(--text))]">{winners.bySpeed.label}</span>
                        </p>
                        <p className="rounded-lg border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
                          Best reliability:{' '}
                          <span className="text-[rgb(var(--text))]">
                            {winners.byReliability.label}
                          </span>
                        </p>
                      </div>
                    )}

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-4">
                        <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
                          Greedy (Cost Only)
                        </p>
                        <p className="mt-2 text-sm font-mono text-xs">
                          Candidate: {compareResult.greedy.candidate_id.slice(0, 8)}…
                        </p>
                        <p className="text-sm">
                          Total cost: {compareResult.greedy.total_cost.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          Delivery days: {compareResult.greedy.delivery_days.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          Reliability: {compareResult.greedy.reliability_score.toFixed(3)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-4">
                        <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
                          Heuristic (Weighted)
                        </p>
                        <p className="mt-2 text-sm font-mono text-xs">
                          Candidate: {compareResult.heuristic.candidate_id.slice(0, 8)}…
                        </p>
                        <p className="text-sm">
                          Total cost: {compareResult.heuristic.total_cost.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          Delivery days: {compareResult.heuristic.delivery_days.toFixed(2)}
                        </p>
                        <p className="text-sm">
                          Reliability: {compareResult.heuristic.reliability_score.toFixed(3)}
                        </p>
                        <p className="text-sm">
                          Score: {compareResult.heuristic.heuristic_score.toFixed(4)}
                        </p>
                      </div>

                      {optimizerResult && (
                        <div className="rounded-xl border border-[rgb(var(--stroke))] p-4">
                          <p className="text-xs uppercase tracking-wide text-[rgb(var(--muted))]">
                            Evolutionary (DEAP Optimize)
                          </p>
                          <p className="mt-2 text-sm font-mono text-xs">
                            Candidate: {optimizerResult.candidate_id.slice(0, 8)}…
                          </p>
                          <p className="text-sm">
                            Total cost: {optimizerResult.total_cost.toFixed(2)}
                          </p>
                          <p className="text-sm">
                            Delivery days: {optimizerResult.delivery_days.toFixed(2)}
                          </p>
                          <p className="text-sm">
                            Reliability: {optimizerResult.reliability.toFixed(3)}
                          </p>
                          <p className="text-sm">
                            Fitness: {optimizerResult.fitness_score.toFixed(3)}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
