import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  listRequests,
  logout,
  me,
  optimizeCompare,
  seedLargeScale,
  type CompareStrategyEntry,
  type OptimizeCompareResponse,
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
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<OptimizeCompareResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'greedy' | 'heuristic' | 'fast' | 'deep'>('deep');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

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

        const [rows] = await Promise.all([listRequests()]);
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

  async function handleCompare() {
    setCompareError(null);
    setCompareData(null);

    if (!selectedRequestId.trim()) {
      setCompareError('Select a request to compare');
      return;
    }

    setComparing(true);
    try {
      const data = await optimizeCompare(selectedRequestId.trim());
      setCompareData(data);
      setActiveTab('deep');
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Comparison request failed');
    } finally {
      setComparing(false);
    }
  }

  async function handleSeedLargeScale() {
    setSeedLoading(true);
    setSeedMessage(null);
    try {
      const result = await seedLargeScale();
      setSeedMessage(`✓ ${result.message} — ${result.candidates_created} candidates created. Reload the page to see the new request.`);
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

  // Chart data derived from compare results
  const scatterData = useMemo(() => {
    if (!compareData) return [];
    const COLORS: Record<string, string> = {
      greedy: '#f59e0b',
      heuristic: '#60a5fa',
      fast: '#34d399',
      deep: '#a78bfa',
    };
    const entries: { x: number; y: number; z: number; strategy: string; fill: string; id: string }[] = [];
    for (const strategy of ['greedy', 'heuristic', 'fast', 'deep'] as const) {
      for (const sol of compareData[strategy]) {
        entries.push({
          x: sol.total_cost,
          y: sol.delivery_days,
          z: sol.reliability,
          strategy,
          fill: COLORS[strategy],
          id: sol.id,
        });
      }
    }
    return entries;
  }, [compareData]);

  const barData = useMemo(() => {
    if (!compareData) return [];
    const best = (list: CompareStrategyEntry[]) =>
      list.length === 0
        ? { cost: 0, days: 0, rel: 0 }
        : {
            cost: Math.min(...list.map((s) => s.total_cost)),
            days: Math.min(...list.map((s) => s.delivery_days)),
            rel: Math.max(...list.map((s) => s.reliability)),
          };
    return [
      { strategy: 'Greedy', ...best(compareData.greedy) },
      { strategy: 'Heuristic', ...best(compareData.heuristic) },
      { strategy: 'Fast', ...best(compareData.fast) },
      { strategy: 'Deep GA', ...best(compareData.deep) },
    ];
  }, [compareData]);

  const radarData = useMemo(() => {
    if (!compareData) return [];
    const top = (list: CompareStrategyEntry[]) => list[0];
    type StrategyKey = 'greedy' | 'heuristic' | 'fast' | 'deep';
    const strategies: { name: string; key: StrategyKey }[] = [
      { name: 'Greedy', key: 'greedy' },
      { name: 'Heuristic', key: 'heuristic' },
      { name: 'Fast', key: 'fast' },
      { name: 'Deep GA', key: 'deep' },
    ];
    const getList = (key: StrategyKey) => compareData[key];
    // Collect all values for normalisation
    const allCosts = strategies.flatMap(({ key }) => getList(key).map((s) => s.total_cost));
    const allDays  = strategies.flatMap(({ key }) => getList(key).map((s) => s.delivery_days));
    const allRel   = strategies.flatMap(({ key }) => getList(key).map((s) => s.reliability));
    const minC = Math.min(...allCosts), maxC = Math.max(...allCosts);
    const minD = Math.min(...allDays),  maxD = Math.max(...allDays);
    const minR = Math.min(...allRel),   maxR = Math.max(...allRel);
    const norm = (v: number, lo: number, hi: number) => hi === lo ? 0.5 : (v - lo) / (hi - lo);
    return strategies
      .filter(({ key }) => getList(key).length > 0)
      .map(({ name, key }) => {
        const s = top(getList(key));
        return {
          strategy: name,
          cost:        parseFloat(((1 - norm(s.total_cost, minC, maxC)) * 100).toFixed(1)),
          speed:       parseFloat(((1 - norm(s.delivery_days, minD, maxD)) * 100).toFixed(1)),
          reliability: parseFloat((norm(s.reliability, minR, maxR) * 100).toFixed(1)),
        };
      });
  }, [compareData]);

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

  const STRATEGY_COLORS: Record<string, string> = {
    greedy: '#f59e0b',
    heuristic: '#60a5fa',
    fast: '#34d399',
    deep: '#a78bfa',
  };

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
                {/* ── Section header + seed button ─────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Optimization Engine Comparison</h2>
                    <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                      Compare Greedy, Weighted Heuristic, Fast and Deep (GA) strategies side-by-side.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={seedLoading}
                    onClick={handleSeedLargeScale}
                    className="rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-xs disabled:opacity-50"
                  >
                    {seedLoading ? 'Seeding…' : 'Generate 150-Candidate Test Data'}
                  </button>
                </div>

                {seedMessage && (
                  <p
                    className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                      seedMessage.startsWith('Error')
                        ? 'bg-red-950/40 text-red-300'
                        : 'bg-emerald-950/40 text-emerald-300'
                    }`}
                  >
                    {seedMessage}
                  </p>
                )}

                {/* ── Request selector + run button ─────────────────────────── */}
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-0">
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                      Request (select one with PAIRING_IN_PROGRESS status)
                    </label>
                    <select
                      value={selectedRequestId}
                      onChange={(e) => {
                        setSelectedRequestId(e.target.value);
                        setCompareData(null);
                        setCompareError(null);
                      }}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="">Select a request…</option>
                      {requests
                        .filter((r) => r.status === 'PAIRING_IN_PROGRESS')
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.id.slice(0, 8)}… — {r.requested_name_text || r.item_name || r.item_id || 'N/A'}
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={comparing || !selectedRequestId}
                    onClick={handleCompare}
                    className="btn btn-primary shrink-0 text-sm"
                  >
                    {comparing ? 'Running all 4 strategies…' : 'Run Full Comparison'}
                  </button>
                </div>

                {compareError && (
                  <p className="mt-3 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
                    {compareError}
                  </p>
                )}

                {/* ── Results ───────────────────────────────────────────────── */}
                {compareData && (
                  <>
                    {/* Summary card */}
                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                        <p className="text-xs text-[rgb(var(--muted))]">Candidate pool</p>
                        <p className="text-xl font-semibold">{compareData.candidate_pool_size}</p>
                      </div>
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                        <p className="text-xs text-[rgb(var(--muted))]">Profile</p>
                        <p className="text-lg font-semibold capitalize">
                          {compareData.optimization_profile ?? 'balanced'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                        <p className="text-xs text-[rgb(var(--muted))]">Weights (cost / time / rel)</p>
                        <p className="font-mono text-sm">
                          {compareData.weights.cost.toFixed(2)} /{' '}
                          {compareData.weights.time.toFixed(2)} /{' '}
                          {compareData.weights.reliability.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
                        <p className="text-xs text-[rgb(var(--muted))]">Solutions per strategy</p>
                        <p className="font-mono text-sm">
                          G:{compareData.greedy.length} H:{compareData.heuristic.length} F:
                          {compareData.fast.length} D:{compareData.deep.length}
                        </p>
                      </div>
                    </div>

                    {/* Winner highlights */}
                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      {(
                        [
                          { key: 'greedy', label: 'Greedy', subtitle: 'Lowest Cost First' },
                          { key: 'heuristic', label: 'Heuristic', subtitle: 'Weighted Sum' },
                          { key: 'fast', label: 'Fast', subtitle: 'Deterministic Opt.' },
                          { key: 'deep', label: 'Deep GA', subtitle: 'NSGA-II / DEAP' },
                        ] as const
                      ).map(({ key, label, subtitle }) => {
                        const best = compareData[key][0];
                        if (!best) return null;
                        return (
                          <div
                            key={key}
                            className="rounded-xl border p-3"
                            style={{ borderColor: STRATEGY_COLORS[key] + '66' }}
                          >
                            <p
                              className="text-xs font-semibold uppercase tracking-wide"
                              style={{ color: STRATEGY_COLORS[key] }}
                            >
                              {label}
                            </p>
                            <p className="text-xs text-[rgb(var(--muted))]">{subtitle}</p>
                            <div className="mt-2 space-y-1 text-sm">
                              <p>
                                <span className="text-[rgb(var(--muted))]">Cost </span>
                                <span className="font-mono font-semibold">
                                  {best.total_cost.toFixed(2)}
                                </span>
                              </p>
                              <p>
                                <span className="text-[rgb(var(--muted))]">Days </span>
                                <span className="font-mono font-semibold">
                                  {best.delivery_days.toFixed(1)}
                                </span>
                              </p>
                              <p>
                                <span className="text-[rgb(var(--muted))]">Rel. </span>
                                <span className="font-mono font-semibold">
                                  {best.reliability.toFixed(3)}
                                </span>
                              </p>
                              <p>
                                <span className="text-[rgb(var(--muted))]">Score </span>
                                <span className="font-mono font-semibold">
                                  {(best.fitness_score ?? 0).toFixed(4)}
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Charts ──────────────────────────────────────────────── */}
                    <div className="mt-6 grid gap-5 lg:grid-cols-2">

                      {/* Pareto scatter: Cost vs Delivery Days */}
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-4">
                        <p className="mb-2 text-sm font-semibold">
                          Pareto Front — Cost vs Delivery Days
                        </p>
                        <p className="mb-3 text-xs text-[rgb(var(--muted))]">
                          Each dot is a candidate solution. Lower-left corner is optimal.
                        </p>
                        <ResponsiveContainer width="100%" height={280}>
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                            <XAxis
                              dataKey="x"
                              name="Cost"
                              type="number"
                              tick={{ fontSize: 10 }}
                              label={{ value: 'Cost', position: 'insideBottom', offset: -4, fontSize: 11 }}
                            />
                            <YAxis
                              dataKey="y"
                              name="Days"
                              type="number"
                              tick={{ fontSize: 10 }}
                              label={{ value: 'Delivery Days', angle: -90, position: 'insideLeft', fontSize: 11 }}
                            />
                            <Tooltip
                              content={({ payload }) => {
                                if (!payload?.length) return null;
                                const d = payload[0]?.payload as typeof scatterData[0];
                                return (
                                  <div className="rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-2 text-xs">
                                    <p style={{ color: d.fill }}>{d.strategy.toUpperCase()}</p>
                                    <p>Cost: {d.x.toFixed(2)}</p>
                                    <p>Days: {d.y.toFixed(1)}</p>
                                    <p>Reliability: {d.z.toFixed(3)}</p>
                                  </div>
                                );
                              }}
                            />
                            <Legend />
                            {(['greedy', 'heuristic', 'fast', 'deep'] as const).map((strategy) => (
                              <Scatter
                                key={strategy}
                                name={strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                                data={scatterData.filter((d) => d.strategy === strategy)}
                                fill={STRATEGY_COLORS[strategy]}
                              >
                                {scatterData
                                  .filter((d) => d.strategy === strategy)
                                  .map((entry) => (
                                    <Cell key={entry.id} fill={STRATEGY_COLORS[strategy]} />
                                  ))}
                              </Scatter>
                            ))}
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Bar chart: best objective values per strategy */}
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-4">
                        <p className="mb-2 text-sm font-semibold">
                          Best Objective Values per Strategy
                        </p>
                        <p className="mb-3 text-xs text-[rgb(var(--muted))]">
                          Lower cost & days are better; higher reliability is better.
                        </p>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={barData} barCategoryGap="20%">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                            <XAxis dataKey="strategy" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{
                                background: 'rgba(15,20,35,0.95)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Legend />
                            <Bar dataKey="cost" name="Best Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="days" name="Best Days" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="rel" name="Best Reliability" fill="#34d399" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Radar chart: normalised score balance */}
                      <div className="rounded-xl border border-[rgb(var(--stroke))] p-4 lg:col-span-2">
                        <p className="mb-2 text-sm font-semibold">
                          Weighted Score Balance (Radar — top solution per strategy)
                        </p>
                        <p className="mb-3 text-xs text-[rgb(var(--muted))]">
                          Scores normalised 0–100. Larger area = better balanced performance.
                        </p>
                        <ResponsiveContainer width="100%" height={300}>
                          <RadarChart data={[
                            { axis: 'Cost Score', ...Object.fromEntries(radarData.map(r => [r.strategy, r.cost])) },
                            { axis: 'Speed Score', ...Object.fromEntries(radarData.map(r => [r.strategy, r.speed])) },
                            { axis: 'Reliability Score', ...Object.fromEntries(radarData.map(r => [r.strategy, r.reliability])) },
                          ]}>
                            <PolarGrid stroke="rgba(255,255,255,0.1)" />
                            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
                            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                            {radarData.map((r) => (
                              <Radar
                                key={r.strategy}
                                name={r.strategy}
                                dataKey={r.strategy}
                                stroke={STRATEGY_COLORS[r.strategy.toLowerCase().replace(' ga', '').replace(' ', '')]}
                                fill={STRATEGY_COLORS[r.strategy.toLowerCase().replace(' ga', '').replace(' ', '')]}
                                fillOpacity={0.15}
                              />
                            ))}
                            <Legend />
                            <Tooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* ── Strategy tabs ────────────────────────────────────────── */}
                    <div className="mt-6">
                      <div className="flex gap-1 border-b border-[rgb(var(--stroke))]">
                        {(['greedy', 'heuristic', 'fast', 'deep'] as const).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                              activeTab === tab
                                ? 'border-b-2 text-[rgb(var(--text))]'
                                : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
                            }`}
                            style={
                              activeTab === tab
                                ? { borderColor: STRATEGY_COLORS[tab] }
                                : {}
                            }
                          >
                            {tab === 'greedy'
                              ? 'Greedy'
                              : tab === 'heuristic'
                                ? 'Heuristic'
                                : tab === 'fast'
                                  ? 'Fast'
                                  : 'Deep GA'}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 overflow-x-auto">
                        {compareData[activeTab].length === 0 ? (
                          <p className="px-3 py-6 text-sm text-[rgb(var(--muted))]">
                            No solutions returned for this strategy.
                          </p>
                        ) : (
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="border-b border-[rgb(var(--stroke))] text-xs text-[rgb(var(--muted))]">
                                <th className="py-2 pr-4">Rank</th>
                                <th className="py-2 pr-4">Candidate ID</th>
                                <th className="py-2 pr-4">Cost</th>
                                <th className="py-2 pr-4">Delivery Days</th>
                                <th className="py-2 pr-4">Reliability</th>
                                <th className="py-2 pr-4">Fitness Score</th>
                                <th className="py-2">Currency</th>
                              </tr>
                            </thead>
                            <tbody>
                              {compareData[activeTab].map((sol, idx) => (
                                <tr
                                  key={sol.id}
                                  className={`border-b border-[rgb(var(--stroke))]/40 ${
                                    idx === 0 ? 'font-semibold' : ''
                                  }`}
                                >
                                  <td className="py-2 pr-4 text-center">
                                    {idx === 0 ? (
                                      <span
                                        className="rounded-full px-2 py-0.5 text-xs"
                                        style={{
                                          background: STRATEGY_COLORS[activeTab] + '33',
                                          color: STRATEGY_COLORS[activeTab],
                                        }}
                                      >
                                        #{sol.rank}
                                      </span>
                                    ) : (
                                      <span className="text-[rgb(var(--muted))]">#{sol.rank}</span>
                                    )}
                                  </td>
                                  <td className="py-2 pr-4 font-mono text-xs">
                                    {sol.id.slice(0, 8)}…
                                  </td>
                                  <td className="py-2 pr-4 font-mono">{sol.total_cost.toFixed(2)}</td>
                                  <td className="py-2 pr-4 font-mono">{sol.delivery_days.toFixed(1)}</td>
                                  <td className="py-2 pr-4 font-mono">{sol.reliability.toFixed(3)}</td>
                                  <td className="py-2 pr-4 font-mono">{(sol.fitness_score ?? 0).toFixed(4)}</td>
                                  <td className="py-2 text-xs text-[rgb(var(--muted))]">
                                    {sol.currency_code}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
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
