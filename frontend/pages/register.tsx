import PresetIcon from '../components/PresetIcon';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import AddressPicker, { type AddressValue } from '../components/AddressPicker';
import {
  getCountries,
  getCurrencies,
  register,
  type CountryItem,
  type CurrencyItem,
  type UserRole,
} from '../lib/authClient';
import { formatCurrencyOptionLabel } from '../lib/formatting';
import { getLocaleFromQuery, supportedLocales, t } from '../lib/i18n';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { useTheme } from '../hooks/useTheme';
import { THEME_CLASSES } from '../styles/themePresets';

const roles: {
  value: UserRole;
  label: string;
}[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'FACTORY', label: 'Factory' },
  { value: 'LOGIST', label: 'Logist' },
];

export default function RegisterPage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme, setTheme] = useTheme();

  const localeLinks = useMemo(
    () =>
      supportedLocales.map((lang) => ({
        lang,
        href: `/register?lang=${lang}`,
      })),
    []
  );

  const [displayName, setDisplayName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [addressValue, setAddressValue] = useState<AddressValue | null>(null);
  const [currencyCode, setCurrencyCode] = useState('');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [currencies, setCurrencies] = useState<CurrencyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [currenciesLoading, setCurrenciesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Logist-only: initial delivery offer
  const [showLogistOffer, setShowLogistOffer] = useState(false);
  const [initialOfferBasePrice, setInitialOfferBasePrice] = useState('');
  const [initialOfferCurrency, setInitialOfferCurrency] = useState('');
  const [initialOfferDescription, setInitialOfferDescription] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadCountries() {
      setCountriesLoading(true);
      try {
        const response = await getCountries(locale);
        if (!isActive) return;
        setCountries(response);
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

    if (!addressValue?.countryCode) {
      setError(copy.countryHint);
      return;
    }

    if (
      !addressValue?.regionName?.trim() ||
      !addressValue?.cityName?.trim() ||
      !addressValue?.street?.trim()
    ) {
      setError(copy.addressHint);
      return;
    }

    if (!currencyCode) {
      setError(copy.currencyHint);
      return;
    }

    if (phone.trim() && (phone.trim().length < 7 || phone.trim().length > 15)) {
      setError('Phone number must be 7–15 characters.');
      return;
    }

    if (contactName.trim() && (contactName.trim().length < 2 || contactName.trim().length > 120)) {
      setError('Contact name must be 2–120 characters.');
      return;
    }

    if (role === 'LOGIST' && showLogistOffer && initialOfferBasePrice !== '') {
      const price = Number(initialOfferBasePrice);
      if (isNaN(price) || price < 0) {
        setError('Base delivery price must be a non-negative number.');
        return;
      }
      if (!initialOfferCurrency) {
        setError('Offer currency is required when base price is set.');
        return;
      }
    }

    setLoading(true);

    try {
      const logistOfferPrice =
        role === 'LOGIST' && showLogistOffer && initialOfferBasePrice !== ''
          ? Number(initialOfferBasePrice)
          : undefined;

      await register({
        email,
        password,
        role,
        display_name: displayName,
        contact_name: contactName.trim() || undefined,
        phone: phone.trim() || undefined,
        country_code: addressValue!.countryCode,
        region_name: addressValue!.regionName,
        city_name: addressValue!.cityName,
        street: addressValue!.street,
        postal_code: addressValue!.postalCode,
        preferred_currency_code: currencyCode,
        initial_offer_base_price: logistOfferPrice,
        initial_offer_currency_code:
          logistOfferPrice !== undefined ? initialOfferCurrency || undefined : undefined,
        initial_offer_description:
          logistOfferPrice !== undefined && initialOfferDescription.trim()
            ? initialOfferDescription.trim()
            : undefined,
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
            <PresetIcon
              src="/favicon/favicon.svg"
              alt="Intelli-Factory"
              size={32}
              className="rounded-md"
            />
            <span>{copy.brand}</span>
          </Link>

          <div className="flex items-center gap-2">
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
            <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} compact />
          </div>
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">{copy.registerTitle}</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">{copy.registerSubtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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

            <div className="grid grid-cols-2 gap-3">
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
              <label htmlFor="displayName" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {role === 'FACTORY'
                  ? copy.legalName
                  : role === 'LOGIST'
                    ? copy.companyName
                    : copy.displayName}
              </label>
              <input
                id="displayName"
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              />
            </div>

            {role !== 'CUSTOMER' && (
              <div>
                <label
                  htmlFor="contactName"
                  className="mb-1 block text-sm text-[rgb(var(--muted))]"
                >
                  {copy.contactNameOptional}
                </label>
                <input
                  id="contactName"
                  type="text"
                  maxLength={120}
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm text-[rgb(var(--muted))]">{copy.address}</label>
              <AddressPicker
                value={addressValue}
                onChange={setAddressValue}
                countries={countries}
                countriesLoading={countriesLoading}
                required
              />
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
                    {formatCurrencyOptionLabel(item.code, item.name)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">{copy.currencyHint}</p>
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.phoneOptional}
              </label>
              <input
                id="phone"
                type="tel"
                maxLength={15}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 700 000 0000"
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
              />
            </div>

            {/* Logist seed initial delivery offer */}
            {role === 'LOGIST' && (
              <details
                open={showLogistOffer}
                onToggle={(e) => setShowLogistOffer((e.currentTarget as HTMLDetailsElement).open)}
                className="rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-4 py-3"
              >
                <summary className="cursor-pointer select-none text-sm font-medium text-[rgb(var(--muted))]">
                  {copy.setupDeliveryProfile}
                </summary>

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="initialOfferBasePrice"
                        className="mb-1 block text-sm text-[rgb(var(--muted))]"
                      >
                        {copy.initialOfferBasePrice}
                      </label>
                      <input
                        id="initialOfferBasePrice"
                        type="number"
                        min={0}
                        step="0.01"
                        value={initialOfferBasePrice}
                        onChange={(e) => setInitialOfferBasePrice(e.target.value)}
                        className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] px-3 py-2"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="initialOfferCurrency"
                        className="mb-1 block text-sm text-[rgb(var(--muted))]"
                      >
                        {copy.initialOfferCurrency}
                      </label>
                      <select
                        id="initialOfferCurrency"
                        value={initialOfferCurrency}
                        onChange={(e) => setInitialOfferCurrency(e.target.value)}
                        disabled={currenciesLoading || currencies.length === 0}
                        className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] px-3 py-2"
                      >
                        <option value="">-</option>
                        {currencies.map((item) => (
                          <option key={item.code} value={item.code}>
                            {formatCurrencyOptionLabel(item.code, item.name)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="initialOfferDescription"
                      className="mb-1 block text-sm text-[rgb(var(--muted))]"
                    >
                      {copy.initialOfferDescription}
                    </label>
                    <textarea
                      id="initialOfferDescription"
                      rows={3}
                      maxLength={500}
                      value={initialOfferDescription}
                      onChange={(e) => setInitialOfferDescription(e.target.value)}
                      className="focus-theme w-full resize-none rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </details>
            )}

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
