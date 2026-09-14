import { useId, useMemo, useRef, useState } from 'react';

export type ComboboxOption = {
  id: string;
  label: string;
  sublabel?: string;
};

type Props = {
  options: ComboboxOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
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
  const [activeIndex, setActiveIndex] = useState(0);
  const inputId = useId();
  const listId = `${inputId}-options`;
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
    setActiveIndex(0);
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
      <label htmlFor={inputId} className="text-sm text-[rgb(var(--muted))]">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>

      {selected ? (
        /* selected chip */
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
        /* search input + dropdown */
        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-required={required}
            aria-activedescendant={
              open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && open) {
                e.stopPropagation();
                setOpen(false);
              }
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setOpen(true);
                setActiveIndex((index) =>
                  Math.max(
                    0,
                    Math.min(filtered.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))
                  )
                );
              }
              if (e.key === 'Enter' && open && filtered[activeIndex]) {
                e.preventDefault();
                handleSelect(filtered[activeIndex]);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={`${base} focus-theme disabled:cursor-not-allowed disabled:opacity-50`}
          />

          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              className="fade-in absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] shadow-xl"
            >
              {allowEmpty && (
                <li
                  onMouseDown={() =>
                    handleSelect({
                      id: '',
                      label: '',
                    })
                  }
                  className="cursor-pointer px-3 py-2 text-sm text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/30"
                >
                  - None
                </li>
              )}
              {filtered.map((opt, index) => (
                <li
                  key={opt.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  style={
                    activeIndex === index ? { background: 'rgb(var(--accent-soft))' } : undefined
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(opt)}
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
