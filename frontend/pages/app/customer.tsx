import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import Combobox, { type ComboboxOption } from '../../components/Combobox';
import SearchableInput from '../../components/SearchableInput';
import {
  createCustomerRequest,
  getRequestsBootstrap,
  listCandidatesForRequest,
  listRequests,
  logout,
  me,
  selectCandidate,
  updateRequestStatus,
  type BootstrapAddress,
  type BootstrapCategory,
  type BootstrapCurrency,
  type BootstrapItem,
  type MatchCandidate,
  type RequestSummary,
} from '../../lib/authClient';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-300',
  PAIRING_IN_PROGRESS: 'text-sky-300',
  MATCHED: 'text-emerald-300',
  COMPLETED: 'text-emerald-300',
  CANCELLED: 'text-red-400',
};

// ── Proposals modal ─────────────────────────────────────────────────────────

type ProposalsModalProps = {
  requestId: string;
  candidates: MatchCandidate[];
  loadingCandidates: boolean;
  onClose: () => void;
  onSelected: () => Promise<void>;
};

function ProposalsModal({
  requestId,
  candidates,
  loadingCandidates,
  onClose,
  onSelected,
}: ProposalsModalProps) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(candidateId: string) {
    setError(null);
    setSelecting(candidateId);
    try {
      await selectCandidate(candidateId);
      await onSelected();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select proposal');
    } finally {
      setSelecting(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Proposals for your request</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Request {requestId.slice(0, 8)}… &mdash; Select the best offer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        {loadingCandidates ? (
          <p className="text-sm text-[rgb(var(--muted))]">Loading proposals…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted))]">
            No complete proposals yet. Factories have bid but logistics quotes are pending.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                  <th className="py-2 pr-3">Factory</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Goods cost</th>
                  <th className="py-2 pr-3">Delivery</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Days</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const goodsCost =
                    c.quoted_quantity && c.inventory_price_per_unit
                      ? (
                          parseFloat(c.quoted_quantity) * parseFloat(c.inventory_price_per_unit)
                        ).toFixed(2)
                      : '—';
                  return (
                    <tr key={c.id} className="border-b border-[rgb(var(--stroke))]/40">
                      <td className="py-2 pr-3 text-xs">{c.factory_legal_name ?? '—'}</td>
                      <td className="py-2 pr-3">{c.item_name ?? '—'}</td>
                      <td className="py-2 pr-3">{c.quoted_quantity ?? '—'}</td>
                      <td className="py-2 pr-3">
                        {goodsCost} {c.currency_code}
                      </td>
                      <td className="py-2 pr-3">
                        {c.delivery_price ?? '—'} {c.currency_code}
                      </td>
                      <td className="py-2 pr-3 font-medium">
                        {c.total_cost ?? '—'} {c.currency_code}
                      </td>
                      <td className="py-2 pr-3">{c.delivery_days ?? '—'}d</td>
                      <td className="py-2 pr-3 text-xs text-sky-300">
                        {c.fitness_score != null ? c.fitness_score.toFixed(4) : '—'}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          disabled={selecting === c.id}
                          onClick={() => void handleSelect(c.id)}
                          className="rounded-md border border-emerald-700/60 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/30 disabled:opacity-50"
                        >
                          {selecting === c.id ? 'Selecting…' : 'Select'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Request creation modal ──────────────────────────────────────────────────

type ModalProps = {
  categories: BootstrapCategory[];
  items: BootstrapItem[];
  currencies: BootstrapCurrency[];
  addresses: BootstrapAddress[];
  onClose: () => void;
  onCreated: () => Promise<void>;
};

function NewRequestModal({
  categories,
  items,
  currencies,
  addresses,
  onClose,
  onCreated,
}: ModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState('');
  // itemText = what the user typed; itemId = matched catalogue id ('' if free text)
  const [itemText, setItemText] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? 'USD');
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => categories.map((c) => ({ id: c.id, label: c.name })),
    [categories]
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  // Suggestions: items scoped to selected category, or all items
  const itemSuggestions = useMemo<ComboboxOption[]>(() => {
    const pool = categoryId ? items.filter((i) => i.category_id === categoryId) : items;
    return pool.map((i) => ({
      id: i.id,
      label: i.name,
      sublabel: categoryNameById.get(i.category_id) ?? '',
    }));
  }, [items, categoryId, categoryNameById]);

  function handleCategoryChange(id: string) {
    setCategoryId(id);
    // clear item match only if the matched item doesn't belong to new category
    if (itemId) {
      const match = items.find((i) => i.id === itemId);
      if (match && id && match.category_id !== id) setItemId('');
    }
  }

  function handleItemChange(text: string, id: string) {
    setItemText(text);
    setItemId(id);
    // auto-set category from matched suggestion when none selected
    if (id && !categoryId) {
      const match = items.find((i) => i.id === id);
      if (match?.category_id) setCategoryId(match.category_id);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!itemText.trim()) {
      setError('Please describe the item you need');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCustomerRequest({
        category_id: categoryId || undefined,
        item_id: itemId || undefined,
        requested_name_text: itemText.trim(),
        quantity: qty,
        destination_address_id: addressId,
        preferred_currency_code: currencyCode,
      });
      setSuccess(`Request created (${result.request_id.slice(0, 8)}\u2026)`);
      setItemText('');
      setItemId('');
      setCategoryId('');
      await onCreated();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">New Supply Request</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Choose a category, then describe what you need. Start typing to see suggestions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--stroke))]/40"
            aria-label="Close"
          >
            \u00d7
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Step 1 \u2014 Category */}
          <Combobox
            options={categoryOptions}
            value={categoryId}
            onChange={handleCategoryChange}
            placeholder="Search category  (e.g. Textile, Electronics, Food\u2026)"
            label="Category"
            allowEmpty
          />

          {/* Step 2 \u2014 Item name: free text with catalogue suggestions */}
          <SearchableInput
            suggestions={itemSuggestions}
            text={itemText}
            selectedId={itemId}
            onChange={handleItemChange}
            placeholder={
              categoryId
                ? `Describe item in ${categoryNameById.get(categoryId) ?? 'category'}\u2026`
                : 'Describe item  (e.g. cotton t-shirt, organic pasta, PCB board\u2026)'
            }
            label="Item name / description"
            required
          />

          {!itemId && itemText && (
            <p className="-mt-2 text-xs text-[rgb(var(--muted))]">
              No catalogue match \u2014 your description will be used directly.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[rgb(var(--muted))]">
                Quantity <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-[rgb(var(--muted))]">
                Currency <span className="text-red-400">*</span>
              </label>
              <select
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                required
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} \u2014 {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-[rgb(var(--muted))]">
              Destination address <span className="text-red-400">*</span>
            </label>
            <select
              value={addressId}
              onChange={(e) => setAddressId(e.target.value)}
              className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            >
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1 text-sm">
              {submitting ? 'Creating\u2026' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CustomerWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [categories, setCategories] = useState<BootstrapCategory[]>([]);
  const [items, setItems] = useState<BootstrapItem[]>([]);
  const [currencies, setCurrencies] = useState<BootstrapCurrency[]>([]);
  const [addresses, setAddresses] = useState<BootstrapAddress[]>([]);
  const [requests, setRequests] = useState<RequestSummary[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [proposalsRequestId, setProposalsRequestId] = useState<string | null>(null);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, MatchCandidate[]>>({});
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  async function openProposals(requestId: string) {
    setProposalsRequestId(requestId);
    if (!candidatesMap[requestId]) {
      setLoadingCandidates(true);
      try {
        const rows = await listCandidatesForRequest(requestId);
        setCandidatesMap((prev) => ({ ...prev, [requestId]: rows }));
      } finally {
        setLoadingCandidates(false);
      }
    }
  }

  async function refreshRequests() {
    const rows = await listRequests();
    setRequests(rows);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setPageError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'CUSTOMER') {
          await router.replace(`/login?lang=${locale}`);
          return;
        }

        const [bootstrap, rows] = await Promise.all([getRequestsBootstrap(), listRequests()]);

        if (cancelled) return;

        setCategories(bootstrap.categories);
        setItems(bootstrap.items);
        setCurrencies(bootstrap.currencies);
        setAddresses(bootstrap.addresses);
        setRequests(rows);
      } catch (err) {
        if (!cancelled)
          setPageError(err instanceof Error ? err.message : 'Failed to load workspace');
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

  async function handleCancelRequest(requestId: string) {
    try {
      await updateRequestStatus(requestId, 'CANCELLED');
      await refreshRequests();
    } catch {
      /* non-critical */
    }
  }

  return (
    <main
      className={`${THEME_CLASSES[theme]} min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
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
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span>{copy.brand}</span>
          </Link>
          <button type="button" onClick={handleLogout} className="btn btn-ghost text-sm">
            {copy.logout}
          </button>
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold sm:text-3xl">My Requests</h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                Track your supply-chain requests and matching status.
              </p>
            </div>
            {!loading && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn btn-primary text-sm"
              >
                + New Request
              </button>
            )}
          </div>

          {loading && (
            <p className="mt-6 text-sm text-[rgb(var(--muted))]">Loading workspace\u2026</p>
          )}

          {pageError && (
            <p className="mt-4 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {pageError}
            </p>
          )}

          {!loading && (
            <div className="mt-6">
              {requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgb(var(--stroke))] py-14 text-center">
                  <p className="text-sm text-[rgb(var(--muted))]">No requests yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="btn btn-primary mt-4 text-sm"
                  >
                    Create your first request
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-4">ID</th>
                        <th className="py-2 pr-4">Category</th>
                        <th className="py-2 pr-4">Item / Description</th>
                        <th className="py-2 pr-4">Qty</th>
                        <th className="py-2 pr-4">Currency</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Action</th>
                        <th className="py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((row) => (
                        <tr key={row.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4 font-mono text-xs">
                            {row.id.slice(0, 8)}\u2026
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {row.category_name ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4">
                            {row.item_name ?? row.requested_name_text ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4">{row.quantity}</td>
                          <td className="py-2 pr-4">{row.preferred_currency_code}</td>
                          <td className={`py-2 pr-4 ${STATUS_COLOR[row.status] ?? ''}`}>
                            {row.status}
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {row.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => void handleCancelRequest(row.id)}
                                  className="rounded-md border border-red-700/60 px-2 py-1 text-xs text-red-300 hover:bg-red-950/30"
                                >
                                  Cancel
                                </button>
                              )}
                              {(row.status === 'PAIRING_IN_PROGRESS' ||
                                row.status === 'MATCHED') && (
                                <button
                                  type="button"
                                  onClick={() => void openProposals(row.id)}
                                  className="rounded-md border border-sky-700/60 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950/30"
                                >
                                  View Proposals
                                </button>
                              )}
                              {row.status !== 'PENDING' &&
                                row.status !== 'PAIRING_IN_PROGRESS' &&
                                row.status !== 'MATCHED' && (
                                  <span className="text-xs text-[rgb(var(--muted))]">—</span>
                                )}
                            </div>
                          </td>
                          <td className="py-2 text-xs text-[rgb(var(--muted))]">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <NewRequestModal
          categories={categories}
          items={items}
          currencies={currencies}
          addresses={addresses}
          onClose={() => setShowModal(false)}
          onCreated={refreshRequests}
        />
      )}
      {proposalsRequestId && (
        <ProposalsModal
          requestId={proposalsRequestId}
          candidates={candidatesMap[proposalsRequestId] ?? []}
          loadingCandidates={loadingCandidates}
          onClose={() => setProposalsRequestId(null)}
          onSelected={async () => {
            await refreshRequests();
            setCandidatesMap((prev) => {
              const next = { ...prev };
              delete next[proposalsRequestId];
              return next;
            });
          }}
        />
      )}
    </main>
  );
}
