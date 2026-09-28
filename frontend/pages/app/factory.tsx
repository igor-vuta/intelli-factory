import SelectField from '../../components/SelectField';
import GuidanceHint from '../../components/GuidanceHint';
import OrderGuidance from '../../components/OrderGuidance';
import { useActionConfirmation } from '../../hooks/useActionConfirmation';
import FactorySetup from '../../components/FactorySetup';
import { categoryCopy } from '../../lib/categoryCopy';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import WorkspaceExperience, { type WorkItem } from '../../components/WorkspaceExperience';
import SignatureList from '../../components/SignatureList';
import StatusBadge from '../../components/StatusBadge';
import RecordRow, { RecordDetail } from '../../components/RecordRow';
import { useExpandedRecords } from '../../hooks/useExpandedRecords';
import { orderFacts } from '../../lib/orderFacts';
import TablePager from '../../components/TablePager';
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
  updateInventoryEntry,
  withdrawFactoryBid,
  updateInventoryEntryStatus,
  type InventoryEntryItem,
  type MatchCandidate,
  type OpenRequest,
  type WorkflowTransaction,
} from '../../lib/authClient';
import { formatDateTime, formatMoney, formatQuantityWithUnit } from '../../lib/formatting';
import { statusLabel } from '../../lib/status';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';

