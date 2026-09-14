import { useExperienceCopy } from '../hooks/useExperienceCopy';
import { useEffect, useRef, useState } from 'react';
import PresetIcon from './PresetIcon';
import { THEME_PRESETS, type Theme } from '../styles/themePresets';

type ThemeSwitcherProps = {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  compact?: boolean;
};

export default function ThemeSwitcher({
  currentTheme,
  onThemeChange,
  compact,
}: ThemeSwitcherProps) {
  const e = useExperienceCopy();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    container.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function choose(theme: Theme) {
    onThemeChange(theme);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      ref={container}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
        if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(
          container.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []
        );
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }}
    >
      {!compact && (
        <div
          role="group"
          aria-label={e('Select color theme')}
          className="theme-segments hidden lg:flex"
        >
          {THEME_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              aria-pressed={currentTheme === preset.id}
              onClick={() => onThemeChange(preset.id)}
            >
              <span className="theme-swatch" style={{ background: preset.palette.accent }} />
              {preset.label}
            </button>
          ))}
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={e('Open theme picker')}
        onClick={() => setOpen(!open)}
        className={`btn btn-ghost ${compact ? '' : 'lg:hidden'}`}
      >
        <PresetIcon src="/presets/theme.svg" alt="" size={20} />
      </button>
      {open && (
        <div role="menu" aria-label={e('Theme options')} className="theme-menu">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="menuitemradio"
              aria-checked={currentTheme === preset.id}
              onClick={() => choose(preset.id)}
            >
              <span className="theme-swatch" style={{ background: preset.palette.accent }} />
              <span className="flex-1">{preset.label}</span>
              <span aria-hidden>{currentTheme === preset.id ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
