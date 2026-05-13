import { useEffect, useState } from 'react';
import { THEME_CLASSES, type Theme } from '../styles/themePresets';

const STORAGE_KEY = 'if-theme';
const DEFAULT_THEME: Theme = 'modernDark';

/** Applies the theme class to <html> so CSS vars cascade everywhere (body, portals, scrollbars). */
function applyThemeToRoot(theme: Theme) {
  const root = document.documentElement;
  root.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) root.classList.remove(cls);
  });
  root.classList.add(THEME_CLASSES[theme]);
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const active = (stored && stored in THEME_CLASSES ? stored : DEFAULT_THEME) as Theme;
      setThemeState(active);
      applyThemeToRoot(active);
    } catch {
      applyThemeToRoot(DEFAULT_THEME);
    }
  }, []);

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme);
    applyThemeToRoot(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      /* ignore */
    }
  }

  return [theme, setTheme];
}
