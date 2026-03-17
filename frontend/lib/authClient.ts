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

export type BootstrapCategory = {
  id: string;
  name: string;
  slug: string;
};

export type BootstrapItem = {
  id: string;
  name: string;
  category_id: string;
};

export type BootstrapCurrency = {
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
  addresses: BootstrapAddress[];
  user: {
    id: string;
    role: UserRole;
    is_email_verified: boolean;
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
  destination_address_id: string;
  preferred_currency_code: string;
  status: string;
  created_at: string;
};

export type CreateRequestPayload = {
  category_id?: string;
  item_id?: string;
  requested_name_text?: string;
  requested_characteristics_json?: Record<string, unknown>;
  quantity: number;
  destination_address_id: string;
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
  stock_address_id: string;
  quantity_available: number;
  price_per_unit: number;
  currency_code: string;
  characteristics_json?: Record<string, unknown>;
};

export type InventoryEntryItem = {
  id: string;
  item_id: string;
  item_name: string;
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
  reliability_score: number;
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

export function register(input: {
  email: string;
  password: string;
  role: UserRole;
  display_name: string;
  country_code: string;
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
  preferred_currency_code: string;
  status: string;
  created_at: string;
};

export type MatchCandidate = {
  id: string;
  request_id: string;
  status: string;
  quoted_quantity: string | null;
  factory_note: string | null;
  currency_code: string;
  // factory
  inventory_entry_id: string;
  item_name: string | null;
  inventory_price_per_unit: string | null;
  factory_legal_name: string | null;
  // logistics
  logistic_offer_id: string | null;
  logistic_title: string | null;
  delivery_price: string | null;
  delivery_days: number | null;
  // combined
  total_cost: string | null;
  reliability_score: number | null;
  fitness_score: number | null;
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
  logistic_offer_id: string;
  delivery_price: number;
  delivery_days: number;
};

// Factory endpoints
export function getOpenRequests() {
  return request<OpenRequest[]>('/pairing/open-requests');
}

export function createFactoryBid(payload: FactoryBidPayload) {
  return request<{ status: string; candidate_id: string }>('/pairing/factory-bids', {
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
  return request<{ status: string; candidate_id: string }>('/pairing/logist-quotes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Customer endpoints
export function listCandidatesForRequest(requestId: string) {
  return request<MatchCandidate[]>(`/pairing/candidates/${encodeURIComponent(requestId)}`);
}

export function selectCandidate(candidateId: string) {
  return request<{ status: string; transaction_id: string; message: string }>(
    '/pairing/select-candidate',
    {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId }),
    }
  );
}
