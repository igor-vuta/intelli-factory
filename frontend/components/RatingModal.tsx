import { FormEvent, useState } from 'react';

import { submitRating, type WorkflowTransaction } from '../lib/authClient';

type RatingModalProps = {
  transaction: WorkflowTransaction;
  alreadyRatedTargets: Set<'LOGIST' | 'FACTORY'>;
  onClose: () => void;
  onRated: () => void;
};

function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl leading-none transition-colors ${
            star <= value ? 'text-amber-400' : 'text-[rgb(var(--stroke))]'
          } hover:text-amber-300`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function RatingModal({
  transaction,
  alreadyRatedTargets,
  onClose,
  onRated,
}: RatingModalProps) {
  const hasLogist = Boolean(transaction.logistic_offer_id);
  const canRateLogist = hasLogist && !alreadyRatedTargets.has('LOGIST');
  const canRateFactory = !alreadyRatedTargets.has('FACTORY');

  const [logistScore, setLogistScore] = useState(5);
  const [factoryScore, setFactoryScore] = useState(5);
  const [rateLogist, setRateLogist] = useState(canRateLogist);
  const [rateFactory, setRateFactory] = useState(canRateFactory);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!rateLogist && !rateFactory) {
      setError('Select at least one rating target.');
      return;
    }

    setSubmitting(true);
    try {
      if (rateLogist && canRateLogist) {
        await submitRating({
          transaction_id: transaction.id,
          target_type: 'LOGIST',
          score: logistScore,
          comment: comment.trim() || undefined,
        });
      }
      if (rateFactory && canRateFactory) {
        await submitRating({
          transaction_id: transaction.id,
          target_type: 'FACTORY',
          score: factoryScore,
          comment: comment.trim() || undefined,
        });
      }
      setSuccess('Rating submitted. Thank you!');
      onRated();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  }

  const INPUT_CLS =
    'focus-theme w-full rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] px-3 py-2 text-sm';

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="slide-up w-full max-w-md rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--bg))] p-6 shadow-2xl sm:p-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Rate this delivery</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">
              Transaction {transaction.id.slice(0, 8)}… &mdash; {transaction.item_name ?? 'item'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-[rgb(var(--muted))] hover:bg-[rgb(var(--stroke))]/40"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Summary */}
        <div className="mb-4 rounded-xl border border-[rgb(var(--stroke))] bg-[rgb(var(--panel))] p-3 text-xs">
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-[rgb(var(--muted))]">Factory</span>
            <span>{transaction.factory_legal_name ?? '-'}</span>
            <span className="text-[rgb(var(--muted))]">Logist</span>
            <span>{transaction.logist_legal_name ?? '-'}</span>
            <span className="text-[rgb(var(--muted))]">Item</span>
            <span>{transaction.item_name ?? '-'}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Logist rating */}
          {hasLogist && (
            <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
              <label className="mb-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rateLogist}
                  onChange={(e) => setRateLogist(e.target.checked)}
                  disabled={!canRateLogist}
                  className="accent-amber-400"
                />
                Rate logist
                {!canRateLogist && (
                  <span className="text-xs text-[rgb(var(--muted))]">(already rated)</span>
                )}
              </label>
              {rateLogist && canRateLogist && (
                <StarSelector value={logistScore} onChange={setLogistScore} />
              )}
            </div>
          )}

          {/* Factory rating */}
          <div className="rounded-xl border border-[rgb(var(--stroke))] p-3">
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rateFactory}
                onChange={(e) => setRateFactory(e.target.checked)}
                disabled={!canRateFactory}
                className="accent-amber-400"
              />
              Rate factory
              {!canRateFactory && (
                <span className="text-xs text-[rgb(var(--muted))]">(already rated)</span>
              )}
            </label>
            {rateFactory && canRateFactory && (
              <StarSelector value={factoryScore} onChange={setFactoryScore} />
            )}
          </div>

          {/* Shared comment */}
          <div>
            <label className="mb-1 block text-sm text-[rgb(var(--muted))]">
              Comment (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Any feedback about this delivery?"
              className={INPUT_CLS}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
              {success}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!canRateLogist && !canRateFactory)}
              className="btn btn-primary flex-1 text-sm"
            >
              {submitting ? 'Submitting…' : 'Submit rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
