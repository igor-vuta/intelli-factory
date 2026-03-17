/**
 * Google-search-bar style combobox.
 * Type to filter, click (or press Enter) to select, click × to clear.
 */
import { useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  id: string;
  /** Primary label shown in the list and the chip when selected */
  label: string;
  /** Optional secondary info shown in smaller text */
  sublabel?: string;
};

type Props = {
  options: ComboboxOption[];
  /** Currently selected option id, or '' for nothing selected */
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
  /** Allow clearing back to empty (shows "— None" as first list item) */
  allowEmpty?: boolean;
  required?: boolean;
};

export default function Combobox({
  options,
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
  allowEmpty = false,
  required = false,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 12);
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 12);
  }, [options, query]);

  function handleSelect(option: ComboboxOption) {
    onChange(option.id);
    setQuery('');
    setOpen(false);
  }

  function handleClear() {
    onChange('');
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const base =
    'w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm';

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-[rgb(var(--muted))]">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {selected ? (
        /* ── selected chip ── */
        <div className={`${base} flex items-center justify-between`}>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{selected.label}</span>
            {selected.sublabel && (
              <span className="block truncate text-xs text-[rgb(var(--muted))]">
                {selected.sublabel}
              </span>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[rgb(var(--muted))] transition hover:bg-[rgb(var(--stroke))]/40 hover:text-[rgb(var(--text))]"
              aria-label="Clear selection"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        /* ── search input + dropdown ── */
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && filtered[0]) {
                e.preventDefault();
                handleSelect(filtered[0]);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={`${base} focus-theme disabled:cursor-not-allowed disabled:opacity-50`}
          />

          {open && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] shadow-xl">
              {allowEmpty && (
                <li
                  onMouseDown={() => handleSelect({ id: '', label: '' })}
                  className="cursor-pointer px-3 py-2 text-sm text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/30"
                >
                  — None
                </li>
              )}
              {filtered.map((opt) => (
                <li
                  key={opt.id}
                  onMouseDown={() => handleSelect(opt)}
                  className="cursor-pointer px-3 py-2 text-sm hover:bg-[rgb(var(--stroke))]/30"
                >
                  <span>{opt.label}</span>
                  {opt.sublabel && (
                    <span className="ml-2 text-xs text-[rgb(var(--muted))]">{opt.sublabel}</span>
                  )}
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-[rgb(var(--muted))]">No matches found</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
