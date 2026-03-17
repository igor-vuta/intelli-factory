import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useMemo, useState } from 'react';

import { login, type UserRole } from '../lib/authClient';
import { getLocaleFromQuery, supportedLocales, t } from '../lib/i18n';
import { THEME_CLASSES, type Theme } from '../styles/themePresets';

export default function LoginPage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme] = useState<Theme>('midnightCore');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const localeLinks = useMemo(
    () =>
      supportedLocales.map((lang) => ({
        lang,
        href: `/login?lang=${lang}`,
      })),
    []
  );

  function routeByRole(role: UserRole): string {
    if (role === 'FACTORY') return '/app/factory';
    if (role === 'LOGIST') return '/app/logist';
    if (role === 'ADMIN') return '/app/admin';
    return '/app/customer';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const auth = await login({ email, password });
      setSuccess(copy.successLogin);
      setTimeout(() => {
        void router.push(`${routeByRole(auth.user.role)}?lang=${locale}`);
      }, 700);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed');
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
          <h1 className="text-2xl font-semibold sm:text-3xl">{copy.loginTitle}</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">{copy.loginSubtitle}</p>

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
              {loading ? '...' : copy.login}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm text-[rgb(var(--muted))]">
            <span>{copy.noAccount}</span>
            <Link
              href={`/register?lang=${locale}`}
              className="text-[rgb(var(--accent))] hover:underline"
            >
              {copy.createOne}
            </Link>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-[rgb(var(--muted))]">
            <span>{copy.needVerification}</span>
            <Link
              href={`/verify-email?lang=${locale}`}
              className="text-[rgb(var(--accent))] hover:underline"
            >
              {copy.resendVerificationAction}
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
