import InteractionMotion from '../components/InteractionMotion';
// IBM Plex ships with the app (Fontsource), so builds never fetch fonts from the network.
// Each weight declares every subset with a unicode-range, so a page downloads only the subsets
// its text uses (Latin for English, Cyrillic for Russian and Kazakh).
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import ErrorBoundary from '../components/ErrorBoundary';
import { useColorMode } from '../hooks/useColorMode';
import { rememberLocale, rememberedLocale, validLocale } from '../lib/localePreference';
import { me } from '../lib/authClient';
import '../styles/globals.css';
import '../styles/experience.css';
import '../styles/identity.css';
import '../styles/landing.css';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  useColorMode();
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
      if (cancelled) return;
      // Keep the address as typed (a 404 must still show the mistyped path), adding only ?lang.
      const [path, search = ''] = router.asPath.split('#')[0].split('?');
      const params = new URLSearchParams(search);
      params.set('lang', locale);
      await router.replace(
        { pathname: router.pathname, query: { ...router.query, lang: locale } },
        `${path}?${params}${window.location.hash}`,
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
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
