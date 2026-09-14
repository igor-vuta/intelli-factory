import { useCallback, useEffect, useState } from 'react';
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
  const [rows, setRows] = useState<Proposal[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parent, setParent] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
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
    void load().catch(() => setError(true));
  }, [load]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      await fn();
      await load();
      onUpdated?.();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="factory-setup surface-1 rounded-2xl p-6 space-y-3">
      <h2>{admin ? c.review : c.request}</h2>
      {!loaded && !error && <p>{c.loading}</p>}
      {error && (
        <p role="alert">
          {c.error}{' '}
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
            <select value={parent} onChange={(e) => setParent(e.target.value)}>
              <option value="">{c.none}</option>
              {cats
                .filter((x) => !x.parent_id)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
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
      {rows.map((row) => (
        <article key={row.id} className="border rounded p-3 space-y-2">
          <p>
            {row.name} —{' '}
            {row.status === 'PENDING'
              ? c.pending
              : row.status === 'APPROVED'
                ? c.approved
                : c.rejected}
          </p>
          <p>{row.description}</p>
          {row.decision_note && <p>{row.decision_note}</p>}
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
                <select
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
                </select>
              </label>
              <label>
                {c.note}
                <input
                  required
                  value={notes[row.id] || ''}
                  onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                />
              </label>
              <button disabled={busy}>{c.approve}</button>
              <button
                type="button"
                disabled={busy || !notes[row.id]}
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
