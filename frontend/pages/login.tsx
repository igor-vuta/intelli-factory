import { rememberLocale } from '../lib/localePreference';
import GuidanceHint from '../components/GuidanceHint';
import LocaleSwitcher from '../components/LocaleSwitcher';
import AuthStory from '../components/AuthStory';
import { workspacePath } from '../lib/navigation';
import PresetIcon from '../components/PresetIcon';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useState } from 'react';

import { login, saveAccountLocale } from '../lib/authClient';
import { getLocaleFromQuery, t } from '../lib/i18n';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { useTheme } from '../hooks/useTheme';

export default function LoginPage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme, setTheme] = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const auth = await login({
        email,
        password,
      });
      setSuccess(copy.successLogin);
      const nextLocale = auth.user.preferred_locale ?? locale;
      rememberLocale(nextLocale);
      if (!auth.user.preferred_locale) {
        // First login for an existing account adopts the current interface language.
        await saveAccountLocale(nextLocale).catch(() => undefined);
      }
      await router.push(workspacePath(auth.user.role, nextLocale));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`auth-screen min-h-screen bg-[rgb(var(--bg))] px-4 py-8 text-[rgb(var(--text))] sm:px-8`}
    >
      <AuthStory />
      <div className="auth-form-column mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <Link
            href={`/?lang=${locale}`}
            className="inline-flex items-center gap-2 text-sm text-[rgb(var(--muted))]"
          >
            <PresetIcon
              src="/presets/brand.svg"
              alt="Intelli-Factory"
              size={32}
              className="rounded-md"
            />
            <span>{copy.brand}</span>
          </Link>

          <div className="flex items-center gap-2">
            <LocaleSwitcher currentLocale={locale} basePath="/login" />
            <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} compact />
          </div>
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">{copy.loginTitle}</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">{copy.loginSubtitle}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <GuidanceHint hint="login" />
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.email}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
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
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2"
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center"
            >
              {loading && <span className="spinner" aria-hidden />} {copy.login}
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

        <Link
          href={`/?lang=${locale}`}
          className="text-center text-sm text-[rgb(var(--muted))] hover:underline"
        >
          {copy.backHome}
        </Link>
      </div>
    </main>
  );
}
