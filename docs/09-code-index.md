# 09. Индекс кода

Навигационная карта репозитория: где что лежит, какие символы экспортирует файл и где
обрабатывается каждый эндпоинт. Цифры — актуальны на 17.10.2026 (без `node_modules`, `dist`,
`.dsh-code-index`).

## Сводка

| Область | Файлов | Строк | Комментарий |
| --- | ---: | ---: | --- |
| `src/` (frontend) | 24 | ~1 870 | React-компоненты, страницы, сервис, утилиты, стили |
| `api/src/` (backend) | 40 | ~1 570 | 6 модулей, 7 контроллеров, 6 сервисов, 6 репозиториев |
| `api/prisma/` | 21 | ~570 | схема, seed, 18 миграций, lock-файл |
| **Итого** | **85** | **~4 000** | плюс `scripts/`, конфиги и документация |

Дополнительно: `scripts/send-test-runs.ps1` (136 строк) — демо-генератор запусков;
`vite.config.js`, `docker-compose.yml`, `index.html`, `package.json`, `api/package.json`,
`api/tsconfig.json`, `.env.example`.

---

## Frontend

Корень — `src/`.

| Файл | Строк | Роль | Экспорты / ключевые сущности |
| --- | ---: | --- | --- |
| `main.jsx` | 5 | точка входа React | монтирует `<App />` в `#root`, `StrictMode` |
| `App.jsx` | 69 | провайдеры, тема, роутинг | `default App`; внутренние `getRoute`, `getPath`, `getInitialTheme`, `getInitialWorkspaceId` |
| `constants.js` | 6 | константы UI | `envColors`, `environmentOptions` |
| `styles.css` | 21 КБ | темы и стили | CSS-переменные `:root`, `[data-theme="light"]`, стили таблиц/аналитики |
| `services/dataService.js` | 106 | HTTP-клиент | `getData`, `getWorkspaces`, `createWorkspace`, `deleteWorkspace`, `createPhase`, `deletePhase`, `createReport`, `deleteReport`, `updateResultFeedback`, `getAutomatedTests`, `createAutomatedTest`, `createAutomatedTestsBulk`, `updateAutomatedTestsVisibility`, `deleteAutomatedTest`, `harvestAutomatedTests`, `importLegacyData` |
| `utils/format.js` | 16 | форматирование | `formatDate`, `formatDuration` |
| `utils/testFileParser.js` | 79 | парсер JSON-каталога | `parseTestsFile`; внутренние `cleanString`, `cleanTags`, `normalizeEntry` |
| `pages/Dashboard.jsx` | 70 | загрузка данных и выбор страницы | `default Dashboard` |
| `pages/PhasesPage.jsx` | 139 | список фаз | `default PhasesPage` |
| `pages/ReportsPage.jsx` | 117 | отчёты фазы | `default ReportsPage` |
| `pages/ReportPage.jsx` | 84 | результаты отчёта | `default ReportPage`; внутри `buildReportView` |
| `pages/ReportDashboard.jsx` | 142 | аналитика отчёта | `default ReportDashboard`; внутри `Metric`, `StatusChart`, `DurationChart` |
| `components/Shell.jsx` | 124 | каркас, workspace switcher, тема | `default Shell` |
| `components/PageHeading.jsx` | 16 | заголовок страницы | `default PageHeading` |
| `components/StatusTag.jsx` | 15 | тег статуса | `default StatusTag` |
| `components/ReportTables.jsx` | 156 | таблицы наборов/кейсов | `SuiteTable`, `CaseTable`; внутри `SuiteStatusBadges`, `getCaseColumns` |
| `components/RunDetails.jsx` | 90 | детали запуска | `default RunDetails`, `FailureFeedbackFields`, `failureReasons` |
| `components/ResultsChart.jsx` | 46 | SVG-донат результатов | `default ResultsChart` |
| `components/ReportsSummaryChart.jsx` | 63 | сводка по отчётам | `default ReportsSummaryChart` |
| `components/CatalogTableParts.jsx` | 109 | колонки каталога | `toDtoPayload`, `getCaseColumns`, `getSuiteColumns`, `caseEmptyText`, `catalogEmptyText` |
| `components/TestCatalogModal.jsx` | 294 | модальное окно каталога | `default TestCatalogModal`; внутри `CatalogTable` |
| `components/HarvestModal.jsx` | 38 | окно Harvest | `default HarvestModal` |
| `components/CreatePhaseModal.jsx` | 44 | создание фазы | `default CreatePhaseModal` |
| `components/CreateReportModal.jsx` | 41 | создание отчёта | `default CreateReportModal` |

