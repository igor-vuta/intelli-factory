import PresetIcon from '../components/PresetIcon';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FormEvent, useEffect, useState } from 'react';

import { resendVerificationEmail, verifyEmail } from '../lib/authClient';
import { getLocaleFromQuery, t } from '../lib/i18n';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { useTheme } from '../hooks/useTheme';
import { THEME_CLASSES } from '../styles/themePresets';

export default function VerifyEmailPage() {
  const router = useRouter();
  const locale = getLocaleFromQuery(router.query.lang);
  const copy = t(locale);

  const [theme, setTheme] = useTheme();
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    const value = router.query.token;
    if (typeof value === 'string') {
      setToken(value);
    }
  }, [router.isReady, router.query.token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await verifyEmail(token.trim());
      setSuccess(copy.verifyEmailSuccess);
      setTimeout(() => {
        void router.push(`/login?lang=${locale}`);
      }, 900);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : copy.verifyEmailFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setResendLoading(true);

    try {
      const result = await resendVerificationEmail(email.trim());
      setSuccess(result.message || copy.resendVerificationSuccess);
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : copy.verifyEmailFailed);
    } finally {
      setResendLoading(false);
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
            <PresetIcon src="/favicon/favicon.svg" alt="Intelli-Factory" size={32} className="rounded-md" />
            <span>{copy.brand}</span>
          </Link>
          <ThemeSwitcher currentTheme={theme} onThemeChange={setTheme} compact />
        </header>

        <section className="surface-1 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-semibold sm:text-3xl">{copy.verifyEmailTitle}</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">{copy.verifyEmailSubtitle}</p>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">{copy.verifyEmailHelp}</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="token" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.verifyEmailTokenLabel}
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
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
              {loading ? '...' : copy.verifyEmailAction}
            </button>
          </form>

          <form
            onSubmit={handleResend}
            className="mt-6 space-y-4 border-t border-[rgb(var(--stroke))]/40 pt-5"
          >
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-[rgb(var(--muted))]">
                {copy.verifyEmailEmailLabel}
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

            <button
              type="submit"
              disabled={resendLoading}
              className="btn btn-ghost w-full justify-center"
            >
              {resendLoading ? '...' : copy.resendVerificationAction}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
