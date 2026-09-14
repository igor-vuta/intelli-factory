import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useExperienceCopy } from '../hooks/useExperienceCopy';

type Identified = { id: string };

/** Reordering is a local presentation preference; it never changes business status. */
export default function ReorderableCards<T extends Identified>({
  items,
  storageKey,
  render,
  onExternalDrop,
}: {
  items: T[];
  storageKey: string;
  render: (item: T, index: number) => ReactNode;
  onExternalDrop?: (item: T, x: number, y: number) => void;
}) {
  const e = useExperienceCopy();
  const [order, setOrder] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const target = useRef<string | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
        setOrder(
          Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
        );
      } catch {
        setOrder([]);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);
  const sorted = [...items].sort((a, b) => {
    const position = (id: string) =>
      order.includes(id)
        ? order.indexOf(id)
        : order.length + items.findIndex((item) => item.id === id);
    return position(a.id) - position(b.id);
  });
  function move(id: string, destination: string) {
    if (id === destination) return;
    const before = new Map(
      [...nodes.current].map(([key, node]) => [key, node.getBoundingClientRect()])
    );
    const next = sorted.map((item) => item.id);
    const from = next.indexOf(id);
    const to = next.indexOf(destination);
    if (from < 0 || to < 0) return;
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Session ordering remains available. */
    }
    setAnnouncement(`${e('Position')} ${to + 1} / ${next.length}`);
    requestAnimationFrame(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      nodes.current.forEach((node, key) => {
        const old = before.get(key);
        if (!old) return;
        const current = node.getBoundingClientRect();
        node.animate(
          [
            { transform: `translate(${old.x - current.x}px, ${old.y - current.y}px)` },
            { transform: 'translate(0,0)' },
          ],
          { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      });
    });
  }
  return (
    <>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {sorted.map((item, index) => (
        <div
          key={item.id}
          className={`reorder-card ${dragging === item.id ? 'is-dragging' : ''}`}
          ref={(node) => {
            if (node) nodes.current.set(item.id, node);
            else nodes.current.delete(item.id);
          }}
        >
          <button
            type="button"
            className="card-grip"
            aria-label={`${e('Rearrange card')} ${index + 1}`}
            title={e('Drag to rearrange. Use arrow keys to move.')}
            onKeyDown={(event) => {
              const offset = ['ArrowRight', 'ArrowDown'].includes(event.key)
                ? 1
                : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                  ? -1
                  : 0;
              if (!offset) return;
              event.preventDefault();
              const neighbour = sorted[index + offset];
              if (neighbour) move(item.id, neighbour.id);
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(item.id);
              target.current = null;
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              target.current = null;
              nodes.current.forEach((node, id) => {
                const box = node.getBoundingClientRect();
                const over =
                  id !== item.id &&
                  event.clientX >= box.left &&
                  event.clientX <= box.right &&
                  event.clientY >= box.top &&
                  event.clientY <= box.bottom;
                node.classList.toggle('is-drop-target', over);
                if (over) target.current = id;
              });
            }}
            onPointerUp={(event) => {
              if (target.current) move(item.id, target.current);
              else onExternalDrop?.(item, event.clientX, event.clientY);
              event.currentTarget.releasePointerCapture(event.pointerId);
              setDragging(null);
              nodes.current.forEach((node) => node.classList.remove('is-drop-target'));
            }}
            onPointerCancel={() => {
              setDragging(null);
              target.current = null;
              nodes.current.forEach((node) => node.classList.remove('is-drop-target'));
            }}
          >
            <span aria-hidden>⠿</span>
          </button>
          {render(item, index)}
        </div>
      ))}
    </>
  );
}
