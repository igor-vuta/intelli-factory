export type UserRole = 'CUSTOMER' | 'FACTORY' | 'LOGIST' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  is_email_verified: boolean;
};

export type ApiMessage = {
  status: string;
  message: string;
};

export type AuthStatusResponse = {
  status: string;
  user: AuthUser;
};

export type CountryItem = {
  code: string;
  label: string;
};

export type CurrencyItem = {
  code: string;
  name: string;
};

export type AddressBootstrapResponse = {
  regions: { code: string; name: string }[];
  cities: { id: string; name: string; region_code: string }[];
};

export type BootstrapCategory = {
  id: string;
  name: string;
  slug: string;
};

export type BootstrapItem = {
  id: string;
  name: string;
  category_id: string;
  unit: string | null;
};

export type BootstrapCurrency = {
  code: string;
  name: string;
};

export type BootstrapCountry = {
  code: string;
  name: string;
};

export type BootstrapAddress = {
  id: string;
  label: string;
};

export type RequestsBootstrap = {
  categories: BootstrapCategory[];
  items: BootstrapItem[];
  currencies: BootstrapCurrency[];
  countries: BootstrapCountry[];
  addresses: BootstrapAddress[];
  user: {
    id: string;
    role: UserRole;
    is_email_verified: boolean;
    primary_address_id?: string | null;
    registration_country_code?: string | null;
    registration_address?: string | null;
  };
};

export type RequestSummary = {
  id: string;
  customer_profile_id: string;
  category_id: string;
  category_name: string | null;
  item_id: string | null;
  item_name: string | null;
  requested_name_text: string | null;
  quantity: string;
  quantity_unit: string;
  destination_address_id: string;
  preferred_currency_code: string;
  status: string;
  created_at: string;
};

export type CreateRequestPayload = {
  category_id?: string;
  category_name_text?: string;
  item_id?: string;
  requested_name_text?: string;
  requested_characteristics_json?: Record<string, unknown>;
  quantity: number;
  quantity_unit: string;
  destination_address_id?: string;
  destination_country_code?: string;
  destination_region_name?: string;
  destination_city_name?: string;
  destination_street?: string;
  preferred_currency_code: string;
};

export type CreateRequestResult = {
  status: string;
  request_id: string;
  message: string;
};

export type InventoryEntryPayload = {
  item_id?: string;
  item_name?: string;
  category_id?: string;
  category_name_text?: string;
  unit?: string;
  stock_address_id?: string;
  stock_country_code?: string;
  stock_region_name?: string;
  stock_city_name?: string;
  stock_street?: string;
  quantity_available: number;
  price_per_unit: number;
  currency_code: string;
  characteristics_json?: Record<string, unknown>;
};

export type InventoryEntryItem = {
  id: string;
  item_id: string;
  item_name: string;
  unit: string | null;
  quantity_available: string;
  price_per_unit: string;
  currency_code: string;
  status: string;
  created_at: string;
};

export type LogisticOfferPayload = {
  title: string;
  description?: string;
  base_price: number;
  price_per_km?: number;
  price_per_kg?: number;
  estimated_days_min?: number;
  estimated_days_max?: number;
  currency_code: string;
};

export type LogisticOfferItem = {
  id: string;
  title: string;
  base_price: string;
  currency_code: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  reliability_score: number;
  status: string;
  created_at: string;
};

export type BaselineComparePriority = 'balanced' | 'cost' | 'speed' | 'reliability';

export type BaselineResult = {
  strategy: 'greedy' | 'heuristic';
  candidate_id: string;
  total_cost: number;
  delivery_days: number;
  reliability_score: number;
  heuristic_score: number;
};

export type BaselineCompareResponse = {
  status: string;
  request_id: string;
  priority: BaselineComparePriority;
  greedy: BaselineResult;
  heuristic: BaselineResult;
};

export type ComparisonCatalogResponse = {
  status: string;
  priorities: BaselineComparePriority[];
};

export type OptimizePriority = 'balanced' | 'cost' | 'speed' | 'reliability';

export type ScoreBreakdown = {
  cost_norm?: number | null;
  time_norm?: number | null;
  reliability_norm?: number | null;
  final_score?: number | null;
  weights?: Record<string, number> | null;
};

export type OptimizeSolution = {
  rank: number;
  candidate_id: string;
  request_id: string;
  inventory_entry_id: string;
  logistic_offer_id: string | null;
  total_cost: number;
  delivery_days: number;
  reliability: number;
  fitness_score: number;
  currency_code: string;
  score_breakdown?: ScoreBreakdown | null;
};

export type OptimizeResponse = {
  status: string;
  request_id: string;
  mode: string;
  solution_count: number;
  solutions: OptimizeSolution[];
};

const apiBase = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.detail || data?.message || 'Request failed';
    throw new Error(message);
  }

  return data as T;
}

export function getAddressBootstrap(countryCode: string) {
  return request<AddressBootstrapResponse>(
    `/addresses/bootstrap?country_code=${encodeURIComponent(countryCode)}`
  );
}

