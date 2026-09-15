import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/router';
import { firstSteps, guidanceText, type GuidedRole } from '../lib/guidance';
import { getLocaleFromQuery } from '../lib/i18n';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('guidance-visibility', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('guidance-visibility', callback);
  };
}

export default function GettingStarted({
  role,
  userId,
  completed,
  onNavigate,
}: {
  role: GuidedRole;
  userId: string;
  completed: boolean[];
  onNavigate: (view: string) => void;
}) {
  const { query } = useRouter();
  const locale = getLocaleFromQuery(query.lang);
  const storageKey = `getting-started:v1:${userId}:${role}`;
  const [temporaryHidden, setTemporaryHidden] = useState<boolean | null>(null);
  const storedHidden = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) === 'hidden';
      } catch {
        return false;
      }
    },
    () => false
  );
  const hidden = temporaryHidden ?? storedHidden;
  const steps = firstSteps[role];
  function toggle() {
    try {
      localStorage.setItem(storageKey, hidden ? 'visible' : 'hidden');
    } catch {
      setTemporaryHidden(!hidden);
      return;
    }
    window.dispatchEvent(new Event('guidance-visibility'));
  }
  return (
    <section className="getting-started" aria-label={guidanceText(locale, 'checklist')}>
      <div className="getting-started-heading">
        {!hidden && (
          <div>
            <h2>{guidanceText(locale, 'checklist')}</h2>
            <p>
              {completed.filter(Boolean).length} / {steps.length} {guidanceText(locale, 'progress')}
            </p>
          </div>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={!hidden}
          aria-controls="getting-started-steps"
          onClick={toggle}
        >
          {guidanceText(locale, hidden ? 'show' : 'hide')}
        </button>
      </div>
      {!hidden && (
        <div id="getting-started-steps">
          <p className="guidance-hint">{guidanceText(locale, 'checklistIntro')}</p>
          <ol className="getting-started-list">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span
                  className="getting-started-number"
                  aria-label={completed[index] ? guidanceText(locale, 'done') : undefined}
                >
                  {completed[index] ? '✓' : index + 1}
                </span>
                <details>
                  <summary>{guidanceText(locale, step.title)}</summary>
                  <p>{guidanceText(locale, step.hint)}</p>
                  <button
                    type="button"
                    className="getting-started-link"
                    onClick={() => onNavigate(step.view)}
                  >
                    {guidanceText(locale, 'openStep')} <span aria-hidden>↗</span>
                  </button>
                </details>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
