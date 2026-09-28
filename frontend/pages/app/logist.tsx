import SelectField from '../../components/SelectField';
import GuidanceHint from '../../components/GuidanceHint';
import OrderGuidance from '../../components/OrderGuidance';
import { useActionConfirmation } from '../../hooks/useActionConfirmation';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import WorkspaceExperience from '../../components/WorkspaceExperience';
import SignatureList from '../../components/SignatureList';
import StatusBadge from '../../components/StatusBadge';
import TablePager from '../../components/TablePager';
import { workspacePath } from '../../lib/navigation';
import Modal from '../../components/Modal';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../lib/authClient';

import AgreementSignModal from '../../components/AgreementSignModal';
import {
  advanceTransactionFulfillment,
  type ContractSigningPayload,
  createLogisticOffer,
  createLogistQuote,
  getFactoryBidsNeedingLogistics,
  getRequestsBootstrap,
  listMyLogisticOffers,
  listMyTransactions,
  logout,
  me,
  signTransaction,
  type BootstrapCurrency,
  type LogisticOfferItem,
  type MatchCandidate,
  type WorkflowTransaction,
} from '../../lib/authClient';
import {
  formatCurrencyOptionLabel,
  formatMoney,
  formatQuantityWithUnit,
} from '../../lib/formatting';
import { statusLabel } from '../../lib/status';
import { getLocaleFromQuery, t } from '../../lib/i18n';

const TABLE_PAGE_SIZE = 5;

type QuoteModalProps = {
  bid: MatchCandidate;
  currencies: BootstrapCurrency[];
  onClose: () => void;
  onQuoted: () => Promise<void>;
};

