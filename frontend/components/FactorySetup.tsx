import Modal from './Modal';
import PresetIcon from './PresetIcon';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import SelectField from './SelectField';
import { useCallback, useEffect, useRef, useState } from 'react';
import AddressPicker, { type AddressValue } from './AddressPicker';
import CategoryProposalPanel, {
  type Category,
  type Proposal,
  type AttributeSchema,
} from './CategoryProposalPanel';
import AttributeFields from './AttributeFields';
import { categoryApi, getRequestsBootstrap, type RequestsBootstrap } from '../lib/authClient';
import { categoryCopy } from '../lib/categoryCopy';
import type { Locale } from '../lib/i18n';
type Setup = {
  ready: boolean;
  email_verified: boolean;
  profile_complete: boolean;
  eligible_inventory_ids: string[];
  profile: {
    legal_name: string;
    contact_name: string | null;
    phone: string | null;
    primary_address_id: string | null;
  };
  selections: { category_id: string; is_active: boolean; confirmed_at: string | null }[];
};
type DraftData = {
  category_id?: string;
  proposal_id?: string;
  item_id?: string;
  item_name?: string;
  unit?: string;
  quantity_available?: string;
  price_per_unit?: string;
  currency_code?: string;
  stock_address_id?: string;
  characteristics_json?: Record<string, unknown>;
};
type Draft = { id: string; data: DraftData };
export default function FactorySetup({
  locale,
  onReady,
  revision = 0,
}: {
  locale: Locale;
  onReady: (ids: string[]) => void;
  revision?: number;
}) {
  const c = categoryCopy(locale);
  const e = useExperienceCopy();
  const hydrated = useRef(false);
  const pending = useRef(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [bootstrap, setBootstrap] = useState<RequestsBootstrap | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState({ legal_name: '', contact_name: '', phone: '' });
  const [location, setLocation] = useState<AddressValue | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState('');
  const [data, setData] = useState<DraftData>({ unit: 'pcs' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const load = useCallback(async () => {
    const [s, categories, b, d, p] = await Promise.all([
      categoryApi<Setup>('/factory-setup'),
      categoryApi<Category[]>(`/?locale=${locale}`),
      getRequestsBootstrap(locale),
      categoryApi<Draft[]>('/drafts'),
      categoryApi<Proposal[]>('/proposals'),
    ]);
    setSetup(s);
    setCats(categories);
    setBootstrap(b);
    setDrafts(d);
    setProposals(p);
    if (!hydrated.current) {
      hydrated.current = true;
      setSelected(s.selections.filter((x) => x.is_active).map((x) => x.category_id));
      setProfile({
        legal_name: s.profile.legal_name,
        contact_name: s.profile.contact_name ?? '',
        phone: s.profile.phone ?? '',
      });
    }
    onReady(s.ready ? s.eligible_inventory_ids : []);
  }, [locale, onReady]);
  useEffect(() => {
    void load().catch(() => setError(c.error));
  }, [load, revision, c.error]);
  async function act(fn: () => Promise<unknown>, success = c.saved, action = '') {
    if (pending.current) return;
    pending.current = true;
    setBusyAction(action);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
      await load();
      setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? e(cause.message) : c.error);
      onReady([]);
      return false;
    } finally {
      setBusyAction('');
      pending.current = false;
      setBusy(false);
    }
  }
  function patch(v: Partial<DraftData>) {
    setData((d) => ({ ...d, ...v }));
  }
  const product = bootstrap?.items.find((x) => x.id === data.item_id) as
    | (RequestsBootstrap['items'][number] & { characteristics_schema?: AttributeSchema })
    | undefined;
  const category = cats.find((x) => x.id === data.category_id);
  async function save() {
    const id = draftId || crypto.randomUUID();
    setDraftId(id);
    await categoryApi(`/drafts/${id}`, 'PUT', { data });
    return id;
  }
  return (
    <section data-section="inventory" className="factory-setup surface-1 rounded-2xl p-6 space-y-4">
      <header className="setup-heading">
        <div className="setup-emblem">
          <PresetIcon src="/presets/factory.svg" alt="" size={32} />
        </div>
        <div>
          <p className="setup-eyebrow">{e('Factory floor')}</p>
          <h2>{c.setup}</h2>
          <p>{c.next}</p>
        </div>
        <span className={`setup-readiness ${setup?.ready ? 'is-ready' : ''}`} role="status">
          {setup ? (setup.ready ? c.ready : c.incomplete) : c.loading}
        </span>
      </header>
      <nav className="setup-path" aria-label={c.setup}>
        <a href="#setup-company">
          <span>01</span>
          <strong>{c.company}</strong>
          <small>{setup?.profile_complete ? e('Complete') : e('Review details')}</small>
        </a>
        <a href="#setup-categories">
          <span>02</span>
          <strong>{c.categories}</strong>
          <small>
            {setup?.selections.some((s) => s.is_active && s.confirmed_at)
              ? e('Confirmed')
              : e('Confirmation needed')}
          </small>
        </a>
        <a href="#setup-stock">
          <span>03</span>
          <strong>{c.draft}</strong>
          <small>
            {setup?.eligible_inventory_ids.length ?? 0} {e('eligible offerings')}
          </small>
        </a>
      </nav>
      {error && (
        <p role="alert" className="category-feedback is-error">
          {error}{' '}
          <button type="button" onClick={() => void act(load)}>
            {c.retry}
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="category-feedback is-success">
          {message}
        </p>
      )}
      {setup && (
        <>
          {!setup.email_verified && <p>{c.verify}</p>}
          <section id="setup-company" className="setup-card">
            <h3>{c.company}</h3>
            <form
              className="grid gap-3 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                void act(
                  () => categoryApi('/factory-profile', 'PATCH', profile),
                  `${c.saved} · ${c.company}`,
                  c.saveProfile
                );
              }}
            >
              {(['legal_name', 'contact_name', 'phone'] as const).map((key, i) => (
                <label key={key}>
                  {[c.company, c.contact, c.phone][i]}
                  <input
                    value={profile[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                  />
                </label>
              ))}
              <button disabled={busy} className="btn setup-action">
                <span aria-hidden>{busyAction === c.saveProfile ? '◌' : '✓'}</span>{' '}
                {busyAction === c.saveProfile ? e('Saving…') : c.saveProfile}
              </button>
            </form>
            <button
              type="button"
              aria-label={c.location}
              className="location-launch"
              onClick={() => setLocationOpen(true)}
            >
              <span className="location-icon" aria-hidden>
                ⌖
              </span>
              <span>
                <strong>{c.location}</strong>
                <small>
                  {setup.profile.primary_address_id
                    ? (bootstrap?.addresses.find((a) => a.id === setup.profile.primary_address_id)
                        ?.label ?? e('Review details'))
                    : e('Add a company address')}
                </small>
              </span>
              <span aria-hidden>→</span>
            </button>
            {locationOpen && (
              <Modal busy={busy} onClose={() => setLocationOpen(false)}>
                <section className="location-sheet">
                  <div className="sheet-title">
                    <h2>{c.location}</h2>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={e('Close')}
                      onClick={() => setLocationOpen(false)}
                    >
                      ×
                    </button>
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (location)
                        void act(
                          () =>
                            categoryApi('/factory-location', 'PUT', {
                              country_code: location.countryCode,
                              region_name: location.regionName,
                              city_name: location.cityName,
                              street: location.street,
                              postal_code: location.postalCode,
                            }),
                          `${c.saved} · ${c.location}`,
                          c.saveLocation
                        ).then((saved) => {
                          if (saved) setLocationOpen(false);
                        });
                    }}
                  >
                    <AddressPicker
                      value={location}
                      onChange={setLocation}
                      countries={(bootstrap?.countries ?? []).map((x) => ({
                        code: x.code,
                        label: x.name,
                      }))}
                      required
                    />
                    <button disabled={busy || !location} className="btn setup-action">
                      {busyAction === c.saveLocation ? e('Saving…') : c.saveLocation}
                    </button>
                  </form>
                  {error && (
                    <p role="alert" className="category-feedback is-error">
                      {error}
                    </p>
                  )}
                </section>
              </Modal>
            )}
          </section>
          <fieldset id="setup-categories" className="setup-card capability-card space-y-2">
            <legend>{c.categories}</legend>
            <label>
              {c.search}
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="capability-grid">
              {cats
                .filter(
                  (x) =>
                    x.selectable &&
                    (x.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
                      selected.includes(x.id))
                )
                .map((x) => (
                  <label
                    key={x.id}
                    className={`capability-option ${selected.includes(x.id) ? 'is-selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(x.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, x.id]
                            : selected.filter((id) => id !== x.id)
                        )
                      }
                    />{' '}
                    {x.parent_id ? `${cats.find((p) => p.id === x.parent_id)?.name ?? ''} / ` : ''}
                    <span className="capability-name">
                      {x.name}
                      <small aria-hidden>
                        {setup.selections.find((s) => s.category_id === x.id && s.is_active)
                          ?.confirmed_at
                          ? e('Confirmed')
                          : selected.includes(x.id)
                            ? e('Confirmation needed')
                            : e('Available')}
                      </small>
                    </span>
                  </label>
                ))}
            </div>
            {!cats.some(
              (x) => x.selectable && x.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
            ) && <p>{c.empty}</p>}
            <p className="category-note">{c.removal}</p>
            <p>{c.fallback}</p>
            <button
              disabled={busy}
              type="button"
              className="btn setup-action confirm-capabilities"
              onClick={() =>
                void act(
                  () => categoryApi('/factory-selections', 'PUT', { category_ids: selected }),
                  `${c.saved} · ${c.categories}`,
                  c.saveCategories
                )
              }
            >
              <span aria-hidden>✓</span>{' '}
              {busyAction === c.saveCategories ? e('Saving…') : c.saveCategories}{' '}
              <span aria-hidden className="selection-count">
                {selected.length}
              </span>
            </button>
          </fieldset>
          <CategoryProposalPanel
            locale={locale}
            onUpdated={() => void load().catch(() => setError(c.error))}
          />
          <div id="setup-stock" className="stock-workbench">
            <aside className="draft-library">
              <h3>{c.drafts}</h3>
              {drafts.length === 0 && <p>{c.emptyDrafts}</p>}
              {drafts.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className="draft-resume"
                  aria-pressed={draftId === d.id}
                  disabled={busy}
                  onClick={() => {
                    setDraftId(d.id);
                    setData(d.data);
                  }}
                >
                  {c.resume}:{' '}
                  {d.data.item_name ||
                    bootstrap?.items.find((x) => x.id === d.data.item_id)?.name ||
                    c.draft}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (busy) return;
                  setDraftId('');
                  setData({ unit: 'pcs' });
                }}
              >
                {c.newDraft}
              </button>
            </aside>
            <form
              className="draft-editor grid gap-3 sm:grid-cols-2"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void act(save);
              }}
            >
              <h3 className="sm:col-span-2">{c.draft}</h3>
              <p className="sm:col-span-2">{c.stockOnly}</p>
              <label>
                {c.category}
                <SelectField
                  aria-label={c.category}
                  value={
                    data.proposal_id ? `proposal:${data.proposal_id}` : (data.category_id ?? '')
                  }
                  onChange={(e) =>
                    patch({
                      category_id: e.target.value.startsWith('proposal:')
                        ? undefined
                        : e.target.value,
                      proposal_id: e.target.value.startsWith('proposal:')
                        ? e.target.value.slice(9)
                        : undefined,
                      item_id: undefined,
                      characteristics_json: {},
                    })
                  }
                >
                  <option value="">—</option>
                  {cats
                    .filter((x) => x.selectable)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  {proposals
                    .filter((x) => x.status !== 'REJECTED')
                    .map((x) => (
                      <option key={x.id} value={`proposal:${x.id}`}>
                        {x.name} — {x.status === 'APPROVED' ? c.approved : c.pending}
                      </option>
                    ))}
                </SelectField>
              </label>
              <label>
                {c.product}
                <SelectField
                  aria-label={c.product}
                  value={data.item_id ?? ''}
                  onChange={(e) => {
                    const item = bootstrap?.items.find((x) => x.id === e.target.value);
                    patch({
                      item_id: item?.id,
                      unit: item?.unit || 'pcs',
                      characteristics_json: {},
                    });
                  }}
                >
                  <option value="">{c.newProduct}</option>
                  {bootstrap?.items
                    .filter((x) => x.category_id === data.category_id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </SelectField>
              </label>
              {!data.item_id && (
                <label>
                  {c.newProduct}
                  <input
                    value={data.item_name ?? ''}
                    onChange={(e) => patch({ item_name: e.target.value })}
                  />
                </label>
              )}
              <label>
                {c.unit}
                <SelectField
                  aria-label={c.unit}
                  disabled={!!data.item_id}
                  value={data.unit ?? 'pcs'}
                  onChange={(e) => patch({ unit: e.target.value })}
                >
                  {['pcs', 'kg', 'g', 't', 'tons', 'l', 'm', 'm2', 'm3', 'roll'].map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </SelectField>
              </label>
              <label>
                {c.quantity} ({data.unit})
                <input
                  type="number"
                  step="any"
                  value={data.quantity_available ?? ''}
                  onChange={(e) => patch({ quantity_available: e.target.value })}
                />
              </label>
              <label>
                {c.price} ({data.currency_code || '—'} / {data.unit})
                <input
                  type="number"
                  step="any"
                  value={data.price_per_unit ?? ''}
                  onChange={(e) => patch({ price_per_unit: e.target.value })}
                />
              </label>
              <label>
                {c.currency}
                <SelectField
                  aria-label={c.currency}
                  value={data.currency_code ?? ''}
                  onChange={(e) => patch({ currency_code: e.target.value })}
                >
                  <option value="">—</option>
                  {bootstrap?.currencies.map((x) => (
                    <option key={x.code}>{x.code}</option>
                  ))}
                </SelectField>
              </label>
              <label>
                {c.stock}
                <SelectField
                  aria-label={c.stock}
                  value={data.stock_address_id ?? ''}
                  onChange={(e) => patch({ stock_address_id: e.target.value })}
                >
                  <option value="">{c.location}</option>
                  {bootstrap?.addresses.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.label}
                    </option>
                  ))}
                </SelectField>
              </label>
              <AttributeFields
                schema={category?.attributes_schema}
                value={data.characteristics_json ?? {}}
                onChange={(v) => patch({ characteristics_json: v })}
              />
              <AttributeFields
                schema={product?.characteristics_schema}
                value={data.characteristics_json ?? {}}
                onChange={(v) => patch({ characteristics_json: v })}
              />
              <button disabled={busy} className="btn btn-secondary">
                {c.save}
              </button>
              <button
                type="button"
                disabled={busy || !setup.email_verified}
                className="btn btn-primary"
                onClick={() =>
                  void act(async () => {
                    const id = await save();
                    await categoryApi(`/drafts/${id}/publish`, 'POST');
                    setDraftId('');
                    setData({ unit: 'pcs' });
                  }, c.published)
                }
              >
                {c.publish}
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}
