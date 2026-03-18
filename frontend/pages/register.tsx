import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  getCountries,
  getCurrencies,
  register,
  type CountryItem,
  type CurrencyItem,
  type UserRole,
} from '../lib/authClient';
import { getLocaleFromQuery, supportedLocales, t } from '../lib/i18n';
import { THEME_CLASSES, type Theme } from '../styles/themePresets';

const roles: { value: UserRole; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'FACTORY', label: 'Factory' },
  { value: 'LOGIST', label: 'Logist' },
];

export default function RegisterPage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [countryCode, setCountryCode] = useState('');
  const [address, setAddress] = useState('');
  const [currencyCode, setCurrencyCode] = useState('');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const localeLinks = useMemo(
    () =>
      supportedLocales.map((lang) => ({
        lang,
        href: `/register?lang=${lang}`,
      })),
    []
  );

  useEffect(() => {
    let isActive = true;

    async function loadCountries() {
      setCountriesLoading(true);
      try {
        const response = await getCountries(locale);
        if (!isActive) return;
        setCountries(response);
        setCountryCode((prev) => {
          const hasCurrent = response.some((item) => item.code === prev);
          return hasCurrent ? prev : response[0]?.code || '';
        });
      } catch {
        if (!isActive) return;
        setCountries([]);
        setError('Failed to load countries. Please refresh and try again.');
      } finally {
        if (isActive) {
          setCountriesLoading(false);
        }
      }
    }

    void loadCountries();

    return () => {
      isActive = false;
    };
  }, [locale]);

  useEffect(() => {
    let isActive = true;

    async function loadCurrencies() {
      setCurrenciesLoading(true);
      try {
        const response = await getCurrencies();
        if (!isActive) return;
        setCurrencies(response);
        setCurrencyCode((prev) => {
          const hasCurrent = response.some((item) => item.code === prev);
          return hasCurrent ? prev : response[0]?.code || '';
        });
      } catch {
        if (!isActive) return;
        setCurrencies([]);
        setError('Failed to load currencies. Please refresh and try again.');
      } finally {
        if (isActive) {
          setCurrenciesLoading(false);
        }
      }
    }

    void loadCurrencies();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError(copy.mismatchPassword);
      return;
    }

    if (!countryCode) {
      setError(copy.countryHint);
      return;
    }

    if (!address.trim()) {
      setError(copy.addressHint);
      return;
    }

    if (!currencyCode) {
      setError(copy.currencyHint);
      return;
    }

    setLoading(true);

    try {
      await register({
        email,
        password,
        role,
        display_name: displayName,
        country_code: countryCode,
        address: address.trim(),
        preferred_currency_code: currencyCode,
      });

      setSuccess(copy.successRegister);
      setTimeout(() => {
        void router.push(`/login?lang=${locale}`);
      }, 900);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`${THEME_CLASSES[theme]} min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
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
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
            <span>{copy.brand}</span>
          </Link>

          <div className="flex items-center gap-1 rounded-lg border border-[rgb(var(--stroke))] bg-[rgb(var(--card))]/80 p-1">
            {localeLinks.map((entry) => (
              <Link
                key={entry.lang}
                href={entry.href}
                className={`rounded-md px-2 py-1 text-xs transition ${
                  entry.lang === locale
                    ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
                    : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
                }`}
              >
                {entry.lang.toUpperCase()}
              </Link>
            ))}
          </div>
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">{copy.registerTitle}</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">{copy.registerSubtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="displayName" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.displayName}
              </label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.email}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              />
            </div>

            <div>
              <label htmlFor="role" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.role}
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              >
                {roles.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="country" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.country}
              </label>
              <select
                id="country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                required
                disabled={countriesLoading || countries.length === 0}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              >
                {countries.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">{copy.countryHint}</p>
            </div>

            <div>
              <label htmlFor="address" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.address}
              </label>
              <input
                id="address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              />
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">{copy.addressHint}</p>
            </div>

            <div>
              <label htmlFor="currency" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.currency}
              </label>
              <select
                id="currency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                required
                disabled={currenciesLoading || currencies.length === 0}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              >
                {currencies.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.code} — {item.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">{copy.currencyHint}</p>
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.password}
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1 block text-sm text-[rgb(var(--muted))]"
              >
                {copy.confirmPassword}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center"
            >
              {loading ? '...' : copy.register}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm text-[rgb(var(--muted))]">
            <span>{copy.haveAccount}</span>
            <Link
              href={`/login?lang=${locale}`}
              className="text-[rgb(var(--accent))] hover:underline"
            >
              {copy.signIn}
            </Link>
          </div>
        </section>

        <Link href="/" className="text-center text-sm text-[rgb(var(--muted))] hover:underline">
          {copy.backHome}
        </Link>
      </div>
    </main>
  );
}
