import { useEffect, useRef, useState } from 'react';
import PresetIcon from './PresetIcon';
import { THEME_LABELS, THEME_PRESETS, type Theme } from '../styles/themePresets';

type ThemeSwitcherProps = {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  compact?: boolean;
};

export default function ThemeSwitcher({ currentTheme, onThemeChange, compact }: ThemeSwitcherProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const themes = THEME_PRESETS.map((p) => p.id);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  return (
    <>
      {/* Desktop - pill row */}
      {!compact && (
        <div
          role="group"
          aria-label="Select color theme"
          className="hidden rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))]/95 p-1 shadow-lg backdrop-blur lg:flex"
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
      )}

      {/* Hamburger dropdown (always visible when compact, otherwise only below lg) */}
      <div
        ref={containerRef}
        className={`relative inline-flex items-center${compact ? '' : ' lg:hidden'}`}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Open theme picker"
          onClick={() => setMenuOpen((open) => !open)}
          className="btn btn-ghost inline-flex items-center justify-center px-2.5 py-2"
        >
          <PresetIcon src="/presets/theme.svg" alt="Select theme" size={20} />
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
