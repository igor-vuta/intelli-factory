# Factory categories — milestone 1

Branch: `feature/factory-categories`, based on `origin/main` at `fe36c8f`.
Worktree: `.worktrees/factory-categories`.

## Behaviour

Factories complete company/contact/location details, confirm one or more production categories, and publish an available-stock offering. Incomplete verified accounts can still log in, edit their profile and save private drafts. Incomplete factories start on the setup view and cannot bid through the UI or API.

`FactoryCategory` has a unique factory/category pair. The migration infers **unconfirmed** selections from existing inventory using its actual item/category IDs. Confirmation never grants descendant-category eligibility. Active leaf categories are selectable; parents are grouping records. Removing a selection disables new bids and selection of outstanding bids in that category. Inventory, bids, contracts and signatures are retained.

`InventoryDraft` stores incomplete, owner-scoped data separately from live inventory. A draft can reference a pending category proposal. Approval resolves that reference at publication, but the factory must still confirm the approved category. Saving a draft has no commercial eligibility requirements. Publishing validates the profile, category, product, unit, positive finite stock quantity/unit price, currency, stock address and attributes. A new product and its inventory are created in one database transaction; failure preserves the draft and rolls back catalogue/stock writes. A concurrent second publication cannot create another offering.

Existing product units and definitions cannot be overwritten through inventory publication. Only stock available now is published; transport estimates are not repurposed as manufacturing lead time. Made-to-order capacity remains outside this milestone.

Category proposals record the submitter, parent, description, pending/approved/rejected status, reviewer, decision time and note. Only verified administrators can decide them. Approval can explicitly link an existing active leaf category. New category codes are independent of display names. Unicode-normalized collisions against existing labels/translations require an explicit review/link; they do not automatically merge identities. Review, category selection and publication use transaction-scoped catalogue locks. Concurrent/repeated approval creates one category, and failed decisions roll back category creation.

Review can add at most two catalogue levels and cannot turn a category already used by products, requests or factory selections into a parent. There is no reparenting endpoint; proposals cannot introduce self-parenting or cycles. Existing trees and IDs are preserved.

The legacy request and inventory endpoints reject attempts to publish `category_name_text` directly. Supplying text alongside an existing category ID never renames or reactivates that category.

## Matching contract

The same validation runs at factory bidding, customer selection and optimizer candidate filtering:

- Verified, complete factory; own active, undeleted inventory.
- Confirmed, enabled capability for the exact active leaf category.
- Active item, matching category/item IDs, supported matching unit and requested attributes.
- A text-only request must match the product's original name after Unicode normalization, case folding and whitespace normalization. Different products in the same category are not interchangeable. Selecting a catalogue item ID is preferable to text matching.
- The quoted quantity equals the entire requested quantity and does not exceed available stock.

The old API permitted partial quotes without allocation/summing logic. This milestone deliberately requires whole-request fulfilment. It does **not** reserve stock.

Two overlapping authorization regressions are closed: only the verified owning customer can select a candidate, and factories/logistics cannot reopen completed requests through the generic status endpoint. Customer cancellation through that endpoint is limited to open requests.

## Catalogue and attributes

The initial catalogue reuses the four families from existing example seeds: `textile`, `electronics`, `food`, `packaging`. It is a small application catalogue, not a comprehensive external manufacturing taxonomy. Existing slugs keep their IDs, labels, status and mappings. No external data or licence changes are introduced.

New Textile records have an initial object schema: required string `material`, optional numeric `gsm` from 1 to 2000, unit `g/m2`. Existing category records are not overwritten. Both customer and factory forms render the supplied definitions. Supported definitions are explicit `type: object`, `required`, primitive property types (`string`, `number`, `integer`, `boolean`), `enum`, numeric `minimum`/`maximum`, and descriptive `unit`. Requested attribute values are matched exactly; range matching and unit conversion are not implemented.

Legacy `Item.characteristics_schema` values are example dictionaries, not necessarily schemas. They remain unchanged; only explicit object definitions impose new validation rules.

Supported stock units: `pcs`, `kg`, `g`, `t`, `tons`, `l`, `m`, `m2`, `m3`, `roll`. Units must agree literally; aliases are not converted. Historical offerings using other units remain stored and require a reviewed product correction before becoming eligible.

Catalogue fallback is **requested-locale translation → original default label**. A missing translation never becomes a new category or a purported verified translation. The new setup/review UI has EN/RU/KK copy. Existing workflow copy outside those controls is not comprehensively rewritten.

Initial migration translation coverage (without pre-existing translation rows):

| Catalogue             | Original labels | EN translation rows | RU translation rows | KK translation rows |
| --------------------- | --------------- | ------------------- | ------------------- | ------------------- |
| Four initial families | 4, English      | 0                   | 0                   | 0                   |

