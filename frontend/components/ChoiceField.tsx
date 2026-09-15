import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useExperienceCopy } from '../hooks/useExperienceCopy';

export type Choice = { id: string; label: string; sublabel?: string; disabled?: boolean };
type Props = {
  options: Choice[];
  value: string;
  onSelect: (id: string, label: string) => void;
  text?: string;
  onTextChange?: (text: string) => void;
  label?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  emptyMessage?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
};

function ChoicePopup({
  anchor,
  children,
  id,
  label,
}: {
  anchor: React.RefObject<HTMLInputElement>;
  children: ReactNode;
  id: string;
  label?: string;
}) {
  const panel = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    function position() {
      const field = anchor.current;
      const list = panel.current;
      if (!field || !list) return;
      const rect = field.getBoundingClientRect();
      const viewport = window.visualViewport;
      const bottom = viewport ? viewport.offsetTop + viewport.height : innerHeight;
      const top = viewport?.offsetTop ?? 0;
      const below = bottom - rect.bottom - 12;
      const above = rect.top - top - 12;
      const upward = below < 200 && above > below;
      Object.assign(list.style, {
        width: `${Math.min(rect.width, innerWidth - 16)}px`,
        left: `${Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8))}px`,
        top: upward ? 'auto' : `${rect.bottom + 6}px`,
        bottom: upward ? `${innerHeight - rect.top + 6}px` : 'auto',
        maxHeight: `${Math.max(80, Math.min(300, upward ? above : below))}px`,
        visibility: 'visible',
      });
    }
    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    document.addEventListener('animationend', position);
    window.visualViewport?.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
      document.removeEventListener('animationend', position);
      window.visualViewport?.removeEventListener('resize', position);
    };
  }, [anchor]);
  return createPortal(
    <ul
      ref={panel}
      id={id}
      role="listbox"
      aria-label={label}
      className="choice-popup"
      style={{ visibility: 'hidden' }}
    >
      {children}
    </ul>,
    document.body
  );
}

/** Search and selection share one listbox. Free text is accepted only when explicitly enabled. */
export default function ChoiceField({
  options,
  value,
  onSelect,
  text,
  onTextChange,
  label,
  id,
  name,
  placeholder,
  className,
  required,
  disabled,
  emptyMessage,
  ...aria
}: Props) {
  const e = useExperienceCopy();
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-choices`;
  const input = useRef<HTMLInputElement>(null);
  const validation = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.id === value);
  const custom = !!onTextChange;
  const search = custom ? (text ?? '') : query;
  const filtered = options.filter((option) =>
    `${option.label} ${option.sublabel ?? ''}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
  );
  const actualOpen = open && !disabled;
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );
  useEffect(() => {
    if (actualOpen)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, actualOpen, listId]);
  function close() {
    setOpen(false);
    setQuery('');
  }
  function choose(option: Choice) {
    if (option.disabled) return;
    input.current?.removeAttribute('aria-invalid');
    onSelect(option.id, option.label);
    close();
  }
  function step(direction: number) {
    let index = actualOpen ? active + direction : direction > 0 ? 0 : filtered.length - 1;
    while (index >= 0 && index < filtered.length && filtered[index].disabled) index += direction;
    if (index >= 0 && index < filtered.length) setActive(index);
    setOpen(true);
  }
  return (
    <div className="choice-field">
      {label && (
        <label htmlFor={inputId}>
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
      )}
      <div className="choice-anchor">
        <input
          {...aria}
          ref={input}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={actualOpen}
          aria-controls={actualOpen ? listId : undefined}
          aria-autocomplete="list"
          aria-required={required}
          aria-activedescendant={actualOpen && filtered[active] ? `${listId}-${active}` : undefined}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={`choice-control ${className ?? ''}`}
          value={custom ? (text ?? '') : actualOpen ? query : (selected?.label ?? '')}
          placeholder={
            actualOpen && !custom ? e('Search options…') : (placeholder ?? e('Choose an option'))
          }
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            if (custom) setOpen(true);
          }}
          onClick={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onTextChange?.(event.target.value);
            input.current?.removeAttribute('aria-invalid');
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(close, 150);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && actualOpen) {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
            if (event.key === 'Tab') close();
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              step(event.key === 'ArrowDown' ? 1 : -1);
            }
            if (actualOpen && (event.key === 'Home' || event.key === 'End')) {
              event.preventDefault();
              const index =
                event.key === 'Home'
                  ? filtered.findIndex((o) => !o.disabled)
                  : filtered.map((o) => !o.disabled).lastIndexOf(true);
              if (index >= 0) setActive(index);
            }
            if (event.key === 'Enter') {
              if (actualOpen) {
                event.preventDefault();
                if (filtered[active]) choose(filtered[active]);
              } else if (!custom) {
                event.preventDefault();
                setOpen(true);
                setActive(0);
              }
            }
          }}
        />
        <span className={`choice-chevron ${actualOpen ? 'is-open' : ''}`} aria-hidden>
          ⌄
        </span>
        <input
          ref={validation}
          className="choice-validation"
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={custom ? (text ?? '') : value}
          readOnly={false}
          onChange={() => undefined}
          required={required}
          disabled={disabled}
          onInvalid={(event) => {
            event.preventDefault();
            input.current?.focus();
            input.current?.setAttribute('aria-invalid', 'true');
          }}
        />
      </div>
      {actualOpen && (
        <ChoicePopup anchor={input} id={listId} label={label ?? aria['aria-label']}>
          {filtered.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.id === value}
              aria-disabled={option.disabled || undefined}
              data-active={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onPointerMove={() => {
                if (!option.disabled) setActive(index);
              }}
              onClick={() => {
                choose(option);
                input.current?.removeAttribute('aria-invalid');
              }}
            >
              <span>
                <span className="choice-option-title">{option.label}</span>
                {option.sublabel && <small>{option.sublabel}</small>}
              </span>
              <span className="choice-check" aria-hidden>
                {option.id === value ? '✓' : ''}
              </span>
            </li>
          ))}
          {!filtered.length && (
            <li className="choice-empty" role="presentation">
              {emptyMessage ?? e('No matches found')}
            </li>
          )}
        </ChoicePopup>
      )}
    </div>
  );
}
