import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useExperienceCopy } from '../hooks/useExperienceCopy';
import {
  createCatalogueItem,
  getCatalogue,
  type Catalogue,
  type CatalogueCategory,
  type CatalogueItem,
  type ProposedProduct,
} from '../lib/authClient';
import type { Locale } from '../lib/i18n';
import Combobox from './Combobox';
import SelectField from './SelectField';

const SHOWN_IN: Record<Locale, string> = {
  en: 'Not yet translated; shown in English',
  ru: 'Not yet translated; shown in Russian',
  kk: 'Not yet translated; shown in Kazakh',
};
const MAX_RESULTS = 8;
// Category choice meaning "none fits: propose a new one" (only where a request can wait for it).
const PROPOSE = '__propose__';
const isOther = (c: CatalogueCategory) => c.slug.startsWith('other-');

// One catalogue download per language for the page's lifetime: pickers remount (for example when
// a draft's category changes) without refetching, and products created here are added to it.
const cache = new Map<Locale, Promise<Catalogue>>();
function loadCatalogue(locale: Locale) {
  let pending = cache.get(locale);
  if (!pending) {
    pending = getCatalogue(locale);
    pending.catch(() => cache.delete(locale));
    cache.set(locale, pending);
  }
  return pending;
}

export function normalise(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

function matches(item: CatalogueItem, query: string) {
  return !query || item.search_labels.some((label) => normalise(label).includes(query));
}

/**
 * Chooses a product from the shared catalogue, or creates a missing one on the spot. Everything
 * happens inline, so the surrounding order or stock form keeps what the user already entered.
 * A missing category is either "Other (not listed)" in the closest group, usable at once, or,
 * where the caller supports it (`onPropose`), a proposal the request waits for.
 */
export default function ProductPicker({
  locale,
  value,
  onChange,
  categoryId,
  proposed = null,
  onPropose,
}: {
  locale: Locale;
  /** The chosen product's ID, or '' for none. */
  value: string;
  onChange: (item: CatalogueItem | null) => void;
  /** Limits choices to one category, e.g. a factory's confirmed production category. */
  categoryId?: string;
  /** A product described under a proposed category, shown instead of a catalogue product. */
  proposed?: ProposedProduct | null;
  /** Offers "propose a new category"; the caller keeps the proposal until the form is sent. */
  onPropose?: (proposal: ProposedProduct | null) => void;
}) {
  const e = useExperienceCopy();
  const id = useId();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    category: '',
    unit: '',
    attributes: [['', '']],
    newCategory: '',
    group: '',
    reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'created' | 'reused' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalogue(locale)
      .then((data) => !cancelled && setCatalogue(data))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const groupName = useMemo(() => {
    const byId = new Map((catalogue?.categories ?? []).map((c) => [c.id, c.name]));
    return (c: CatalogueCategory) => (c.parent_id ? (byId.get(c.parent_id) ?? '') : '');
  }, [catalogue]);
  // "Group › Category", so a category reads unambiguously wherever it is shown.
  const categoryLabel = useMemo(
    () =>
      new Map(
        (catalogue?.categories ?? []).map((c) => [
          c.id,
          groupName(c) ? `${groupName(c)} › ${c.name}` : c.name,
        ])
      ),
    [catalogue, groupName]
  );
  // Leaves grouped under their group, each group's "Other" last.
  const categories = useMemo(
    () =>
      (catalogue?.categories ?? [])
        .filter((c) => c.selectable && (!categoryId || c.id === categoryId))
        .sort(
          (a, b) =>
            groupName(a).localeCompare(groupName(b), locale) ||
            Number(isOther(a)) - Number(isOther(b)) ||
            a.name.localeCompare(b.name, locale)
        ),
    [catalogue, categoryId, groupName, locale]
  );
  const groups = useMemo(
    () => (catalogue?.categories ?? []).filter((c) => !c.parent_id && !c.selectable),
    [catalogue]
  );
  const proposing = draft.category === PROPOSE;
  const pool = useMemo(
    () => (catalogue?.items ?? []).filter((i) => !categoryId || i.category_id === categoryId),
    [catalogue, categoryId]
  );
  const normalisedQuery = normalise(query);
  const results = useMemo(
    () => pool.filter((item) => matches(item, normalisedQuery)).slice(0, MAX_RESULTS),
    [pool, normalisedQuery]
  );
  // Products the new one may duplicate: same category, overlapping name.
  const similar = useMemo(() => {
    const name = normalise(draft.name);
    if (!creating || name.length < 2) return [];
    return pool
      .filter((item) => !draft.category || proposing || item.category_id === draft.category)
      .filter((item) =>
        item.search_labels.some((label) => {
          const other = normalise(label);
          return other.includes(name) || name.includes(other);
        })
      )
      .slice(0, 4);
  }, [creating, draft.name, draft.category, pool, proposing]);

  function choose(item: CatalogueItem | null, how: typeof outcome = null) {
    onPropose?.(null);
    onChange(item);
    setOutcome(how);
    setCreating(false);
    setError(null);
    if (item) setQuery('');
  }

  function startCreating() {
    setDraft({
      name: query.trim(),
      category: categoryId ?? (categories.length === 1 ? categories[0].id : ''),
      unit: catalogue?.units.includes('pcs') ? 'pcs' : (catalogue?.units[0] ?? ''),
      attributes: [['', '']],
      newCategory: '',
      group: '',
      reason: '',
    });
    setError(null);
    setCreating(true);
  }

  async function create() {
    if (saving) return;
    if (normalise(draft.name).length < 2) return setError(e('Enter the product name'));
    if (!draft.category) return setError(e('Choose a category'));
    if (!draft.unit) return setError(e('Choose a unit'));
    const attributes = Object.fromEntries(
      draft.attributes.map(([k, v]) => [k.trim(), v.trim()]).filter(([k, v]) => k && v)
    );
    if (proposing) {
      if (normalise(draft.newCategory).length < 2) return setError(e('Name the new category'));
      if (draft.reason.trim().length < 5)
        return setError(e('Say briefly what the category is for'));
      onPropose?.({
        category: {
          name: draft.newCategory.trim(),
          description: draft.reason.trim(),
          parent_id: draft.group || null,
        },
        product: { name: draft.name.trim(), locale, unit: draft.unit, attributes },
      });
      setCreating(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { created, ...item } = await createCatalogueItem({
        name: draft.name.trim(),
        locale,
        category_id: draft.category,
        unit: draft.unit,
        attributes,
      });
      // Keep the cached list current so the new product is searchable straight away.
      const next = (c: Catalogue) =>
        c.items.some((i) => i.id === item.id) ? c : { ...c, items: [...c.items, item] };
      cache.set(locale, loadCatalogue(locale).then(next));
      setCatalogue((c) => c && next(c));
      choose(item, created ? 'created' : 'reused');
    } catch (err) {
      setError(err instanceof Error ? err.message : e('Could not save the product'));
    } finally {
      setSaving(false);
    }
  }

  // Enter inside the inline panel creates the product instead of submitting the outer form.
  function createOnEnter(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void create();
  }

  function describe(item: CatalogueItem) {
    const facts = [
      categoryLabel.get(item.category_id),
      item.unit,
      ...Object.entries(item.identity_attributes).map(([k, v]) => `${k}: ${v}`),
    ].filter(Boolean);
    return facts.join(' · ');
  }

  function fallbackNote(item: CatalogueItem) {
    if (!item.fallback) return null;
    return e(item.label_locale ? SHOWN_IN[item.label_locale] : 'Not yet translated; original name');
  }

  if (loadError) return <p className="product-picker-error">{loadError}</p>;

  if (proposed && !value)
    return (
      <div className="product-picker">
        <span className="product-picker-label">{e('Product')}</span>
        <div className="product-picker-chosen">
          <div>
            <strong>{proposed.product.name}</strong>
            <small>
              {e('New category')}: {proposed.category.name} · {proposed.product.unit}
            </small>
            <small className="product-picker-outcome" role="status">
              {e(
                'Your request will be saved and go live on its own once an administrator approves the category.'
              )}
            </small>
          </div>
          <button type="button" className="if-link" onClick={() => onPropose?.(null)}>
            {e('Change')}
          </button>
        </div>
      </div>
    );

  const chosen = value ? catalogue?.items.find((item) => item.id === value) : undefined;
  if (value && !catalogue)
    return <p className="product-picker-label">{e('Loading the catalogue…')}</p>;
  // A saved choice the catalogue no longer offers (merged, retired or in a closed category).
  if (value && !chosen)
    return (
      <div className="product-picker">
        <span className="product-picker-label">{e('Product')}</span>
        <div className="product-picker-chosen">
          <p className="product-picker-error">{e('This product is no longer available.')}</p>
          <button type="button" className="if-link" onClick={() => choose(null)}>
            {e('Change')}
          </button>
        </div>
      </div>
    );
  if (chosen)
    return (
      <div className="product-picker">
        <span className="product-picker-label">{e('Product')}</span>
        <div className="product-picker-chosen">
          <div>
            <strong>{chosen.name}</strong>
            <small>{describe(chosen)}</small>
            {fallbackNote(chosen) && <small>{fallbackNote(chosen)}</small>}
            {outcome && (
              <small className="product-picker-outcome" role="status">
                {outcome === 'created'
                  ? e('Added to the shared catalogue and selected.')
                  : e('This product is already in the catalogue; selected it.')}
              </small>
            )}
          </div>
          <button type="button" className="if-link" onClick={() => choose(null)}>
            {e('Change')}
          </button>
        </div>
      </div>
    );

  return (
    <div className="product-picker">
      <label className="product-picker-label" htmlFor={`${id}-search`}>
        {/* One child, so grid-based form labels keep the marker on the same line. */}
        <span>
          {e('Product')} <span className="text-danger">*</span>
        </span>
      </label>
      <input
        id={`${id}-search`}
        type="search"
        className="focus-theme product-picker-input"
        placeholder={e('Search the catalogue in any language')}
        value={query}
        aria-controls={`${id}-results`}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
        disabled={!catalogue}
      />
      <ul id={`${id}-results`} className="product-picker-results" aria-label={e('Products')}>
        {results.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => choose(item)}>
              <strong>{item.name}</strong>
              <small>{describe(item)}</small>
              {fallbackNote(item) && <small>{fallbackNote(item)}</small>}
            </button>
          </li>
        ))}
        {catalogue && results.length === 0 && (
          <li className="product-picker-empty">{e('No product matches yet.')}</li>
        )}
      </ul>

      {!creating ? (
        <button type="button" className="if-button" onClick={startCreating} disabled={!catalogue}>
          {query.trim() ? `${e('Create product')} “${query.trim()}”` : e('Create product')}
        </button>
      ) : (
        <div className="product-picker-create" role="group" aria-labelledby={`${id}-create`}>
          <h4 id={`${id}-create`}>{e('New product')}</h4>
          <p className="guidance-hint">
            {e(
              'It joins the shared catalogue straight away. Add what makes it a distinct product, such as material, grade or size.'
            )}
          </p>
          <label>
            <span>{e('Name')}</span>
            <input
              className="focus-theme"
              value={draft.name}
              autoFocus
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              onKeyDown={createOnEnter}
            />
          </label>
          <div className="product-picker-row">
            <div className="product-picker-field">
              <Combobox
                label={e('Category')}
                placeholder={e('Choose a category')}
                value={draft.category}
                onChange={(category) => setDraft({ ...draft, category })}
                disabled={!!categoryId}
                options={[
                  ...categories.map((c) => ({ id: c.id, label: c.name, sublabel: groupName(c) })),
                  ...(onPropose
                    ? [
                        {
                          id: PROPOSE,
                          label: e('Propose a new category…'),
                          sublabel: e('Your request waits for approval'),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <label>
              <span>{e('Unit')}</span>
              <SelectField
                value={draft.unit}
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              >
                {(catalogue?.units ?? []).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
          {proposing && (
            <div className="product-picker-proposal">
              <label>
                <span>{e('New category name')}</span>
                <input
                  className="focus-theme"
                  value={draft.newCategory}
                  onChange={(event) => setDraft({ ...draft, newCategory: event.target.value })}
                  onKeyDown={createOnEnter}
                />
              </label>
              <div className="product-picker-field">
                <Combobox
                  label={e('Group')}
                  placeholder={e('Closest group (optional)')}
                  value={draft.group}
                  onChange={(group) => setDraft({ ...draft, group })}
                  allowEmpty
                  options={groups.map((g) => ({ id: g.id, label: g.name }))}
                />
              </div>
              <label>
                <span>{e('What is it for?')}</span>
                <input
                  className="focus-theme"
                  value={draft.reason}
                  onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                  onKeyDown={createOnEnter}
                />
              </label>
            </div>
          )}
          <fieldset className="product-picker-attributes">
            <legend>{e('Distinguishing characteristics (optional)')}</legend>
            {draft.attributes.map(([key, val], index) => (
              <div className="product-picker-row" key={index}>
                <input
                  className="focus-theme"
                  aria-label={e('Characteristic')}
                  placeholder={e('e.g. material')}
                  value={key}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      attributes: draft.attributes.map((pair, i) =>
                        i === index ? [event.target.value, pair[1]] : pair
                      ),
                    })
                  }
                  onKeyDown={createOnEnter}
                />
                <input
                  className="focus-theme"
                  aria-label={e('Value')}
                  placeholder={e('e.g. cotton')}
                  value={val}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      attributes: draft.attributes.map((pair, i) =>
                        i === index ? [pair[0], event.target.value] : pair
                      ),
                    })
                  }
                  onKeyDown={createOnEnter}
                />
              </div>
            ))}
            {draft.attributes.length < 4 && (
              <button
                type="button"
                className="if-link"
                onClick={() => setDraft({ ...draft, attributes: [...draft.attributes, ['', '']] })}
              >
                {e('Add a characteristic')}
              </button>
            )}
          </fieldset>
          {similar.length > 0 && (
            <div className="product-picker-similar">
              <p>{e('Similar products already in the catalogue:')}</p>
              <ul>
                {similar.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>{item.name}</strong> <small>{describe(item)}</small>
                    </span>
                    <button type="button" className="if-link" onClick={() => choose(item)}>
                      {e('Use this')}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && (
            <p className="product-picker-error" role="alert">
              {error}
            </p>
          )}
          <div className="product-picker-actions">
            <button
              type="button"
              className="if-button if-button-primary"
              onClick={() => void create()}
              disabled={saving}
            >
              {saving
                ? e('Saving…')
                : proposing
                  ? e('Continue with the new category')
                  : e('Create and select')}
            </button>
            <button type="button" className="if-link" onClick={() => setCreating(false)}>
              {e('Cancel')}
            </button>
          </div>
          {!categoryId && (
            <p className="guidance-hint">
              {onPropose
                ? e(
                    'No fitting category? Pick “Other (not listed)” in the closest group (factories see it straight away), or propose a new category and your request will wait for it.'
                  )
                : e(
                    'No fitting category? Pick “Other (not listed)” in the closest group, or propose a new category for review.'
                  )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
