import PresetIcon from '../../components/PresetIcon';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../lib/authClient';

import AgreementSignModal from '../../components/AgreementSignModal';
import Combobox, { type ComboboxOption } from '../../components/Combobox';
import LocaleSwitcher from '../../components/LocaleSwitcher';
import SearchableInput from '../../components/SearchableInput';
import {
  advanceTransactionFulfillment,
  type ContractSigningPayload,
  createFactoryBid,
  createInventoryEntry,
  getOpenRequests,
  getRequestsBootstrap,
  listMyTransactions,
  listMyFactoryBids,
  listMyInventoryEntries,
  logout,
  me,
  signTransaction,
  updateInventoryEntryStatus,
  type BootstrapAddress,
  type BootstrapCategory,
  type BootstrapCountry,
  type BootstrapCurrency,
  type BootstrapItem,
  type InventoryEntryItem,
  type MatchCandidate,
  type OpenRequest,
  type WorkflowTransaction,
} from '../../lib/authClient';
import { formatCurrencyOptionLabel, formatQuantityWithUnit } from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import ThemeSwitcher from '../../components/ThemeSwitcher';
import { useTheme } from '../../hooks/useTheme';
import { THEME_CLASSES } from '../../styles/themePresets';

const TABLE_PAGE_SIZE = 5;

// ── Bid modal ────────────────────────────────────────────────────────────────

type BidModalProps = {
  request: OpenRequest;
  inventory: InventoryEntryItem[];
  copy: ReturnType<typeof t>;
  onClose: () => void;
  onBidPlaced: () => Promise<void>;
};