function QuoteModal({ bid, currencies, onClose: onDismiss, onQuoted }: QuoteModalProps) {
  const { dialogId, onClose } = useModalDismiss(onDismiss);
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
  const [currencyCode, setCurrencyCode] = useState(
    currencies[0]?.code ?? bid.currency_code ?? 'USD'
  );
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
    <Modal
      id={dialogId}
      onClose={onClose}
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div className="slide-up max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Quote Delivery</h2>
            <GuidanceHint hint="quote" />
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Factory: {bid.factory_legal_name ?? 'N/A'} - Item: {bid.item_name ?? 'N/A'} -{' '}
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
            <p className="text-sm">
              {formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <p className="sm:col-span-2 rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
            Required: Title, Base price, Currency. Required for quote: Delivery price and Delivery
            days. Optional: Description, Price per km, Price per kg, Est. min/max days.
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
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                  Price per km (optional)
                </label>
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
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                  Price per kg (optional)
                </label>
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
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                  Est. min days (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={estimatedDaysMin}
                  onChange={(e) => setEstimatedDaysMin(e.target.value)}
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                  Est. max days (optional)
                </label>
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
            <SelectField
              aria-label="Currency"
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
            </SelectField>
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

          {error && (
            <p className="sm:col-span-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {success && (
            <p className="sm:col-span-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
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
    </Modal>
  );
}

export default function LogistWorkspacePage() {
  const { confirm, confirmation } = useActionConfirmation();
  const e = useExperienceCopy();
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [loading, setLoading] = useState(true);
  const [guidanceUserId, setGuidanceUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [currencies, setCurrencies] = useState<BootstrapCurrency[]>([]);
  const [factoryBids, setFactoryBids] = useState<MatchCandidate[]>([]);
  const [transactions, setTransactions] = useState<WorkflowTransaction[]>([]);
  const [logisticOffers, setLogisticOffers] = useState<LogisticOfferItem[]>([]);
  // Add Logistic Offer form
  const [offerTitle, setOfferTitle] = useState('Regional courier offer');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerBasePrice, setOfferBasePrice] = useState('');
  const [offerPricePerKm, setOfferPricePerKm] = useState('');
  const [offerPricePerKg, setOfferPricePerKg] = useState('');
  const [offerDaysMin, setOfferDaysMin] = useState('');
  const [offerDaysMax, setOfferDaysMax] = useState('');
  const [offerCurrencyCode, setOfferCurrencyCode] = useState('');
  const [offerShowOptional, setOfferShowOptional] = useState(false);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState<string | null>(null);
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
        factoryBidsRequestStatusFilter === 'ALL' ||
        requestStatus === factoryBidsRequestStatusFilter;
      const matchesCurrency =
        factoryBidsCurrencyFilter === 'ALL' || bid.currency_code === factoryBidsCurrencyFilter;
      const matchesQuote =
        factoryBidsQuoteFilter === 'ALL' || quoteStage === factoryBidsQuoteFilter;
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

  const factoryBidsTotalPages = Math.max(
    1,
    Math.ceil(filteredFactoryBids.length / TABLE_PAGE_SIZE)
  );
  const transactionsTotalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / TABLE_PAGE_SIZE)
  );

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

  const refreshOffers = useCallback(async () => {
    const offers = await listMyLogisticOffers();
    setLogisticOffers(offers);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'LOGIST') {
          await router.replace(workspacePath(auth.user.role, locale));
          return;
        }
        const [bootstrap, bids, txRows, offers] = await Promise.all([
          getRequestsBootstrap(),
          getFactoryBidsNeedingLogistics(),
          listMyTransactions(),
          listMyLogisticOffers(),
        ]);
        if (cancelled) return;
        setCurrencies(bootstrap.currencies);
        setGuidanceUserId(bootstrap.user.id);
        setFactoryBids(bids);
        setTransactions(txRows);
        setLogisticOffers(offers);
        setOfferCurrencyCode((prev) => prev || bootstrap.currencies[0]?.code || 'USD');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load workspace');
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
      void refreshFactoryBids().catch(() =>
        setError('Could not refresh workspace. Please check your connection and try again.')
      );
      void refreshTransactions().catch(() =>
        setError('Could not refresh workspace. Please check your connection and try again.')
      );
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

    if (
      workflowBusyId ||
      !(await confirm(action === 'START' ? 'Start delivery' : 'Mark delivered'))
    )
      return;
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

  async function handleAddOffer(e: FormEvent) {
    e.preventDefault();
    setOfferError(null);
    setOfferSuccess(null);

    const parsedBasePrice = Number(offerBasePrice);
    const parsedPricePerKm = offerPricePerKm.trim() ? Number(offerPricePerKm) : undefined;
    const parsedPricePerKg = offerPricePerKg.trim() ? Number(offerPricePerKg) : undefined;
    const parsedDaysMin = offerDaysMin.trim() ? Number(offerDaysMin) : undefined;
    const parsedDaysMax = offerDaysMax.trim() ? Number(offerDaysMax) : undefined;

    const trimmedTitle = offerTitle.trim();
    if (!trimmedTitle || trimmedTitle.length < 2 || trimmedTitle.length > 120) {
      setOfferError('Title must be 2–120 characters');
      return;
    }
    if (!Number.isFinite(parsedBasePrice) || parsedBasePrice < 0) {
      setOfferError('Base price must be ≥ 0');
      return;
    }
    if (!offerCurrencyCode) {
      setOfferError('Select a currency');
      return;
    }
    if (
      parsedPricePerKm !== undefined &&
      (!Number.isFinite(parsedPricePerKm) || parsedPricePerKm < 0)
    ) {
      setOfferError('Price per km must be ≥ 0');
      return;
    }
    if (
      parsedPricePerKg !== undefined &&
      (!Number.isFinite(parsedPricePerKg) || parsedPricePerKg < 0)
    ) {
      setOfferError('Price per kg must be ≥ 0');
      return;
    }
    if (
      parsedDaysMin !== undefined &&
      (!Number.isFinite(parsedDaysMin) || parsedDaysMin < 0 || !Number.isInteger(parsedDaysMin))
    ) {
      setOfferError('Est. min days must be a whole number ≥ 0');
      return;
    }
    if (
      parsedDaysMax !== undefined &&
      (!Number.isFinite(parsedDaysMax) || parsedDaysMax < 0 || !Number.isInteger(parsedDaysMax))
    ) {
      setOfferError('Est. max days must be a whole number ≥ 0');
      return;
    }
    if (
      parsedDaysMin !== undefined &&
      parsedDaysMax !== undefined &&
      parsedDaysMin > parsedDaysMax
    ) {
      setOfferError('Est. min days cannot exceed est. max days');
      return;
    }
    if (offerDescription.trim().length > 500) {
      setOfferError('Description must be ≤ 500 characters');
      return;
    }

    setOfferSubmitting(true);
    try {
      await createLogisticOffer({
        title: trimmedTitle,
        description: offerDescription.trim() || undefined,
        base_price: parsedBasePrice,
        price_per_km: parsedPricePerKm,
        price_per_kg: parsedPricePerKg,
        estimated_days_min: parsedDaysMin,
        estimated_days_max: parsedDaysMax,
        currency_code: offerCurrencyCode,
      });
      setOfferSuccess('Logistic offer created.');
      setOfferTitle('Regional courier offer');
      setOfferDescription('');
      setOfferBasePrice('');
      setOfferPricePerKm('');
      setOfferPricePerKg('');
      setOfferDaysMin('');
      setOfferDaysMax('');
      setOfferShowOptional(false);
      await refreshOffers();
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setOfferSubmitting(false);
    }
  }

  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const showOfferForm =
    offerFormOpen || router.query.add === '1' || (!loading && logisticOffers.length === 0);
  const offerToggle = useRef<HTMLButtonElement>(null);
  const offerHeading = useRef<HTMLHeadingElement>(null);
  function openOfferForm() {
    setOfferFormOpen(true);
    requestAnimationFrame(() => offerHeading.current?.focus());
  }
  function closeOfferForm() {
    setOfferFormOpen(false);
    requestAnimationFrame(() => offerToggle.current?.focus());
  }
  const statusOption = (status: string) => (
    <option key={status} value={status}>
      {statusLabel(locale, status)}
    </option>
  );

  async function handleLogout() {
    try {
      await logout();
      await router.push(`/login?lang=${locale}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not log out. Please try again.');
    }
  }

  return (
    <WorkspaceExperience
      role="logist"
      guidance={
        guidanceUserId
          ? {
              userId: guidanceUserId,
              completed: [
                logisticOffers.length > 0,
                factoryBids.some((bid) => bid.has_my_quote) || transactions.length > 0,
                transactions.some(
                  (transaction) => transaction.signature_status.LOGIST === 'SIGNED'
                ),
                transactions.some((transaction) =>
                  ['IN_PROGRESS', 'COMPLETED'].includes(transaction.status)
                ),
              ],
            }
          : undefined
      }
      loading={loading}
      error={error}
      counts={[
        factoryBids.filter((bid) => !bid.has_my_quote).length,
        transactions.filter((tx) => tx.status !== 'COMPLETED').length,
        logisticOffers.length,
      ]}
      items={transactions.map((tx) => ({
        id: tx.id,
        title: tx.item_name ?? 'Delivery',
        status: tx.status,
        moveToRoad: tx.can_start_fulfillment
          ? () => void handleWorkflowAction(tx.id, 'START')
          : undefined,
        detail: `${formatMoney(locale, tx.total_cost, tx.currency_code)} · ${tx.delivery_days ?? '—'} ${e('days')}`,
        action: tx.can_sign
          ? () => void handleWorkflowAction(tx.id, 'SIGN')
          : tx.can_start_fulfillment
            ? () => void handleWorkflowAction(tx.id, 'START')
            : tx.can_mark_in_progress
              ? () => void handleWorkflowAction(tx.id, 'MARK_IN_PROGRESS')
              : undefined,
        actionLabel: tx.can_sign
          ? 'Review & sign'
          : tx.can_start_fulfillment
            ? 'Start delivery'
            : tx.can_mark_in_progress
              ? 'Mark delivered'
              : 'View delivery',
      }))}
      onLogout={handleLogout}
    >
      <div className="workspace-panels">
        {loading && <p className="text-sm text-[rgb(var(--muted))]">Loading workspace…</p>}

        {!loading && (
          <>
            {/* Quote requests: factory bids waiting for a delivery price */}
            <section data-section="quotes" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="quotes" className="text-lg font-semibold">
                {copy.bidsNeedingQuoteTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {copy.bidsNeedingQuoteSubtitle}
              </p>

              <div className="table-filters table-filters-4">
                <input
                  type="search"
                  aria-label={e('Search item, factory or note')}
                  value={factoryBidsQuery}
                  onChange={(e) => setFactoryBidsQuery(e.target.value)}
                  placeholder={e('Search item, factory or note')}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <SelectField
                  aria-label={e('Status')}
                  value={factoryBidsRequestStatusFilter}
                  onChange={(e) => setFactoryBidsRequestStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All request statuses')}</option>
                  {factoryBidsRequestStatusOptions.map(statusOption)}
                </SelectField>
                <SelectField
                  aria-label={e('Currency')}
                  value={factoryBidsCurrencyFilter}
                  onChange={(e) => setFactoryBidsCurrencyFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All currencies')}</option>
                  {factoryBidsCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  aria-label={e('Quote status')}
                  value={factoryBidsQuoteFilter}
                  onChange={(e) => setFactoryBidsQuoteFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All quote states')}</option>
                  <option value="NOT_QUOTED">{e('Need quote')}</option>
                  <option value="QUOTED">{e('Already quoted')}</option>
                </SelectField>
              </div>

              {filteredFactoryBids.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {factoryBids.length === 0
                    ? copy.noBidsWaiting
                    : e('No factory bids match current filters.')}
                </p>
              ) : (
                <>
                  <div
                    className="record-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={copy.bidsNeedingQuoteTitle}
                  >
                    <table className="record-table">
                      <thead>
                        <tr>
                          <th>{e('Goods')}</th>
                          <th>{e('Quantity')}</th>
                          <th>{e('Goods cost')}</th>
                          <th>{e('Status')}</th>
                          <th>
                            <span className="sr-only">{e('Action')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFactoryBids.map((bid) => {
                          const goodsCost =
                            bid.quoted_quantity && bid.inventory_price_per_unit
                              ? parseFloat(bid.quoted_quantity) *
                                parseFloat(bid.inventory_price_per_unit)
                              : null;
                          return (
                            <tr key={bid.id}>
                              <td className="record-title">
                                {bid.item_name ?? '—'}
                                <small>{bid.factory_legal_name ?? ''}</small>
                                {bid.factory_note && <small>{bid.factory_note}</small>}
                              </td>
                              <td data-label={e('Quantity')} className="num">
                                {formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)}
                              </td>
                              <td data-label={e('Goods cost')} className="num">
                                {formatMoney(locale, goodsCost, bid.currency_code)}
                              </td>
                              <td data-label={e('Status')}>
                                <StatusBadge status={bid.request_status ?? 'PAIRING_IN_PROGRESS'} />
                                {bid.has_my_quote && <small>{e('You have quoted')}</small>}
                              </td>
                              <td className="record-actions">
                                <button
                                  type="button"
                                  onClick={() => setQuoteTarget(bid)}
                                  className={`if-button ${bid.has_my_quote ? '' : 'if-button-primary'}`}
                                >
                                  {bid.has_my_quote ? e('Update quote') : copy.quoteDelivery}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePager
                    page={factoryBidsPage}
                    pageSize={TABLE_PAGE_SIZE}
                    total={filteredFactoryBids.length}
                    onPage={setFactoryBidsPage}
                  />
                </>
              )}
            </section>

            {/* Delivery services: the list first, the form on demand */}
            <section data-section="offers" className="surface-1 rounded-2xl p-6 sm:p-8">
              {logisticOffers.length === 0 && (
                <div className="mb-6 rounded-2xl border-2 border-[rgb(var(--accent))] bg-[rgb(var(--panel))] p-5">
                  <h2 className="text-lg font-semibold">{copy.logistSetupTitle}</h2>
                  <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                    {copy.logistSetupSubtitle}
                  </p>
                </div>
              )}

              <div className="section-heading-row">
                <div>
                  <h2 id="offers" className="text-lg font-semibold">
                    {copy.myOffersTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{copy.addOfferSubtitle}</p>
                </div>
                {logisticOffers.length > 0 && (
                  <button
                    ref={offerToggle}
                    type="button"
                    className="if-button if-button-primary"
                    aria-controls={showOfferForm ? 'add-offer' : undefined}
                    aria-expanded={showOfferForm}
                    onClick={() => (showOfferForm ? closeOfferForm() : openOfferForm())}
                  >
                    {showOfferForm ? e('Close the form') : e('Add delivery service')}
                  </button>
                )}
              </div>
              {offerSuccess && (
                <p
                  role="status"
                  className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
                >
                  {offerSuccess}
                </p>
              )}

              {showOfferForm && (
                <form
                  id="add-offer"
                  onSubmit={(e) => void handleAddOffer(e)}
                  className="inventory-form mt-4 grid gap-4 sm:grid-cols-2"
                  aria-labelledby="add-offer-title"
                >
                  <h3
                    id="add-offer-title"
                    ref={offerHeading}
                    tabIndex={-1}
                    className="font-semibold sm:col-span-2"
                  >
                    {copy.addOfferTitle}
                  </h3>
                  {/* Title */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="offer-title"
                      className="mb-1 block text-sm text-[rgb(var(--muted))]"
                    >
                      {copy.offerTitle} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="offer-title"
                      value={offerTitle}
                      onChange={(e) => setOfferTitle(e.target.value)}
                      maxLength={120}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  {/* Base price + Currency */}
                  <div>
                    <label
                      htmlFor="offer-base-price"
                      className="mb-1 block text-sm text-[rgb(var(--muted))]"
                    >
                      {copy.basePrice} <span className="text-danger">*</span>
                    </label>
                    <input
                      id="offer-base-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={offerBasePrice}
                      onChange={(e) => setOfferBasePrice(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                      {copy.currency} <span className="text-danger">*</span>
                    </label>
                    <SelectField
                      aria-label="Currency"
                      value={offerCurrencyCode}
                      onChange={(e) => setOfferCurrencyCode(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                      required
                    >
                      {currencies.map((c) => (
                        <option key={c.code} value={c.code}>
                          {formatCurrencyOptionLabel(c.code, c.name)}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  {/* Optional terms toggle */}
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => setOfferShowOptional((prev) => !prev)}
                      className="rounded-md border border-[rgb(var(--stroke))] px-3 py-2 text-xs text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/20"
                    >
                      {offerShowOptional ? copy.hideOptionalTerms : copy.showOptionalTerms}
                    </button>
                  </div>

                  {offerShowOptional && (
                    <>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                          Description
                        </label>
                        <textarea
                          value={offerDescription}
                          onChange={(e) => setOfferDescription(e.target.value)}
                          maxLength={500}
                          rows={2}
                          className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                          {copy.pricePerKm}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={offerPricePerKm}
                          onChange={(e) => setOfferPricePerKm(e.target.value)}
                          className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                          {copy.pricePerKg}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={offerPricePerKg}
                          onChange={(e) => setOfferPricePerKg(e.target.value)}
                          className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                          Est. min days
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={offerDaysMin}
                          onChange={(e) => setOfferDaysMin(e.target.value)}
                          className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                          Est. max days
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={offerDaysMax}
                          onChange={(e) => setOfferDaysMax(e.target.value)}
                          className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        />
                      </div>
                    </>
                  )}

                  {offerError && (
                    <p
                      role="alert"
                      className="sm:col-span-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
                    >
                      {offerError}
                    </p>
                  )}
                  <div className="flex gap-3 sm:col-span-2">
                    {logisticOffers.length > 0 && (
                      <button type="button" className="if-button" onClick={closeOfferForm}>
                        {e('Cancel')}
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={offerSubmitting}
                      className="if-button if-button-primary flex-1"
                    >
                      {offerSubmitting ? e('Adding…') : copy.addOfferTitle}
                    </button>
                  </div>
                </form>
              )}

              {logisticOffers.length > 0 && (
                <div
                  className="record-scroll mt-4"
                  tabIndex={0}
                  role="region"
                  aria-label={copy.myOffersTitle}
                >
                  <table className="record-table">
                    <thead>
                      <tr>
                        <th>{e('Service')}</th>
                        <th>{e('Base price')}</th>
                        <th>{e('Delivery time')}</th>
                        <th>{e('Reliability')}</th>
                        <th>{e('Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logisticOffers.map((offer) => (
                        <tr key={offer.id}>
                          <td className="record-title">{offer.title}</td>
                          <td data-label={e('Base price')} className="num">
                            {formatMoney(locale, offer.base_price, offer.currency_code)}
                          </td>
                          <td data-label={e('Delivery time')} className="num">
                            {offer.estimated_days_min != null && offer.estimated_days_max != null
                              ? `${offer.estimated_days_min}–${offer.estimated_days_max} ${e('days')}`
                              : offer.estimated_days_min != null
                                ? `${offer.estimated_days_min}+ ${e('days')}`
                                : offer.estimated_days_max != null
                                  ? `≤ ${offer.estimated_days_max} ${e('days')}`
                                  : '—'}
                          </td>
                          <td data-label={e('Reliability')} className="num">
                            {offer.reliability_score
                              ? `${(offer.reliability_score * 100).toFixed(0)}%`
                              : '—'}
                          </td>
                          <td data-label={e('Status')}>
                            <StatusBadge status={offer.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Deliveries: contracts and fulfilment */}
            <section data-section="workflow" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="workflow" className="text-lg font-semibold">
                {e('Contracts and deliveries')}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {e(
                  'Sign contracts, collect the goods from the factory once payment is confirmed, then mark the delivery.'
                )}
              </p>

              <div className="table-filters">
                <input
                  type="search"
                  aria-label={e('Search order or item')}
                  value={transactionsQuery}
                  onChange={(e) => setTransactionsQuery(e.target.value)}
                  placeholder={e('Search order or item')}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <SelectField
                  aria-label={e('Status')}
                  value={transactionsStatusFilter}
                  onChange={(e) => setTransactionsStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All statuses')}</option>
                  {transactionsStatusOptions.map(statusOption)}
                </SelectField>
                <SelectField
                  aria-label={e('Payment')}
                  value={transactionsPaymentFilter}
                  onChange={(e) => setTransactionsPaymentFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All payment states')}</option>
                  {transactionsPaymentOptions.map(statusOption)}
                </SelectField>
              </div>

              {filteredTransactions.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {transactions.length === 0
                    ? e('No active transactions yet.')
                    : e('No transactions match current filters.')}
                </p>
              ) : (
                <>
                  <div
                    className="record-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={e('Contracts and deliveries')}
                  >
                    <table className="record-table">
                      <thead>
                        <tr>
                          <th>{e('Order')}</th>
                          <th>{e('Status')}</th>
                          <th>{e('Signatures')}</th>
                          <th>{e('Next step')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((tx) => {
                          const canAct =
                            tx.can_sign || tx.can_start_fulfillment || tx.can_mark_in_progress;
                          return (
                            <tr key={tx.id}>
                              <td className="record-title">
                                {tx.item_name ?? '—'}
                                <small className="font-mono">{tx.id.slice(0, 8)}</small>
                              </td>
                              <td data-label={e('Status')}>
                                <StatusBadge status={tx.status} />
                                <small>
                                  {e('Payment')}: {statusLabel(locale, tx.payment_status)}
                                </small>
                              </td>
                              <td data-label={e('Signatures')}>
                                <SignatureList status={tx.signature_status} />
                              </td>
                              <td className="record-actions record-next">
                                <OrderGuidance transaction={tx} />
                                <div className="flex flex-wrap gap-2">
                                  {tx.can_sign && (
                                    <button
                                      type="button"
                                      onClick={() => void handleWorkflowAction(tx.id, 'SIGN')}
                                      disabled={workflowBusyId === tx.id + 'SIGN'}
                                      className="if-button if-button-primary"
                                    >
                                      {workflowBusyId === tx.id + 'SIGN'
                                        ? e('Signing…')
                                        : e('Sign')}
                                    </button>
                                  )}
                                  {tx.can_start_fulfillment && (
                                    <button
                                      type="button"
                                      onClick={() => void handleWorkflowAction(tx.id, 'START')}
                                      disabled={workflowBusyId === tx.id + 'START'}
                                      className="if-button if-button-primary"
                                    >
                                      {workflowBusyId === tx.id + 'START'
                                        ? e('Starting…')
                                        : e('Start delivery')}
                                    </button>
                                  )}
                                  {tx.can_mark_in_progress && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleWorkflowAction(tx.id, 'MARK_IN_PROGRESS')
                                      }
                                      disabled={workflowBusyId === tx.id + 'MARK_IN_PROGRESS'}
                                      className="if-button if-button-primary"
                                    >
                                      {workflowBusyId === tx.id + 'MARK_IN_PROGRESS'
                                        ? e('Submitting…')
                                        : e('Delivered')}
                                    </button>
                                  )}
                                  {!canAct && tx.status !== 'COMPLETED' && (
                                    <span className="text-xs text-[rgb(var(--muted))]">
                                      {e('Awaiting others')}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePager
                    page={transactionsPage}
                    pageSize={TABLE_PAGE_SIZE}
                    total={filteredTransactions.length}
                    onPage={setTransactionsPage}
                  />
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
      {confirmation}
    </WorkspaceExperience>
  );
}
