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
  type OptimizePriority,
  type OptimizeSolution,
  type RequestSummary,
} from '../../lib/authClient';
import { formatQuantityWithUnit } from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

export default function AdminWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [availableSkus, setAvailableSkus] = useState<string[]>([]);
  const [availableDestinations, setAvailableDestinations] = useState<string[]>([]);
  const [sku, setSku] = useState('');
  const [destination, setDestination] = useState('');
  const [quantity, setQuantity] = useState('100');
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

        const [rows, catalog] = await Promise.all([listRequests(), getComparisonCatalog()]);
        if (!cancelled) {
          setRequests(rows);
          setAvailableSkus(catalog.skus);
          setAvailableDestinations(catalog.destinations);
          setSku((prev) => (prev && catalog.skus.includes(prev) ? prev : (catalog.skus[0] ?? '')));
          setDestination((prev) =>
            prev && catalog.destinations.includes(prev) ? prev : (catalog.destinations[0] ?? '')
          );
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

    const parsedQty = Number(quantity);
    if (!sku.trim()) {
      setCompareError('SKU is required');
      return;
    }
    if (!destination.trim()) {
      setCompareError('Destination is required');
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setCompareError('Quantity must be greater than 0');
      return;
    }

    setComparing(true);
    try {
      const [baseline, optimized] = await Promise.all([
        compareBaselines({
          sku: sku.trim(),
          quantity: parsedQty,
          priority,
        }),
        optimizeSupply({
          sku: sku.trim(),
          destination: destination.trim(),
          quantity: parsedQty,
          priority: priority as OptimizePriority,
        }),
      ]);

      const bestSolution = optimized.solutions?.[0];
      if (!bestSolution) {
        throw new Error('Optimizer returned no solutions for this input');
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
        reliability_score: optimizerResult.reliability_score,
      });
    }

    return rows;
  }, [compareResult, optimizerResult]);

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
                    {requests.map((row) => (
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
              </div>

              <div className="mt-8 border-t border-[rgb(var(--stroke))] pt-6">
                <h2 className="text-xl font-semibold">Baseline Comparison</h2>
                <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                  Compare greedy, heuristic, and DEAP optimizer outputs side-by-side.
                </p>

                <form onSubmit={handleCompare} className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">SKU</label>
                    <select
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    >
                      {availableSkus.length === 0 ? (
                        <option value="">No SKUs available</option>
                      ) : (
                        availableSkus.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">
                      Destination
                    </label>
                    <select
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    >
                      {availableDestinations.length === 0 ? (
                        <option value="">No destinations available</option>
                      ) : (
                        availableDestinations.map((entry) => (
                          <option key={entry} value={entry}>
                            {entry}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-[rgb(var(--muted))]">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    />
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
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={
                      comparing ||
                      availableSkus.length === 0 ||
                      availableDestinations.length === 0 ||
                      !sku ||
                      !destination
                    }
                    className="btn btn-primary text-sm sm:col-span-4"
                  >
                    {comparing ? 'Running comparison…' : 'Run Comparison'}
                  </button>
                </form>

                {(availableSkus.length === 0 || availableDestinations.length === 0) && (
                  <p className="mt-3 rounded-lg bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
                    Comparison catalog is not available from backend. Verify /api/comparison/catalog
                    is reachable.
                  </p>
                )}

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
                        <p className="mt-2 text-sm">
                          Provider: {compareResult.greedy.logistics_provider}
                        </p>
                        <p className="text-sm">Manufacturer: {compareResult.greedy.manufacturer}</p>
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
                        <p className="mt-2 text-sm">
                          Provider: {compareResult.heuristic.logistics_provider}
                        </p>
                        <p className="text-sm">
                          Manufacturer: {compareResult.heuristic.manufacturer}
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
                          <p className="mt-2 text-sm">
                            Provider: {optimizerResult.logistics_provider}
                          </p>
                          <p className="text-sm">Manufacturer: {optimizerResult.manufacturer}</p>
                          <p className="text-sm">
                            Total cost: {optimizerResult.total_cost.toFixed(2)}
                          </p>
                          <p className="text-sm">
                            Delivery days: {optimizerResult.delivery_days.toFixed(2)}
                          </p>
                          <p className="text-sm">
                            Reliability: {optimizerResult.reliability_score.toFixed(3)}
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
