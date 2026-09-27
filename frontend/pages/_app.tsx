import InteractionMotion from '../components/InteractionMotion';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { rememberLocale, rememberedLocale, validLocale } from '../lib/localePreference';
import { me } from '../lib/authClient';
import '../styles/globals.css';
import '../styles/experience.css';
import '../styles/identity.css';
import '../styles/landing.css';

// Latin + Cyrillic (Russian and Kazakh letters live in both Cyrillic subsets).
const plexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

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
      <div className={`contents ${plexSans.variable} ${plexMono.variable}`}>
        <InteractionMotion />
        <Component {...pageProps} />
      </div>
    </ErrorBoundary>
  );
}
