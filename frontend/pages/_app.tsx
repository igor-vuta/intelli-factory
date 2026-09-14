import { WelcomePreferences } from '../components/Preferences';
import InteractionMotion from '../components/InteractionMotion';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { rememberLocale, rememberedLocale, validLocale } from '../lib/localePreference';
import { me } from '../lib/authClient';
import '../styles/globals.css';
import '../styles/experience.css';

export default function App({ Component, pageProps }: AppProps) {
  useTheme();
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    if (validLocale(router.query.lang)) {
      rememberLocale(router.query.lang);
      document.documentElement.lang = router.query.lang;
      return;
    }
    let cancelled = false;
    async function restore() {
      let locale = rememberedLocale();
      if (router.pathname.startsWith('/app/')) {
        try {
          const auth = await me();
          if (validLocale(auth.user.preferred_locale)) locale = auth.user.preferred_locale;
        } catch {
          /* The workspace handles authentication errors. */
        }
      }
      if (!cancelled)
        await router.replace(
          {
            pathname: router.pathname,
            query: { ...router.query, lang: locale },
            hash: window.location.hash,
          },
          undefined,
          { shallow: true }
        );
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [router, router.isReady, router.query.lang]);
  if (!router.isReady || !validLocale(router.query.lang)) return null;
  return (
    <ErrorBoundary>
      <InteractionMotion />
      <WelcomePreferences />
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
