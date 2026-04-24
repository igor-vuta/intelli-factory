import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { type ComboboxOption } from '../../components/Combobox';
import AgreementSignModal from '../../components/AgreementSignModal';
import PaymentMockupModal from '../../components/PaymentMockupModal';
import SearchableInput from '../../components/SearchableInput';
import {
  acceptTransactionCompletion,
  captureTransactionPayment,
  type ContractSigningPayload,
  createCustomerRequest,
  getRequestsBootstrap,
  listMyTransactions,
  listCandidatesForRequest,
  listRequests,
  logout,
  me,
  signTransaction,
  selectCandidate,
  updateRequestStatus,
  type BootstrapAddress,
  type BootstrapCategory,
  type BootstrapCountry,
  type BootstrapCurrency,
  type BootstrapItem,
  type MatchCandidate,
  type RequestSummary,
  type WorkflowTransaction,
} from '../../lib/authClient';
import { formatCurrencyOptionLabel, formatQuantityWithUnit } from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-amber-300',
  PAIRING_IN_PROGRESS: 'text-sky-300',
  MATCHED: 'text-emerald-300',
  CONTRACT_DRAFTED: 'text-indigo-300',
  CONTRACT_SIGNING: 'text-indigo-300',
  FULLY_SIGNED: 'text-violet-300',
  PAYMENT_CONFIRMED: 'text-emerald-300',
  FULFILLMENT_STARTED: 'text-amber-300',
  IN_PROGRESS: 'text-sky-300',
  COMPLETED: 'text-emerald-300',
  CANCELLED: 'text-red-400',
};

const REQUESTS_PAGE_SIZE = 5;

// ── Proposals modal ─────────────────────────────────────────────────────────

type ProposalsModalProps = {
  requestId: string;
  requestStatus: string;
  candidates: MatchCandidate[];
  loadingCandidates: boolean;
  loadError: string | null;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onSelected: () => Promise<void>;
};

type RecommendationGoal = 'RELIABILITY' | 'COST' | 'TIME';