### UI-поток

```text
main.jsx → App.jsx → Dashboard.jsx
                         ├─ Shell.jsx (sidebar/header/theme)
                         ├─ PhasesPage → CreatePhaseModal
                         ├─ ReportsPage → CreateReportModal, TestCatalogModal
                         │                   ├─ HarvestModal
                         │                   └─ CatalogTableParts
                         ├─ ReportPage → ResultsChart, ReportTables → RunDetails
                         └─ ReportDashboard
```

---

## Backend

Корень — `api/src/`.

### Инфраструктура

| Файл | Строк | Роль | Символы |
| --- | ---: | --- | --- |
| `main.ts` | 24 | bootstrap | `bootstrap`; глобальные pipe/CORS/BigInt |
| `app.module.ts` | 31 | корневой модуль | `AppModule` |
| `config/app.config.ts` | 13 | env-конфиг | `appConfig` (`port`, `host`, `corsOrigin`, `enableLegacyImport`, `trustProxy`) |
| `common/database/prisma.module.ts` | 6 | глобальный Prisma-модуль | `PrismaModule` |
| `common/database/prisma.service.ts` | 8 | lifecycle Prisma | `PrismaService` (`$connect`, `$disconnect`) |
| `common/pipes/parse-bigint.pipe.ts` | 14 | валидация числового path-параметра | `ParseBigIntPipe` |

### Модули

| Модуль | Файлы | Ключевые методы |
| --- | --- | --- |
| `workspaces` | `workspaces.module.ts`, `controller/workspaces.controller.ts`, `service/workspaces.service.ts`, `repository/workspaces.repository.ts`, `dto/create-workspace.dto.ts` | `findAll`, `findById`, `create`, `findOrCreateByName`, `canonicalName`, `delete` |
| `phases` | `phases.module.ts`, `controller/phases.controller.ts`, `service/phases.service.ts`, `repository/phases.repository.ts`, `dto/create-phase.dto.ts` | `findAll(workspaceId)`, `findById`, `create`, `ensureExists`, `delete` |
| `reports` | `reports.module.ts`, `controller/phase-reports.controller.ts`, `controller/reports.controller.ts`, `service/reports.service.ts`, `service/report-view.utils.ts`, `repository/reports.repository.ts`, `dto/create-report.dto.ts`, `dto/update-result-feedback.dto.ts` | `findByPhaseId`, `findResultsByPhaseId`, `createForPhase`, `findResults`, `updateResultFeedback`, `delete`; утилиты `parseDateOnly`, `dayStart`, `dayEnd`, `toRow` |
| `results` | `results.module.ts`, `controller/results.controller.ts`, `service/results.service.ts`, `repository/results.repository.ts`, `dto/run-payload.ts` | `normalize`, `ingestRun`; `create`, `findById`, `updateFeedback`, `findRunsCoveringWindow`, `findDistinctPaths`, `findLatestRunPerPath`, `circuitFilter`; типы `RunPayload`, `NormalizedRun`, `ReportResultRow` |
| `tests` | `tests.module.ts`, `controller/tests.controller.ts`, `service/tests.service.ts`, `repository/tests.repository.ts`, `dto/create-automated-test.dto.ts`, `dto/bulk-automated-tests.dto.ts`, `dto/update-visibility.dto.ts` | `findForEnvironment`, `create`, `createBulk`, `updateVisibility`, `harvestFromResults`, `delete`; `harvestBatch`, `findByResultPath`, `update`, `addEnvironment` (не используется) |
| `import` | `import.module.ts`, `controller/import.controller.ts`, `service/import.service.ts`, `repository/import.repository.ts` | `importLegacy`, `executeImport`; интерфейсы `LegacyPhase`, `LegacyReport`, `LegacyResult`, `LegacyImportPayload` |