function BidModal({ request, inventory, copy, onClose, onBidPlaced }: BidModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inventoryId, setInventoryId] = useState(inventory[0]?.id ?? '');
  const [quotedQty, setQuotedQty] = useState(request.quantity);
  const [note, setNote] = useState('');

  const inventoryOptions = useMemo<ComboboxOption[]>(
    () =>
      inventory.map((i) => ({
        id: i.id,
        label: `${i.item_name} @${i.price_per_unit} ${i.currency_code} (${i.quantity_available} available)`,
      })),
    [inventory]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const qty = Number(quotedQty);
    if (!inventoryId) {
      setError('Select an inventory entry');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Quantity must be > 0');
      return;
    }

    setSubmitting(true);
    try {
      await createFactoryBid({
        request_id: request.id,
        inventory_entry_id: inventoryId,
        quoted_quantity: qty,
        factory_note: note.trim() || undefined,
      });
      setSuccess('Bid placed!');
      await onBidPlaced();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place bid');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="slide-up w-full max-w-lg rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{copy.placeBidTitle}</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Request: {request.item_name ?? request.requested_name_text ?? 'N/A'}
              {' \u2014 '}
              {formatQuantityWithUnit(request.quantity, request.quantity_unit)}
              {' • '}
              {request.preferred_currency_code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
          >
            \u00d7
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Combobox
            options={inventoryOptions}
            value={inventoryId}
            onChange={setInventoryId}
            placeholder="Select inventory entry to fulfil this request"
            label={copy.selectInventoryEntry}
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm text-[rgb(var(--muted))]">
              {copy.offeredQty} <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="any"
              value={quotedQty}
              onChange={(e) => setQuotedQty(e.target.value)}
              className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-[rgb(var(--muted))]">{copy.noteToLogistics}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
              placeholder="e.g. Ready to ship in 48 h from Almaty warehouse"
            />
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
              {submitting ? 'Submitting\u2026' : copy.submitBid}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FactoryWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme, setTheme] = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<BootstrapAddress[]>([]);
  const [countries, setCountries] = useState<BootstrapCountry[]>([]);
  const [currencies, setCurrencies] = useState<BootstrapCurrency[]>([]);
  const [categories, setCategories] = useState<BootstrapCategory[]>([]);
  const [items, setItems] = useState<BootstrapItem[]>([]);
  const [inventory, setInventory] = useState<InventoryEntryItem[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenRequest[]>([]);
  const [myBids, setMyBids] = useState<MatchCandidate[]>([]);
  const [transactions, setTransactions] = useState<WorkflowTransaction[]>([]);
  const [workflowBusyId, setWorkflowBusyId] = useState<string | null>(null);
  const [signingTransaction, setSigningTransaction] = useState<WorkflowTransaction | null>(null);
  const [inventoryStatusBusyId, setInventoryStatusBusyId] = useState<string | null>(null);
  const [bidTarget, setBidTarget] = useState<OpenRequest | null>(null);
  const [openRequestsPage, setOpenRequestsPage] = useState(1);
  const [myBidsPage, setMyBidsPage] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [openRequestsQuery, setOpenRequestsQuery] = useState('');
  const [openRequestsStatusFilter, setOpenRequestsStatusFilter] = useState('ALL');
  const [openRequestsCurrencyFilter, setOpenRequestsCurrencyFilter] = useState('ALL');
  const [myBidsQuery, setMyBidsQuery] = useState('');
  const [myBidsStatusFilter, setMyBidsStatusFilter] = useState('ALL');
  const [myBidsCurrencyFilter, setMyBidsCurrencyFilter] = useState('ALL');
  const [myBidsStageFilter, setMyBidsStageFilter] = useState('ALL');
  const [transactionsQuery, setTransactionsQuery] = useState('');
  const [transactionsStatusFilter, setTransactionsStatusFilter] = useState('ALL');
  const [transactionsPaymentFilter, setTransactionsPaymentFilter] = useState('ALL');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('ALL');
  const [inventoryCurrencyFilter, setInventoryCurrencyFilter] = useState('ALL');

  const hasFactoryBidForRequest = useMemo(() => {
    return new Set(myBids.map((bid) => bid.request_id));
  }, [myBids]);

  const openRequestStatusOptions = useMemo(
    () => Array.from(new Set(openRequests.map((row) => row.status))).sort(),
    [openRequests]
  );
  const openRequestCurrencyOptions = useMemo(
    () => Array.from(new Set(openRequests.map((row) => row.preferred_currency_code))).sort(),
    [openRequests]
  );
  const myBidStatusOptions = useMemo(
    () => Array.from(new Set(myBids.map((bid) => bid.status))).sort(),
    [myBids]
  );
  const myBidCurrencyOptions = useMemo(
    () => Array.from(new Set(myBids.map((bid) => bid.currency_code))).sort(),
    [myBids]
  );
  const transactionStatusOptions = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.status))).sort(),
    [transactions]
  );
  const transactionPaymentOptions = useMemo(
    () => Array.from(new Set(transactions.map((tx) => tx.payment_status))).sort(),
    [transactions]
  );
  const inventoryStatusOptions = useMemo(
    () => Array.from(new Set(inventory.map((entry) => entry.status))).sort(),
    [inventory]
  );
  const inventoryCurrencyOptions = useMemo(
    () => Array.from(new Set(inventory.map((entry) => entry.currency_code))).sort(),
    [inventory]
  );

  const filteredOpenRequests = useMemo(() => {
    const q = openRequestsQuery.trim().toLowerCase();
    return openRequests.filter((row) => {
      const matchesQuery =
        !q ||
        (row.item_name ?? '').toLowerCase().includes(q) ||
        (row.requested_name_text ?? '').toLowerCase().includes(q) ||
        (row.category_name ?? '').toLowerCase().includes(q);
      const matchesStatus =
        openRequestsStatusFilter === 'ALL' || row.status === openRequestsStatusFilter;
      const matchesCurrency =
        openRequestsCurrencyFilter === 'ALL' ||
        row.preferred_currency_code === openRequestsCurrencyFilter;
      return matchesQuery && matchesStatus && matchesCurrency;
    });
  }, [openRequests, openRequestsQuery, openRequestsStatusFilter, openRequestsCurrencyFilter]);

  const filteredMyBids = useMemo(() => {
    const q = myBidsQuery.trim().toLowerCase();
    return myBids.filter((bid) => {
      const stage = bid.logistic_offer_id ? 'COMPLETE' : 'FACTORY_ONLY';
      const matchesQuery = !q || (bid.item_name ?? '').toLowerCase().includes(q);
      const matchesStatus = myBidsStatusFilter === 'ALL' || bid.status === myBidsStatusFilter;
      const matchesCurrency =
        myBidsCurrencyFilter === 'ALL' || bid.currency_code === myBidsCurrencyFilter;
      const matchesStage = myBidsStageFilter === 'ALL' || stage === myBidsStageFilter;
      return matchesQuery && matchesStatus && matchesCurrency && matchesStage;
    });
  }, [myBids, myBidsQuery, myBidsStatusFilter, myBidsCurrencyFilter, myBidsStageFilter]);

  const filteredTransactions = useMemo(() => {
    const q = transactionsQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      const matchesQuery = !q || tx.id.toLowerCase().includes(q) || (tx.item_name ?? '').toLowerCase().includes(q);
      const matchesStatus =
        transactionsStatusFilter === 'ALL' || tx.status === transactionsStatusFilter;
      const matchesPayment =
        transactionsPaymentFilter === 'ALL' || tx.payment_status === transactionsPaymentFilter;
      return matchesQuery && matchesStatus && matchesPayment;
    });
  }, [transactions, transactionsQuery, transactionsStatusFilter, transactionsPaymentFilter]);

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    return inventory.filter((entry) => {
      const matchesQuery = !q || entry.item_name.toLowerCase().includes(q);
      const matchesStatus = inventoryStatusFilter === 'ALL' || entry.status === inventoryStatusFilter;
      const matchesCurrency =
        inventoryCurrencyFilter === 'ALL' || entry.currency_code === inventoryCurrencyFilter;
      return matchesQuery && matchesStatus && matchesCurrency;
    });
  }, [inventory, inventoryQuery, inventoryStatusFilter, inventoryCurrencyFilter]);

  const openRequestsTotalPages = Math.max(1, Math.ceil(filteredOpenRequests.length / TABLE_PAGE_SIZE));
  const myBidsTotalPages = Math.max(1, Math.ceil(filteredMyBids.length / TABLE_PAGE_SIZE));
  const transactionsTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / TABLE_PAGE_SIZE));
  const inventoryTotalPages = Math.max(1, Math.ceil(filteredInventory.length / TABLE_PAGE_SIZE));

  const paginatedOpenRequests = useMemo(() => {
    const start = (openRequestsPage - 1) * TABLE_PAGE_SIZE;
    return filteredOpenRequests.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredOpenRequests, openRequestsPage]);

  const paginatedMyBids = useMemo(() => {
    const start = (myBidsPage - 1) * TABLE_PAGE_SIZE;
    return filteredMyBids.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredMyBids, myBidsPage]);

  const paginatedTransactions = useMemo(() => {
    const start = (transactionsPage - 1) * TABLE_PAGE_SIZE;
    return filteredTransactions.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTransactions, transactionsPage]);

  const paginatedInventory = useMemo(() => {
    const start = (inventoryPage - 1) * TABLE_PAGE_SIZE;
    return filteredInventory.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredInventory, inventoryPage]);

  useEffect(() => {
    if (openRequestsPage > openRequestsTotalPages) setOpenRequestsPage(openRequestsTotalPages);
  }, [openRequestsPage, openRequestsTotalPages]);

  useEffect(() => {
    if (myBidsPage > myBidsTotalPages) setMyBidsPage(myBidsTotalPages);
  }, [myBidsPage, myBidsTotalPages]);

  useEffect(() => {
    if (transactionsPage > transactionsTotalPages) setTransactionsPage(transactionsTotalPages);
  }, [transactionsPage, transactionsTotalPages]);

  useEffect(() => {
    if (inventoryPage > inventoryTotalPages) setInventoryPage(inventoryTotalPages);
  }, [inventoryPage, inventoryTotalPages]);

  const [factoryCategoryText, setFactoryCategoryText] = useState('');
  const [factoryCategoryId, setFactoryCategoryId] = useState('');
  const [itemText, setItemText] = useState('');
  const [itemId, setItemId] = useState('');
  const [unitText, setUnitText] = useState('pcs');
  const [unitId, setUnitId] = useState('pcs');
  const [stockAddressId, setStockAddressId] = useState('');
  const [useManualStockAddress, setUseManualStockAddress] = useState(false);
  const [stockCountryCode, setStockCountryCode] = useState('');
  const [stockRegionName, setStockRegionName] = useState('');
  const [stockCityName, setStockCityName] = useState('');
  const [stockStreet, setStockStreet] = useState('');
  const [quantityAvailable, setQuantityAvailable] = useState('500');
  const [pricePerUnit, setPricePerUnit] = useState('25');
  const [currencyCode, setCurrencyCode] = useState('USD');

  async function refreshInventory() {
    const entries = await listMyInventoryEntries();
    setInventory(entries);
  }

  async function refreshBids() {
    const bids = await listMyFactoryBids();
    setMyBids(bids);
  }

  async function refreshOpenRequests() {
    const rows = await getOpenRequests();
    setOpenRequests(rows);
  }

  async function refreshTransactions() {
    const rows = await listMyTransactions();
    setTransactions(rows);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadPage() {
      setLoading(true);
      setError(null);
      try {
        const auth = await me();
        if (auth.user.role !== 'FACTORY') {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        const [bootstrap, entries, open, bids, txRows] = await Promise.all([
          getRequestsBootstrap(),
          listMyInventoryEntries(),
          getOpenRequests(),
          listMyFactoryBids(),
          listMyTransactions(),
        ]);
        if (cancelled) return;
        setCategories(bootstrap.categories);
        setItems(bootstrap.items);
        setAddresses(bootstrap.addresses);
        setCountries(bootstrap.countries ?? []);
        setCurrencies(bootstrap.currencies);
        setInventory(entries);
        setOpenRequests(open);
        setMyBids(bids);
        setTransactions(txRows);
        if (bootstrap.user.primary_address_id) {
          setStockAddressId(bootstrap.user.primary_address_id);
        } else if (bootstrap.addresses[0]) {
          setStockAddressId(bootstrap.addresses[0].id);
        }
        if (bootstrap.user.registration_country_code) {
          setStockCountryCode(bootstrap.user.registration_country_code);
        } else if (bootstrap.countries[0]) {
          setStockCountryCode(bootstrap.countries[0].code);
        }
        if (bootstrap.user.registration_address) {
          setStockStreet(bootstrap.user.registration_address);
        }
        if (bootstrap.currencies[0]) setCurrencyCode(bootstrap.currencies[0].code);
      } catch (loadError) {
        if (cancelled) return;
        if (loadError instanceof ApiError && loadError.status === 401) {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Failed to load workspace');
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

  async function handleCreateInventory(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const quantity = Number(quantityAvailable);
    const price = Number(pricePerUnit);
    if (!itemId && !itemText.trim()) {
      setError('Please enter item name');
      return;
    }
    // Strip star prefix as safety net (shouldn't happen but guard it)
    const safeItemText = itemText.startsWith('★ ') ? itemText.slice(2) : itemText;
    if (!factoryCategoryText.trim()) {
      setError('Please choose or type a category');
      return;
    }
    if (!unitText.trim()) {
      setError('Please choose or type a unit');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Quantity must be > 0');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Price per unit must be > 0');
      return;
    }
    setSubmitting(true);
    try {
      await createInventoryEntry({
        item_id: itemId || undefined,
        item_name: !itemId ? safeItemText.trim() : undefined,
        category_id: !itemId ? factoryCategoryId : undefined,
        category_name_text: !itemId ? factoryCategoryText.trim() : undefined,
        unit: unitText.trim(),
        stock_address_id: !useManualStockAddress ? stockAddressId : undefined,
        stock_country_code: useManualStockAddress ? stockCountryCode : undefined,
        stock_region_name: useManualStockAddress ? stockRegionName.trim() : undefined,
        stock_city_name: useManualStockAddress ? stockCityName.trim() : undefined,
        stock_street: useManualStockAddress ? stockStreet.trim() : undefined,
        quantity_available: quantity,
        price_per_unit: price,
        currency_code: currencyCode,
      });
      setSuccess('Inventory entry created');
      setItemText('');
      setItemId('');
      setFactoryCategoryText('');
      setFactoryCategoryId('');
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create inventory entry');
    } finally {
      setSubmitting(false);
    }
  }

  // ── derived options ────────────────────────────────────────────────────────
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const categoryOptions = useMemo<ComboboxOption[]>(
    () =>
      categories.map((c) => ({
        id: c.id,
        label: c.name,
      })),
    [categories]
  );
  const itemSuggestions = useMemo<ComboboxOption[]>(() => {
    const pool = factoryCategoryId
      ? items.filter((i) => i.category_id === factoryCategoryId)
      : items;
    return pool.map((i) => ({
      id: i.id,
      label: i.name,
      sublabel: categoryNameById.get(i.category_id) ?? '',
    }));
  }, [items, factoryCategoryId, categoryNameById]);

  // Suggestions derived from open customer requests
  const requestItemSuggestions = useMemo<ComboboxOption[]>(() => {
    const seen = new Set<string>();
    const out: ComboboxOption[] = [];
    for (const req of openRequests) {
      const name = req.item_name ?? req.requested_name_text;
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ id: `req:${req.id}`, label: `★ ${name}` });
    }
    return out;
  }, [openRequests]);

  // Merged item name options: request-derived first, then catalogue
  const itemNameOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Set<string>();
    const merged: ComboboxOption[] = [];
    for (const opt of requestItemSuggestions) {
      const key = opt.label.replace(/^★\s*/, '').toLowerCase();
      seen.add(key);
      merged.push(opt);
    }
    for (const opt of itemSuggestions) {
      if (!seen.has(opt.label.toLowerCase())) {
        merged.push(opt);
      }
    }
    return merged;
  }, [requestItemSuggestions, itemSuggestions]);

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
    setFactoryCategoryText(text);
    setFactoryCategoryId(id);
    if (itemId) {
      const sel = items.find((i) => i.id === itemId);
      if (sel && id && sel.category_id !== id) setItemId('');
    }
  }

  function handleItemChange(text: string, id: string) {
    const cleanText = text.startsWith('★ ') ? text.slice(2) : text;
    // Request-derived suggestion: id starts with 'req:'
    if (id.startsWith('req:')) {
      setItemText(cleanText);
      setItemId('');
      // Try to find a matching catalogue item by name
      const match = items.find((i) => i.name.toLowerCase() === cleanText.toLowerCase());
      if (match) {
        setItemId(match.id);
        if (match.category_id) {
          setFactoryCategoryId(match.category_id);
          setFactoryCategoryText(categoryNameById.get(match.category_id) ?? '');
        }
        if (match.unit) {
          setUnitText(match.unit);
          setUnitId(match.unit);
        }
      }
      return;
    }
    setItemText(cleanText);
    setItemId(id);
    if (id) {
      const sel = items.find((i) => i.id === id);
      if (sel?.category_id) {
        setFactoryCategoryId(sel.category_id);
        setFactoryCategoryText(categoryNameById.get(sel.category_id) ?? '');
      }
      if (sel?.unit) {
        setUnitText(sel.unit);
        setUnitId(sel.unit);
      }
    }
  }

  function handleUnitChange(text: string, id: string) {
    setUnitText(text);
    setUnitId(id);
  }

  const BID_STATUS: Record<string, string> = {
    PENDING: 'text-amber-300',
    ACCEPTED: 'text-emerald-300',
    REJECTED: 'text-red-400',
    EXPIRED: 'text-[rgb(var(--muted))]',
  };

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
      await Promise.all([refreshTransactions(), refreshBids(), refreshOpenRequests()]);
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
      await Promise.all([refreshTransactions(), refreshBids(), refreshOpenRequests()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow action failed');
    } finally {
      setWorkflowBusyId(null);
    }
  }

  async function handleToggleInventoryStatus(entryId: string, currentStatus: string) {
    setError(null);
    setSuccess(null);
    const nextStatus: 'ACTIVE' | 'PAUSED' = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setInventoryStatusBusyId(entryId);
    try {
      await updateInventoryEntryStatus(entryId, nextStatus);
      await refreshInventory();
      setSuccess(`Inventory status updated to ${nextStatus}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory status');
    } finally {
      setInventoryStatusBusyId(null);
    }
  }

  return (
    <main
      className={`${THEME_CLASSES[theme]} min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))]"
          >
            <PresetIcon src="/presets/factory.svg" alt="Factory workspace" size={32} className="rounded-md" />
            <span>{copy.brand}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher currentLocale={locale} basePath="/app/factory" />
            <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} />
            <button type="button" onClick={handleLogout} className="btn btn-ghost text-sm">
              {copy.logout}
            </button>
          </div>
        </header>

        {loading && <p className="text-sm text-[rgb(var(--muted))]">Loading workspace\u2026</p>}
        {error && (
          <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
        )}

        {!loading && (
          <>
            {/* ── Open Requests (PENDING) ─────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h1 className="slide-up text-2xl font-semibold sm:text-3xl">{copy.factoryWorkspaceTitle}</h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                {copy.factoryWorkspaceSubtitle}
              </p>

              <h2 className="mt-6 text-lg font-semibold">{copy.openRequestsTitle}</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {copy.openRequestsSubtitle}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={openRequestsQuery}
                  onChange={(e) => setOpenRequestsQuery(e.target.value)}
                  placeholder="Search item/category"
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <select
                  value={openRequestsStatusFilter}
                  onChange={(e) => setOpenRequestsStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">All statuses</option>
                  {openRequestStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={openRequestsCurrencyFilter}
                  onChange={(e) => setOpenRequestsCurrencyFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">All currencies</option>
                  {openRequestCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

              {filteredOpenRequests.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {openRequests.length === 0
                    ? 'No open requests at this time.'
                    : 'No requests match current filters.'}
                </p>
              ) : (
                <>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-4">{copy.colItemDescription}</th>
                        <th className="py-2 pr-4">{copy.colCategory}</th>
                        <th className="py-2 pr-4">{copy.colQty}</th>
                        <th className="py-2 pr-4">{copy.colCurrency}</th>
                        <th className="py-2 pr-4">{copy.colStatus}</th>
                        <th className="py-2 pr-4">{copy.colPlaced}</th>
                        <th className="py-2">{copy.colAction}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedOpenRequests.map((row) => {
                        const hasBid = hasFactoryBidForRequest.has(row.id);
                        return (
                        <tr key={row.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4 font-medium">
                            {row.item_name ?? row.requested_name_text ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {row.category_name ?? '\u2014'}
                          </td>
                          <td className="py-2 pr-4">
                            {formatQuantityWithUnit(row.quantity, row.quantity_unit)}
                          </td>
                          <td className="py-2 pr-4">{row.preferred_currency_code}</td>
                          <td className={`py-2 pr-4 ${row.status === 'PAIRING_IN_PROGRESS' ? 'text-sky-300' : ''}`}>
                            {row.status}
                          </td>
                          <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="py-2">
                            {inventory.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setBidTarget(row)}
                                className="rounded-md border border-sky-700/60 px-3 py-1 text-xs text-sky-300 hover:bg-sky-950/30"
                              >
                                {hasBid ? copy.actionBid : copy.actionBid}
                              </button>
                            ) : (
                              <span className="text-xs text-[rgb(var(--muted))]">
                                Add inventory first
                              </span>
                            )}
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                  <span>
                    Showing {(openRequestsPage - 1) * TABLE_PAGE_SIZE + 1}
                    {' - '}
                    {Math.min(openRequestsPage * TABLE_PAGE_SIZE, filteredOpenRequests.length)} of{' '}
                    {filteredOpenRequests.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={openRequestsPage <= 1}
                      onClick={() => setOpenRequestsPage((prev) => Math.max(1, prev - 1))}
                      className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span>
                      Page {openRequestsPage} / {openRequestsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={openRequestsPage >= openRequestsTotalPages}
                      onClick={() =>
                        setOpenRequestsPage((prev) => Math.min(openRequestsTotalPages, prev + 1))
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

            {/* ── My Bids ─────────────────────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold">{copy.myBidsTitle}</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {copy.myBidsSubtitle}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <input
                  type="text"
                  value={myBidsQuery}
                  onChange={(e) => setMyBidsQuery(e.target.value)}
                  placeholder="Search item"
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <select
                  value={myBidsStatusFilter}
                  onChange={(e) => setMyBidsStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">All statuses</option>
                  {myBidStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <select
                  value={myBidsCurrencyFilter}
                  onChange={(e) => setMyBidsCurrencyFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">All currencies</option>
                  {myBidCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
                <select
                  value={myBidsStageFilter}
                  onChange={(e) => setMyBidsStageFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">All stages</option>
                  <option value="FACTORY_ONLY">Factory bid only</option>
                  <option value="COMPLETE">Complete proposal</option>
                </select>
              </div>

              {filteredMyBids.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {myBids.length === 0 ? 'No bids yet.' : 'No bids match current filters.'}
                </p>
              ) : (
                <>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                        <th className="py-2 pr-4">{copy.colItem}</th>
                        <th className="py-2 pr-4">{copy.colQtyOffered}</th>
                        <th className="py-2 pr-4">{copy.colPriceUnit}</th>
                        <th className="py-2 pr-4">{copy.colCurrency}</th>
                        <th className="py-2 pr-4">{copy.colDelivery}</th>
                        <th className="py-2 pr-4">{copy.colTotalCost}</th>
                        <th className="py-2 pr-4">{copy.colStatus}</th>
                        <th className="py-2">{copy.colStage}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMyBids.map((bid) => (
                        <tr key={bid.id} className="border-b border-[rgb(var(--stroke))]/40">
                          <td className="py-2 pr-4">{bid.item_name ?? '\u2014'}</td>
                          <td className="py-2 pr-4">
                            {formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)}
                          </td>
                          <td className="py-2 pr-4">{bid.inventory_price_per_unit ?? '\u2014'}</td>
                          <td className="py-2 pr-4">{bid.currency_code}</td>
                          <td className="py-2 pr-4">
                            {bid.logistic_offer_id ? (
                              `${bid.delivery_days}d \u2022 ${bid.delivery_price} ${bid.currency_code}`
                            ) : (
                              <span className="text-xs text-amber-300">awaiting logistics</span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {bid.total_cost ? `${bid.total_cost} ${bid.currency_code}` : '\u2014'}
                          </td>
                          <td className={`py-2 pr-4 ${BID_STATUS[bid.status] ?? ''}`}>
                            {bid.status}
                          </td>
                          <td className="py-2 text-xs text-[rgb(var(--muted))]">
                            {bid.logistic_offer_id ? 'Complete proposal' : 'Factory bid only'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                  <span>
                    Showing {(myBidsPage - 1) * TABLE_PAGE_SIZE + 1}
                    {' - '}
                    {Math.min(myBidsPage * TABLE_PAGE_SIZE, filteredMyBids.length)} of{' '}
                    {filteredMyBids.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={myBidsPage <= 1}
                      onClick={() => setMyBidsPage((prev) => Math.max(1, prev - 1))}
                      className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span>
                      Page {myBidsPage} / {myBidsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={myBidsPage >= myBidsTotalPages}
                      onClick={() => setMyBidsPage((prev) => Math.min(myBidsTotalPages, prev + 1))}
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
                Sign selected contracts, then start and progress fulfillment after payment is
                confirmed.
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
                  {transactionStatusOptions.map((status) => (
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
                  {transactionPaymentOptions.map((payment) => (
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
                                  {workflowBusyId === tx.id + 'START'
                                    ? 'Submitting...'
                                    : 'Given to logist'}
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
                                    ? 'Updating...'
                                    : 'In Progress'}
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
                        setTransactionsPage((prev) =>
                          Math.min(transactionsTotalPages, prev + 1)
                        )
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

            {/* ── Add Inventory ────────────────────────────────────────── */}
            <section className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 className="text-lg font-semibold">{copy.addInventoryTitle}</h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {copy.addInventorySubtitle}
              </p>
              {success && (
                <p className="mt-3 rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
                  {success}
                </p>
              )}

              <form onSubmit={handleCreateInventory} className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <SearchableInput
                    suggestions={categoryOptions}
                    text={factoryCategoryText}
                    selectedId={factoryCategoryId}
                    onChange={handleCategoryChange}
                    placeholder="Type category or choose existing"
                    label="Category"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <SearchableInput
                    suggestions={itemNameOptions}
                    text={itemText}
                    selectedId={itemId}
                    onChange={handleItemChange}
                    placeholder={
                      factoryCategoryId
                        ? `Type item in ${categoryNameById.get(factoryCategoryId) ?? 'category'}…`
                        : 'Type item name (existing or brand-new)'
                    }
                    label="Item name"
                    required
                  />
                  {requestItemSuggestions.length > 0 && (
                    <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                      ★ {requestItemSuggestions.length} item{requestItemSuggestions.length !== 1 ? 's' : ''} wanted by customers
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <SearchableInput
                    suggestions={unitSuggestions}
                    text={unitText}
                    selectedId={unitId}
                    onChange={handleUnitChange}
                    placeholder="Choose or type unit (kg, liters, pcs)"
                    label="Unit"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    {copy.stockAddressLabel}
                  </label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setUseManualStockAddress(false)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        !useManualStockAddress
                          ? 'border-sky-700/80 text-sky-300'
                          : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                      }`}
                    >
                      Choose existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseManualStockAddress(true)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        useManualStockAddress
                          ? 'border-sky-700/80 text-sky-300'
                          : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                      }`}
                    >
                      Provide yourself
                    </button>
                  </div>

                  {!useManualStockAddress ? (
                    <select
                      value={stockAddressId}
                      onChange={(e) => setStockAddressId(e.target.value)}
                      className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
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
                        value={stockCountryCode}
                        onChange={(e) => setStockCountryCode(e.target.value)}
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
                        value={stockRegionName}
                        onChange={(e) => setStockRegionName(e.target.value)}
                        className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        placeholder="Region"
                        required
                      />
                      <input
                        value={stockCityName}
                        onChange={(e) => setStockCityName(e.target.value)}
                        className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                        placeholder="City"
                        required
                      />
                      <input
                        value={stockStreet}
                        onChange={(e) => setStockStreet(e.target.value)}
                        className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm sm:col-span-2"
                        placeholder="Address / Street"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    {copy.qtyAvailableLabel}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityAvailable}
                    onChange={(e) => setQuantityAvailable(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
                    {copy.pricePerUnitLabel}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    required
                  />
                </div>

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

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary sm:col-span-2 text-sm"
                >
                  {submitting ? 'Creating\u2026' : copy.addInventoryAction}
                </button>
              </form>

              {/* My inventory list */}
              {inventory.length > 0 && (
                <>
                <div className="mt-6 grid gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    value={inventoryQuery}
                    onChange={(e) => setInventoryQuery(e.target.value)}
                    placeholder="Search item"
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  />
                  <select
                    value={inventoryStatusFilter}
                    onChange={(e) => setInventoryStatusFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">All statuses</option>
                    {inventoryStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={inventoryCurrencyFilter}
                    onChange={(e) => setInventoryCurrencyFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">All currencies</option>
                    {inventoryCurrencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredInventory.length === 0 ? (
                  <p className="mt-3 text-sm text-[rgb(var(--muted))]">No inventory matches current filters.</p>
                ) : (
                  <>
                  <div className="mt-6 overflow-x-auto">
                    <h3 className="mb-2 text-sm font-medium text-[rgb(var(--muted))]">
                      Current inventory
                    </h3>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[rgb(var(--stroke))] text-[rgb(var(--muted))]">
                          <th className="py-2 pr-3">{copy.colItem}</th>
                          <th className="py-2 pr-3">{copy.colQty}</th>
                          <th className="py-2 pr-3">{copy.pricePerUnitLabel}</th>
                          <th className="py-2 pr-3">{copy.colCurrency}</th>
                          <th className="py-2 pr-3">{copy.colStatus}</th>
                          <th className="py-2">{copy.colAction}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInventory.map((e) => (
                          <tr key={e.id} className="border-b border-[rgb(var(--stroke))]/40">
                            <td className="py-2 pr-3">{e.item_name}</td>
                            <td className="py-2 pr-3">
                              {formatQuantityWithUnit(e.quantity_available, e.unit)}
                            </td>
                            <td className="py-2 pr-3">{e.price_per_unit}</td>
                            <td className="py-2 pr-3">{e.currency_code}</td>
                            <td className="py-2 pr-3">{e.status}</td>
                            <td className="py-2">
                              <button
                                type="button"
                                disabled={inventoryStatusBusyId === e.id}
                                onClick={() => void handleToggleInventoryStatus(e.id, e.status)}
                                className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
                                  e.status === 'ACTIVE'
                                    ? 'border-amber-700/60 text-amber-300 hover:bg-amber-950/30'
                                    : 'border-emerald-700/60 text-emerald-300 hover:bg-emerald-950/30'
                                }`}
                              >
                                {inventoryStatusBusyId === e.id
                                  ? 'Updating...'
                                  : e.status === 'ACTIVE'
                                    ? copy.actionPause
                                    : copy.actionActivate}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                    <span>
                      Showing {(inventoryPage - 1) * TABLE_PAGE_SIZE + 1}
                      {' - '}
                      {Math.min(inventoryPage * TABLE_PAGE_SIZE, filteredInventory.length)} of{' '}
                      {filteredInventory.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={inventoryPage <= 1}
                        onClick={() => setInventoryPage((prev) => Math.max(1, prev - 1))}
                        className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <span>
                        Page {inventoryPage} / {inventoryTotalPages}
                      </span>
                      <button
                        type="button"
                        disabled={inventoryPage >= inventoryTotalPages}
                        onClick={() =>
                          setInventoryPage((prev) => Math.min(inventoryTotalPages, prev + 1))
                        }
                        className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  </>
                )}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {bidTarget && (
        <BidModal
          request={bidTarget}
          inventory={inventory}
          copy={copy}
          onClose={() => setBidTarget(null)}
          onBidPlaced={async () => {
            await Promise.all([refreshBids(), refreshOpenRequests()]);
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
