import { useEffect, useRef, useState } from 'react';
import { useExperienceCopy } from '../../hooks/useExperienceCopy';

// The request lifecycle as the backend enforces it (see transactions.py can_* flags).
const STAGES = [
  { name: 'Request', actor: 'Customer' },
  { name: 'Offers', actor: 'Factory + logistics' },
  { name: 'Choice', actor: 'Customer' },
  { name: 'Contract', actor: 'Platform' },
  { name: 'Signatures', actor: 'All three parties' },
  { name: 'Payment', actor: 'Customer' },
  { name: 'Delivery', actor: 'Factory, then logistics' },
  { name: 'Accepted', actor: 'Customer' },
] as const;

export default function Lifecycle() {
  const e = useExperienceCopy();
  const list = useRef<HTMLOListElement>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlayed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="how-it-works"
      className="landing-section lifecycle"
      aria-labelledby="lifecycle-title"
    >
      <h2 id="lifecycle-title">{e('From request to delivery, one timeline.')}</h2>
      <p className="landing-lead">
        {e('Every step has an owner, and a step only opens when the one before it is done.')}
      </p>
      <ol ref={list} className={`lifecycle-track${played ? ' is-played' : ''}`}>
        {STAGES.map((stage, k) => (
          <li key={stage.name} style={{ '--stage': k } as React.CSSProperties}>
            <span className="lifecycle-node" aria-hidden="true" />
            {stage.name === 'Signatures' && (
              <span className="lifecycle-checks" aria-hidden="true">
                ✓✓✓
              </span>
            )}
            <strong>{e(stage.name)}</strong>
            <span>{e(stage.actor)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