### Карта эндпоинтов

| Метод и путь | Контроллер :: метод | Сервис |
| --- | --- | --- |
| `GET /workspaces` | `WorkspacesController::findAll` | `WorkspacesService.findAll` |
| `POST /workspaces` | `WorkspacesController::create` | `WorkspacesService.create` |
| `GET /workspaces/:workspaceId` | `WorkspacesController::findById` | `WorkspacesService.findById` |
| `DELETE /workspaces/:workspaceId` | `WorkspacesController::delete` | `WorkspacesService.delete` |
| `GET /phases` | `PhasesController::findAll` | `PhasesService.findAll` |
| `POST /phases` | `PhasesController::create` | `PhasesService.create` |
| `GET /phases/:phaseId` | `PhasesController::findById` | `PhasesService.findById` |
| `DELETE /phases/:phaseId` | `PhasesController::delete` | `PhasesService.delete` |
| `GET /phases/:phaseId/reports` | `PhaseReportsController::findByPhase` | `ReportsService.findByPhaseId` |
| `GET /phases/:phaseId/reports/results-summary` | `PhaseReportsController::findResultsSummary` | `ReportsService.findResultsByPhaseId` |
| `POST /phases/:phaseId/reports` | `PhaseReportsController::create` | `ReportsService.createForPhase` |
| `GET /reports/:reportId` | `ReportsController::findById` | `ReportsService.findById` |
| `GET /reports/:reportId/results` | `ReportsController::findResults` | `ReportsService.findResults` |
| `PATCH /reports/results/:resultId/feedback` | `ReportsController::updateResultFeedback` | `ReportsService.updateResultFeedback` |
| `DELETE /reports/:reportId` | `ReportsController::delete` | `ReportsService.delete` |
| `POST /results` | `ResultsController::ingest` | `ResultsService.ingestRun` |
| `GET /tests` | `TestsController::findAll` | `TestsService.findForEnvironment` |
| `POST /tests` | `TestsController::create` | `TestsService.create` |
| `POST /tests/bulk` | `TestsController::createBulk` | `TestsService.createBulk` |
| `POST /tests/visibility` | `TestsController::updateVisibility` | `TestsService.updateVisibility` |
| `POST /tests/harvest` | `TestsController::harvest` | `TestsService.harvestFromResults` |
| `DELETE /tests/:testId` | `TestsController::delete` | `TestsService.delete` |
| `POST /import` | `ImportController::importLegacy` | `ImportService.importLegacy` |

### Межмодульные зависимости

```text
ReportsService  → PhasesService (ensureExists, findById)
                → ResultsRepository (findRunsCoveringWindow)
                → TestsRepository (findForEnvironment)
ResultsService  → WorkspacesService (findOrCreateByName)
TestsService    → ResultsRepository (findDistinctPaths, findLatestRunPerPath)
```

Все репозитории используют глобальный `PrismaService`.

---

## Prisma

