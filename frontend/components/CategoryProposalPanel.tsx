import { useExperienceCopy } from '../hooks/useExperienceCopy';
import SelectField from './SelectField';
import { useCallback, useEffect, useRef, useState } from 'react';
import { categoryApi } from '../lib/authClient';
import { categoryCopy } from '../lib/categoryCopy';
import type { Locale } from '../lib/i18n';
export type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  selectable: boolean;
  attributes_schema?: AttributeSchema;
};
export type AttributeSchema = {
  type?: string;
  required?: string[];
  properties?: Record<
    string,
    { type: string; enum?: (string | number)[]; minimum?: number; maximum?: number; unit?: string }
  >;
};
export type Proposal = {
  id: string;
  name: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  category_id: string | null;
  decision_note: string | null;
  parent_id?: string | null;
  submitter_id?: string;
  decided_at?: string | null;
};
export default function CategoryProposalPanel({
  locale,
  admin = false,
  onUpdated,
}: {
  locale: Locale;
  admin?: boolean;
  onUpdated?: () => void;
}) {
  const c = categoryCopy(locale);
  const e = useExperienceCopy();
  const pending = useRef(false);
  const [rows, setRows] = useState<Proposal[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parent, setParent] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const [p, categories] = await Promise.all([
      categoryApi<Proposal[]>('/proposals'),
      categoryApi<Category[]>(`/?locale=${locale}`),
    ]);
    setRows(p);
    setCats(categories);
    setLoaded(true);
  }, [locale]);
  useEffect(() => {
    void load().catch(() => setError(c.error));
  }, [load, c.error]);
  async function act(fn: () => Promise<unknown>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      onUpdated?.();
    } catch (cause) {
      setError(cause instanceof Error ? e(cause.message) : c.error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className={`category-proposals ${admin ? 'is-review' : ''} surface-1 rounded-2xl p-6 space-y-3`}
    >
      <header className="proposal-heading">
        <h2>{admin ? c.review : c.request}</h2>
        <span className="proposal-count">
          {rows.filter((r) => r.status === 'PENDING').length} {c.pending}
        </span>
      </header>
      {!loaded && !error && <p>{c.loading}</p>}
      {error && (
        <p role="alert" className="category-feedback is-error">
          {error}{' '}
          <button type="button" onClick={() => void act(load)}>
            {c.retry}
          </button>
        </p>
      )}
      {!admin && (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await categoryApi('/proposals', 'POST', {
                name,
                description,
                parent_id: parent || null,
              });
              setName('');
              setDescription('');
            });
          }}
        >
          <label>
            {c.name}
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {c.parent}
            <SelectField
              aria-label={c.parent}
              value={parent}
              onChange={(e) => setParent(e.target.value)}
            >
              <option value="">{c.none}</option>
              {cats
                .filter((x) => !x.parent_id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </SelectField>
          </label>
          <label>
            {c.description}
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button disabled={busy} className="btn btn-secondary">
            {c.submit}
          </button>
          <p>{c.waiting}</p>
        </form>
      )}
      {loaded && !rows.length && <p className="category-empty">{e('No category proposals yet')}</p>}
      {rows.map((row) => (
        <article key={row.id} className="proposal-item space-y-2" data-status={row.status}>
          <p>
            {row.name} —{' '}
            {row.status === 'PENDING'
              ? c.pending
              : row.status === 'APPROVED'
                ? c.approved
                : c.rejected}
          </p>
          <p className="proposal-description">{row.description}</p>
          <div className="proposal-meta">
            {row.parent_id && (
              <span>
                {c.parent}: {cats.find((cat) => cat.id === row.parent_id)?.name ?? row.parent_id}
              </span>
            )}
            {admin && row.submitter_id && (
              <span>
                {e('Submitted by')}: {row.submitter_id.slice(0, 8)}
              </span>
            )}
            {row.decided_at && (
              <time dateTime={row.decided_at}>
                {new Intl.DateTimeFormat(locale).format(new Date(row.decided_at))}
              </time>
            )}
          </div>
          {row.decision_note && <p className="proposal-decision">{row.decision_note}</p>}
          {admin && row.status === 'PENDING' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void act(() =>
                  categoryApi(`/proposals/${row.id}/decision`, 'POST', {
                    status: 'APPROVED',
                    category_id: links[row.id] || null,
                    note: notes[row.id],
                  })
                );
              }}
            >
              <label>
                {c.link}
                <SelectField
                  aria-label={c.link}
                  value={links[row.id] || ''}
                  onChange={(e) => setLinks({ ...links, [row.id]: e.target.value })}
                >
                  <option value="">{c.create}</option>
                  {cats
                    .filter((x) => x.selectable)
                    .map((x) => (
                      <option value={x.id} key={x.id}>
                        {x.name}
                      </option>
                    ))}
                </SelectField>
              </label>
              <label>
                {c.note}
                <input
                  required
                  value={notes[row.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                />
              </label>
              <button className="btn btn-primary" disabled={busy || !notes[row.id]?.trim()}>
                {c.approve}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || !notes[row.id]?.trim()}
                onClick={() =>
                  void act(() =>
                    categoryApi(`/proposals/${row.id}/decision`, 'POST', {
                      status: 'REJECTED',
                      note: notes[row.id],
                    })
                  )
                }
              >
                {c.reject}
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
