// Light/dark preference for the new identity. A browser setting (not an account setting):
// 'system' follows prefers-color-scheme. _document.tsx applies it before first paint.

export type ColorModePreference = 'system' | 'light' | 'dark';
export type ColorMode = 'light' | 'dark';

export const COLOR_MODE_KEY = 'if-color-mode';
export const COLOR_MODE_PREFERENCES: ColorModePreference[] = ['system', 'light', 'dark'];
// Matches the identity's page background in each mode (styles/identity.css).
export const THEME_COLOR: Record<ColorMode, string> = { dark: '#0E1214', light: '#F3F5F6' };

// Holds the choice for this page view when storage is unavailable.
let unsavedPreference: ColorModePreference | null = null;

export function readPreference(): ColorModePreference {
  try {
    const stored = localStorage.getItem(COLOR_MODE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return unsavedPreference ?? 'system';
  }
}

export function resolveMode(preference: ColorModePreference): ColorMode {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyMode(mode: ColorMode) {
  document.documentElement.dataset.mode = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[mode]);
}

export function savePreference(preference: ColorModePreference) {
  unsavedPreference = preference;
  try {
    if (preference === 'system') localStorage.removeItem(COLOR_MODE_KEY);
    else localStorage.setItem(COLOR_MODE_KEY, preference);
  } catch {
    /* The choice still applies for this page view. */
  }
  applyMode(resolveMode(preference));
  window.dispatchEvent(new Event('color-mode'));
}

/** Inline, dependency-free version of readPreference + resolveMode + applyMode for _document. */
export const COLOR_MODE_SCRIPT = `(function(){var p='system';try{var s=localStorage.getItem('${COLOR_MODE_KEY}');if(s==='light'||s==='dark')p=s;}catch(e){}var m=p==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.dataset.mode=m;})();`;
