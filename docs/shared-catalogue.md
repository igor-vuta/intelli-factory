# Shared multilingual catalogue

Implements `docs/UNIVERSAL_CATALOGUE_TASK.md` on top of the category governance already on `main`,
reusing the backend of the earlier `feature/universal-catalogue` branch.

## Decisions

- **Hybrid creation.** Products are created immediately and reused by everyone. Categories stay
  governed: customers and factories propose them (`/api/categories/proposals`) and an
  administrator approves; only administrators create categories directly
  (`POST /api/catalogue/categories`). The category tree decides which factories may publish and
  bid, so it changes only through review.
- **Source.** The repository's existing catalogue (textile, electronics, food, packaging, energy)
  is the starting point. No external taxonomy is imported and no translation coverage is
  claimed; importing one would need its own review of coverage, licensing, updates and real
  EN/RU/KK labels.
- **Product identity.** A product is a category, a name in a stated language, a supported unit and
  optional identity characteristics (material, grade/model, dimensions with their units). Stock
  and requests can't override identity characteristics. Quantity, price, stock location and
  offering details belong to each factory's stock, not to the product.
- **Units.** `pcs`, `kg`, `g`, `t`, `tons`, `l`, `m`, `m2`, `m3`, `roll`. Matching needs the same
  unit; there is no implicit conversion.
- **Who may change what.** Verified customers, factories and administrators create products
  (500 per account, a bound on abuse rather than moderation). Only administrators add or correct
  translations and aliases, establish, retire or merge records; every change is written to
  `EventLog` with its actor. There is no hard delete.

## Identity and language

- New requests and stock name a product by ID. Older free-text requests stay readable and keep
  matching by name as before; they are never reassigned to a similar product automatically.
- Names are compared after Unicode NFKC, case folding and whitespace collapsing, across the
  original label, every translation and every alias, within the same category. A product is
  reused only when its unit and identity characteristics are also equal, so different grades or
  sizes stay distinct. Two exact matches return a conflict asking the user to choose.
- Creation, stock publication and production declarations share one PostgreSQL advisory lock, so
  simultaneous identical creations return one record and no uniqueness error escapes.
- A label is shown in the requested language when a translation exists; otherwise the original is
  shown and marked (`fallback`, with its language when known). Historical labels keep an unknown
  source language rather than an invented one.
- Lifecycle: `NEW` → `ESTABLISHED`; `RETIRED` removes a record from new selection; `MERGED`
  redirects a duplicate to its canonical product. Stock, requests, bids and contracts keep their
  original references; matching compares canonical products, and the merged names stay
  searchable. Only products merge, and only with the same category, unit and characteristics.
- A factory can draft stock under a proposed category. Its product can't exist until the category
  is approved, so the draft keeps a name and unit; publishing it creates or reuses the product.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/catalogue?locale=ru&q=…&category_id=…` | Search labels, translations, aliases and merged names; returns hierarchy, units and fallback markers |
| `POST /api/catalogue/items` | `{name, locale, category_id, unit, attributes}`: create or reuse (`created` says which) |
| `POST /api/catalogue/categories` | Admin: `{name, locale, parent_id?}` |
| `PUT /api/catalogue/{categories\|items}/{id}/label` | Admin: `{locale, name, aliases}`; the previous name stays an alias |
| `POST /api/catalogue/{categories\|items}/{id}/maintenance` | Admin: `{action: establish\|retire\|merge, target_id?}` |

Administrators maintain labels and merges through this API; there is no maintenance screen yet.

## Migration and rollback

`20260929120000_shared_catalogue` only adds columns (source language, lifecycle state, identity
characteristics, merge link, aliases) and an index. It rewrites no name, unit, stock or commercial
reference; existing rows become `ESTABLISHED` with an unknown source language.

1. Back up the database before release. Apply the migration and deploy the matching application
   version together (`prisma migrate deploy`, as the production workflow already does).
2. Before any catalogue writes, rollback is the snapshot plus the previous application version.
3. Once products, labels or merges exist, prefer a forward fix: reverting the application alone
   loses merge-aware matching. Export catalogue records and `EventLog` before a planned snapshot
   restore. Don't drop the new columns or replay old free-text creation over current data.

## Verification

Development used disposable databases only (a throwaway PostgreSQL 15 on `127.0.0.1:55439` for
tests, the local `intelli_ux` database for the browser).

- Backend, real PostgreSQL: simultaneous creation returns one record; a Russian product is found
  and reused through English and Kazakh labels once added; variants stay distinct; admin
  categories deduplicate; corrected labels stay searchable; merges keep references and resolve
  to the canonical product; identity characteristics can't be overridden.
- Backend, mocked: only permitted roles create categories, create products, relabel or maintain;
  requests require a catalogue product.
- Browser, mocked API (desktop and phone): the picker finds a Russian-only product by its English
  alias and marks it untranslated, creates a missing product inline, and keeps the entered
  quantity; no horizontal overflow.
- Browser, real API and database: the full request → stock → bid → quote → optimisation →
  signatures → payment → delivery → ratings journey, with the product created through the
  catalogue.