`GET /api/categories/coverage` gives administrators actual counts and missing category IDs per locale, including pre-existing catalogue records. This report does not claim translation coverage of a live database.

## Validation

Validation used disposable PostgreSQL **15.19** on `127.0.0.1:55439`, mocked/no email delivery, and local frontend/API ports 3149/8049. No production accounts or data were used.

- ESLint, Prettier, Jest (6 tests) and Ruff.
- Full pytest suite: **102 passed**, including real PostgreSQL review concurrency, decision rollback, draft publication concurrency, ownership, readiness and capability removal.
- Empty-schema and representative historical-data migration replay; repeated backfill preserves category IDs, inventory, requests, contracts and signed signatures.
- Actor checks, invalid ownership/category/item/unit/quantity/specification combinations, inactive categories, parent groups, pending inventory, unverified factories and legacy category-publication bypasses.
- Twelve browser checks: EN/RU/KK factory flow on desktop/mobile; administrator review and customer catalogue consistency on both sizes; load retry, empty search and failed-save preservation on both sizes. Factory checks include keyboard category selection, multiple selections, draft resume, invalid publication, successful publication and pending proposals.
- Manual browser verification: resume saved draft, publish stock, readiness changes to ready, and submit an eligible whole-request bid. Mobile rendering inspected; automated checks assert no horizontal overflow.
- Production build via `npm run build --workspace=frontend -- --webpack`. Default Turbopack repeatedly failed creating a local worker port with `Operation not permitted`; the bundler configuration was not changed.
- Commitlint runs through the commit-message hook when preparing the feature branch for delivery.

### Repeat local database checks

From `backend/app/api`, with the isolated environment installed using `uv` and the Prisma client generated:

```sh
export CATEGORY_TEST_DATABASE_URL=postgresql://factory_test@127.0.0.1:55439/factory_categories_test
DATABASE_URL="$CATEGORY_TEST_DATABASE_URL" uv run --no-project prisma migrate deploy
uv run --no-project pytest tests/ -q
uv run --no-project python verify_category_migration.py
```

`verify_category_migration.py` replays all migration SQL in temporary, rollback-only schemas, including old data inserted before the category migration. PostgreSQL tests reject URLs outside the named disposable localhost database. Without `CATEGORY_TEST_DATABASE_URL`, database cases are explicitly skipped. The backend CI job now provisions PostgreSQL 15, applies migrations and runs both the replay check and the full suite. Validation recorded here is local; a GitHub CI result is not included in this report.

### Repeat browser checks

Prepare fresh disposable accounts with `uv run --no-project python tests/prepare_category_browser.py`. It writes a mode-600 fixture to `/private/tmp/factory-browser-fixture.json` without sending email. Start the API on port 8049 using the same disposable database. Start the frontend on port 3149 with `BACKEND_API_URL=http://127.0.0.1:8049/api`; use `next dev --webpack` locally if Turbopack encounters the worker-port restriction.

From `frontend`:

```sh
CATEGORY_BROWSER_FIXTURE=/private/tmp/factory-browser-fixture.json npx playwright test --config=category.playwright.config.ts
```

The test runner uses the existing local servers and creates no production sessions. Browser screenshots and traces are local test artifacts.

## Next milestone and limits

Candidate selection still performs several separate writes; this change does not claim atomic acceptance or reservation safety. Milestone 2 should implement guarded, atomic lifecycle transitions, acceptance retries and cancellation consistency. Milestone 3 still owns stock reservations, currency conversion/comparison, immutable commercial snapshots, logistics quote scoping and exact simulated payment validation. The audit's payment defect is not fixed here.

Eligibility is checked against current data at each operation; it is not a claim that concurrent stock commitments are safe. This is not a complete security audit. Feature-branch delivery does not merge, deploy or modify live data.

## Review entry points

- `backend/app/api/prisma/schema.prisma` and `prisma/migrations/20260915000100_factory_categories/migration.sql`: new relations, private drafts, proposals and provisional backfill.
- `backend/app/api/routers/categories.py`: catalogue, profile/setup, selection, proposal review and draft endpoints.
- `backend/app/api/services/category_governance.py`: shared publication and matching rules, used by `routers/requests.py`, `routers/pairing.py` and `services/optimization_engine.py`.
- `frontend/components/FactorySetup.tsx`, `CategoryProposalPanel.tsx`, `AttributeFields.tsx`, and `frontend/lib/categoryCopy.ts`: localized controls; integrated into the factory, customer and admin pages.
- `backend/app/api/tests/test_category_governance.py`, `verify_category_migration.py`, `tests/prepare_category_browser.py`, `frontend/e2e/factory-categories.spec.ts`, and `.github/workflows/ci.yml`: validation and repeatable test setup.

Other sessions advanced `main` to `7d977ab` and changed the root checkout while this work was in progress. This feature remains based on `fe36c8f`; it has not incorporated those later changes. The geography checkout was left untouched.
