# 09. Индекс кода

Навигационная карта репозитория: где что лежит, какие символы экспортирует файл и где
обрабатывается каждый эндпоинт. Цифры актуальны на 19.10.2026 (без `node_modules`, `dist`,
`.dsh-code-index`).

## Сводка

| Область | Файлов | Строк | Комментарий |
| --- | ---: | ---: | --- |
| `src/` (frontend) | 25 | ~2 600 | React-компоненты, страницы, сервис, утилиты, стили |
| `api/src/` (backend) | 45 | ~2 160 | 7 модулей, 8 контроллеров, 7 сервисов, 6 репозиториев |
| `api/prisma/` | 3 | ~280 | схема, одна baseline-миграция, lock-файл |
| **Итого** | **73** | **~5 040** | плюс `scripts/`, конфиги и документация |

Дополнительно: `scripts/send-test-runs.ps1` (136 строк) — демо-генератор запусков;
`vite.config.js`, `docker-compose.yml`, `index.html`, `package.json`, `api/package.json`,
`api/tsconfig.json`, `.env.example`.

История миграций схлопнута: вместо накопительных миграций в репозитории одна
`20261018000000_baseline` (149 строк), описывающая финальную схему. Таблица старой истории
сохранена в [06-data-model.md](06-data-model.md#история-миграций) как историческая справка.

---

## Frontend

Корень — `src/`.

| Файл | Строк | Роль | Экспорты / ключевые сущности |
| --- | ---: | --- | --- |
| `main.jsx` | 5 | точка входа React | монтирует `<App />` в `#root`, `StrictMode` |
| `App.jsx` | 76 | провайдеры, тема, роутинг | `default App`; внутренние `getRoute`, `getPath`, `getInitialTheme`, `getInitialWorkspaceId` |
| `constants.js` | 6 | константы UI | `envColors`, `environmentOptions` |
| `styles.css` | 152 | темы и стили | CSS-переменные `:root`, `[data-theme="light"]`, стили таблиц, аналитики, матриц |
| `services/dataService.js` | 126 | HTTP-клиент | `getData`, `getPhaseAnalytics`, `getWorkspaces`, `createWorkspace`, `deleteWorkspace`, `createPhase`, `deletePhase`, `createReport`, `deleteReport`, `updateResultFeedback`, `getAutomatedTests`, `createAutomatedTest`, `createAutomatedTestsBulk`, `updateAutomatedTestsVisibility`, `deleteAutomatedTest`, `harvestAutomatedTests`, `importLegacyData` |
| `utils/format.js` | 16 | форматирование | `formatDate`, `formatDuration` |
| `utils/testFileParser.js` | 79 | парсер JSON-каталога | `parseTestsFile`; внутренние `cleanString`, `cleanTags`, `normalizeEntry` |
| `pages/Dashboard.jsx` | 73 | загрузка данных и выбор страницы | `default Dashboard`; ленивый `PhaseAnalytics` |
| `pages/PhasesPage.jsx` | 139 | список фаз | `default PhasesPage` |
| `pages/ReportsPage.jsx` | 117 | отчёты фазы | `default ReportsPage`; внутри `create`, `remove`, колонки |
| `pages/ReportPage.jsx` | 133 | результаты отчёта | `default ReportPage`; внутри `buildReportView`, фильтры статус/владелец/тег |
| `pages/ReportDashboard.jsx` | 142 | аналитика отчёта | `default ReportDashboard`; внутри `Metric`, `StatusChart`, `DurationChart` |
| `pages/PhaseAnalytics.jsx` | 469 | аналитика фазы | `default PhaseAnalytics`; внутри `PassRateTrend`, `PhaseMatrix`, `ReportComparison`, `FailureSignatures`, `FailureReasons`, `OwnerTable`, `SuiteTable`, `Hygiene` |
| `components/Shell.jsx` | 141 | каркас, workspace switcher, тема | `default Shell` |
| `components/PageHeading.jsx` | 16 | заголовок страницы | `default PageHeading` |
| `components/StatusTag.jsx` | 15 | тег статуса | `default StatusTag` |
| `components/ReportTables.jsx` | 177 | таблицы наборов/кейсов | `SuiteTable`, `CaseTable`; внутри `getCaseColumns` |
| `components/RunDetails.jsx` | 59 | детали запуска, обратная связь | `default RunDetails`, `FailureFeedbackFields`, `failureReasons` |
| `components/ResultsChart.jsx` | 46 | SVG-донат результатов | `default ResultsChart` |
| `components/ReportsSummaryChart.jsx` | 77 | сводка по отчётам фазы | `default ReportsSummaryChart`; накопительный результат, стековые полосы |
| `components/CatalogTableParts.jsx` | 109 | колонки каталога | `toDtoPayload`, `getCaseColumns`, `getSuiteColumns`, `caseEmptyText`, `catalogEmptyText` |
| `components/TestCatalogModal.jsx` | 295 | модальное окно каталога | `default TestCatalogModal`; внутри `CatalogTable` |
| `components/HarvestModal.jsx` | 44 | окно Harvest | `default HarvestModal` |
| `components/CreatePhaseModal.jsx` | 45 | создание фазы | `default CreatePhaseModal` |
| `components/CreateReportModal.jsx` | 42 | создание отчёта | `default CreateReportModal` |

### UI-поток

```text
main.jsx → App.jsx → Dashboard.jsx
                         ├─ Shell.jsx (sidebar/header/theme)
                         ├─ PhasesPage → CreatePhaseModal
                         ├─ ReportsPage → CreateReportModal, TestCatalogModal
                         │                   ├─ HarvestModal
                         │                   └─ CatalogTableParts
                         │                   └─ ReportsSummaryChart
                         ├─ ReportPage → ResultsChart, ReportTables → RunDetails
                         ├─ ReportDashboard
                         └─ PhaseAnalytics (lazy)
```

### Аналитика: где считается

`ReportDashboard` считает метрики отчёта в `useMemo` по `data.results` (один ответ
`GET /reports/:id/results`): статусы, владельцев, длительности, ошибки, `failureReason`,
долг анализа. `PhaseAnalytics` получает готовый серверный агрегат
`GET /phases/:id/analytics`: KPI, тренд, сравнение отчётов, матрицу, ошибки, владельцев, наборы,
гигиену; клиент только фильтрует и сортирует. Подробный каталог метрик — в
[11-analytics.md](11-analytics.md).

---

## Backend

Корень — `api/src/`.

### Инфраструктура

| Файл | Строк | Роль | Символы |
| --- | ---: | --- | --- |
| `main.ts` | 26 | bootstrap | `bootstrap`; глобальные pipe/CORS/BigInt |
| `app.module.ts` | 30 | корневой модуль | `AppModule` |
| `config/app.config.ts` | 12 | env-конфиг | `appConfig` (`port`, `host`, `corsOrigin`, `enableLegacyImport`, `trustProxy`) |
| `common/database/prisma.module.ts` | 5 | глобальный Prisma-модуль | `PrismaModule` |
| `common/database/prisma.service.ts` | 7 | lifecycle Prisma | `PrismaService` (`$connect`, `$disconnect`) |
| `common/dates/day-range.ts` | 22 | UTC-границы дня | `parseDateOnly`, `dayStart`, `dayEnd` |
| `common/pipes/parse-bigint.pipe.ts` | 13 | валидация числового path-параметра | `ParseBigIntPipe` |

### Модули

| Модуль | Файлы | Ключевые методы |
| --- | --- | --- |
| `workspaces` | 5: `workspaces.module.ts`, `controller`, `service`, `repository`, `dto/create-workspace.dto.ts` | `findAll`, `findById`, `create`, `findOrCreateByName`, `canonicalName`, `delete` |
| `phases` | 5: `phases.module.ts`, `controller`, `service`, `repository`, `dto/create-phase.dto.ts` | `findAll(workspaceId)`, `findById`, `create`, `ensureExists`, `delete` |
| `reports` | 8: `reports.module.ts`, `controller/phase-reports`, `controller/reports`, `service/reports`, `service/report-view.utils`, `repository/reports`, `dto/create-report`, `dto/update-result-feedback` | `findByPhaseId`, `findResultsByPhaseId`, `createForPhase`, `findResults`, `updateResultFeedback`, `delete`; утилита `toRow` |
| `results` | 5: `results.module.ts`, `controller`, `service`, `repository`, `dto/run-payload.ts` | `normalize`, `ingestRun`; `create`, `findById`, `updateFeedback`, `findRunsCoveringWindow`, `findDistinctPaths`, `findLatestRunPerPath`, `circuitFilter`; типы `RunPayload`, `NormalizedRun`, `ReportResultRow` |
| `tests` | 7: `tests.module.ts`, `controller`, `service`, `repository`, `dto/create-automated-test`, `dto/bulk-automated-tests`, `dto/update-visibility` | `findForEnvironment`, `create`, `createBulk`, `updateVisibility`, `harvestFromResults`, `delete`; `harvestBatch`, `findByResultPath`, `update`, `addEnvironment` (не используется) |
| `analytics` | 4: `analytics.module.ts`, `controller/phase-analytics`, `service/phase-analytics`, `dto/analytics.types.ts` | `getPhaseAnalytics`; приватные `buildEntries`, `buildReportRows`, `buildKpi`, `buildOwners`, `buildSuites`, `buildFailures`, `buildMatrix`, `buildHygiene`, `normalizeMessage`, `percentile` |
| `import` | 4: `import.module.ts`, `controller`, `service`, `repository` | `importLegacy`, `executeImport`; интерфейсы `LegacyPhase`, `LegacyReport`, `LegacyResult`, `LegacyImportPayload` |

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
| `GET /phases/:phaseId/analytics` | `PhaseAnalyticsController::findForPhase` | `PhaseAnalyticsService.getPhaseAnalytics` |
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

`results-summary` возвращает `{ reportSummaries: [{ reportId, counts, total }], cumulative: { passed, total } }`.
Счётчики считаются по видимому каталогу окружения фазы и правилу «последний запуск, но `passed`
побеждает», тому же, что и в представлении отчёта.

`analytics` возвращает `{ phase, kpi, reports, matrix, owners, suites, failures, hygiene }`.
Матрица компактна: ячейки — коды `p/f/b/s/n`; `hygiene` включает запуски вне каталога, дубли,
чужой `circuit` и пересечения окон отчётов.

### Межмодульные зависимости

```text
ReportsService   → PhasesService (ensureExists, findById)
                 → ResultsRepository (findRunsCoveringWindow)
                 → TestsRepository (findForEnvironment)
ResultsService   → WorkspacesService (findOrCreateByName)
TestsService     → ResultsRepository (findDistinctPaths, findLatestRunPerPath)
AnalyticsService → PhasesService (findById)
                 → ReportsRepository (findByPhaseId)
                 → TestsRepository (findForEnvironment)
                 → ResultsRepository (findRunsCoveringWindow без circuit)
```

Все репозитории используют глобальный `PrismaService`.

---

## Prisma

| Путь | Роль |
| --- | --- |
| `api/prisma/schema.prisma` | модели `Workspace`, `Phase`, `Report`, `AutomatedTest`, `AutomatedTestEnvironment`, `TestResult`; enum `TestStatus` |
| `api/prisma/migrations/20261018000000_baseline/migration.sql` | baseline: таблицы, индексы (включая GiST), CHECK-ограничения, FK, сброс последовательности `Workspace` |
| `api/prisma/migrations/migration_lock.toml` | провайдер `postgresql` |

---

## Скрипты и конфигурация

| Файл | Роль |
| --- | --- |
| `scripts/send-test-runs.ps1` | демо-нагрузка `POST /api/results`: позитивные и негативные кейсы, ретраи, теги, `-DryRun`, `-BaseUrl` |
| `docker-compose.yml` | PostgreSQL 16 (`test_insights` / `test_insights_dev`), порт 5432, healthcheck |
| `vite.config.js` | React-плагин, `dedupe: react/react-dom`, `manualChunks` (react/charts/antd/dayjs) |
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
| `dayjs` | `utils/format.js`, `App.jsx`, `PhasesPage`, `CreatePhaseModal`, `CreateReportModal` |
| `@ant-design/charts` | **не используется** в `src/`, хотя указан в зависимостях и `manualChunks`; кандидат для аналитики фазы с ленивой загрузкой |
| `@nestjs/common`, `core`, `platform-express` | каркас API |
| `@nestjs/config` | `appConfig`, `ConfigModule` |
| `@nestjs/throttler` | глобальный guard и `@Throttle` |
| `@prisma/client`, `prisma` | доступ к БД и миграции |
| `class-validator`, `class-transformer` | DTO и трансформация query/body |
| `reflect-metadata`, `rxjs` | обязательные зависимости Nest |
| `jest`, `ts-jest`, `@nestjs/testing` | заявлены в `api/package.json`, тестов и конфигов нет |

---

## Состояние репозитория

- Ветка `master`; актуальный список коммитов — `git log --oneline`.
- Workspace, документация и deployment-настройки закоммичены; аналитика фазы добавлена в рабочее
  дерево и на момент обновления индекса не закоммичена (`git status`).
- `api/prisma/seed.ts` удалён: установка пустая, демо-данных нет. Workspace создаётся в UI или
  автоматически при приёме запуска с `projectName`.
- `.dsh-code-index/19326952e60a.json` — **устаревший служебный снимок**: в поле `root` указан
  `C:\Users\PC\Documents\zxzx`, снимок сделан 16.10.2026 и содержит 65 файлов, включая удалённый
  `api/prisma/seed.ts`. Как источник истины его использовать нельзя; актуальная карта — этот
  документ. В git каталог не входит.
- `dist/` и `api/dist/` — результаты сборки, в git не входят.

## Как пользоваться индексом

- Ищете поведение экрана — начните с `src/pages/*`, затем `components/*`.
- Ищете правило API — `api/src/modules/<feature>/service/*.service.ts`.
- Ищете SQL/выборку — `api/src/modules/<feature>/repository/*.repository.ts`.
- Ищете метрику аналитики — `api/src/modules/analytics/service/phase-analytics.service.ts`
  и `src/pages/PhaseAnalytics.jsx`.
- Ищете ограничение БД — `api/prisma/migrations/`.
- Ищете контракт запуска — `api/src/modules/results/service/results.service.ts` и
  [07-ingestion-and-import.md](07-ingestion-and-import.md).
- Ищете идеи по метрикам — [11-analytics.md](11-analytics.md).

## Связанные документы

- [README.md](README.md) — карта документации
- [02-architecture.md](02-architecture.md) — потоки и слои
- [05-api.md](05-api.md) — контракты
- [06-data-model.md](06-data-model.md) — схема и миграции
- [10-deployment.md](10-deployment.md) — развёртывание на сервере
- [11-analytics.md](11-analytics.md) — аналитика: текущее состояние и каталог метрик
