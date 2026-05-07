import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import AgreementSignModal from '../../components/AgreementSignModal';
import {
  advanceTransactionFulfillment,
  type ContractSigningPayload,
  createLogistQuote,
  getFactoryBidsNeedingLogistics,
  getRequestsBootstrap,
  listMyTransactions,
  logout,
  me,
  signTransaction,
  type BootstrapCurrency,
  type MatchCandidate,
  type WorkflowTransaction,
} from '../../lib/authClient';
import { formatCurrencyOptionLabel, formatQuantityWithUnit } from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { THEME_CLASSES, type Theme } from '../../styles/themePresets';

const TABLE_PAGE_SIZE = 5;

type QuoteModalProps = {
  bid: MatchCandidate;
  currencies: BootstrapCurrency[];
  onClose: () => void;
  onQuoted: () => Promise<void>;
};

function QuoteModal({ bid, currencies, onClose, onQuoted }: QuoteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('Regional delivery offer');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('40');
  const [pricePerKm, setPricePerKm] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [estimatedDaysMin, setEstimatedDaysMin] = useState('');
  const [estimatedDaysMax, setEstimatedDaysMax] = useState('');
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? bid.currency_code ?? 'USD');
  const [deliveryPrice, setDeliveryPrice] = useState('40');
  const [deliveryDays, setDeliveryDays] = useState('3');
  const [showOptionalTerms, setShowOptionalTerms] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedBasePrice = Number(basePrice);
    const parsedPricePerKm = pricePerKm.trim() ? Number(pricePerKm) : undefined;
    const parsedPricePerKg = pricePerKg.trim() ? Number(pricePerKg) : undefined;
    const parsedDaysMin = estimatedDaysMin.trim() ? Number(estimatedDaysMin) : undefined;
    const parsedDaysMax = estimatedDaysMax.trim() ? Number(estimatedDaysMax) : undefined;
    const parsedDeliveryPrice = Number(deliveryPrice);
    const parsedDeliveryDays = Number(deliveryDays);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
      setError('Base price must be >= 0');
      return;
    }
    if (
      parsedPricePerKm !== undefined &&
      (!Number.isFinite(parsedPricePerKm) || parsedPricePerKm < 0)
    ) {
      setError('Price per km must be >= 0');
      return;
    }
    if (
      parsedPricePerKg !== undefined &&
      (!Number.isFinite(parsedPricePerKg) || parsedPricePerKg < 0)
    ) {
      setError('Price per kg must be >= 0');
      return;
    }
    if (parsedDaysMin !== undefined && (!Number.isFinite(parsedDaysMin) || parsedDaysMin < 0)) {
      setError('Est. min days must be >= 0');
      return;
    }
    if (parsedDaysMax !== undefined && (!Number.isFinite(parsedDaysMax) || parsedDaysMax < 0)) {
      setError('Est. max days must be >= 0');
      return;
    }
    if (
      parsedDaysMin !== undefined &&
      parsedDaysMax !== undefined &&
      parsedDaysMin > parsedDaysMax
    ) {
      setError('Est. min days cannot exceed est. max days');
      return;
    }
    if (!currencyCode) {
      setError('Select a currency');
      return;
    }
    if (!Number.isFinite(parsedDeliveryPrice) || parsedDeliveryPrice < 0) {
      setError('Delivery price must be >= 0');
      return;
    }
    if (!Number.isFinite(parsedDeliveryDays) || parsedDeliveryDays < 1) {
      setError('Delivery days must be >= 1');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createLogistQuote({
        factory_bid_id: bid.id,
        title: title.trim(),
        description: description.trim() || undefined,
        base_price: parsedBasePrice,
        price_per_km: parsedPricePerKm,
        price_per_kg: parsedPricePerKg,
        estimated_days_min: parsedDaysMin,
        estimated_days_max: parsedDaysMax,
        currency_code: currencyCode,
        delivery_price: parsedDeliveryPrice,
        delivery_days: parsedDeliveryDays,
      });
      setSuccess(result.message ?? 'Quote submitted');
      await onQuoted();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit quote');
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Quote Delivery</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Factory: {bid.factory_legal_name ?? 'N/A'} - Item: {bid.item_name ?? 'N/A'} -
              {' '}
              {formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)} @{' '}
              {bid.inventory_price_per_unit} {bid.currency_code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">From</p>
            <p className="text-sm">{bid.source_address_label ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">To</p>
            <p className="text-sm">{bid.destination_address_label ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Goods</p>
            <p className="text-sm">{bid.item_name ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-[rgb(var(--muted))]">Quantity</p>
            <p className="text-sm">{formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <p className="sm:col-span-2 rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
            Required: Title, Base price, Currency. Required for quote: Delivery price and Delivery days.
            Optional: Description, Price per km, Price per kg, Est. min/max days.
          </p>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Base price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => setShowOptionalTerms((prev) => !prev)}
              className="rounded-md border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/20"
            >
              {showOptionalTerms ? 'Hide optional terms' : 'Show optional terms'}
            </button>
          </div>

          {showOptionalTerms && (
            <>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Price per km (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerKm}
                  onChange={(e) => setPricePerKm(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Price per kg (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Est. min days (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedDaysMin}
                  onChange={(e) => setEstimatedDaysMin(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Est. max days (optional)</label>
                <input
                  type="number"
                  min="0"
                  value={estimatedDaysMax}
                  onChange={(e) => setEstimatedDaysMax(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Currency</label>
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {formatCurrencyOptionLabel(c.code, c.name)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Delivery price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={deliveryPrice}
              onChange={(e) => setDeliveryPrice(e.target.value)}
              className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">Delivery days</label>
            <input
              type="number"
              min="1"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
              className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            />
          </div>

          {bid.factory_note && (
            <p className="sm:col-span-2 rounded-lg bg-[rgb(var(--panel))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
              Factory note: {bid.factory_note}
            </p>
          )}

          {error && <p className="sm:col-span-2 rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}
          {success && (
            <p className="sm:col-span-2 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <div className="sm:col-span-2 flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1 text-sm">
              {submitting ? 'Submitting...' : 'Submit Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LogistWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currencies, setCurrencies] = useState<BootstrapCurrency[]>([]);
  const [factoryBids, setFactoryBids] = useState<MatchCandidate[]>([]);
  const [transactions, setTransactions] = useState<WorkflowTransaction[]>([]);
  const [workflowBusyId, setWorkflowBusyId] = useState<string | null>(null);
  const [signingTransaction, setSigningTransaction] = useState<WorkflowTransaction | null>(null);
  const [quoteTarget, setQuoteTarget] = useState<MatchCandidate | null>(null);
  const [factoryBidsPage, setFactoryBidsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [factoryBidsQuery, setFactoryBidsQuery] = useState('');
  const [factoryBidsRequestStatusFilter, setFactoryBidsRequestStatusFilter] = useState('ALL');
  const [factoryBidsCurrencyFilter, setFactoryBidsCurrencyFilter] = useState('ALL');
  const [factoryBidsQuoteFilter, setFactoryBidsQuoteFilter] = useState('ALL');
  const [transactionsQuery, setTransactionsQuery] = useState('');
  const [transactionsStatusFilter, setTransactionsStatusFilter] = useState('ALL');
  const [transactionsPaymentFilter, setTransactionsPaymentFilter] = useState('ALL');

  const factoryBidsRequestStatusOptions = useMemo(
    () =>
      Array.from(
        new Set(factoryBids.map((bid) => bid.request_status ?? 'PAIRING_IN_PROGRESS'))
      ).sort(),
    [factoryBids]
  );
  const factoryBidsCurrencyOptions = useMemo(
    () => Array.from(new Set(factoryBids.map((bid) => bid.currency_code))).sort(),
    [factoryBids]
  );
  const transactionsStatusOptions = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.status))).sort(),
    [transactions]
  );
  const transactionsPaymentOptions = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.payment_status))).sort(),
    [transactions]
  );

  const filteredFactoryBids = useMemo(() => {
    const q = factoryBidsQuery.trim().toLowerCase();
    return factoryBids.filter((bid) => {
      const requestStatus = bid.request_status ?? 'PAIRING_IN_PROGRESS';
      const quoteStage = bid.has_my_quote ? 'QUOTED' : 'NOT_QUOTED';
      const matchesQuery =
        !q ||
        (bid.item_name ?? '').toLowerCase().includes(q) ||
        (bid.factory_legal_name ?? '').toLowerCase().includes(q) ||
        (bid.factory_note ?? '').toLowerCase().includes(q);
      const matchesStatus =
        factoryBidsRequestStatusFilter === 'ALL' || requestStatus === factoryBidsRequestStatusFilter;
      const matchesCurrency =
        factoryBidsCurrencyFilter === 'ALL' || bid.currency_code === factoryBidsCurrencyFilter;
      const matchesQuote = factoryBidsQuoteFilter === 'ALL' || quoteStage === factoryBidsQuoteFilter;
      return matchesQuery && matchesStatus && matchesCurrency && matchesQuote;
    });
  }, [
    factoryBids,
    factoryBidsQuery,
    factoryBidsRequestStatusFilter,
    factoryBidsCurrencyFilter,
    factoryBidsQuoteFilter,
  ]);

  const filteredTransactions = useMemo(() => {
    const q = transactionsQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesQuery =
        !q || tx.id.toLowerCase().includes(q) || (tx.item_name ?? '').toLowerCase().includes(q);
      const matchesStatus =
        transactionsStatusFilter === 'ALL' || tx.status === transactionsStatusFilter;
      const matchesPayment =
        transactionsPaymentFilter === 'ALL' || tx.payment_status === transactionsPaymentFilter;
      return matchesQuery && matchesStatus && matchesPayment;
    });
  }, [transactions, transactionsQuery, transactionsStatusFilter, transactionsPaymentFilter]);

  const factoryBidsTotalPages = Math.max(1, Math.ceil(filteredFactoryBids.length / TABLE_PAGE_SIZE));
  const transactionsTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / TABLE_PAGE_SIZE));

  const paginatedFactoryBids = useMemo(() => {
    const start = (factoryBidsPage - 1) * TABLE_PAGE_SIZE;
    return filteredFactoryBids.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredFactoryBids, factoryBidsPage]);

  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * TABLE_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTransactions, transactionsPage]);

  useEffect(() => {
    if (factoryBidsPage > factoryBidsTotalPages) setFactoryBidsPage(factoryBidsTotalPages);
  }, [factoryBidsPage, factoryBidsTotalPages]);

  useEffect(() => {
    if (transactionsPage > transactionsTotalPages) setTransactionsPage(transactionsTotalPages);
  }, [transactionsPage, transactionsTotalPages]);

  const refreshFactoryBids = useCallback(async () => {
    const rows = await getFactoryBidsNeedingLogistics();
    setFactoryBids(rows);
  }, []);

  const refreshTransactions = useCallback(async () => {
    const rows = await listMyTransactions();
    setTransactions(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'LOGIST') {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        const [bootstrap, bids, txRows] = await Promise.all([
          getRequestsBootstrap(),
          getFactoryBidsNeedingLogistics(),
          listMyTransactions(),
        ]);
        if (cancelled) return;
        setCurrencies(bootstrap.currencies);
        setFactoryBids(bids);
        setTransactions(txRows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace');
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
      void refreshFactoryBids();
      void refreshTransactions();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading, refreshFactoryBids, refreshTransactions]);

  async function handleWorkflowAction(
    transactionId: string,
    action: 'SIGN' | 'START' | 'MARK_IN_PROGRESS'
  ) {
    if (action === 'SIGN') {
      const tx = transactions.find((row) => row.id === transactionId);
      if (!tx) {
        setError('Transaction no longer available');
        return;
      }
      setSigningTransaction(tx);
      return;
    }

    setWorkflowBusyId(transactionId + action);
    try {
      await advanceTransactionFulfillment(transactionId, action);
      await Promise.all([refreshTransactions(), refreshFactoryBids()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow action failed');
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
      await Promise.all([refreshTransactions(), refreshFactoryBids()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow action failed');
    } finally {
      setWorkflowBusyId(null);
    }
  }

  async function handleLogout() {
    await logout();
    await router.push(`/login?lang=${locale}`);
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

        {loading && <p className="text-sm text-[rgb(var(--muted))]">Loading workspace…</p>}
        {error && <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>}

        {!loading && (
          <>
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
            <h1 className="text-2xl font-semibold sm:text-3xl">Logistics Workspace</h1>
            <p className="mt-1 text-sm text-[rgb(var(--muted))]">
              Submit delivery quotes with your full offer terms. Your logistics profile is updated
              from the latest quote details.
            </p>

            <h2 className="mt-6 text-lg font-semibold">Factory Bids Needing Your Quote</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Add a quote with full logistics terms per bid. This creates a complete proposal for
              customer selection.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <input
                type="text"
                value={factoryBidsQuery}
                onChange={(e) => setFactoryBidsQuery(e.target.value)}
                placeholder="Search item/factory/note"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
              <select
                value={factoryBidsRequestStatusFilter}
                onChange={(e) => setFactoryBidsRequestStatusFilter(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              >
                <option value="ALL">All request statuses</option>
                {factoryBidsRequestStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={factoryBidsCurrencyFilter}
                onChange={(e) => setFactoryBidsCurrencyFilter(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              >
                <option value="ALL">All currencies</option>
                {factoryBidsCurrencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <select
                value={factoryBidsQuoteFilter}
                onChange={(e) => setFactoryBidsQuoteFilter(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              >
                <option value="ALL">All quote states</option>
                <option value="NOT_QUOTED">Need quote</option>
                <option value="QUOTED">Already quoted</option>
              </select>
            </div>

            {filteredFactoryBids.length === 0 ? (
              <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                {factoryBids.length === 0
                  ? 'No factory bids waiting for logistics quotes at this time.'
                  : 'No factory bids match current filters.'}
              </p>
            ) : (
              <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                      <th className="py-2 pr-4">Request item</th>
                      <th className="py-2 pr-4">Factory</th>
                      <th className="py-2 pr-4">Qty offered</th>
                      <th className="py-2 pr-4">Goods cost</th>
                      <th className="py-2 pr-4">Request status</th>
                      <th className="py-2 pr-4">Factory note</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedFactoryBids.map((bid) => {
                      const goodsCost =
                        bid.quoted_quantity && bid.inventory_price_per_unit
                          ? (
                              parseFloat(bid.quoted_quantity) *
                              parseFloat(bid.inventory_price_per_unit)
                            ).toFixed(2)
                          : '-';
                      return (
                        <tr key={bid.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4 font-medium">{bid.item_name ?? '-'}</td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {bid.factory_legal_name ?? '-'}
                          </td>
                          <td className="py-2 pr-4">
                            {formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)}
                          </td>
                          <td className="py-2 pr-4">
                            {goodsCost} {bid.currency_code}
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {bid.request_status ?? 'PAIRING_IN_PROGRESS'}
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {bid.factory_note ?? '-'}
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => setQuoteTarget(bid)}
                              className={`rounded-md border px-3 py-1 text-xs hover:bg-emerald-950/30 ${
                                bid.has_my_quote
                                  ? 'border-amber-700/60 text-amber-300'
                                  : 'border-emerald-700/60 text-emerald-300'
                              }`}
                            >
                              {bid.has_my_quote ? 'Update Quote' : 'Quote Delivery'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                <span>
                  Showing {(factoryBidsPage - 1) * TABLE_PAGE_SIZE + 1}
                  {' - '}
                  {Math.min(factoryBidsPage * TABLE_PAGE_SIZE, filteredFactoryBids.length)} of{' '}
                  {filteredFactoryBids.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={factoryBidsPage <= 1}
                    onClick={() => setFactoryBidsPage((prev) => Math.max(1, prev - 1))}
                    className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>
                    Page {factoryBidsPage} / {factoryBidsTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={factoryBidsPage >= factoryBidsTotalPages}
                    onClick={() =>
                      setFactoryBidsPage((prev) => Math.min(factoryBidsTotalPages, prev + 1))
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

            <section className="surface-1 rounded-2xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Contract & Fulfillment Workflow</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Sign contract packets and progress fulfillment after customer payment confirmation.
            </p>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={transactionsQuery}
                onChange={(e) => setTransactionsQuery(e.target.value)}
                placeholder="Search tx or item"
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              />
              <select
                value={transactionsStatusFilter}
                onChange={(e) => setTransactionsStatusFilter(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              >
                <option value="ALL">All statuses</option>
                {transactionsStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={transactionsPaymentFilter}
                onChange={(e) => setTransactionsPaymentFilter(e.target.value)}
                className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              >
                <option value="ALL">All payment states</option>
                {transactionsPaymentOptions.map((payment) => (
                  <option key={payment} value={payment}>
                    {payment}
                  </option>
                ))}
              </select>
            </div>

            {filteredTransactions.length === 0 ? (
              <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                {transactions.length === 0
                  ? 'No active transactions yet.'
                  : 'No transactions match current filters.'}
              </p>
            ) : (
              <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                      <th className="py-2 pr-4">Transaction</th>
                      <th className="py-2 pr-4">Item</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Payment</th>
                      <th className="py-2 pr-4">Signatures</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-[rgb(var(--stroke))]/40">
                        <td className="py-2 pr-4 font-mono text-xs">{tx.id.slice(0, 8)}...</td>
                        <td className="py-2 pr-4">{tx.item_name ?? '-'}</td>
                        <td className="py-2 pr-4">{tx.status}</td>
                        <td className="py-2 pr-4 text-xs">{tx.payment_status}</td>
                        <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                          C:{tx.signature_status.CUSTOMER} F:{tx.signature_status.FACTORY} L:
                          {tx.signature_status.LOGIST}
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
                            {tx.can_start_fulfillment && (
                              <button
                                type="button"
                                onClick={() => void handleWorkflowAction(tx.id, 'START')}
                                disabled={workflowBusyId === tx.id + 'START'}
                                className="rounded-md border border-amber-700/60 px-2 py-1 text-xs text-amber-300 hover:bg-amber-950/30 disabled:opacity-60"
                              >
                                {workflowBusyId === tx.id + 'START' ? 'Starting...' : 'Start'}
                              </button>
                            )}
                            {tx.can_mark_in_progress && (
                              <button
                                type="button"
                                onClick={() => void handleWorkflowAction(tx.id, 'MARK_IN_PROGRESS')}
                                disabled={workflowBusyId === tx.id + 'MARK_IN_PROGRESS'}
                                className="rounded-md border border-sky-700/60 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950/30 disabled:opacity-60"
                              >
                                {workflowBusyId === tx.id + 'MARK_IN_PROGRESS'
                                  ? 'Submitting...'
                                  : 'Delivered'}
                              </button>
                            )}
                            {!tx.can_sign && !tx.can_start_fulfillment && !tx.can_mark_in_progress && (
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
                  Showing {(transactionsPage - 1) * TABLE_PAGE_SIZE + 1}
                  {' - '}
                  {Math.min(transactionsPage * TABLE_PAGE_SIZE, filteredTransactions.length)} of{' '}
                  {filteredTransactions.length}
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
                    Page {transactionsPage} / {transactionsTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={transactionsPage >= transactionsTotalPages}
                    onClick={() =>
                      setTransactionsPage((prev) => Math.min(transactionsTotalPages, prev + 1))
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
          </>
        )}
      </div>

      {quoteTarget && (
        <QuoteModal
          bid={quoteTarget}
          currencies={currencies}
          onClose={() => setQuoteTarget(null)}
          onQuoted={async () => {
            await refreshFactoryBids();
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
    </main>
  );
}
