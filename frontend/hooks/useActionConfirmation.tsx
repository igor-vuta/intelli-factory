import { useEffect, useRef, useState } from 'react';
import Modal from '../components/Modal';
import { useExperienceCopy } from './useExperienceCopy';

export function useActionConfirmation() {
  const e = useExperienceCopy();
  const [title, setTitle] = useState<string | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(() => () => resolver.current?.(false), []);
  function settle(confirmed: boolean) {
    resolver.current?.(confirmed);
    resolver.current = null;
    setTitle(null);
  }
  function confirm(action: string): Promise<boolean> {
    resolver.current?.(false);
    setTitle(action);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }
  const confirmation = title && (
    <Modal onClose={() => settle(false)}>
      <section className="confirmation-sheet">
        <div className="sheet-title">
          <h2>{e(title)}</h2>
          <button type="button" aria-label={e('Close')} onClick={() => settle(false)}>
            ×
          </button>
        </div>
        <p>{e('This changes the real order status. Continue?')}</p>
        <div className="flex gap-3">
          <button type="button" className="btn btn-ghost" onClick={() => settle(false)}>
            {e('Cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => settle(true)}>
            {e('Confirm')}
          </button>
        </div>
      </section>
    </Modal>
  );
  return { confirm, confirmation };
}