export function register(input: {
  email: string;
  password: string;
  role: UserRole;
  display_name: string;
  country_code: string;
  /** Structured address fields (preferred) */
  region_name?: string;
  city_name?: string;
  street?: string;
  postal_code?: string;
  /** Legacy flat address (fallback) */
  address?: string;
  preferred_currency_code: string;
}) {
  return request<ApiMessage>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function verifyEmail(token: string) {
  return request<ApiMessage>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function resendVerificationEmail(email: string) {
  return request<ApiMessage>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function login(input: { email: string; password: string }) {
  return request<AuthStatusResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function me() {
  return request<AuthStatusResponse>('/auth/me');
}

export function logout() {
  return request<ApiMessage>('/auth/logout', {
    method: 'POST',
  });
}

export function getCountries(locale: 'en' | 'ru' | 'kk') {
  return request<CountryItem[]>(`/auth/countries?locale=${locale}`);
}

export function getCurrencies() {
  return request<CurrencyItem[]>('/auth/currencies');
}

export function getRequestsBootstrap() {
  return request<RequestsBootstrap>('/requests/bootstrap');
}

export function createCustomerRequest(payload: CreateRequestPayload) {
  return request<CreateRequestResult>('/requests/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listRequests(status?: string) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<RequestSummary[]>(`/requests/${suffix}`);
}

export function updateRequestStatus(requestId: string, status: string) {
  return request<ApiMessage>(`/requests/${encodeURIComponent(requestId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function createInventoryEntry(payload: InventoryEntryPayload) {
  return request<ApiMessage>('/requests/inventory-entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMyInventoryEntries() {
  return request<InventoryEntryItem[]>('/requests/inventory-entries/mine');
}

export function updateInventoryEntryStatus(inventoryEntryId: string, status: 'ACTIVE' | 'PAUSED') {
  return request<ApiMessage>(
    `/requests/inventory-entries/${encodeURIComponent(inventoryEntryId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
}

export function createLogisticOffer(payload: LogisticOfferPayload) {
  return request<ApiMessage>('/requests/logistic-offers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMyLogisticOffers() {
  return request<LogisticOfferItem[]>('/requests/logistic-offers/mine');
}

// ── Pairing / matching workflow ───────────────────────────────────────────────

export type OpenRequest = {
  id: string;
  category_id: string;
  category_name: string | null;
  item_id: string | null;
  item_name: string | null;
  requested_name_text: string | null;
  quantity: string;
  quantity_unit: string;
  preferred_currency_code: string;
  status: string;
  created_at: string;
};

export type MatchCandidate = {
  id: string;
  request_id: string;
  request_status?: string | null;
  status: string;
  quoted_quantity: string | null;
  quantity_unit: string;
  factory_note: string | null;
  currency_code: string;
  // factory
  inventory_entry_id: string;
  item_name: string | null;
  inventory_price_per_unit: string | null;
  factory_legal_name: string | null;
  factory_avg_rating: number | null;
  source_address_label: string | null;
  destination_address_label: string | null;
  // logistics
  logistic_offer_id: string | null;
  logistic_title: string | null;
  logist_legal_name: string | null;
  logist_avg_rating: number | null;
  delivery_price: string | null;
  delivery_days: number | null;
  // combined
  total_cost: string | null;
  reliability_score: number | null;
  fitness_score: number | null;
  has_my_quote?: boolean;
  created_at: string;
};

export type FactoryBidPayload = {
  request_id: string;
  inventory_entry_id: string;
  quoted_quantity: number;
  factory_note?: string;
};

export type LogistQuotePayload = {
  factory_bid_id: string;
  title: string;
  description?: string;
  base_price: number;
  price_per_km?: number;
  price_per_kg?: number;
  estimated_days_min?: number;
  estimated_days_max?: number;
  currency_code: string;
  delivery_price: number;
  delivery_days: number;
};

export type WorkflowTransaction = {
  id: string;
  request_id: string;
  status: string;
  my_role: UserRole;
  item_name: string | null;
  currency_code: string | null;
  total_cost: string | null;
  delivery_days: number | null;
  contract_version: number | null;
  signature_status: Record<'CUSTOMER' | 'FACTORY' | 'LOGIST', 'PENDING' | 'SIGNED' | 'DECLINED'>;
  payment_status: string;
  payment_amount: string | null;
  can_sign: boolean;
  can_pay: boolean;
  can_start_fulfillment: boolean;
  can_mark_in_progress: boolean;
  can_accept_completion: boolean;
  contract_reference: string;
  contract_date: string;
  factory_legal_name: string | null;
  client_legal_name: string | null;
  logist_legal_name: string | null;
  match_candidate_id: string | null;
  inventory_entry_id: string | null;
  logistic_offer_id: string | null;
  candidate_status: string | null;
  request_status: string | null;
  quoted_quantity: string | null;
  factory_note: string | null;
  delivery_price: string | null;
  reliability_score: number | null;
  fitness_score: number | null;
  candidate_created_at: string | null;
  candidate_updated_at: string | null;
  candidate_deleted_at: string | null;
  goods_cost: string | null;
  payment_terms: string | null;
  created_at: string;
  updated_at: string;
};

export type ContractSigningPayload = {
  signer_name?: string;
  jurisdiction?: string;
  negotiation_days?: number;
  dispute_window_days?: number;
  contract_date?: string;
  rendered_contract_text?: string;
};

// Factory endpoints
export function getOpenRequests() {
  return request<OpenRequest[]>('/pairing/open-requests');
}

export function createFactoryBid(payload: FactoryBidPayload) {
  return request<{
    status: string;
    candidate_id: string;
  }>('/pairing/factory-bids', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMyFactoryBids() {
  return request<MatchCandidate[]>('/pairing/factory-bids/mine');
}

// Logist endpoints
export function getFactoryBidsNeedingLogistics() {
  return request<MatchCandidate[]>('/pairing/factory-bids-needing-logistics');
}

export function createLogistQuote(payload: LogistQuotePayload) {
  return request<{
    status: string;
    candidate_id: string;
    message?: string;
  }>('/pairing/logist-quotes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Customer endpoints
export function listCandidatesForRequest(requestId: string) {
  return request<MatchCandidate[]>(`/pairing/candidates/${encodeURIComponent(requestId)}`);
}

export function selectCandidate(candidateId: string) {
  return request<{
    status: string;
    transaction_id: string;
    message: string;
  }>('/pairing/select-candidate', {
    method: 'POST',
    body: JSON.stringify({
      candidate_id: candidateId,
    }),
  });
}

// Contract / payment / fulfillment workflow
export function listMyTransactions() {
  return request<WorkflowTransaction[]>('/transactions/mine');
}

// Rating endpoints
export type RatingTarget = 'LOGIST' | 'FACTORY';

export type SubmitRatingPayload = {
  transaction_id: string;
  target_type: RatingTarget;
  score: number;
  comment?: string;
};

export function submitRating(payload: SubmitRatingPayload) {
  return request<{ status: string; new_reliability_score: number }>('/ratings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMyRatingsForTransaction(transactionId: string) {
  return request<{ target_type: RatingTarget; score: number; created_at: string }[]>(
    `/ratings/transaction/${encodeURIComponent(transactionId)}/mine`
  );
}

export function signTransaction(transactionId: string, payload?: ContractSigningPayload) {
  return request<{ status: string; transaction_status: string }>(
    `/transactions/${encodeURIComponent(transactionId)}/sign`,
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }
  );
}

export function captureTransactionPayment(
  transactionId: string,
  payload?: { amount?: number; provider_reference?: string }
) {
  return request<{ status: string; transaction_status: string }>(
    `/transactions/${encodeURIComponent(transactionId)}/payments/capture`,
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }
  );
}

export function advanceTransactionFulfillment(
  transactionId: string,
  action: 'START' | 'MARK_IN_PROGRESS'
) {
  return request<{ status: string; transaction_status: string }>(
    `/transactions/${encodeURIComponent(transactionId)}/fulfillment/advance`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    }
  );
}

export function acceptTransactionCompletion(transactionId: string) {
  return request<{ status: string; transaction_status: string }>(
    `/transactions/${encodeURIComponent(transactionId)}/accept-completion`,
    {
      method: 'POST',
    }
  );
}

export function compareBaselines(payload: {
  request_id: string;
  priority: BaselineComparePriority;
}) {
  return request<BaselineCompareResponse>('/comparison/baselines', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getComparisonCatalog() {
  return request<ComparisonCatalogResponse>('/comparison/catalog');
}

export function optimizeSupply(payload: {
  request_id: string;
  mode: 'fast' | 'deep';
}) {
  return request<OptimizeResponse>('/automations/optimize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Full 4-strategy comparison ────────────────────────────────────────────────

export type CompareStrategyEntry = {
  id: string;
  total_cost: number;
  delivery_days: number;
  reliability: number;
  fitness_score: number;
  rank: number;
  currency_code: string;
  score_breakdown?: ScoreBreakdown | null;
};

export type OptimizeCompareResponse = {
  request_id: string;
  optimization_profile: string | null;
  weights: { cost: number; time: number; reliability: number };
  candidate_pool_size: number;
  greedy: CompareStrategyEntry[];
  heuristic: CompareStrategyEntry[];
  fast: CompareStrategyEntry[];
  deep: CompareStrategyEntry[];
};

export function optimizeCompare(request_id: string, profile?: OptimizePriority) {
  const body: { request_id: string; mode: 'fast' | 'deep'; profile?: OptimizePriority } = {
    request_id,
    mode: 'deep',
  };
  if (profile) body.profile = profile;
  return request<OptimizeCompareResponse>('/automations/optimize/compare', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function seedLargeScale() {
  return request<{ status: string; message: string; candidates_created: number }>(
    '/automations/seed-large-scale',
    { method: 'POST' }
  );
}
