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
│   └── import/
│       ├── controller/
│       ├── service/
│       ├── repository/
│       └── import.module.ts
├── app.module.ts
└── main.ts
```

Each feature is isolated in its own module. Controllers contain only HTTP concerns, services contain application/business logic, repositories encapsulate Prisma queries, and DTOs define validated request payloads. This makes it straightforward to add another feature without growing a single application file.


The Prisma schema is in `api/prisma/schema.prisma`. The initial migration is committed under `api/prisma/migrations/`. Use `prisma migrate dev` while developing schema changes and `prisma migrate deploy` for a production-like environment. The API never runs migrations automatically and does not use `synchronize`/`ddl-auto` behavior.

`TestResult.steps` is stored as PostgreSQL JSONB because steps have a flexible payload (`name`, `status`, `duration`, optional `output`/`error`) and are rendered as one report detail. The stable relational fields remain indexed columns. Results are idempotent via the unique `(reportId, automatedTestId)` constraint.

## Legacy localStorage import

Legacy data can be imported only when the API process explicitly has `ENABLE_LEGACY_IMPORT=true`. Send the old `{ phases, reports, results }` object to `POST /api/import` with `X-Import-Confirmation: yes`. The import runs in one transaction, maps old phase IDs to database-generated numeric IDs, validates relationships, and uses upserts to avoid duplicates. Existing browser localStorage is not deleted automatically. Keep this endpoint disabled outside a trusted migration window; the API currently has no authentication and must not be exposed publicly.

## API endpoints

- `GET/POST /api/phases`
- `GET /api/phases/:phaseId`
- `GET/POST /api/phases/:phaseId/reports`
- `GET /api/reports/:reportId`
- `GET /api/reports/:reportId/results`
- `POST /api/reports/:reportId/results` (idempotent upsert)
- `POST /api/import` (disabled by default)

## Checks

Run `npm run build` for the frontend and `npm run api:build` for the API. PostgreSQL integration tests require Docker and a running database; do not treat schema generation alone as an integration test.

## Documentation

Full project documentation (in Russian) lives in [`docs/`](docs/README.md): overview and glossary, architecture, frontend, backend, HTTP API reference, data model and migrations, ingestion contracts, and the development guide.

> The API/model sections above predate workspaces and the current run contract. Treat `docs/05-api.md` and `docs/06-data-model.md` as the source of truth.