| Путь | Роль |
| --- | --- |
| `api/prisma/schema.prisma` | модели `Workspace`, `Phase`, `Report`, `AutomatedTest`, `AutomatedTestEnvironment`, `TestResult`; enum `TestStatus` |
| `api/prisma/seed.ts` | идемпотентные демо-данные: workspace, 3 фазы, 4 отчёта, 5 тестов, 8 запусков |
| `api/prisma/migrations/` | 18 миграций (описание — в [06-data-model.md](06-data-model.md#история-миграций)) |
| `api/prisma/migrations/migration_lock.toml` | провайдер `postgresql` |

---

## Скрипты и конфигурация

| Файл | Роль |
| --- | --- |
| `scripts/send-test-runs.ps1` | демо-нагрузка `POST /api/results`: 12 позитивных и 4 негативных кейса, `-DryRun`, `-BaseUrl` |
| `docker-compose.yml` | PostgreSQL 16 (`test_insights` / `test_insights_dev`), порт 5432, healthcheck |
| `vite.config.js` | React-плагин, `dedupe: react/react-dom`, `manualChunks` (charts/antd/dayjs) |
| `index.html` | HTML-оболочка SPA |
| `package.json` | скрипты фронтенда/API, зависимости |
| `api/package.json` | скрипты Nest/Prisma/Jest, зависимости API |
| `api/tsconfig.json` | CommonJS, ES2021, `strictNullChecks`, `noImplicitAny: false` |
| `api/.env.example` | шаблон окружения |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package-lock.json` | следы двух пакетных менеджеров |

---

## Зависимости и где они используются

| Пакет | Где |
| --- | --- |
| `react`, `react-dom` | всё приложение |
| `antd` | UI-компоненты (`Layout`, `Table`, `Modal`, `Form`, `Select`, `Progress`, …) |
| `@ant-design/icons` | иконки в компонентах |
| `dayjs` | `utils/format.js`, `PhasesPage`, `CreatePhaseModal`, `CreateReportModal` |
| `@ant-design/charts` | **не используется** в `src/`, хотя указан в зависимостях и `manualChunks` |
| `@nestjs/common`, `core`, `platform-express` | каркас API |
| `@nestjs/config` | `appConfig`, `ConfigModule` |
| `@nestjs/throttler` | глобальный guard и `@Throttle` |
| `@prisma/client`, `prisma` | доступ к БД, миграции, seed |
| `class-validator`, `class-transformer` | DTO и трансформация query/body |
| `reflect-metadata`, `rxjs` | обязательные зависимости Nest |
| `jest`, `ts-jest`, `@nestjs/testing` | заявлены в `api/package.json`, тестов и конфигов нет |

---

## Состояние репозитория

- Ветка `master`, последний коммит — `d3d70aa «Перевести интерфейс на русский язык»`.
- Рабочее дерево содержит незакоммиченную функциональность **workspace**:
  - изменены `schema.prisma`, `seed.ts`, `app.module.ts`, `parse-bigint.pipe.ts`;
  - изменены модули `import`, `phases`, `reports`, `results`, `tests`;
  - изменены `App.jsx`, `Shell.jsx`, `TestCatalogModal.jsx`, `Dashboard.jsx`, `PhasesPage.jsx`,
    `ReportsPage.jsx`, `dataService.js`, `styles.css`;
  - новые: `api/src/modules/workspaces/` и миграция `20261021000000_workspaces/`.
- `.dsh-code-index/` — служебный индекс IDE/агента, в git не входит.
- `dist/` и `api/dist/` — результаты сборки, в git не входят.

## Как пользоваться индексом

- Ищете поведение экрана — начните с `src/pages/*`, затем `components/*`.
- Ищете правило API — `api/src/modules/<feature>/service/*.service.ts`.
- Ищете SQL/выборку — `api/src/modules/<feature>/repository/*.repository.ts`.
- Ищете ограничение БД — `api/prisma/migrations/`.
- Ищете контракт запуска — `api/src/modules/results/service/results.service.ts` и
  [07-ingestion-and-import.md](07-ingestion-and-import.md).

## Связанные документы

- [README.md](README.md) — карта документации
- [02-architecture.md](02-architecture.md) — потоки и слои
- [05-api.md](05-api.md) — контракты
- [06-data-model.md](06-data-model.md) — схема и миграции
- [10-deployment.md](10-deployment.md) — развёртывание на сервере