const TABLE_PAGE_SIZE = 5;
// A bid can be withdrawn while its request is still open to offers.
const WITHDRAWABLE = ['PENDING', 'PAIRING_IN_PROGRESS', 'PAUSED'];

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
    <Modal
      id={dialogId}
      onClose={onClose}
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div className="slide-up w-full max-w-lg rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{copy.placeBidTitle}</h2>
            <GuidanceHint hint="bid" />
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
              {copy.offeredQty} <span className="text-danger">*</span>
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
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
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
  const { confirm, confirmation } = useActionConfirmation();
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);
  const e = useExperienceCopy();

  // Factory readiness (FactorySetup): only stock in verified categories can be bid with.
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
  const [guidanceUserId, setGuidanceUserId] = useState('');
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
        setGuidanceUserId(auth.user.id);
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
      !(await confirm(action === 'START' ? 'Given to logist' : 'Mark in delivery'))
    )
      return;
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

  // What the factory can act on now, most urgent first: its signature, then hand-overs, then
  // requests it has not bid on yet. Permissions come from the API's can_* flags.
  const attention: WorkItem[] = [
    ...transactions
      .filter((tx) => tx.can_sign)
      .map((tx) => ({
        id: tx.id,
        title: tx.item_name ?? e('Order'),
        status: tx.status,
        detail: e('The contract is ready for your signature.'),
        action: () => void handleWorkflowAction(tx.id, 'SIGN'),
        actionLabel: 'Review and sign',
      })),
    ...transactions
      .filter((tx) => tx.can_start_fulfillment)
      .map((tx) => ({
        id: tx.id,
        title: tx.item_name ?? e('Order'),
        status: tx.status,
        detail: e('Paid. Hand the goods to the carrier when they are ready.'),
        action: () => void handleWorkflowAction(tx.id, 'START'),
        actionLabel: 'Given to logist',
      })),
    ...transactions
      .filter((tx) => tx.can_mark_in_progress)
      .map((tx) => ({
        id: tx.id,
        title: tx.item_name ?? e('Order'),
        status: tx.status,
        detail: e('The carrier has the goods. Mark the order as in delivery.'),
        action: () => void handleWorkflowAction(tx.id, 'MARK_IN_PROGRESS'),
        actionLabel: 'Mark in delivery',
      })),
    ...openRequests
      .filter((row) => !hasFactoryBidForRequest.has(row.id))
      .map((row) => ({
        id: row.id,
        title: row.item_name ?? row.requested_name_text ?? e('Supply request'),
        status: row.status,
        detail: `${formatQuantityWithUnit(row.quantity, row.quantity_unit)} · ${row.preferred_currency_code}`,
        ...(eligibleInventory.length
          ? { action: () => setBidTarget(row), actionLabel: 'Place a bid' }
          : { actionView: 'inventory', actionLabel: 'Add stock first' }),
      })),
  ];
  const statusOption = (status: string) => (
    <option key={status} value={status}>
      {statusLabel(locale, status)}
    </option>
  );

  const demandRecords = useExpandedRecords(
    filteredOpenRequests.map((row) => row.id),
    TABLE_PAGE_SIZE,
    setOpenRequestsPage
  );
  const bidRecords = useExpandedRecords(
    filteredMyBids.map((bid) => bid.id),
    TABLE_PAGE_SIZE,
    setMyBidsPage
  );
  const orderRecords = useExpandedRecords(
    filteredTransactions.map((tx) => tx.id),
    TABLE_PAGE_SIZE,
    setTransactionsPage
  );
  const stockRecords = useExpandedRecords(
    filteredInventory.map((entry) => entry.id),
    TABLE_PAGE_SIZE,
    setInventoryPage
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [stockEdit, setStockEdit] = useState<{
    id: string;
    quantity: string;
    price: string;
  } | null>(null);

  function openView(view: string, focus?: string, extra: Record<string, string> = {}) {
    const { add: _add, focus: _focus, ...query } = router.query;
    void _add;
    void _focus;
    void router.push(
      {
        pathname: router.pathname,
        query: { ...query, view, ...(focus ? { focus } : {}), ...extra },
      },
      undefined,
      { shallow: true, scroll: false }
    );
  }

  async function withdrawBid(candidateId: string) {
    if (busyId || !(await confirm('Withdraw my bid'))) return;
    setBusyId(candidateId);
    setError(null);
    try {
      await withdrawFactoryBid(candidateId);
      await Promise.all([refreshBids(), refreshOpenRequests()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not withdraw the bid');
    } finally {
      setBusyId(null);
    }
  }

  async function saveStock(entryId: string) {
    if (!stockEdit || busyId) return;
    setBusyId(entryId);
    setError(null);
    try {
      await updateInventoryEntry(entryId, {
        quantity_available: Number(stockEdit.quantity),
        price_per_unit: Number(stockEdit.price),
      });
      setStockEdit(null);
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the stock');
    } finally {
      setBusyId(null);
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
      guidance={
        guidanceUserId
          ? {
              userId: guidanceUserId,
              completed: [
                inventory.length > 0,
                myBids.length > 0,
                transactions.some(
                  (transaction) => transaction.signature_status.FACTORY === 'SIGNED'
                ),
                transactions.some((transaction) =>
                  ['FULFILLMENT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(transaction.status)
                ),
              ],
            }
          : undefined
      }
      loading={loading}
      error={error}
      counts={[
        openRequests.length,
        inventory.length,
        transactions.filter((tx) => tx.status !== 'COMPLETED').length,
      ]}
      items={attention}
      onLogout={handleLogout}
    >
      <div className="workspace-panels">
        {loading && <p className="text-sm text-[rgb(var(--muted))]">Loading workspace…</p>}

        {!loading && (
          <>
            <FactorySetup locale={locale} onReady={handleReadiness} revision={setupRevision} />
            {/* Demand board: open customer requests */}
            <section data-section="requests" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="requests" className="text-lg font-semibold">
                {copy.openRequestsTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{copy.openRequestsSubtitle}</p>
              <p className="mt-2 text-xs text-[rgb(var(--muted))]">{categoryCopy(locale).whole}</p>
              {!eligibleInventory.length && (
                <p className="mt-1 text-xs text-warning">{categoryCopy(locale).blocked}</p>
              )}

              <div className="table-filters">
                <input
                  type="search"
                  aria-label={e('Search item or category')}
                  value={openRequestsQuery}
                  onChange={(e) => setOpenRequestsQuery(e.target.value)}
                  placeholder={e('Search item or category')}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <SelectField
                  aria-label={e('Status')}
                  value={openRequestsStatusFilter}
                  onChange={(e) => setOpenRequestsStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All statuses')}</option>
                  {openRequestStatusOptions.map(statusOption)}
                </SelectField>
                <SelectField
                  aria-label={e('Currency')}
                  value={openRequestsCurrencyFilter}
                  onChange={(e) => setOpenRequestsCurrencyFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All currencies')}</option>
                  {openRequestCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </SelectField>
              </div>

              {filteredOpenRequests.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {openRequests.length === 0
                    ? e('No open requests at this time.')
                    : e('No requests match current filters.')}
                </p>
              ) : (
                <>
                  <div
                    className="record-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={copy.openRequestsTitle}
                  >
                    <table className="record-table">
                      <thead>
                        <tr>
                          <th>{e('Item')}</th>
                          <th>{e('Quantity')}</th>
                          <th>{e('Status')}</th>
                          <th>{e('Placed')}</th>
                          <th>
                            <span className="sr-only">{e('Action')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedOpenRequests.map((row) => {
                          const myBid = myBids.find(
                            (bid) => bid.request_id === row.id && !bid.logistic_offer_id
                          );
                          return (
                            <RecordRow
                              key={row.id}
                              id={row.id}
                              open={demandRecords.isOpen(row.id)}
                              onToggle={() => demandRecords.toggle(row.id)}
                              colSpan={5}
                              title={
                                row.item_name ?? row.requested_name_text ?? e('Supply request')
                              }
                              subtitle={<small>{row.category_name ?? ''}</small>}
                              detail={
                                <RecordDetail
                                  facts={[
                                    [e('Category'), row.category_name],
                                    [
                                      e('Quantity'),
                                      formatQuantityWithUnit(row.quantity, row.quantity_unit),
                                    ],
                                    [e('Currency'), row.preferred_currency_code],
                                    [e('Status'), statusLabel(locale, row.status)],
                                    [e('Placed'), formatDateTime(locale, row.created_at)],
                                    [
                                      e('Your bid'),
                                      myBid
                                        ? formatQuantityWithUnit(
                                            myBid.quoted_quantity,
                                            myBid.quantity_unit
                                          )
                                        : e('Not yet'),
                                    ],
                                  ]}
                                  actions={
                                    <>
                                      {eligibleInventory.length > 0 ? (
                                        <button
                                          type="button"
                                          onClick={() => setBidTarget(row)}
                                          className="if-button if-button-primary"
                                        >
                                          {myBid ? e('Bid with other stock') : copy.actionBid}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openView('inventory', undefined, { add: '1' })
                                          }
                                          className="if-button if-button-primary"
                                        >
                                          {e('Add inventory first')}
                                        </button>
                                      )}
                                      {myBid && (
                                        <button
                                          type="button"
                                          className="if-button"
                                          onClick={() => openView('bids', myBid.id)}
                                        >
                                          {e('See my bid')}
                                        </button>
                                      )}
                                      {myBid && myBid.status === 'PENDING' && (
                                        <button
                                          type="button"
                                          className="if-button is-danger"
                                          disabled={busyId !== null}
                                          onClick={() => void withdrawBid(myBid.id)}
                                        >
                                          {e('Withdraw my bid')}
                                        </button>
                                      )}
                                    </>
                                  }
                                />
                              }
                            >
                              <td data-label={e('Quantity')} className="num">
                                {formatQuantityWithUnit(row.quantity, row.quantity_unit)}
                                <small>{row.preferred_currency_code}</small>
                              </td>
                              <td data-label={e('Status')}>
                                <StatusBadge status={row.status} />
                                {hasFactoryBidForRequest.has(row.id) && (
                                  <small>{e('You have bid')}</small>
                                )}
                              </td>
                              <td data-label={e('Placed')}>
                                {formatDateTime(locale, row.created_at)}
                              </td>
                              <td className="record-actions">
                                {eligibleInventory.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => setBidTarget(row)}
                                    className="if-button if-button-primary"
                                  >
                                    {copy.actionBid}
                                  </button>
                                ) : (
                                  <span className="text-xs text-[rgb(var(--muted))]">
                                    {e('Add inventory first')}
                                  </span>
                                )}
                              </td>
                            </RecordRow>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePager
                    page={openRequestsPage}
                    pageSize={TABLE_PAGE_SIZE}
                    total={filteredOpenRequests.length}
                    onPage={setOpenRequestsPage}
                  />
                </>
              )}
            </section>

            {/* My bids */}
            <section data-section="bids" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="bids" className="text-lg font-semibold">
                {copy.myBidsTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{copy.myBidsSubtitle}</p>

              <div className="table-filters table-filters-4">
                <input
                  type="search"
                  aria-label={e('Search item')}
                  value={myBidsQuery}
                  onChange={(e) => setMyBidsQuery(e.target.value)}
                  placeholder={e('Search item')}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                />
                <SelectField
                  aria-label={e('Status')}
                  value={myBidsStatusFilter}
                  onChange={(e) => setMyBidsStatusFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All statuses')}</option>
                  {myBidStatusOptions.map(statusOption)}
                </SelectField>
                <SelectField
                  aria-label={e('Currency')}
                  value={myBidsCurrencyFilter}
                  onChange={(e) => setMyBidsCurrencyFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All currencies')}</option>
                  {myBidCurrencyOptions.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  aria-label={e('Proposal stage')}
                  value={myBidsStageFilter}
                  onChange={(e) => setMyBidsStageFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All stages')}</option>
                  <option value="FACTORY_ONLY">{e('Waiting for delivery quote')}</option>
                  <option value="COMPLETE">{e('Complete proposal')}</option>
                </SelectField>
              </div>

              {filteredMyBids.length === 0 ? (
                <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                  {myBids.length === 0 ? e('No bids yet.') : e('No bids match current filters.')}
                </p>
              ) : (
                <>
                  <div
                    className="record-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={copy.myBidsTitle}
                  >
                    <table className="record-table">
                      <thead>
                        <tr>
                          <th>{e('Item')}</th>
                          <th>{e('Your offer')}</th>
                          <th>{e('Delivery')}</th>
                          <th>{e('Total')}</th>
                          <th>{e('Status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMyBids.map((bid) => (
                          <RecordRow
                            key={bid.id}
                            id={bid.id}
                            open={bidRecords.isOpen(bid.id)}
                            onToggle={() => bidRecords.toggle(bid.id)}
                            colSpan={5}
                            title={bid.item_name ?? '—'}
                            subtitle={
                              bid.logist_legal_name ? (
                                <small>{bid.logist_legal_name}</small>
                              ) : undefined
                            }
                            detail={
                              <RecordDetail
                                facts={[
                                  [e('Request'), statusLabel(locale, bid.request_status)],
                                  [
                                    e('Your offer'),
                                    formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit),
                                  ],
                                  [
                                    e('Price per unit'),
                                    formatMoney(
                                      locale,
                                      bid.inventory_price_per_unit,
                                      bid.currency_code
                                    ),
                                  ],
                                  [e('Pickup'), bid.source_address_label],
                                  [e('Destination'), bid.destination_address_label],
                                  [e('Your note'), bid.factory_note],
                                  [
                                    e('Carrier'),
                                    bid.logist_legal_name ?? e('Waiting for delivery quote'),
                                  ],
                                  [
                                    e('Delivery'),
                                    bid.logistic_offer_id
                                      ? `${formatMoney(locale, bid.delivery_price, bid.currency_code)} · ${bid.delivery_days} ${e('days')}`
                                      : null,
                                  ],
                                  [
                                    e('Total'),
                                    bid.total_cost
                                      ? formatMoney(locale, bid.total_cost, bid.currency_code)
                                      : null,
                                  ],
                                  [e('Placed'), formatDateTime(locale, bid.created_at)],
                                ]}
                                actions={
                                  <>
                                    <button
                                      type="button"
                                      className="if-button"
                                      onClick={() => openView('requests', bid.request_id)}
                                    >
                                      {e('View the request')}
                                    </button>
                                    {bid.status === 'PENDING' &&
                                      WITHDRAWABLE.includes(bid.request_status ?? '') && (
                                        <button
                                          type="button"
                                          className="if-button is-danger"
                                          disabled={busyId !== null}
                                          onClick={() => void withdrawBid(bid.id)}
                                        >
                                          {e('Withdraw my bid')}
                                        </button>
                                      )}
                                  </>
                                }
                              />
                            }
                          >
                            <td data-label={e('Your offer')} className="num">
                              {formatQuantityWithUnit(bid.quoted_quantity, bid.quantity_unit)}
                              <small>
                                {formatMoney(
                                  locale,
                                  bid.inventory_price_per_unit,
                                  bid.currency_code
                                )}{' '}
                                {e('per unit')}
                              </small>
                            </td>
                            <td data-label={e('Delivery')} className="num">
                              {bid.logistic_offer_id ? (
                                <>
                                  {bid.delivery_days} {e('days')}
                                  <small>
                                    {formatMoney(locale, bid.delivery_price, bid.currency_code)}
                                  </small>
                                </>
                              ) : (
                                <span className="text-warning">
                                  {e('Waiting for delivery quote')}
                                </span>
                              )}
                            </td>
                            <td data-label={e('Total')} className="num">
                              {bid.total_cost
                                ? formatMoney(locale, bid.total_cost, bid.currency_code)
                                : '—'}
                            </td>
                            <td data-label={e('Status')}>
                              <StatusBadge status={bid.status} />
                            </td>
                          </RecordRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <TablePager
                    page={myBidsPage}
                    pageSize={TABLE_PAGE_SIZE}
                    total={filteredMyBids.length}
                    onPage={setMyBidsPage}
                  />
                </>
              )}
            </section>

            {/* Production: contracts and fulfilment */}
            <section data-section="workflow" className="surface-1 rounded-2xl p-6 sm:p-8">
              <h2 id="workflow" className="text-lg font-semibold">
                {e('Contracts and fulfilment')}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {e(
                  'Sign selected contracts, then hand the goods to the carrier once payment is confirmed.'
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
                  {transactionStatusOptions.map(statusOption)}
                </SelectField>
                <SelectField
                  aria-label={e('Payment')}
                  value={transactionsPaymentFilter}
                  onChange={(e) => setTransactionsPaymentFilter(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                >
                  <option value="ALL">{e('All payment states')}</option>
                  {transactionPaymentOptions.map(statusOption)}
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
                    aria-label={e('Contracts and fulfilment')}
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
                          const actions = (
                            <>
                              {tx.can_sign && (
                                <button
                                  type="button"
                                  onClick={() => void handleWorkflowAction(tx.id, 'SIGN')}
                                  disabled={workflowBusyId === tx.id + 'SIGN'}
                                  className="if-button if-button-primary"
                                >
                                  {workflowBusyId === tx.id + 'SIGN' ? e('Signing…') : e('Sign')}
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
                                    ? e('Submitting…')
                                    : e('Given to logist')}
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
                                    ? e('Updating…')
                                    : e('Mark in delivery')}
                                </button>
                              )}
                            </>
                          );
                          return (
                            <RecordRow
                              key={tx.id}
                              id={tx.id}
                              open={orderRecords.isOpen(tx.id)}
                              onToggle={() => orderRecords.toggle(tx.id)}
                              colSpan={4}
                              title={tx.item_name ?? e('Order')}
                              subtitle={<small className="font-mono">{tx.id.slice(0, 8)}</small>}
                              detail={
                                <RecordDetail
                                  facts={orderFacts(tx, e, locale)}
                                  actions={canAct ? actions : undefined}
                                />
                              }
                            >
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
                                  {actions}
                                  {!canAct && tx.status !== 'COMPLETED' && (
                                    <span className="text-xs text-[rgb(var(--muted))]">
                                      {e('Awaiting others')}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </RecordRow>
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

            {/* Inventory: the stock list (publishing new stock happens in FactorySetup above) */}
            <section data-section="inventory" className="surface-1 rounded-2xl p-6 sm:p-8">
              <div className="section-heading-row">
                <div>
                  <h2 id="inventory" className="text-lg font-semibold">
                    {copy.myInventoryTitle}
                  </h2>
                  <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                    {copy.addInventorySubtitle}
                  </p>
                </div>
              </div>
              {success && (
                <p
                  role="status"
                  className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success"
                >
                  {success}
                </p>
              )}

              {inventory.length > 0 && (
                <>
                  <div className="table-filters">
                    <input
                      type="search"
                      aria-label={e('Search item')}
                      value={inventoryQuery}
                      onChange={(e) => setInventoryQuery(e.target.value)}
                      placeholder={e('Search item')}
                      className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    />
                    <SelectField
                      aria-label={e('Status')}
                      value={inventoryStatusFilter}
                      onChange={(e) => setInventoryStatusFilter(e.target.value)}
                      className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="ALL">{e('All statuses')}</option>
                      {inventoryStatusOptions.map(statusOption)}
                    </SelectField>
                    <SelectField
                      aria-label={e('Currency')}
                      value={inventoryCurrencyFilter}
                      onChange={(e) => setInventoryCurrencyFilter(e.target.value)}
                      className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                    >
                      <option value="ALL">{e('All currencies')}</option>
                      {inventoryCurrencyOptions.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  {filteredInventory.length === 0 ? (
                    <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                      {e('No inventory matches current filters.')}
                    </p>
                  ) : (
                    <>
                      <div
                        className="record-scroll"
                        tabIndex={0}
                        role="region"
                        aria-label={copy.myInventoryTitle}
                      >
                        <table className="record-table">
                          <thead>
                            <tr>
                              <th>{e('Item')}</th>
                              <th>{e('Available')}</th>
                              <th>{e('Price per unit')}</th>
                              <th>{e('Status')}</th>
                              <th>
                                <span className="sr-only">{e('Action')}</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedInventory.map((entry) => (
                              <RecordRow
                                key={entry.id}
                                id={entry.id}
                                open={stockRecords.isOpen(entry.id)}
                                onToggle={() => stockRecords.toggle(entry.id)}
                                colSpan={5}
                                title={entry.item_name}
                                detail={
                                  <RecordDetail
                                    facts={[
                                      [
                                        e('Available'),
                                        formatQuantityWithUnit(
                                          entry.quantity_available,
                                          entry.unit
                                        ),
                                      ],
                                      [
                                        e('Price per unit'),
                                        formatMoney(
                                          locale,
                                          entry.price_per_unit,
                                          entry.currency_code
                                        ),
                                      ],
                                      [e('Status'), statusLabel(locale, entry.status)],
                                      [e('Added'), formatDateTime(locale, entry.created_at)],
                                      [
                                        e('Open bids'),
                                        myBids.filter(
                                          (bid) =>
                                            bid.inventory_entry_id === entry.id &&
                                            bid.status === 'PENDING' &&
                                            !bid.logistic_offer_id
                                        ).length,
                                      ],
                                    ]}
                                    actions={
                                      <>
                                        <button
                                          type="button"
                                          className="if-button"
                                          aria-expanded={stockEdit?.id === entry.id}
                                          onClick={() =>
                                            setStockEdit(
                                              stockEdit?.id === entry.id
                                                ? null
                                                : {
                                                    id: entry.id,
                                                    quantity: entry.quantity_available,
                                                    price: entry.price_per_unit,
                                                  }
                                            )
                                          }
                                        >
                                          {e('Edit')}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={inventoryStatusBusyId === entry.id}
                                          onClick={() =>
                                            void handleToggleInventoryStatus(entry.id, entry.status)
                                          }
                                          className="if-button"
                                        >
                                          {entry.status === 'ACTIVE'
                                            ? copy.actionPause
                                            : copy.actionActivate}
                                        </button>
                                      </>
                                    }
                                  >
                                    {stockEdit?.id === entry.id && (
                                      <form
                                        className="record-edit"
                                        onSubmit={(event) => {
                                          event.preventDefault();
                                          void saveStock(entry.id);
                                        }}
                                      >
                                        <label>
                                          {e('Available')} ({entry.unit ?? 'pcs'})
                                          <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            required
                                            value={stockEdit.quantity}
                                            onChange={(event) =>
                                              setStockEdit({
                                                ...stockEdit,
                                                quantity: event.target.value,
                                              })
                                            }
                                          />
                                        </label>
                                        <label>
                                          {e('Price per unit')} ({entry.currency_code})
                                          <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            required
                                            value={stockEdit.price}
                                            onChange={(event) =>
                                              setStockEdit({
                                                ...stockEdit,
                                                price: event.target.value,
                                              })
                                            }
                                          />
                                        </label>
                                        <button
                                          type="submit"
                                          className="if-button if-button-primary"
                                          disabled={busyId !== null}
                                        >
                                          {e('Save changes')}
                                        </button>
                                        <p className="record-notice record-edit-wide">
                                          {e(
                                            'The price is locked while open bids use this stock; the quantity can always change.'
                                          )}
                                        </p>
                                      </form>
                                    )}
                                  </RecordDetail>
                                }
                              >
                                <td data-label={e('Available')} className="num">
                                  {formatQuantityWithUnit(entry.quantity_available, entry.unit)}
                                </td>
                                <td data-label={e('Price per unit')} className="num">
                                  {formatMoney(locale, entry.price_per_unit, entry.currency_code)}
                                </td>
                                <td data-label={e('Status')}>
                                  <StatusBadge status={entry.status} />
                                </td>
                                <td className="record-actions">
                                  <button
                                    type="button"
                                    disabled={inventoryStatusBusyId === entry.id}
                                    onClick={() =>
                                      void handleToggleInventoryStatus(entry.id, entry.status)
                                    }
                                    className="if-button"
                                  >
                                    {inventoryStatusBusyId === entry.id
                                      ? e('Updating…')
                                      : entry.status === 'ACTIVE'
                                        ? copy.actionPause
                                        : copy.actionActivate}
                                  </button>
                                </td>
                              </RecordRow>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <TablePager
                        page={inventoryPage}
                        pageSize={TABLE_PAGE_SIZE}
                        total={filteredInventory.length}
                        onPage={setInventoryPage}
                      />
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
      {confirmation}
    </WorkspaceExperience>
  );
}
