# UI and UX checks

Branch: `feature/ui-ux-enhancement`.

Three selectable visual themes share components and interaction rules: Pearl defaults to customer workspaces, Grove to factory, and Midnight to logistics/admin/public pages. A saved choice overrides the role default. Legacy preferences fall back to Midnight. Role shortcuts lead to workflow sections, and landing links preselect registration roles.

## Role experiences

Customer: warm editorial purchasing studio, request cards and a four-stage order timeline. Factory: forest sidebar workspace with lime accents, demand board, inventory and production sections. Logistics: midnight dispatch board with blue route graphics and transaction lanes. Admin: violet control room with real request distribution and optimisation tools. Landing and authentication pages use the same updated brand icon family and editorial typography.

Buttons and links have pointer and keyboard press feedback. Navigation has progress and entrance motion; dialogs animate in and out. Reduced-motion preferences disable these effects. Workspace sections have URL state that survives reload, browser history and language changes. Keyboard dialog focus, theme selection and autocomplete are covered by browser checks.

Desktop and mobile screenshots were reviewed for all four overview layouts, plus landing, authentication and customer order cards. The redesigned overviews, navigation, landing and authentication story, order timeline, theme controls and customer card labels support English, Russian and Kazakh. Theme names remain product names; user-entered data is not translated. Locale checks cover public routes and all four roles on desktop and mobile.

## Local environment

- Frontend: http://127.0.0.1:3100
- Backend: http://127.0.0.1:8000 (readiness: `/ready`)
- PostgreSQL 15: `127.0.0.1:55432`, database `intelli_ux`, user `intelli_user`
- Database directory: `/private/tmp/intelli-ux-postgres`
- Python environment: `backend/app/api/.venv`
- Local configuration: `backend/app/api/.env` (ignored by Git)

The database is a separate test cluster bound to loopback. It uses local trust authentication and contains only generated demo/test data. It is not registered as a login service; its temporary directory may be removed by macOS.

Demo accounts: `customer.demo@intelli.local`, `factory.demo@intelli.local`, `logist.demo@intelli.local`, `admin.demo@intelli.local`. Password: `password123`.

To restart the existing database:

```sh
/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/intelli-ux-postgres -l /private/tmp/intelli-ux-postgres.log -o '-h 127.0.0.1 -p 55432 -k /private/tmp' start
```

Start the backend from `backend/app/api`:

```sh
uv run --no-project uvicorn main:app --host 127.0.0.1 --port 8000
```

Start the frontend from the repository root:

```sh
npm run dev --workspace=frontend -- --hostname 127.0.0.1 --port 3100
```

For a fresh database, initialize a separate cluster, create `intelli_ux`, configure the local database URL, run `uv run --no-project prisma migrate deploy`, then run `seed.py` with `SEED_WITH_REFERENCE_GEO=1` and `seed_workflow_scenarios.py`. Keep `DATABASE_URL` exported for standalone seed scripts. The project environment was installed from the hashed `requirements.txt` with `uv pip install`; Prisma was generated with `uv run --no-project prisma generate`.

## Verification

Passed locally: 56 fixture-based browser checks, 6 Jest tests, 53 backend tests, ESLint, changed-source formatting, and the normal production build.

Additional real database tests cover desktop and mobile:

- Login through the browser for all four roles.
- Inventory, request, factory bid and logistics quote creation through real API calls using the browser sessions.
- Greedy, fast and deep optimisation comparison.
- Contract signing by all three parties through their workspace dialogs.
- Mock payment, factory handover, logistics delivery, customer acceptance and ratings through the UI.
- Completed transaction state read back from the database-backed API.
- Registration through the real API, followed by token verification and login through the UI.

Run the fixture suite:

```sh
npm run test:e2e --workspace=frontend -- flows.spec.ts
```

Run the real workflow suite against the isolated local backend:

```sh
INTELLI_LIVE_E2E=1 npm run test:e2e --workspace=frontend -- live-workflow
```

Real tests create records and are skipped unless explicitly enabled. They must only run against an isolated local test environment. Install Chromium once with `npm exec --workspace=frontend -- playwright install chromium`.

The full lifecycle is verified locally, with a mix of API setup/actions and browser interactions. This does not establish that every form interaction or the hosted deployment works. Email verification uses the application's development link; external mail delivery is not exercised. Payment remains the application's mock checkout and does not charge money.

The workflow seeder now shares the connected application Prisma client with the optimisation engine; its post-seed scoring was verified against PostgreSQL.

## Language persistence

The selected interface language is stored locally as `if-locale`. URLs without a valid language are normalized while preserving other query parameters and fragments. Explicit URL languages remain valid overrides. A bare authenticated workspace URL restores the account preference first.

`User.preferred_locale` stores an optional `en`, `ru`, or `kk` value. Registration records the current language; login restores an existing preference or adopts the current language for an account without one. The shared language switcher updates authenticated accounts through `PATCH /auth/preferences`; guests keep the browser preference. Failed account saves show a localized message while keeping the local selection.

Migration `20260914190000_user_preferred_locale` was applied to the isolated local test database. Apply migrations and regenerate Prisma when running this branch in another environment.

Two real database browser checks verify preference updates, restoration in a fresh session and after clearing browser storage, unauthenticated rejection, and invalid-language rejection:

```sh
INTELLI_LIVE_E2E=1 npm run test:e2e --workspace=frontend -- live-locale.spec.ts
```
