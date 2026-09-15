# Shared multilingual catalogue

## Outcome

Customers and factories choose products from one shared catalogue. Users can create a missing category or item directly and immediately use it. They should not have to submit a suggestion and wait before continuing their work. Registration stays focused on account, contact and location details; adding products belongs in the workspace after registration.

## Starting point

Continue from the tested `feature/guided-onboarding` branch, or the branch that contains it after merge. Check current branches and worktrees before changing anything. Preserve all existing progress and leave unrelated worktrees untouched. Use a separate implementation branch. Do not commit, push, merge or deploy without fresh authorization for this session. Any authorized commits must be signed using the existing Git identity; do not add co-authors or contributor attribution.

The onboarding branch includes guided registration, required phone validation, address-entry hints and role-specific guidance. It does not change catalogue creation or matching rules.

Inspect these files and the latest category-governance changes before implementation:

- `backend/app/api/prisma/schema.prisma`: `Category`, `CategoryTranslation`, `Item`, `ItemTranslation`, inventory and request relationships.
- `backend/app/api/routers/requests.py` and catalogue/inventory routes: current creation, normalization and selection behavior.
- `frontend/pages/app/customer.tsx`, `frontend/pages/app/factory.tsx`: current category/item fields and free-text submissions.
- `frontend/lib/authClient.ts`: bootstrap and creation contracts.
- `frontend/lib/guidance.ts`: update instructions to describe the final catalogue behavior.

The schema already contains category trees, category/item translations, and a unique item name within each category. Reuse and extend these structures. Category-governance work exists in other branches/worktrees; compare it before deciding the migration path. Do not blindly merge an older branch over newer changes.

## Required experience

1. Search or browse the shared catalogue in English, Russian or Kazakh. Display category hierarchy, item name, unit and relevant characteristics clearly.
2. Select existing records first. Searching a translated name or alias must find the same canonical item, not a separate record per language.
3. When there is no match, offer an explicit “Create category” or “Create item” action. Show likely duplicates before creation. Keep entered order/inventory details intact when the dialog opens or closes.
4. Creating a category or item makes it available for the user's current operation immediately. Return its canonical ID and select it automatically. Show whether it is newly created, established or later merged; do not describe creation as a pending suggestion.
5. Let customers and factories reuse the same records. Separate product identity from a particular factory's stock, price, lead time and location.
6. Translate interface text in all three languages. Store user-provided labels with their language. Provide a clear fallback when a translation is missing; never claim a user-entered label has been translated if it has not.
7. Make creation usable on mobile: short forms, readable labels, keyboard access, sufficient spacing and clear recovery from errors.

## Design decisions to resolve in the separate session

- Which initial catalogue source and product domains should be included? Evaluate coverage, licensing, update process and EN/RU/KK labels before importing anything. “Universal” means a shared extensible catalogue; do not promise exhaustive worldwide product coverage.
- What minimum data is needed for a useful category/item, and which characteristics and units determine whether products are interchangeable?
- Who may rename, translate, merge or retire records after creation? New records should be usable immediately while duplicate cleanup and abuse controls protect shared data.
- How are alternative names, transliteration, spelling variations and cross-language duplicates normalized? Do not merge distinct grades, dimensions or materials just because names resemble each other.
- How will factory production categories and eligibility restrictions interact with user-created categories? Preserve backend authorization and matching constraints.

## Implementation requirements

- Use canonical IDs and explicit locale labels; never match requests to inventory by translated display text alone.
- Handle concurrent creation of the same category/item without duplicate rows or an unhandled uniqueness error.
- Validate units, category relationships and permissions server-side. Reuse existing records where appropriate and return actionable errors.
- Preserve references from requests, inventory, bids and contracts when records are merged or retired. Keep history and existing orders readable.
- Provide a migration and rollback plan, including any legacy free-text records and existing translations. Do not alter live data during development.
- Do not silently replace unrelated products or erase user-entered metadata during catalogue cleanup.

## Acceptance checks

- A customer creates an item in Russian; a factory can find and reuse that canonical item through its English or Kazakh label after those translations are added.
- Customer and factory flows can create a missing category/item and continue immediately without losing form data.
- Duplicate attempts, including simultaneous requests, reuse or clearly resolve the existing record.
- Product variants remain distinct; compatible units and attributes participate correctly in matching.
- Unauthorized rename/merge/delete attempts fail. Existing stock, requests and orders retain valid references after authorized cleanup.
- Missing translations use an explicit fallback; UI controls and error messages remain localized.
- Test the full request → stock/bid → logistics quote → selected order journey and mobile catalogue creation in all three languages.

Deliver the implementation, migration notes and verified test results on its separate branch. Distinguish mocked UI coverage from tests against a real disposable database.
