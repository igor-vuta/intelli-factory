import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import ErrorBoundary from '../components/ErrorBoundary';
import { THEME_PRESETS, type Theme } from '../styles/themePresets';
import { updateFavicon } from '../hooks/useTheme';
import '../styles/globals.css';

const ACCENT_HEX: Record<Theme, string> = THEME_PRESETS.reduce(
  (acc, p) => { acc[p.id] = p.palette.accent; return acc; },
  {} as Record<Theme, string>
);

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const stored = localStorage.getItem('if-theme') as Theme | null;
    const theme: Theme = (stored && stored in ACCENT_HEX ? stored : 'modernDark') as Theme;
    updateFavicon(ACCENT_HEX[theme]);

    function onStorageChange(e: StorageEvent) {
      if (e.key === 'if-theme' && e.newValue && e.newValue in ACCENT_HEX) {
        updateFavicon(ACCENT_HEX[e.newValue as Theme]);
      }
    }
    window.addEventListener('storage', onStorageChange);
    return () => window.removeEventListener('storage', onStorageChange);
  }, []);

  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  );
}
