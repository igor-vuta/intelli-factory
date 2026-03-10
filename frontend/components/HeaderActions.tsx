import Link from 'next/link';
import { useState } from 'react';
import type { Theme } from '../styles/themePresets';

type HeaderActionsProps = {
  theme: Theme;
  themeLabel: Record<Theme, string>;
  onThemeChange: (theme: Theme) => void;
};

export default function HeaderActions({ theme, themeLabel, onThemeChange }: HeaderActionsProps) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const themes = Object.keys(themeLabel) as Theme[];

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div
        role="group"
        aria-label="Select color theme"
        className="hidden rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))]/95 p-1 shadow-lg backdrop-blur md:block"
      >
        {themes.map((itemTheme) => {
          const active = theme === itemTheme;
          return (
            <button
              key={itemTheme}
              type="button"
              aria-pressed={active}
              onClick={() => onThemeChange(itemTheme)}
              className={`mx-0.5 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))] active:scale-95 ${
                active
                  ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
                  : 'text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
              }`}
            >
              {themeLabel[itemTheme]}
            </button>
          );
        })}
      </div>

      <div className="relative md:hidden">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={themeMenuOpen}
          aria-label="Open theme picker"
          onClick={() => {
            setThemeMenuOpen((open) => !open);
            setMobileMenuOpen(false);
          }}
          className="btn btn-ghost whitespace-nowrap text-sm"
        >
          Theme: {themeLabel[theme]}
        </button>

        {themeMenuOpen && (
          <div
            role="menu"
            aria-label="Theme options"
            className="absolute right-0 top-full z-[70] mt-2 w-44 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))]/95 p-1 shadow-2xl backdrop-blur-md"
          >
            {themes.map((itemTheme) => {
              const active = theme === itemTheme;
              return (
                <button
                  key={itemTheme}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onThemeChange(itemTheme);
                    setThemeMenuOpen(false);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg))] active:scale-95 ${
                    active
                      ? 'bg-[rgb(var(--accent-soft))] text-[rgb(var(--text))]'
                      : 'text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel))] hover:text-[rgb(var(--text))]'
                  }`}
                >
                  {themeLabel[itemTheme]}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={mobileMenuOpen}
        aria-label="Open navigation menu"
        onClick={() => {
          setMobileMenuOpen((open) => !open);
          setThemeMenuOpen(false);
        }}
        className="btn btn-ghost inline-flex items-center justify-center gap-2 px-3 text-sm md:hidden"
      >
        <span>Menu</span>
        <span aria-hidden className="relative h-3.5 w-4">
          <span className="absolute left-0 top-0 h-0.5 w-4 rounded bg-current" />
          <span className="absolute left-0 top-1.5 h-0.5 w-4 rounded bg-current" />
          <span className="absolute left-0 top-3 h-0.5 w-4 rounded bg-current" />
        </span>
      </button>

      <Link
        href="/login"
        className="btn btn-ghost hidden whitespace-nowrap text-sm md:inline-flex"
        aria-label="Log in to your Intelli-Factory account"
      >
        Log in
      </Link>
      <Link
        href="/register"
        className="btn btn-primary hidden whitespace-nowrap text-sm md:inline-flex"
        aria-label="Create a new Intelli-Factory account"
      >
        Get started
      </Link>

      {mobileMenuOpen && (
        <div
          role="menu"
          aria-label="Mobile navigation"
          className="absolute right-0 top-full z-[70] mt-2 w-52 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))]/95 p-2 shadow-2xl backdrop-blur-md md:hidden"
        >
          <Link
            href="/login"
            className="mb-1 block rounded-lg px-3 py-2 text-sm font-medium text-[rgb(var(--text))] transition hover:bg-[rgb(var(--panel))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]"
            role="menuitem"
            onClick={() => setMobileMenuOpen(false)}
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="block rounded-lg bg-[rgb(var(--accent-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--text))] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]"
            role="menuitem"
            onClick={() => setMobileMenuOpen(false)}
          >
            Get started
          </Link>
        </div>
      )}
    </div>
  );
}
