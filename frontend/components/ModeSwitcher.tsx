import { useColorMode } from '../hooks/useColorMode';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { COLOR_MODE_PREFERENCES, type ColorModePreference } from '../lib/colorMode';

const LABELS: Record<ColorModePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function ModeIcon({ preference }: { preference: ColorModePreference }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  if (preference === 'light')
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="3.5" />
        <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
      </svg>
    );
  if (preference === 'dark')
    return (
      <svg {...common}>
        <path d="M15.5 12.4A6.5 6.5 0 0 1 7.6 4.5a6.5 6.5 0 1 0 7.9 7.9Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="3" y="4" width="14" height="10" rx="1.5" />
      <path d="M7.5 17h5M10 14v3" />
    </svg>
  );
}

/** System / Light / Dark as a native radio group: arrow keys, labels and state come for free. */
export default function ModeSwitcher() {
  const e = useExperienceCopy();
  const { preference, setPreference } = useColorMode();
  return (
    <fieldset className="mode-switcher">
      <legend className="sr-only">{e('Colour mode')}</legend>
      {COLOR_MODE_PREFERENCES.map((option) => (
        <label key={option} className="mode-switcher-option" title={e(LABELS[option])}>
          <input
            type="radio"
            name="color-mode"
            value={option}
            checked={preference === option}
            onChange={() => setPreference(option)}
          />
          <ModeIcon preference={option} />
          <span className="sr-only">{e(LABELS[option])}</span>
        </label>
      ))}
    </fieldset>
  );
}
