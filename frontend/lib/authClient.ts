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
