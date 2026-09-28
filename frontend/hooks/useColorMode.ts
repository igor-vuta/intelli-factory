import { useEffect, useSyncExternalStore } from 'react';
import {
  type ColorMode,
  type ColorModePreference,
  applyMode,
  readPreference,
  resolveMode,
  savePreference,
} from '../lib/colorMode';

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: light)');
  window.addEventListener('color-mode', onChange);
  window.addEventListener('storage', onChange);
  media.addEventListener('change', onChange);
  return () => {
    window.removeEventListener('color-mode', onChange);
    window.removeEventListener('storage', onChange);
    media.removeEventListener('change', onChange);
  };
}

const snapshot = () => `${readPreference()}:${resolveMode(readPreference())}`;

export function useColorMode(): {
  preference: ColorModePreference;
  mode: ColorMode;
  setPreference: (preference: ColorModePreference) => void;
} {
  const value = useSyncExternalStore(subscribe, snapshot, () => 'system:dark');
  const [preference, mode] = value.split(':') as [ColorModePreference, ColorMode];

  // Keep <html data-mode> in step when the system setting or another tab changes it.
  useEffect(() => applyMode(mode), [mode]);

  return { preference, mode, setPreference: savePreference };
}
