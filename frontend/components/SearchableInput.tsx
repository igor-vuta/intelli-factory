/**
 * Free-text input with autocomplete suggestion dropdown.
 *
 * Unlike Combobox, the user is NOT locked to picking from the list — they can
 * type anything. Selecting a suggestion fills the text field and records the
 * matched option id so the backend can use an existing FK when available.
 *
 * Props:
 *   text      — current raw string in the input
 *   selectedId — id of the matched suggestion, or '' for free-text
 *   onChange  — called with (text, id) on every change
 */
import { useMemo, useRef, useState } from 'react';

import { type ComboboxOption } from './Combobox';

type Props = {
  suggestions: ComboboxOption[];
  text: string;
  selectedId: string;
  onChange: (text: string, id: string) => void;
  placeholder: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
};

export default function SearchableInput({
  suggestions,
  text,
  selectedId,
  onChange,
  placeholder,
  label,
  required = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = text.toLowerCase();
    if (!q) return suggestions.slice(0, 10);
    return suggestions.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 10);
  }, [suggestions, text]);

  function pickSuggestion(opt: ComboboxOption) {
    onChange(opt.label, opt.id);
    setOpen(false);
    inputRef.current?.blur();
  }

  const base =
    'w-full rounded-xl border bg-[rgb(var(--panel))] px-3 py-2 text-sm focus-theme disabled:cursor-not-allowed disabled:opacity-50';

  const borderClass = selectedId ? 'border-emerald-600/60' : 'border-[rgb(var(--stroke))]';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-[rgb(var(--muted))]">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => onChange(e.target.value, '')}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault();
              pickSuggestion(filtered[0]);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`${base} ${borderClass} pr-20`}
        />

        {/* Matched indicator */}
        {selectedId && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400">
            ✓ matched
          </span>
        )}

        {open && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] shadow-xl">
            {filtered.map((opt) => (
              <li
                key={opt.id}
                onMouseDown={() => pickSuggestion(opt)}
                className={`cursor-pointer px-3 py-2 text-sm hover:bg-[rgb(var(--stroke))]/30 ${
                  opt.id === selectedId ? 'font-medium text-emerald-300' : ''
                }`}
              >
                {opt.label}
                {opt.sublabel && (
                  <span className="ml-2 text-xs text-[rgb(var(--muted))]">{opt.sublabel}</span>
                )}
              </li>
            ))}
            {filtered.length === 0 && text && (
              <li className="px-3 py-2 text-xs text-[rgb(var(--muted))]">
                No catalogue match — your description will be used as-is
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
