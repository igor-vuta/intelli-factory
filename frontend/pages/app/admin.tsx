import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import { listRequests, logout, me, type RequestSummary } from '../../lib/authClient';
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

        const rows = await listRequests();
        if (!cancelled) setRequests(rows);
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
                          {row.customer_profile_id.slice(0, 8)}...
                        </td>
                        <td className="py-2 pr-3">
                          {row.requested_name_text || row.item_id || 'N/A'}
                        </td>
                        <td className="py-2 pr-3">{row.quantity}</td>
                        <td className="py-2 pr-3">{row.preferred_currency_code}</td>
                        <td className="py-2 pr-3">{row.status}</td>
                        <td className="py-2">{new Date(row.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
