# Reporter for autotests

React + Vite frontend with a NestJS REST API, Prisma ORM, PostgreSQL, and versioned Prisma migrations.

## Local setup

Requirements: Node.js 20+, Docker Desktop.

```powershell
npm install
npm run api:install
Copy-Item api/.env.example api/.env
npm run db:up
npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate:deploy
```

The database starts empty: there is no seed script and no demo data. After the first launch,
create a workspace in the UI (or post a run with `projectName`).

Run the API and frontend in separate terminals:

```powershell
npm run api:dev
npm run dev
```

The API is available at `http://localhost:3001/api`; the Vite app is available at `http://localhost:5173`.
Set `VITE_API_URL` when the API is hosted elsewhere. The frontend requests only the data needed by the current route.

## API structure

The API follows a Spring Boot-inspired layered structure while keeping NestJS modules:

```text
api/src/
├── common/
│   └── database/                 # shared infrastructure (Prisma)
├── modules/
│   ├── phases/
│   │   ├── controller/           # HTTP endpoints
│   │   ├── service/              # business rules
│   │   ├── repository/           # database access
│   │   ├── dto/                  # request contracts
│   │   └── phases.module.ts
│   ├── reports/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── reports.module.ts
│   ├── tests/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── dto/
│   │   └── tests.module.ts
│   ├── import/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   └── import.module.ts
│   └── allure/
│       ├── controller/           # POST /allure/import, GET /attachments/:key
│       ├── service/              # ZIP reader, allure-results parser, storage
│       ├── repository/
│       └── allure.module.ts
├── app.module.ts
└── main.ts
```

Each feature is isolated in its own module. Controllers contain only HTTP concerns, services contain application/business logic, repositories encapsulate Prisma queries, and DTOs define validated request payloads. This makes it straightforward to add another feature without growing a single application file.


The Prisma schema is in `api/prisma/schema.prisma`. The initial migration is committed under `api/prisma/migrations/`. Use `prisma migrate dev` while developing schema changes and `prisma migrate deploy` for a production-like environment. The API never runs migrations automatically and does not use `synchronize`/`ddl-auto` behavior.

`TestResultDetail.steps` is stored as PostgreSQL JSONB because steps have a flexible payload (`name`, `status`, `duration`, nested `steps`, `attachments`) and are rendered as one report detail. `attachments` holds metadata only: files live under `ATTACHMENTS_DIR` (default `api/storage/attachments`) and are served by `GET /api/attachments/:key`. Steps, attachments, parameters, links, status details and the failure text live in `TestResultDetail` (1:1 with the run) so the hot `TestResult` row stays narrow: list queries read thousands of runs per request, while the detail is read for one run at a time. Steps, attachments and parameters are filled by the `allure-results` import; runs posted through the form contract keep them empty. The stable relational fields remain indexed columns. Results are idempotent on import via the unique `(workspaceId, externalId)` constraint.

## Allure-results import

Instead of posting one request per test, CI can upload the `allure-results` directory as a ZIP. The
archive brings steps, screenshots, parameters, tags, the Epic label, TMS/issue links and the failure
stack trace; missing catalog paths are registered automatically for the given environment.

```powershell
Compress-Archive -Path target\allure-results\* -DestinationPath target\allure-results.zip
Invoke-RestMethod -Method Post `
  -Uri 'http://localhost:3001/api/allure/import?workspaceId=1&environment=dso' `
  -ContentType 'application/zip' -InFile target\allure-results.zip
```

Re-uploading the same archive is a no-op (`imported = 0`), and a run already posted by the test-side
listener is enriched in place instead of duplicated (same `path` + `circuit` + start time ±10 s), so
the fast per-test channel stays the source of truth and the archive only adds steps and screenshots.
`environment` becomes the run `circuit` and must match the phase environment. The report page has the
same action: «Импорт allure-results», and a «Детали» button next to every case opens the step tree and
screenshots. Contract details — [`docs/05-api.md`](docs/05-api.md) and
[`docs/07-ingestion-and-import.md`](docs/07-ingestion-and-import.md).

## Launch history

The «История запусков» page in the sidebar lists every uploaded archive of the selected workspace —
including archives that contained only duplicates — with its file name, environment, run window,
status counts and import counters. The source of a launch (`ci`, `local` or `unknown`) is shown next
to the environment and can be filtered. CI uploads pass `origin=ci`; the web upload form asks for the
source (`local` by default); clients that send nothing stay `unknown`. Opening a row shows the report
of that exact CI run (the runs are not merged with the catalog, so hidden catalog tests stay visible).
The data comes from the `AllureLaunch` table and `GET /api/launches` / `GET /api/launches/:launchId`.
When CI reuses one `launchId` for several archives, the history entry accumulates their counters and
shows the runs of the whole launch.

## Legacy localStorage import

Legacy data can be imported only when the API process explicitly has `ENABLE_LEGACY_IMPORT=true`. Send the old `{ phases, reports, results }` object to `POST /api/import` with `X-Import-Confirmation: yes`. The import runs in one transaction, maps old phase IDs to database-generated numeric IDs, validates relationships, and uses upserts to avoid duplicates. Existing browser localStorage is not deleted automatically. Keep this endpoint disabled outside a trusted migration window; the API currently has no authentication and must not be exposed publicly.

## API endpoints

- `GET /api/phases`
- `GET /api/phases/:phaseId`
- `GET/POST /api/phases/:phaseId/reports`
- `GET /api/reports/:reportId`
- `GET /api/reports/:reportId/results`
- `POST /api/reports/:reportId/results` (idempotent upsert)
- `POST /api/results`
- `GET /api/results/:resultId/details`
- `POST /api/allure/import`
- `GET /api/launches`
- `GET /api/launches/:launchId`
- `GET /api/attachments/:key`
- `POST /api/import` (disabled by default)

## Checks

Run `npm run build` for the frontend and `npm run api:build` for the API. PostgreSQL integration tests require Docker and a running database; do not treat schema generation alone as an integration test.

## Documentation

Full project documentation (in Russian) lives in [`docs/`](docs/README.md): overview and glossary, architecture, frontend, backend, HTTP API reference, data model and migrations, ingestion contracts, and the development guide.

> The API/model sections above predate workspaces and the current run contract. Treat `docs/05-api.md` and `docs/06-data-model.md` as the source of truth.
