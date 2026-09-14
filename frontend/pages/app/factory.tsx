import FactorySetup from '../../components/FactorySetup';
import { categoryCopy } from '../../lib/categoryCopy';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import WorkspaceExperience from '../../components/WorkspaceExperience';
import { workspacePath } from '../../lib/navigation';
import Modal from '../../components/Modal';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../lib/authClient';

import AgreementSignModal from '../../components/AgreementSignModal';
import Combobox, { type ComboboxOption } from '../../components/Combobox';
import {
  advanceTransactionFulfillment,
  type ContractSigningPayload,
  createFactoryBid,
  getOpenRequests,
  listMyTransactions,
  listMyFactoryBids,
  listMyInventoryEntries,
  logout,
  me,
  signTransaction,
  updateInventoryEntryStatus,
  type InventoryEntryItem,
  type MatchCandidate,
  type OpenRequest,
  type WorkflowTransaction,
} from '../../lib/authClient';
import { formatQuantityWithUnit } from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';

const TABLE_PAGE_SIZE = 5;

type BidModalProps = {
  request: OpenRequest;
  inventory: InventoryEntryItem[];
  copy: ReturnType<typeof t>;
  onClose: () => void;
  onBidPlaced: () => Promise<void>;
};

function BidModal({ request, inventory, copy, onClose: onDismiss, onBidPlaced }: BidModalProps) {
  const { dialogId, onClose } = useModalDismiss(onDismiss);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inventoryId, setInventoryId] = useState(inventory[0]?.id ?? '');
  const quotedQty = request.quantity;
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
    <Modal
      id={dialogId}
      onClose={onClose}
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
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
              readOnly
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
            <p role="alert" className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
            >
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
    </Modal>
  );
}

