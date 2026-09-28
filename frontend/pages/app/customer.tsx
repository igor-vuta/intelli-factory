import Combobox from '../../components/Combobox';
import SelectField from '../../components/SelectField';
import GuidanceHint from '../../components/GuidanceHint';
import OrderGuidance from '../../components/OrderGuidance';
import { dissolve } from '../../lib/dissolve';
import { useActionConfirmation } from '../../hooks/useActionConfirmation';
import CategoryProposalPanel from '../../components/CategoryProposalPanel';
import AttributeFields from '../../components/AttributeFields';
import { categoryCopy } from '../../lib/categoryCopy';
import ProposalExplorer from '../../components/ProposalExplorer';
import StatusBadge from '../../components/StatusBadge';
import RecordRow, { RecordDetail } from '../../components/RecordRow';
import SignatureList from '../../components/SignatureList';
import TablePager from '../../components/TablePager';
import { useExpandedRecords } from '../../hooks/useExpandedRecords';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';
import OrderProgress from '../../components/OrderProgress';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import WorkspaceExperience from '../../components/WorkspaceExperience';
import { workspacePath } from '../../lib/navigation';
import Modal from '../../components/Modal';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { type ComboboxOption } from '../../components/Combobox';
import AgreementSignModal from '../../components/AgreementSignModal';
import PaymentMockupModal from '../../components/PaymentMockupModal';
import RatingModal from '../../components/RatingModal';
import SearchableInput from '../../components/SearchableInput';
import { ApiError } from '../../lib/authClient';
import {
  acceptTransactionCompletion,
  captureTransactionPayment,
  type ContractSigningPayload,
  createCustomerRequest,
  getMyRatingsForTransaction,
  getRequestsBootstrap,
  listMyTransactions,
  listCandidatesForRequest,
  listRequests,
  logout,
  me,
  signTransaction,
  selectCandidate,
  updateRequestStatus,
  updateRequest,
  pauseRequest,
  resumeRequest,
  deleteRequest,
  type BootstrapAddress,
  type BootstrapCategory,
  type BootstrapCountry,
  type BootstrapCurrency,
  type BootstrapItem,
  type MatchCandidate,
  type RatingTarget,
  type RequestSummary,
  type WorkflowTransaction,
} from '../../lib/authClient';
import {
  formatCurrencyOptionLabel,
  formatDateTime,
  formatQuantityWithUnit,
} from '../../lib/formatting';
import { getLocaleFromQuery, t } from '../../lib/i18n';
import { orderFacts } from '../../lib/orderFacts';

const REQUESTS_PAGE_SIZE = 5;

// What a customer can do with a request, by status (the API enforces the same rules).
const SEARCHING_STATUSES = ['PENDING', 'PAIRING_IN_PROGRESS'];
const PROPOSAL_STATUSES = ['PAIRING_IN_PROGRESS', 'MATCHED', 'PAUSED'];
const EDITABLE_STATUSES = ['PENDING', 'PAUSED'];
const CANCELLABLE_STATUSES = [...SEARCHING_STATUSES, 'PAUSED', 'MATCHED'];
const DELETABLE_STATUSES = ['PENDING', 'CANCELLED'];

function requestExplanation(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Waiting for the first factory to bid.';
    case 'PAIRING_IN_PROGRESS':
      return 'Factories have bid; complete proposals appear once a carrier quotes.';
    case 'PAUSED':
      return 'Paused: no new bids or quotes until you resume searching.';
    case 'CANCELLED':
      return 'Cancelled. You can delete it from your list.';
    case 'COMPLETED':
      return 'Delivered and accepted.';
    default:
      return 'A proposal was chosen; this request continues as an order.';
  }
}

/** The one action a request card offers, matching where the order is in its lifecycle. */
function nextStep(status: string): { actionLabel: string; actionView?: string } {
  if (['PAIRING_IN_PROGRESS', 'MATCHED'].includes(status))
    return { actionLabel: 'Compare proposals' };
  if (['CONTRACT_DRAFTED', 'CONTRACT_SIGNING'].includes(status))
    return { actionLabel: 'Review and sign', actionView: 'workflow' };
  if (['FULLY_SIGNED', 'AWAITING_PAYMENT'].includes(status))
    return { actionLabel: 'Pay', actionView: 'workflow' };
  if (['PAYMENT_CONFIRMED', 'FULFILLMENT_STARTED', 'IN_PROGRESS'].includes(status))
    return { actionLabel: 'Track delivery', actionView: 'workflow' };
  return { actionLabel: 'View request' };
}

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

