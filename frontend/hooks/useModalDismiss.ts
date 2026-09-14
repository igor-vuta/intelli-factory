import { useCallback, useId, useRef } from 'react';

export function useModalDismiss(onDismiss: () => void) {
  const dialogId = useId();
  const closing = useRef(false);
  const onClose = useCallback(() => {
    if (closing.current) return;
    const backdrop = document.getElementById(dialogId);
    if (!backdrop || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDismiss();
      return;
    }
    closing.current = true;
    const panel = backdrop.firstElementChild;
    panel?.animate(
      [
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        {
          opacity: 0,
          transform: `translateX(${backdrop.dataset.side === 'left' ? '-100%' : '100%'})`,
        },
      ],
      { duration: 180, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }
    );
    const fade = backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 180,
      fill: 'forwards',
    });
    fade.onfinish = onDismiss;
  }, [dialogId, onDismiss]);
  return { dialogId, onClose };
}
