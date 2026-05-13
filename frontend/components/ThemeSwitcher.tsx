import { useState } from 'react';
import { THEME_LABELS, THEME_PRESETS, type Theme } from '../styles/themePresets';

type ThemeSwitcherProps = {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export default function ThemeSwitcher({ currentTheme, onThemeChange }: ThemeSwitcherProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const themes = THEME_PRESETS.map((p) => p.id);

  return (
    <>
      {/* Desktop — pill row */}
      <div
        role="group"
        aria-label="Select color theme"
        className="hidden rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))]/95 p-1 shadow-lg backdrop-blur md:flex"
      >
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={currentTheme === t}
            onClick={() => onThemeChange(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] active:scale-95 ${
              currentTheme === t
                ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
                : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
            }`}
          >
            {THEME_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Mobile — hamburger dropdown */}
      <div className="relative md:hidden">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open theme picker"
          onClick={() => setMenuOpen((open) => !open)}
          className="btn btn-ghost inline-flex items-center justify-center px-2.5 py-2"
        >
          <span aria-hidden className="relative flex h-4 w-5 flex-col justify-between">
            <span
              className={`h-0.5 w-full rounded bg-current transition-all duration-200 ${menuOpen ? 'translate-y-[7px] rotate-45' : ''}`}
            />
            <span
              className={`h-0.5 rounded bg-current transition-all duration-200 ${menuOpen ? 'w-0 opacity-0' : 'w-full'}`}
            />
            <span
              className={`h-0.5 w-full rounded bg-current transition-all duration-200 ${menuOpen ? '-translate-y-[7px] -rotate-45' : ''}`}
            />
          </span>
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Theme options"
            className="absolute right-0 top-full z-[70] mt-2 w-44 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))]/95 p-1 shadow-2xl backdrop-blur-md"
          >
            {themes.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={currentTheme === t}
                onClick={() => {
                  onThemeChange(t);
                  setMenuOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] active:scale-95 ${
                  currentTheme === t
                    ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
                    : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel))] hover:text-[rgb(var(--text))]'
                }`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