function ProposalsModal({
  requestId,
  requestStatus,
  candidates,
  loadingCandidates,
  loadError,
  onRefresh,
  onClose: onDismiss,
  onSelected,
}: ProposalsModalProps) {
  const e = useExperienceCopy();
  const { dialogId, onClose } = useModalDismiss(onDismiss);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acceptedCandidate = useMemo(
    () => candidates.find((c) => c.status === 'ACCEPTED'),
    [candidates]
  );

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
    <Modal id={dialogId} onClose={onClose} className="modal-wide">
      <div className="flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--stroke))] pb-6">
          <div>
            <h2 className="text-lg font-semibold">{e('Compare proposals')}</h2>
            <GuidanceHint hint="proposals" />
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              {e('Request')} {requestId.slice(0, 8)}…
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="rounded-md border border-[rgb(var(--stroke))] px-2 py-1 text-xs text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/20"
            >
              {e('Refresh')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={e('Close')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
            >
              ×
            </button>
          </div>
        </div>

        <div className="pt-6">
          {error && (
            <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          {loadError && (
            <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {loadError}
            </p>
          )}

          {acceptedCandidate && (
            <p className="mb-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              {e('A proposal is already selected for this request.')}
            </p>
          )}

          {loadingCandidates ? (
            <p className="text-sm text-[rgb(var(--muted))]">{e('Loading proposals…')}</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">
              {requestStatus === 'MATCHED'
                ? e('Request is matched, but no proposal rows were returned. Try refresh.')
                : e(
                    'No complete proposals yet. Factories have bid but logistics quotes are pending.'
                  )}
            </p>
          ) : (
            <ProposalExplorer
              candidates={candidates}
              selecting={selecting}
              onChoose={(candidateId) => void handleSelect(candidateId)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

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
  onClose: onDismiss,
  onCreated,
}: ModalProps) {
  const e = useExperienceCopy();
  const { dialogId, onClose } = useModalDismiss(onDismiss);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const categoryLocale = getLocaleFromQuery(useRouter().query.lang);
  const [attributes, setAttributes] = useState<Record<string, unknown>>({});
  const [, setCategoryText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [itemText, setItemText] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [quantityUnitText, setQuantityUnitText] = useState('pcs');
  const [quantityUnitId, setQuantityUnitId] = useState('pcs');
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? 'USD');
  const [addressId, setAddressId] = useState(defaultAddressId ?? addresses[0]?.id ?? '');
  const [useManualAddress, setUseManualAddress] = useState(addresses.length === 0);
  const [countryCode, setCountryCode] = useState(defaultCountryCode ?? countries[0]?.code ?? '');
  const [regionName, setRegionName] = useState('');
  const [cityName, setCityName] = useState('');
  const [street, setStreet] = useState(defaultStreet ?? '');

  const categoryOptions = useMemo<ComboboxOption[]>(
    () =>
      categories
        .filter((c) => !categories.some((child) => child.parent_id === c.id))
        .map((c) => ({
          id: c.id,
          label: c.name,
        })),
    [categories]
  );

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  // Items scoped to selected category
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
    setAttributes({});
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
    if (submitting) return;
    setError(null);
    setSuccess(null);

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError(e('Quantity must be greater than 0'));
      return;
    }
    if (!itemText.trim()) {
      setError(e('Please describe the item you need'));
      return;
    }
    if (!categoryId) {
      setError(categoryCopy(categoryLocale).select);
      return;
    }
    if (!quantityUnitText.trim()) {
      setError(e('Please provide a quantity unit (e.g. kg, liters, pcs)'));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createCustomerRequest({
        category_id: categoryId || undefined,
        requested_characteristics_json: attributes,
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
      setSuccess(`${e('Request created')} (${result.request_id.slice(0, 8)}…)`);
      setItemText('');
      setItemId('');
      setCategoryText('');
      setCategoryId('');
      await onCreated();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : e('Failed to create request'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      id={dialogId}
      onClose={onClose}
      busy={submitting}
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div className="request-composer slide-up w-full max-w-lg rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{e('New Supply Request')}</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              {e(
                'Choose a category, then describe what you need. Start typing to see suggestions.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--stroke))]/40"
            aria-label={e('Close')}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="composer-section-title">
            <span>01</span>
            <h3>{e('What do you need?')}</h3>
          </div>
          <GuidanceHint hint="request" />
          <Combobox
            options={categoryOptions}
            value={categoryId}
            onChange={(id) => handleCategoryChange(categoryNameById.get(id) ?? '', id)}
            placeholder={categoryCopy(categoryLocale).select}
            label={e('Category')}
            required
          />

          <AttributeFields
            schema={categories.find((c) => c.id === categoryId)?.attributes_schema}
            value={attributes}
            onChange={setAttributes}
          />
          <AttributeFields
            schema={items.find((i) => i.id === itemId)?.characteristics_schema}
            value={attributes}
            onChange={setAttributes}
          />

          {/* Step 2 \u2014 Item name: free text with catalogue suggestions */}
          <SearchableInput
            suggestions={itemSuggestions}
            text={itemText}
            selectedId={itemId}
            onChange={handleItemChange}
            placeholder={
              categoryId
                ? `${e('Describe item')} · ${categoryNameById.get(categoryId) ?? e('Category')}`
                : e('Describe item')
            }
            label={e('Item name / description')}
            required
          />

          {!itemId && itemText && (
            <p className="-mt-2 text-xs text-[rgb(var(--muted))]">
              {e('No catalogue match — your description will be used directly.')}
            </p>
          )}

          <div className="composer-section-title">
            <span>02</span>
            <h3>{e('Quantity & budget')}</h3>
          </div>
          <GuidanceHint hint="quantity" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="request-quantity" className="text-sm text-[rgb(var(--muted))]">
                {e('Quantity')} <span className="text-danger">*</span>
              </label>
              <input
                id="request-quantity"
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
                disabled={!!itemId}
                suggestions={unitSuggestions}
                text={quantityUnitText}
                selectedId={quantityUnitId}
                onChange={handleUnitChange}
                placeholder={e('Choose or type a unit (kg, liters, pcs)')}
                label={e('Unit')}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-[rgb(var(--muted))]">
                {e('Currency')} <span className="text-danger">*</span>
              </label>
              <SelectField
                aria-label="Currency"
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
              </SelectField>
            </div>
          </div>

          <div className="composer-section-title">
            <span>03</span>
            <h3>{e('Where should it arrive?')}</h3>
          </div>
          <GuidanceHint hint="address" />
          <div className="flex flex-col gap-2">
            <label className="text-sm text-[rgb(var(--muted))]">
              {e('Destination address')} <span className="text-danger">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setUseManualAddress(false)}
                disabled={addresses.length === 0}
                aria-pressed={!useManualAddress}
                className={`rounded-md border px-2 py-1 text-xs ${
                  !useManualAddress
                    ? 'border-info/40 text-info'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                {e('Choose existing')}
              </button>
              <button
                type="button"
                onClick={() => setUseManualAddress(true)}
                aria-pressed={useManualAddress}
                className={`rounded-md border px-2 py-1 text-xs ${
                  useManualAddress
                    ? 'border-info/40 text-info'
                    : 'border-[rgb(var(--stroke))] text-[rgb(var(--muted))]'
                }`}
              >
                {e('Provide yourself')}
              </button>
            </div>

            {!useManualAddress ? (
              <SelectField
                aria-label="Address"
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
              </SelectField>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectField
                  aria-label="Country"
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
                </SelectField>
                <input
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  placeholder={e('Region')}
                  required
                />
                <input
                  value={cityName}
                  onChange={(e) => setCityName(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  placeholder={e('City')}
                  required
                />
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm sm:col-span-2"
                  placeholder={e('Address / Street')}
                  required
                />
              </div>
            )}
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

          <div className="composer-actions flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn btn-ghost flex-1 text-sm"
            >
              {e('Cancel')}
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1 text-sm">
              {submitting ? e('Creating…') : e('Create Request')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default function CustomerWorkspacePage() {
  const { confirm, confirmation } = useActionConfirmation();
  const e = useExperienceCopy();
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [loading, setLoading] = useState(true);
  const [guidanceUserId, setGuidanceUserId] = useState('');
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
  const [ratingTransaction, setRatingTransaction] = useState<WorkflowTransaction | null>(null);
  const [ratedTargetsMap, setRatedTargetsMap] = useState<Record<string, Set<RatingTarget>>>({});

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
        const haystack = [row.item_name, row.requested_name_text, row.category_name, row.id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [requests, requestSearch, requestStatusFilter, requestCurrencyFilter]);

  const totalRequestPages = Math.max(1, Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE));

  const paginatedRequests = useMemo(() => {
    const start = (requestsPage - 1) * REQUESTS_PAGE_SIZE;
    return filteredRequests.slice(start, start + REQUESTS_PAGE_SIZE);
  }, [filteredRequests, requestsPage]);

  const totalTransactionPages = Math.max(1, Math.ceil(transactions.length / REQUESTS_PAGE_SIZE));

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
    // Refresh rated-targets for any COMPLETED transactions
    const completed = rows.filter((tx) => tx.status === 'COMPLETED');
    if (completed.length > 0) {
      const entries = await Promise.all(
        completed.map(async (tx) => {
          const ratings = await getMyRatingsForTransaction(tx.id);
          return [tx.id, new Set(ratings.map((r) => r.target_type as RatingTarget))] as const;
        })
      );
      setRatedTargetsMap(Object.fromEntries(entries));
    }
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
          await router.replace(workspacePath(auth.user.role, locale));
          return;
        }

        const [bootstrap, rows, txRows] = await Promise.all([
          getRequestsBootstrap(locale),
          listRequests(),
          listMyTransactions(),
        ]);

        if (cancelled) return;

        setCategories(bootstrap.categories);
        setItems(bootstrap.items);
        setCurrencies(bootstrap.currencies);
        setGuidanceUserId(bootstrap.user.id);
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
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          await router.replace(`/login?lang=${locale}`);
          return;
        }
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
      void refreshRequests().catch(() =>
        setPageError('Could not refresh workspace. Please check your connection and try again.')
      );
      void refreshTransactions().catch(() =>
        setPageError('Could not refresh workspace. Please check your connection and try again.')
      );
      if (proposalsRequestId) {
        void refreshCandidatesForRequest(proposalsRequestId).catch(() =>
          setPageError('Could not refresh workspace. Please check your connection and try again.')
        );
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

    if (workflowBusyId || !(await confirm('Accept'))) return;
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
    try {
      await logout();
      await router.push(`/login?lang=${locale}`);
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Could not log out. Please try again.');
    }
  }

  const [cancellingRequest, setCancellingRequest] = useState<string | null>(null);

  async function handleCancelRequest(requestId: string) {
    if (cancellingRequest) return;
    if (!(await confirm('Cancel request'))) return;
    setCancellingRequest(requestId);
    setPageError(null);
    try {
      await updateRequestStatus(requestId, 'CANCELLED');
      await refreshRequests();
    } catch (cause) {
      setPageError(
        cause instanceof Error ? cause.message : 'Could not cancel the request. Please try again.'
      );
    } finally {
      setCancellingRequest(null);
    }
  }

  const [editing, setEditing] = useState<{ id: string; quantity: string; currency: string } | null>(
    null
  );
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const requestRecords = useExpandedRecords(
    filteredRequests.map((row) => row.id),
    REQUESTS_PAGE_SIZE,
    setRequestsPage
  );
  const orderRecords = useExpandedRecords(
    transactions.map((tx) => tx.id),
    REQUESTS_PAGE_SIZE,
    setTransactionsPage
  );

  function openView(view: string, focus: string) {
    void router.push(
      { pathname: router.pathname, query: { ...router.query, view, focus } },
      undefined,
      {
        shallow: true,
        scroll: false,
      }
    );
  }

  /** Runs one request action, confirming the destructive ones; true when it succeeded. */
  async function runRequestAction(
    requestId: string,
    action: string,
    call: () => Promise<unknown>,
    confirmLabel?: string
  ) {
    if (requestBusy) return false;
    if (confirmLabel && !(await confirm(confirmLabel))) return false;
    setRequestBusy(`${requestId}:${action}`);
    setPageError(null);
    try {
      await call();
      if (action === 'delete') await dissolve(document.getElementById(`record-${requestId}`));
      await refreshRequests();
      return true;
    } catch (cause) {
      setPageError(cause instanceof Error ? cause.message : 'Could not update the request.');
      return false;
    } finally {
      setRequestBusy(null);
    }
  }

  return (
    <WorkspaceExperience
      role="customer"
      guidance={
        guidanceUserId
          ? {
              userId: guidanceUserId,
              completed: [
                requests.length > 0,
                transactions.length > 0,
                transactions.some(
                  (transaction) => transaction.signature_status.CUSTOMER === 'SIGNED'
                ),
                transactions.some((transaction) => transaction.payment_status === 'CAPTURED'),
                transactions.some((transaction) => transaction.status === 'COMPLETED'),
              ],
            }
          : undefined
      }
      loading={loading}
      error={pageError}
      counts={[
        requests.length,
        transactions.filter((tx) => tx.status !== 'COMPLETED').length,
        transactions.filter((tx) => tx.status === 'COMPLETED').length,
      ]}
      items={requests.map((row) => ({
        id: row.id,
        title: row.item_name ?? row.requested_name_text ?? row.category_name ?? 'Supply request',
        status: row.status,
        detail: `${row.quantity} ${row.quantity_unit} · ${row.preferred_currency_code}`,
        ...nextStep(row.status),
        action: ['PAIRING_IN_PROGRESS', 'MATCHED'].includes(row.status)
          ? () => void openProposals(row.id)
          : // Contract-stage cards open the order itself, not just the orders list.
            (() => {
              const order = transactions.find((tx) => tx.request_id === row.id);
              return order ? () => openView('workflow', order.id) : undefined;
            })(),
      }))}
      onLogout={handleLogout}
      onCreate={() => setShowModal(true)}
    >
      <div className="workspace-panels">
        <CategoryProposalPanel locale={locale} />
        <section data-section="requests" className="surface-1 rounded-2xl p-6 sm:p-8">
          <div className="section-heading-row">
            <div>
              <h2 id="requests" className="text-lg font-semibold">
                {copy.myRequestsTitle}
              </h2>
              <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
                {e('Open a request to see its details and everything you can do with it.')}
              </p>
            </div>
            {!loading && (
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="if-button if-button-primary"
              >
                {copy.newRequestAction}
              </button>
            )}
          </div>

          {loading && (
            <p className="mt-6 text-sm text-[rgb(var(--muted))]">{e('Loading workspace…')}</p>
          )}

          {!loading &&
            (requests.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[rgb(var(--stroke))] py-14 text-center">
                <p className="text-sm text-[rgb(var(--muted))]">{e('No requests yet.')}</p>
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="if-button if-button-primary mt-4"
                >
                  {e('Create your first request')}
                </button>
              </div>
            ) : (
              <>
                <div className="table-filters">
                  <input
                    type="search"
                    aria-label={e('Search item, category or reference')}
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder={e('Search item, category or reference')}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  />
                  <SelectField
                    aria-label="Status"
                    value={requestStatusFilter}
                    onChange={(e) => setRequestStatusFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">{e('All statuses')}</option>
                    {requestStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    aria-label={e('Currency')}
                    value={requestCurrencyFilter}
                    onChange={(e) => setRequestCurrencyFilter(e.target.value)}
                    className="focus-theme rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                  >
                    <option value="ALL">{e('All currencies')}</option>
                    {requestCurrencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </SelectField>
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[rgb(var(--stroke))] py-10 text-center">
                    <p className="text-sm text-[rgb(var(--muted))]">
                      {e('No requests match your current filters.')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRequestSearch('');
                        setRequestStatusFilter('ALL');
                        setRequestCurrencyFilter('ALL');
                      }}
                      className="if-button mt-3"
                    >
                      {e('Clear filters')}
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="record-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={copy.myRequestsTitle}
                    >
                      <table className="record-table">
                        <thead>
                          <tr>
                            <th>{e('Item')}</th>
                            <th>{e('Quantity')}</th>
                            <th>{e('Status')}</th>
                            <th>{e('Created')}</th>
                            <th>
                              <span className="sr-only">{e('Next step')}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRequests.map((row) => {
                            const order = transactions.find((tx) => tx.request_id === row.id);
                            const hasProposals = PROPOSAL_STATUSES.includes(row.status);
                            const busy = requestBusy?.startsWith(row.id) ?? false;
                            return (
                              <RecordRow
                                key={row.id}
                                id={row.id}
                                open={requestRecords.isOpen(row.id)}
                                onToggle={() => requestRecords.toggle(row.id)}
                                colSpan={5}
                                title={
                                  row.item_name ?? row.requested_name_text ?? e('Supply request')
                                }
                                subtitle={<small>{row.category_name ?? ''}</small>}
                                detail={
                                  <RecordDetail
                                    facts={[
                                      [e('Status'), e(requestExplanation(row.status))],
                                      [e('Reference'), <code key="ref">{row.id.slice(0, 8)}</code>],
                                      [e('Category'), row.category_name],
                                      [
                                        e('Quantity'),
                                        formatQuantityWithUnit(row.quantity, row.quantity_unit),
                                      ],
                                      [e('Currency'), row.preferred_currency_code],
                                      [e('Created'), formatDateTime(locale, row.created_at)],
                                    ]}
                                    actions={
                                      <>
                                        {hasProposals && (
                                          <button
                                            type="button"
                                            className="if-button if-button-primary"
                                            onClick={() => void openProposals(row.id)}
                                          >
                                            {e('Compare proposals')}
                                          </button>
                                        )}
                                        {order && (
                                          <button
                                            type="button"
                                            className="if-button if-button-primary"
                                            onClick={() => openView('workflow', order.id)}
                                          >
                                            {e('Open the order')}
                                          </button>
                                        )}
                                        {EDITABLE_STATUSES.includes(row.status) && (
                                          <button
                                            type="button"
                                            className="if-button"
                                            aria-expanded={editing?.id === row.id}
                                            onClick={() =>
                                              setEditing(
                                                editing?.id === row.id
                                                  ? null
                                                  : {
                                                      id: row.id,
                                                      quantity: row.quantity,
                                                      currency: row.preferred_currency_code,
                                                    }
                                              )
                                            }
                                          >
                                            {e('Edit')}
                                          </button>
                                        )}
                                        {SEARCHING_STATUSES.includes(row.status) && (
                                          <button
                                            type="button"
                                            className="if-button"
                                            disabled={busy}
                                            onClick={() =>
                                              void runRequestAction(row.id, 'pause', () =>
                                                pauseRequest(row.id)
                                              )
                                            }
                                          >
                                            {e('Stop searching')}
                                          </button>
                                        )}
                                        {row.status === 'PAUSED' && (
                                          <button
                                            type="button"
                                            className="if-button"
                                            disabled={busy}
                                            onClick={() =>
                                              void runRequestAction(row.id, 'resume', () =>
                                                resumeRequest(row.id)
                                              )
                                            }
                                          >
                                            {e('Resume searching')}
                                          </button>
                                        )}
                                        {CANCELLABLE_STATUSES.includes(row.status) && (
                                          <button
                                            type="button"
                                            onClick={() => void handleCancelRequest(row.id)}
                                            disabled={cancellingRequest !== null}
                                            className="if-button is-danger"
                                          >
                                            {copy.cancelRequest}
                                          </button>
                                        )}
                                        {DELETABLE_STATUSES.includes(row.status) && (
                                          <button
                                            type="button"
                                            className="if-button is-danger"
                                            disabled={busy}
                                            onClick={() =>
                                              void runRequestAction(
                                                row.id,
                                                'delete',
                                                () => deleteRequest(row.id),
                                                'Delete request'
                                              )
                                            }
                                          >
                                            {e('Delete')}
                                          </button>
                                        )}
                                      </>
                                    }
                                  >
                                    {editing?.id === row.id && (
                                      <form
                                        className="record-edit"
                                        onSubmit={(event) => {
                                          event.preventDefault();
                                          void runRequestAction(row.id, 'edit', () =>
                                            updateRequest(row.id, {
                                              quantity: Number(editing.quantity),
                                              preferred_currency_code: editing.currency,
                                            })
                                          ).then((ok) => ok && setEditing(null));
                                        }}
                                      >
                                        <label>
                                          {e('Quantity')} ({row.quantity_unit})
                                          <input
                                            type="number"
                                            min="0.01"
                                            step="any"
                                            required
                                            value={editing.quantity}
                                            onChange={(event) =>
                                              setEditing({
                                                ...editing,
                                                quantity: event.target.value,
                                              })
                                            }
                                          />
                                        </label>
                                        <div className="record-edit-field">
                                          <span>{e('Currency')}</span>
                                          <SelectField
                                            aria-label={e('Currency')}
                                            value={editing.currency}
                                            onChange={(event) =>
                                              setEditing({
                                                ...editing,
                                                currency: event.target.value,
                                              })
                                            }
                                            className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm"
                                          >
                                            {currencies.map((c) => (
                                              <option key={c.code} value={c.code}>
                                                {formatCurrencyOptionLabel(c.code, c.name)}
                                              </option>
                                            ))}
                                          </SelectField>
                                        </div>
                                        <button
                                          type="submit"
                                          className="if-button if-button-primary"
                                          disabled={busy}
                                        >
                                          {e('Save changes')}
                                        </button>
                                        <p className="record-notice record-edit-wide">
                                          {e(
                                            'A request can be edited until the first factory bids on it.'
                                          )}
                                        </p>
                                      </form>
                                    )}
                                  </RecordDetail>
                                }
                              >
                                <td data-label={e('Quantity')} className="num">
                                  {formatQuantityWithUnit(row.quantity, row.quantity_unit)}
                                  <small>{row.preferred_currency_code}</small>
                                </td>
                                <td data-label={e('Status')}>
                                  <StatusBadge status={row.status} />
                                </td>
                                <td data-label={e('Created')}>
                                  {formatDateTime(locale, row.created_at)}
                                </td>
                                <td className="record-actions">
                                  {hasProposals ? (
                                    <button
                                      type="button"
                                      onClick={() => void openProposals(row.id)}
                                      className="if-button"
                                    >
                                      {copy.viewProposals}
                                    </button>
                                  ) : order ? (
                                    <button
                                      type="button"
                                      onClick={() => openView('workflow', order.id)}
                                      className="if-button"
                                    >
                                      {e('Open the order')}
                                    </button>
                                  ) : null}
                                </td>
                              </RecordRow>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <TablePager
                      page={requestsPage}
                      pageSize={REQUESTS_PAGE_SIZE}
                      total={filteredRequests.length}
                      onPage={setRequestsPage}
                    />
                  </>
                )}
              </>
            ))}
        </section>

        {!loading && (
          <section data-section="workflow" className="surface-1 rounded-2xl p-6 sm:p-8">
            <h2 id="workflow" className="text-lg font-semibold">
              {e('Contract, Payment & Acceptance')}
            </h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              {e(
                'Continue matched requests: sign contract, pay after all signatures, then accept completion at the end of delivery.'
              )}
            </p>

            {transactions.length === 0 ? (
              <p className="mt-3 text-sm text-[rgb(var(--muted))]">
                {e('No active transactions yet.')}
              </p>
            ) : (
              <>
                <div
                  className="record-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={e('Contract, Payment & Acceptance')}
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
                        const canAct = tx.can_sign || tx.can_pay || tx.can_accept_completion;
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
                            {tx.can_pay && (
                              <button
                                type="button"
                                onClick={() => void handleWorkflowAction(tx.id, 'PAY')}
                                disabled={workflowBusyId === tx.id + 'PAY'}
                                className="if-button if-button-primary"
                              >
                                {workflowBusyId === tx.id + 'PAY' ? e('Paying…') : e('Pay')}
                              </button>
                            )}
                            {tx.can_accept_completion && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleWorkflowAction(tx.id, 'ACCEPT_COMPLETION')
                                }
                                disabled={workflowBusyId === tx.id + 'ACCEPT_COMPLETION'}
                                className="if-button if-button-primary"
                              >
                                {workflowBusyId === tx.id + 'ACCEPT_COMPLETION'
                                  ? e('Accepting…')
                                  : e('Accept')}
                              </button>
                            )}
                            {tx.status === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => setRatingTransaction(tx)}
                                className="if-button"
                              >
                                {e('Rate')}
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
                                actions={
                                  <>
                                    {actions}
                                    <button
                                      type="button"
                                      className="if-button"
                                      onClick={() => openView('requests', tx.request_id)}
                                    >
                                      {e('View the request')}
                                    </button>
                                  </>
                                }
                              />
                            }
                          >
                            <td data-label={e('Status')}>
                              <StatusBadge status={tx.status} />
                              <OrderProgress status={tx.status} />
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
                  pageSize={REQUESTS_PAGE_SIZE}
                  total={transactions.length}
                  onPage={setTransactionsPage}
                />
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
      {ratingTransaction && (
        <RatingModal
          transaction={ratingTransaction}
          alreadyRatedTargets={ratedTargetsMap[ratingTransaction.id] ?? new Set()}
          onClose={() => setRatingTransaction(null)}
          onRated={() =>
            void refreshTransactions().catch(() => setPageError('Could not refresh transactions.'))
          }
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
      {confirmation}
    </WorkspaceExperience>
  );
}
