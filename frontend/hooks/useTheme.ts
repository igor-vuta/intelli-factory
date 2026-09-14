import { useEffect, useSyncExternalStore } from 'react';
import { THEME_CLASSES, THEME_PRESETS, type Theme } from '../styles/themePresets';

const STORAGE_KEY = 'if-theme';
const DEFAULT_THEME: Theme = 'modernDark';

const THEME_ACCENT_HEX: Record<Theme, string> = THEME_PRESETS.reduce(
  (acc, p) => {
    acc[p.id] = p.palette.accent;
    return acc;
  },
  {} as Record<Theme, string>
);

let _faviconSvgRaw: string | null = null;

function getFaviconSvg(): Promise<string | null> {
  if (_faviconSvgRaw !== null) return Promise.resolve(_faviconSvgRaw);
  return fetch('/favicon/favicon.svg')
    .then((res) => (res.ok ? res.text() : null))
    .then((text) => {
      _faviconSvgRaw = text;
      return text;
    })
    .catch(() => null);
}

export function updateFavicon(accentHex: string): void {
  getFaviconSvg().then((svg) => {
    if (!svg) return;
    const recolored = svg.replace(/fill="#[0-9a-fA-F]{3,8}"/gi, `fill="${accentHex}"`);
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(recolored)}`;
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')
      .forEach((el) => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = dataUrl;
    document.head.appendChild(link);
  });
}

/* Applies the theme class to <html> so CSS vars cascade everywhere. */
function applyThemeToRoot(theme: Theme) {
  const root = document.documentElement;
  root.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) root.classList.remove(cls);
  });
  root.classList.add(THEME_CLASSES[theme]);
  updateFavicon(THEME_ACCENT_HEX[theme]);
}

let fallbackTheme: Theme = DEFAULT_THEME;

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && Object.prototype.hasOwnProperty.call(THEME_CLASSES, stored)
      ? (stored as Theme)
      : fallbackTheme;
  } catch {
    return fallbackTheme;
  }
}

function subscribeTheme(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('if-theme-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('if-theme-change', onChange);
  };
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_THEME);

  useEffect(() => {
    applyThemeToRoot(theme);
  }, [theme]);

  function setTheme(newTheme: Theme) {
    fallbackTheme = newTheme;
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {}
    window.dispatchEvent(new Event('if-theme-change'));
  }

  return [theme, setTheme];
}
