import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

/**
 * Which records in a list are open. Arriving with `?focus=<id>` (from an overview card) opens
 * that record, turns to the page holding it and scrolls it into view, once per focus.
 */
export function useExpandedRecords(
  ids: string[],
  pageSize: number,
  setPage: (page: number) => void
) {
  const router = useRouter();
  // Records the user flipped away from their default (the focused record starts open).
  const [flipped, setFlipped] = useState<Set<string>>(() => new Set());
  const handled = useRef<string | null>(null);
  const focus = typeof router.query.focus === 'string' ? router.query.focus : null;
  const at = focus ? ids.indexOf(focus) : -1;

  useEffect(() => {
    if (!focus || at < 0 || handled.current === focus) return;
    handled.current = focus;
    setPage(Math.floor(at / pageSize) + 1);
    requestAnimationFrame(() =>
      document.getElementById(`record-${focus}`)?.scrollIntoView({
        block: 'center',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    );
  }, [focus, at, pageSize, setPage]);

  return {
    isOpen: (id: string) => (id === focus) !== flipped.has(id),
    toggle: (id: string) =>
      setFlipped((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
  };
}