function _toNum(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ProposalsModal({
  requestId,
  requestStatus,
  candidates,
  loadingCandidates,
  loadError,
  onRefresh,
  onClose,
  onSelected,
}: ProposalsModalProps) {
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recommendationGoal, setRecommendationGoal] = useState<RecommendationGoal>('RELIABILITY');
  const acceptedCandidate = useMemo(
    () => candidates.find((c) => c.status === 'ACCEPTED'),
    [candidates]
  );

  const recommendedCandidate = useMemo(() => {
    const available = candidates.filter((c) => c.status === 'PENDING' || c.status === 'ACCEPTED');
    if (available.length === 0) return null;

    const byReliability = available
      .filter((c) => _toNum(c.reliability_score) != null)
      .sort((a, b) => (_toNum(b.reliability_score) ?? -1) - (_toNum(a.reliability_score) ?? -1));
    const byCost = available
      .filter((c) => _toNum(c.total_cost) != null)
      .sort((a, b) => (_toNum(a.total_cost) ?? Number.MAX_SAFE_INTEGER) - (_toNum(b.total_cost) ?? Number.MAX_SAFE_INTEGER));
    const byTime = available
      .filter((c) => _toNum(c.delivery_days) != null)
      .sort((a, b) => (_toNum(a.delivery_days) ?? Number.MAX_SAFE_INTEGER) - (_toNum(b.delivery_days) ?? Number.MAX_SAFE_INTEGER));

    if (recommendationGoal === 'RELIABILITY') return byReliability[0] ?? null;
    if (recommendationGoal === 'COST') return byCost[0] ?? null;
    return byTime[0] ?? null;
  }, [candidates, recommendationGoal]);

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 text-xs text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/20"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
            >
              ×
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        {loadError && (
          <p className="mb-3 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {loadError}
          </p>
        )}

        {acceptedCandidate && (
          <p className="mb-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            A proposal is already selected for this request.
          </p>
        )}

        {!loadingCandidates && candidates.length > 0 && (
          <div className="mb-4 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-3">
            <p className="mb-2 text-xs text-[rgb(var(--muted))]">Recommendation engine</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRecommendationGoal('RELIABILITY')}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  recommendationGoal === 'RELIABILITY'
                    ? 'border-emerald-700/80 text-emerald-300'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                [R] Reliability
              </button>
              <button
                type="button"
                onClick={() => setRecommendationGoal('COST')}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  recommendationGoal === 'COST'
                    ? 'border-amber-700/80 text-amber-300'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                [$] Cost
              </button>
              <button
                type="button"
                onClick={() => setRecommendationGoal('TIME')}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  recommendationGoal === 'TIME'
                    ? 'border-sky-700/80 text-sky-300'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                [T] Time
              </button>
            </div>

            {recommendedCandidate ? (
              <div className="rounded-lg border border-sky-700/40 bg-sky-950/20 px-3 py-2 text-sm">
                <div className="font-medium text-sky-200">Recommended proposal</div>
                <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                  Factory: {recommendedCandidate.factory_legal_name ?? '—'} | Total:{' '}
                  {recommendedCandidate.total_cost ?? '—'} {recommendedCandidate.currency_code} | Days:{' '}
                  {recommendedCandidate.delivery_days ?? '—'} | Reliability:{' '}
                  {recommendedCandidate.reliability_score ?? '—'}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[rgb(var(--muted))]">
                No recommendation can be computed because required fields are missing.
              </p>
            )}
          </div>
        )}

        {loadingCandidates ? (
          <p className="text-sm text-[rgb(var(--muted))]">Loading proposals…</p>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-[rgb(var(--muted))]">
            {requestStatus === 'MATCHED'
              ? 'Request is matched, but no proposal rows were returned. Try refresh.'
              : 'No complete proposals yet. Factories have bid but logistics quotes are pending.'}
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
                    <tr
                      key={c.id}
                      className={`border-b border-[rgb(var(--stroke))]/40 ${
                        recommendedCandidate?.id === c.id ? 'bg-sky-950/20' : ''
                      }`}
                    >
                      <td className="py-2 pr-3 text-xs">{c.factory_legal_name ?? '—'}</td>
                      <td className="py-2 pr-3">{c.item_name ?? '—'}</td>
                      <td className="py-2 pr-3">
                        {formatQuantityWithUnit(c.quoted_quantity, c.quantity_unit)}
                      </td>
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
                        <div className="flex items-center gap-2">
                          {recommendedCandidate?.id === c.id && (
                            <span className="rounded-md border border-sky-700/60 px-2 py-1 text-[10px] text-sky-300">
                              Recommended
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={
                              selecting === c.id ||
                              (acceptedCandidate != null && acceptedCandidate.id !== c.id)
                            }
                            onClick={() => void handleSelect(c.id)}
                            className="rounded-md border border-emerald-700/60 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950/30 disabled:opacity-50"
                          >
                            {c.status === 'ACCEPTED'
                              ? 'Selected'
                              : selecting === c.id
                                ? 'Selecting…'
                                : 'Select'}
                          </button>
                        </div>
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
  countries: BootstrapCountry[];
  addresses: BootstrapAddress[];
  defaultAddressId?: string | null;
  defaultCountryCode?: string | null;
  defaultStreet?: string | null;
  onClose: () => void;
  onCreated: () => Promise<void>;
};

function NewRequestModal({
  categories,
  items,
  currencies,
  countries,
  addresses,
  defaultAddressId,
  defaultCountryCode,
  defaultStreet,
  onClose,
  onCreated,
}: ModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [categoryText, setCategoryText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  // itemText = what the user typed; itemId = matched catalogue id ('' if free text)
  const [itemText, setItemText] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [quantityUnitText, setQuantityUnitText] = useState('pcs');
  const [quantityUnitId, setQuantityUnitId] = useState('pcs');
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? 'USD');
  const [addressId, setAddressId] = useState(defaultAddressId ?? addresses[0]?.id ?? '');
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [countryCode, setCountryCode] = useState(defaultCountryCode ?? countries[0]?.code ?? '');
  const [regionName, setRegionName] = useState('');
  const [cityName, setCityName] = useState('');
  const [street, setStreet] = useState(defaultStreet ?? '');

  const categoryOptions = useMemo<ComboboxOption[]>(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
      })),
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

  const unitSuggestions = useMemo<ComboboxOption[]>(() => {
    const fallbackUnits = ['pcs', 'kg', 'g', 'l', 'liters', 'tons', 'boxes', 'roll', 'm', 'cm'];
    const uniqueUnits = new Map<string, string>();

    for (const item of items) {
      const raw = item.unit?.trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!uniqueUnits.has(key)) uniqueUnits.set(key, raw);
    }

    for (const unit of fallbackUnits) {
      const key = unit.toLowerCase();
      if (!uniqueUnits.has(key)) uniqueUnits.set(key, unit);
    }

    return Array.from(uniqueUnits.values())
      .sort((a, b) => a.localeCompare(b))
      .map((unit) => ({ id: unit, label: unit }));
  }, [items]);

  function handleCategoryChange(text: string, id: string) {
    setCategoryText(text);
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
    // auto-set category and unit from matched suggestion when available
    if (id) {
      const match = items.find((i) => i.id === id);
      if (match?.category_id) {
        setCategoryId(match.category_id);
        setCategoryText(categoryNameById.get(match.category_id) ?? '');
      }
      if (match?.unit) {
        setQuantityUnitText(match.unit);
        setQuantityUnitId(match.unit);
      }
    }
  }

  function handleUnitChange(text: string, id: string) {
    setQuantityUnitText(text);
    setQuantityUnitId(id);
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
    if (!categoryText.trim()) {
      setError('Please choose or type a category');
      return;
    }
    if (!quantityUnitText.trim()) {
      setError('Please provide a quantity unit (e.g. kg, liters, pcs)');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCustomerRequest({
        category_id: categoryId || undefined,
        category_name_text: categoryText.trim(),
        item_id: itemId || undefined,
        requested_name_text: itemText.trim(),
        quantity: qty,
        quantity_unit: quantityUnitText.trim(),
        destination_address_id: !useManualAddress ? addressId : undefined,
        destination_country_code: useManualAddress ? countryCode : undefined,
        destination_region_name: useManualAddress ? regionName.trim() : undefined,
        destination_city_name: useManualAddress ? cityName.trim() : undefined,
        destination_street: useManualAddress ? street.trim() : undefined,
        preferred_currency_code: currencyCode,
      });
      setSuccess(`Request created (${result.request_id.slice(0, 8)}\u2026)`);
      setItemText('');
      setItemId('');
      setCategoryText('');
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
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Step 1 \u2014 Category */}
          <SearchableInput
            suggestions={categoryOptions}
            text={categoryText}
            selectedId={categoryId}
            onChange={handleCategoryChange}
            placeholder="Type category or choose existing (e.g. Textile, Electronics, Food)"
            label="Category"
            required
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

          <div className="grid gap-4 sm:grid-cols-3">
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
              <SearchableInput
                suggestions={unitSuggestions}
                text={quantityUnitText}
                selectedId={quantityUnitId}
                onChange={handleUnitChange}
                placeholder="Choose or type a unit (kg, liters, pcs)"
                label="Unit"
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
                    {formatCurrencyOptionLabel(c.code, c.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-[rgb(var(--muted))]">
              Destination address <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setUseManualAddress(false)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  !useManualAddress
                    ? 'border-sky-700/80 text-sky-300'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                Choose existing
              </button>
              <button
                type="button"
                onClick={() => setUseManualAddress(true)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  useManualAddress
                    ? 'border-sky-700/80 text-sky-300'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                Provide yourself
              </button>
            </div>

            {!useManualAddress ? (
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
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  required
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.code} - {country.name}
                    </option>
                  ))}
                </select>
                <input
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  placeholder="Region"
                  required
                />
                <input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  placeholder="City"
                  required
                />
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm sm:col-span-2"
                  placeholder="Address / Street"
                  required
                />
              </div>
            )}
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
  const [countries, setCountries] = useState<BootstrapCountry[]>([]);
  const [addresses, setAddresses] = useState<BootstrapAddress[]>([]);
  const [bootstrapUser, setBootstrapUser] = useState<{
    primary_address_id?: string | null;
    registration_country_code?: string | null;
    registration_address?: string | null;
  }>({});
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [transactions, setTransactions] = useState<WorkflowTransaction[]>([]);
  const [workflowBusyId, setWorkflowBusyId] = useState<string | null>(null);
  const [signingTransaction, setSigningTransaction] = useState<WorkflowTransaction | null>(null);
  const [paymentTransaction, setPaymentTransaction] = useState<WorkflowTransaction | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [proposalsRequestId, setProposalsRequestId] = useState<string | null>(null);
  const [candidatesMap, setCandidatesMap] = useState<Record<string, MatchCandidate[]>>({});
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('ALL');
  const [requestCurrencyFilter, setRequestCurrencyFilter] = useState('ALL');
  const [requestsPage, setRequestsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);

  const requestStatusOptions = useMemo(
    () => Array.from(new Set(requests.map((row) => row.status))).sort(),
    [requests]
  );

  const requestCurrencyOptions = useMemo(
    () => Array.from(new Set(requests.map((row) => row.preferred_currency_code))).sort(),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    const search = requestSearch.trim().toLowerCase();

    return requests.filter((row) => {
      if (requestStatusFilter !== 'ALL' && row.status !== requestStatusFilter) return false;
      if (requestCurrencyFilter !== 'ALL' && row.preferred_currency_code !== requestCurrencyFilter)
        return false;

      if (search) {
        const haystack = [
          row.item_name,
          row.requested_name_text,
          row.category_name,
          row.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [requests, requestSearch, requestStatusFilter, requestCurrencyFilter]);

  const totalRequestPages = Math.max(
    1,
    Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE)
  );

  const paginatedRequests = useMemo(() => {
    const start = (requestsPage - 1) * REQUESTS_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [filteredRequests, requestsPage]);

  const totalTransactionPages = Math.max(
    1,
    Math.ceil(transactions.length / REQUESTS_PAGE_SIZE)
  );

  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * REQUESTS_PAGE_SIZE;
    return transactions.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [transactions, transactionsPage]);

  useEffect(() => {
    setRequestsPage(1);
  }, [requestSearch, requestStatusFilter, requestCurrencyFilter]);

  useEffect(() => {
    if (requestsPage > totalRequestPages) {
      setRequestsPage(totalRequestPages);
    }
  }, [requestsPage, totalRequestPages]);

  useEffect(() => {
    if (transactionsPage > totalTransactionPages) {
      setTransactionsPage(totalTransactionPages);
    }
  }, [transactionsPage, totalTransactionPages]);

  const refreshRequests = useCallback(async () => {
    const rows = await listRequests();
    setRequests(rows);
  }, []);

  const refreshTransactions = useCallback(async () => {
    const rows = await listMyTransactions();
    setTransactions(rows);
  }, []);

  const refreshCandidatesForRequest = useCallback(async (requestId: string) => {
    try {
      setProposalsError(null);
      const rows = await listCandidatesForRequest(requestId);
      setCandidatesMap((prev) => ({
        ...prev,
        [requestId]: rows,
      }));
    } catch (err) {
      setProposalsError(err instanceof Error ? err.message : 'Failed to load proposals');
    }
  }, []);

  async function openProposals(requestId: string) {
    setProposalsRequestId(requestId);
    setLoadingCandidates(true);
    try {
      await refreshCandidatesForRequest(requestId);
    } finally {
      setLoadingCandidates(false);
    }
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

        const [bootstrap, rows, txRows] = await Promise.all([
          getRequestsBootstrap(),
          listRequests(),
          listMyTransactions(),
        ]);

        if (cancelled) return;

        setCategories(bootstrap.categories);
        setItems(bootstrap.items);
        setCurrencies(bootstrap.currencies);
        setCountries(bootstrap.countries ?? []);
        setAddresses(bootstrap.addresses);
        setBootstrapUser({
          primary_address_id: bootstrap.user.primary_address_id,
          registration_country_code: bootstrap.user.registration_country_code,
          registration_address: bootstrap.user.registration_address,
        });
        setRequests(rows);
        setTransactions(txRows);
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

  useEffect(() => {
    if (loading) return;

    const intervalId = window.setInterval(() => {
      void refreshRequests();
      void refreshTransactions();
      if (proposalsRequestId) {
        void refreshCandidatesForRequest(proposalsRequestId);
      }
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    loading,
    proposalsRequestId,
    refreshCandidatesForRequest,
    refreshRequests,
    refreshTransactions,
  ]);

  async function handleWorkflowAction(
    transactionId: string,
    action: 'SIGN' | 'PAY' | 'ACCEPT_COMPLETION'
  ) {
    if (action === 'SIGN') {
      const tx = transactions.find((row) => row.id === transactionId);
      if (!tx) {
        setPageError('Transaction no longer available');
        return;
      }
      setSigningTransaction(tx);
      return;
    }

    if (action === 'PAY') {
      const tx = transactions.find((row) => row.id === transactionId);
      if (!tx) {
        setPageError('Transaction no longer available');
        return;
      }
      setPaymentTransaction(tx);
      return;
    }

    setWorkflowBusyId(transactionId + action);
    try {
      await acceptTransactionCompletion(transactionId);
      await Promise.all([refreshTransactions(), refreshRequests()]);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Workflow action failed');
    } finally {
      setWorkflowBusyId(null);
    }
  }

  async function handleConfirmSignFromAgreement(payload: ContractSigningPayload) {
    if (!signingTransaction) return;
    const txId = signingTransaction.id;
    setWorkflowBusyId(txId + 'SIGN');
    try {
      await signTransaction(txId, payload);
      setSigningTransaction(null);
      await Promise.all([refreshTransactions(), refreshRequests()]);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Workflow action failed');
    } finally {
      setWorkflowBusyId(null);
    }
  }

  async function handleConfirmPayment(payload: { amount?: number; provider_reference?: string }) {
    if (!paymentTransaction) return;
    const txId = paymentTransaction.id;
    setWorkflowBusyId(txId + 'PAY');
    try {
      await captureTransactionPayment(txId, payload);
      setPaymentTransaction(null);
      await Promise.all([refreshTransactions(), refreshRequests()]);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Workflow action failed');
    } finally {
      setWorkflowBusyId(null);
    }
  }

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
              ) : filteredRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgb(var(--stroke))] py-10 text-center">
                  <p className="text-sm text-[rgb(var(--muted))]">
                    No requests match your current filters.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRequestSearch('');
                      setRequestStatusFilter('ALL');
                      setRequestCurrencyFilter('ALL');
                    }}
                    className="btn btn-ghost mt-3 text-sm"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <input
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      placeholder="Search by name/category/id"
                      className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm lg:col-span-2"
                    />
                    <select
                      value={requestStatusFilter}
                      onChange={(e) => setRequestStatusFilter(e.target.value)}
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
                      value={requestCurrencyFilter}
                      onChange={(e) => setRequestCurrencyFilter(e.target.value)}
                      className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="ALL">All currencies</option>
                      {requestCurrencyOptions.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>

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
                      {paginatedRequests.map((row) => (
                        <tr key={row.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4 font-mono text-xs">
                            {row.id.slice(0, 8)}
                            \u2026
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {row.category_name ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4">
                            {row.item_name ?? row.requested_name_text ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4">
                            {formatQuantityWithUnit(row.quantity, row.quantity_unit)}
                          </td>
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
                        Page {requestsPage} / {totalRequestPages}
                      </span>
                      <button
                        type="button"
                        disabled={requestsPage >= totalRequestPages}
                        onClick={() =>
                          setRequestsPage((prev) => Math.min(totalRequestPages, prev + 1))
                        }
                        className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        {!loading && (
          <section className="surface-1 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Contract, Payment & Acceptance</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Continue matched requests: sign contract, pay after all signatures, then accept
              completion at the end of delivery.
            </p>

            {transactions.length === 0 ? (
              <p className="mt-3 text-sm text-[rgb(var(--muted))]">No active transactions yet.</p>
            ) : (
              <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                      <th className="py-2 pr-4">Transaction</th>
                      <th className="py-2 pr-4">Item</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Signatures</th>
                      <th className="py-2 pr-4">Payment</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[rgb(var(--stroke))]/40">
                        <td className="py-2 pr-4 font-mono text-xs">{tx.id.slice(0, 8)}...</td>
                        <td className="py-2 pr-4">{tx.item_name ?? '-'}</td>
                        <td className={`py-2 pr-4 ${STATUS_COLOR[tx.status] ?? ''}`}>{tx.status}</td>
                        <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                          C:{tx.signature_status.CUSTOMER} F:{tx.signature_status.FACTORY} L:
                          {tx.signature_status.LOGIST}
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {tx.total_cost ? `${tx.total_cost} ${tx.currency_code ?? ''}` : '-'}{' '}
                          ({tx.payment_status})
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {tx.can_sign && (
                              <button
                                type="button"
                                onClick={() => void handleWorkflowAction(tx.id, 'SIGN')}
                                disabled={workflowBusyId === tx.id + 'SIGN'}
                                className="rounded-md border border-indigo-700/60 px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-950/30 disabled:opacity-60"
                              >
                                {workflowBusyId === tx.id + 'SIGN' ? 'Signing...' : 'Sign'}
                              </button>
                            )}
                            {tx.can_pay && (
                              <button
                                type="button"
                                onClick={() => void handleWorkflowAction(tx.id, 'PAY')}
                                disabled={workflowBusyId === tx.id + 'PAY'}
                                className="rounded-md border border-emerald-700/60 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950/30 disabled:opacity-60"
                              >
                                {workflowBusyId === tx.id + 'PAY' ? 'Paying...' : 'Pay'}
                              </button>
                            )}
                            {tx.can_accept_completion && (
                              <button
                                type="button"
                                onClick={() => void handleWorkflowAction(tx.id, 'ACCEPT_COMPLETION')}
                                disabled={workflowBusyId === tx.id + 'ACCEPT_COMPLETION'}
                                className="rounded-md border border-sky-700/60 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950/30 disabled:opacity-60"
                              >
                                {workflowBusyId === tx.id + 'ACCEPT_COMPLETION'
                                  ? 'Accepting...'
                                  : 'Accept'}
                              </button>
                            )}
                            {!tx.can_sign && !tx.can_pay && !tx.can_accept_completion && (
                              <span className="text-xs text-[rgb(var(--muted))]">Awaiting others</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                <span>
                  Showing {(transactionsPage - 1) * REQUESTS_PAGE_SIZE + 1}
                  {' - '}
                  {Math.min(transactionsPage * REQUESTS_PAGE_SIZE, transactions.length)} of{' '}
                  {transactions.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={transactionsPage <= 1}
                    onClick={() => setTransactionsPage((prev) => Math.max(1, prev - 1))}
                    className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>
                    Page {transactionsPage} / {totalTransactionPages}
                  </span>
                  <button
                    type="button"
                    disabled={transactionsPage >= totalTransactionPages}
                    onClick={() =>
                      setTransactionsPage((prev) => Math.min(totalTransactionPages, prev + 1))
                    }
                    className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
              </>
            )}
          </section>
        )}
      </div>

      {showModal && (
        <NewRequestModal
          categories={categories}
          items={items}
          currencies={currencies}
          countries={countries}
          addresses={addresses}
          defaultAddressId={bootstrapUser.primary_address_id}
          defaultCountryCode={bootstrapUser.registration_country_code}
          defaultStreet={bootstrapUser.registration_address}
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
          requestStatus={requests.find((row) => row.id === proposalsRequestId)?.status ?? 'PENDING'}
          onSelected={async () => {
            await refreshRequests();
            setCandidatesMap((prev) => {
              const next = { ...prev };
              delete next[proposalsRequestId];
              return next;
            });
          }}
          loadError={proposalsError}
          onRefresh={async () => {
            if (!proposalsRequestId) return;
            setLoadingCandidates(true);
            try {
              await refreshCandidatesForRequest(proposalsRequestId);
            } finally {
              setLoadingCandidates(false);
            }
          }}
        />
      )}
      {signingTransaction && (
        <AgreementSignModal
          transaction={signingTransaction}
          busy={workflowBusyId === signingTransaction.id + 'SIGN'}
          onClose={() => setSigningTransaction(null)}
          onConfirm={handleConfirmSignFromAgreement}
        />
      )}
      {paymentTransaction && (
        <PaymentMockupModal
          transaction={paymentTransaction}
          busy={workflowBusyId === paymentTransaction.id + 'PAY'}
          onClose={() => setPaymentTransaction(null)}
          onConfirm={handleConfirmPayment}
        />
      )}
    </main>
  );
}