export default function FactoryWorkspacePage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [eligibleInventory, setEligibleInventory] = useState<string[]>([]);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [setupRevision, setSetupRevision] = useState(0);
  const handleReadiness = useCallback((ids: string[]) => {
    setEligibleInventory(ids);
    setSetupLoaded(true);
  }, []);
  useEffect(() => {
    if (setupLoaded && !eligibleInventory.length && router.isReady && !router.query.view) {
      void router.replace(
        { pathname: router.pathname, query: { ...router.query, view: 'inventory' } },
        undefined,
        { shallow: true }
      );
    }
  }, [setupLoaded, eligibleInventory.length, router]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const matchesQuery =
        !q || tx.id.toLowerCase().includes(q) || (tx.item_name ?? '').toLowerCase().includes(q);
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
      const matchesStatus =
        inventoryStatusFilter === 'ALL' || entry.status === inventoryStatusFilter;
      const matchesCurrency =
        inventoryCurrencyFilter === 'ALL' || entry.currency_code === inventoryCurrencyFilter;
      return matchesQuery && matchesStatus && matchesCurrency;
    });
  }, [inventory, inventoryQuery, inventoryStatusFilter, inventoryCurrencyFilter]);

  const openRequestsTotalPages = Math.max(
    1,
    Math.ceil(filteredOpenRequests.length / TABLE_PAGE_SIZE)
  );
  const myBidsTotalPages = Math.max(1, Math.ceil(filteredMyBids.length / TABLE_PAGE_SIZE));
  const transactionsTotalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / TABLE_PAGE_SIZE)
  );
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

  useEffect(() => {
    if (eligibleInventory.length)
      void listMyInventoryEntries()
        .then(setInventory)
        .catch(() => setError(categoryCopy(locale).error));
  }, [eligibleInventory, locale]);

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
          await router.replace(workspacePath(auth.user.role, locale));
          return;
        }
        const [entries, open, bids, txRows] = await Promise.all([
          listMyInventoryEntries(),
          getOpenRequests(),
          listMyFactoryBids(),
          listMyTransactions(),
        ]);
        if (cancelled) return;
        setInventory(entries);
        setOpenRequests(open);
        setMyBids(bids);
        setTransactions(txRows);
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
    try {
      await logout();
      await router.push(`/login?lang=${locale}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not log out. Please try again.');
    }
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
      setSetupRevision((v) => v + 1);
      await refreshInventory();
      setSuccess(`Inventory status updated to ${nextStatus}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory status');
    } finally {
      setInventoryStatusBusyId(null);
    }
  }

  return (
    <WorkspaceExperience
      role="factory"
      loading={loading}
      error={error}
      counts={[
        openRequests.length,
        inventory.length,
        transactions.filter((tx) => tx.status !== 'COMPLETED').length,
      ]}
      items={openRequests.map((row) => ({
        id: row.id,
        title: row.item_name ?? row.requested_name_text ?? 'Supply request',
        status: row.status,
        detail: `${row.quantity} ${row.quantity_unit} · ${row.preferred_currency_code}`,
        action: () =>
          eligibleInventory.length ? setBidTarget(row) : setError(categoryCopy(locale).blocked),
        actionLabel: 'Place a bid',
      }))}
      onLogout={handleLogout}
    >
      <div className="workspace-panels">
        {loading && <p className="text-sm text-[rgb(var(--muted))]">Loading workspace\u2026</p>}

        {!loading && (
          <>
            <FactorySetup locale={locale} onReady={handleReadiness} revision={setupRevision} />
            {/* Open Requests (PENDING) */}
            <section data-section="requests" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h1 className="slide-up text-2xl font-semibold sm:text-3xl">
                {copy.factoryWorkspaceTitle}
              </h1>
              <p className="mt-1 text-sm text-[rgb(var(--muted))]">
                {copy.factoryWorkspaceSubtitle}
              </p>

              <p>{categoryCopy(locale).whole}</p>
              {!eligibleInventory.length && <p>{categoryCopy(locale).blocked}</p>}
              <h2 id="requests" className="mt-6 text-lg font-semibold">
                {copy.openRequestsTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{copy.openRequestsSubtitle}</p>

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
                              <td
                                className={`py-2 pr-4 ${row.status === 'PAIRING_IN_PROGRESS' ? 'text-sky-300' : ''}`}
                              >
                                {row.status}
                              </td>
                              <td className="py-2 pr-4 text-xs text-[rgb(var(--muted))]">
                                {new Date(row.created_at).toLocaleString('en-GB', {
                                  timeZone: 'UTC',
                                })}
                              </td>
                              <td className="py-2">
                                {inventory.length > 0 ? (
                                  <button
                                    type="button"
                                    disabled={!eligibleInventory.length}
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--muted))]">
                    <span>
                      Showing {(openRequestsPage - 1) * TABLE_PAGE_SIZE + 1}
                      {' - '}
                      {Math.min(
                        openRequestsPage * TABLE_PAGE_SIZE,
                        filteredOpenRequests.length
                      )} of {filteredOpenRequests.length}
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

            {/* My Bids  */}
            <section data-section="bids" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="bids" className="text-lg font-semibold">
                {copy.myBidsTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{copy.myBidsSubtitle}</p>

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
                            <td className="py-2 pr-4">
                              {bid.inventory_price_per_unit ?? '\u2014'}
                            </td>
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
                        onClick={() =>
                          setMyBidsPage((prev) => Math.min(myBidsTotalPages, prev + 1))
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

            <section data-section="workflow" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="workflow" className="text-lg font-semibold">
                Contract & Fulfillment Workflow
              </h2>
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
                                    onClick={() =>
                                      void handleWorkflowAction(tx.id, 'MARK_IN_PROGRESS')
                                    }
                                    disabled={workflowBusyId === tx.id + 'MARK_IN_PROGRESS'}
                                    className="rounded-md border border-sky-700/60 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950/30 disabled:opacity-60"
                                  >
                                    {workflowBusyId === tx.id + 'MARK_IN_PROGRESS'
                                      ? 'Updating...'
                                      : 'In Progress'}
                                  </button>
                                )}
                                {!tx.can_sign &&
                                  !tx.can_start_fulfillment &&
                                  !tx.can_mark_in_progress && (
                                    <span className="text-xs text-[rgb(var(--muted))]">
                                      Awaiting others
                                    </span>
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
                      {Math.min(
                        transactionsPage * TABLE_PAGE_SIZE,
                        filteredTransactions.length
                      )} of {filteredTransactions.length}
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

            <section data-section="inventory" className="surface-1 rounded-2xl p-6 sm:p-8">
              {success && <p role="status">{success}</p>}
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
                    <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                      No inventory matches current filters.
                    </p>
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
                          {Math.min(
                            inventoryPage * TABLE_PAGE_SIZE,
                            filteredInventory.length
                          )} of {filteredInventory.length}
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
          inventory={inventory.filter((i) => eligibleInventory.includes(i.id))}
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
    </WorkspaceExperience>
  );
}
