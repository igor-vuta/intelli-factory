import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  id?: string;
  children: ReactNode;
  className?: string;
  onClose: () => void;
  busy?: boolean;
};

export default function Modal({ id, children, className, onClose, busy = false }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  const pending = useRef(busy);
  useEffect(() => {
    close.current = onClose;
    pending.current = busy;
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = dialog.current;
    const heading = panel?.querySelector('h2');
    if (heading) heading.id = titleId;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pending.current) close.current();
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
        ) ?? []
      ).filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panel)
      ) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', keyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, [titleId]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      id={id}
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={busy}
      tabIndex={-1}
      className={`modal-backdrop ${className ?? ''}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
