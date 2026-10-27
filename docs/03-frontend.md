# 03. Frontend

Приложение — одностраничное React 19-приложение на Vite 6 с Ant Design 5. Сборка не использует
TypeScript: только `.jsx`/`.js`. Роутинг, тема и загрузка данных реализованы вручную.

## Точки входа

| Файл | Роль |
| --- | --- |
| `index.html` | контейнер `#root`, `lang="ru"`, подключение `/src/main.jsx` |
| `src/main.jsx` | `createRoot(...).render(<StrictMode><App /></StrictMode>)` |
| `src/App.jsx` | провайдеры antd, тема, состояние workspace, ручной роутинг |
| `src/pages/Dashboard.jsx` | загрузка данных по маршруту, состояния загрузки/ошибки, выбор страницы |
| `src/services/dataService.js` | HTTP-клиент и все вызовы API |

## Маршруты

Роутер — регулярное выражение в `App.jsx`:

```js
/^\/phase\/(\d+)(?:\/analytics|\/report\/(\d+)(?:\/analytics)?)?\/?$/
```

| URL | `route.page` | Компонент | Данные |
| --- | --- | --- | --- |
| `/` (любой другой путь) | `phases` | `PhasesPage` | `GET /phases?workspaceId=` |
| `/phase/:phaseId` | `reports` | `ReportsPage` | `GET /phases/:id`, `GET /phases/:id/reports`, `GET /phases/:id/reports/results-summary` |
| `/phase/:phaseId/analytics` | `phaseAnalytics` | `PhaseAnalytics` (ленивый чанк) | `GET /phases/:id/analytics`, `GET /phases/:id/reports` |
| `/phase/:phaseId/report/:reportId` | `report` | `ReportPage` | `GET /reports/:id`, `GET /reports/:id/results` |
| `/phase/:phaseId/report/:reportId/analytics` | `analytics` | `ReportDashboard` | те же, что для `report` (аналитика считается на клиенте) |

Особенности:

- `navigate(route)` собирает путь через `getPath()` и вызывает `history.pushState`; состояние
  React обновляется сразу, без перезагрузки.
- При `popstate` маршрут пересчитывается из `location.pathname`.
- ID в URL — числовые (`\d+`), потому что в БД ключи BigInt.
- Если фаза не найдена, показывается предупреждение с кнопкой «Назад к фазам».
- Параметр `route.phase` / `route.report` передаётся объектом для мгновенного отображения заголовков
  без ожидания API.

## Состояние приложения

| Состояние | Где | Персистентность |
| --- | --- | --- |
| `route` | `App.jsx` | URL |
| `colorMode` (`dark`/`light`) | `App.jsx` | `localStorage["reporter-for-autotests-theme"]`, по умолчанию `dark` |
| `workspaceId` | `App.jsx` | `localStorage["reporter-for-autotests-workspace"]` |
| `data`, `error`, `loadToken` | `Dashboard.jsx` | — (перезагрузка по кнопке/маршруту) |
| `workspaces`, `workspacesToken` | `Dashboard.jsx` | — (перезагрузка после create/delete) |
| Состояние модальных окон, выбора, поиска | соответствующие страницы/компоненты | — |

`selectWorkspace(id)` сохраняет выбор и принудительно возвращает на список фаз. Смена workspace
сбрасывает `data` и перезагружает список workspace (чтобы появились только что созданные при
приёме запусков проекты).

## Загрузка данных

`Dashboard` использует два эффекта:

1. **Список workspace** — при монтировании, смене `workspaceId` и по `workspacesToken`.
2. **Данные маршрута** — при изменении `page/phaseId/reportId/workspaceId` и по `loadToken`.

При смене маршрута `data` сбрасывается в `null` (показывается индикатор загрузки), а при ручном
обновлении старые данные остаются видимыми до прихода новых. Ошибка загрузки показывается
`Alert`-ом с кнопкой «Повторить»; текст ошибки берётся из ответа API или из сообщения сети.

`getData(route)` в `dataService.js`:

| Страница | Запросы (параллельно) |
| --- | --- |
| `phases` | `GET /phases[?workspaceId=]` |
| `reports` | `GET /phases/:id`, `GET /phases/:id/reports`, `GET /phases/:id/reports/results-summary` |
| `phaseAnalytics` | `GET /phases/:id/analytics`, `GET /phases/:id/reports` |
| `report`, `analytics` | `GET /reports/:id` (включает `phase`), `GET /reports/:id/results` |

## Страницы

### `PhasesPage` — список фаз

- Таблица: имя и `#id`, окружение (`Tag`), период, подсказка о результатах, действия.
- Переключатель **«Активна сегодня»** включён по умолчанию: фильтрует фазы, в период которых
  попадает текущая дата (`dayjs().startOf('day')`).
- Клик по строке → `reports`; кнопки: удалить (Popconfirm) и открыть.
- Создание через `CreatePhaseModal`; `workspaceId` подставляется из пропсов.
- После создания/удаления вызывается `reload()` (перезагрузка данных маршрута).

### `ReportsPage` — отчёты фазы

- Заголовок фазы с окружением и периодом, кнопки «Каталог тестов» и «Новый отчёт».
- `ReportsSummaryChart` — сводка по отчётам (стековые полосы по статусам).
- Таблица отчётов: имя, окно, дата создания, автор, действия.
- `TestCatalogModal` получает `environment` и `workspaceId` фазы — каталог и Harvest ограничены
  окружением фазы.
- Создание через `CreateReportModal`; даты проверяются на «конец не раньше начала» на клиенте.
- Кнопка «Аналитика фазы» → `phaseAnalytics`.

### `PhaseAnalytics` — аналитика фазы

Ленивый чанк (`React.lazy` + `Suspense`), данные — один серверный агрегат
`GET /phases/:id/analytics`:

- KPI: отчёты, каталог, покрытие, прошли хотя бы раз, никогда не проходили, флаки;
- SVG-графики из `components/charts` (barrel `components/charts/index.js`): stacked bars «Статусы по отчётам», `LineChart` pass rate + coverage,
  `DonutChart` lifecycle (stable green / recovered / regressed / stable red / never run / other),
  `ColumnChart` «Возраст текущих падений» с MTTR;
- таблица сравнения отчётов: счётчики, pass rate, coverage, p90, флаки, регрессы, fixed, анализ;
- матрица «тест × отчёт» на CSS Grid: коды `p/f/b/s/n`, группировка по наборам, фильтры
  по набору/тексту, сворачивание наборов, sticky-заголовки и первый столбец; Select и поле
  поиска в тулбаре имеют отдельные стили для светлой темы;
- топ подписей ошибок и распределение `failureReason`;
- владельцы и наборы — по последнему отчёту;
- гигиена данных: запуски вне каталога, дубли, чужой `circuit`, пересечение окон, пропуски
  владельца/сообщения, объём приёма по дням.

Тяжёлые агрегаты считает сервер; клиент только фильтрует и сортирует. Клик по строке сравнения
открывает существующую аналитику отчёта. Чарты получают `theme` из `colorMode` (`dark`/`light`),
а библиотека грузится вместе с ленивым чанком страницы.

### `ReportPage` — результаты отчёта

- `buildReportView(results, query)`:
  - фильтр по подстроке в `name` или `path`;
  - подсчёт статусов `passed/failed/broken/skipped/no_run`;
  - группировка по `suiteName` (fallback «Без набора»), сортировка наборов и кейсов.
- `ResultsChart` — SVG-донат с процентом прохождения и легендой.
- `SuiteTable` (из `ReportTables.jsx`) — раскрывающиеся наборы; внутри `CaseTable`:
  - название кейса, метка «не зарегистрирован» при `inCatalog === false`;
  - статус, владелец, длительность;
  - inline-поля обратной связи по падению (только для `failed`/`broken`);
  - раскрытие строки — `RunDetails` (путь, circuit, ответственность, окно, теги, сообщение,
    обратная связь) или текст «нет запусков» для `no_run`.
- Кнопки: «Открыть аналитику», «Обновить результаты».

### `ReportDashboard` — аналитика отчёта

Все метрики считаются из `data.results` в `useMemo`:

- плитки: всего кейсов, процент прохождения, эффективный pass rate, покрытие, упавшие/сломанные,
  p90 времени, флаки, stale green;
- «Обзор результатов» — прогресс-бары по статусам;
- «Тесты по владельцам» — 100 % stacked SVG-бар по статусам + таблица passed / fail+broken /
  skipped / no run, всего, p90 и флаки;
- «Длительность» — p50/p90/p95/p99 и stacked SVG-бар по бакетам с разбивкой по статусам;
- «Суммарная длительность по наборам» — горизонтальные бары: длина = сумма длительностей
  тестов набора, справа общее время и число тестов с временем;
- «Наборы» — pass rate, fail+broken, no run, p90;
- «Самые медленные тест-кейсы» — топ-8 по `durationMs`;
- «Подписи ошибок» — SVG-Парето (частота + накопленная доля) и таблица подписей; клик по строке
  раскрывает упавшие с этой подписью тесты (имя, путь, статус, владелец). В свёрнутом виде таблица
  короткая и прокручивается, при раскрытии внутренний скролл отключается — список тестов виден целиком;
- «Stale green» — отчёт показывает `passed`, но последний запуск упал/сломался;
- «Флаки и ретраи» — число запусков, стабильность, последние статусы, `retryFixed`/`regressed`;
- «Результаты анализа» — покрытие `failureReason` и распределение причин;
- «Требует анализа» — упавшие без `failureReason`, в разрезе владельца;
- «Обратная связь по падениям» — пары `failureReason` + `failureComment`.

Run-агрегаты (`runCount`, `latestStatus`, `staleGreen`, `flaky`, `recentStatuses`, …) приходят
в строке `GET /reports/:id/results`; для старых ответов UI использует безопасные fallback-значения.
Маршрут `analytics` ленивый, поэтому SVG-графики не попадают в стартовый бандл.

## Компоненты

| Компонент | Назначение | Ключевые детали |
| --- | --- | --- |
| `Shell.jsx` | каркас приложения | `Layout` + `Sider` + `Header`; бренд-логотип по теме, workspace dropdown (выбор/создание/удаление), переключатель темы, заглушки навигации |
| `PageHeading.jsx` | заголовок страницы | `eyebrow`, `title`, `description`, слот `action` |
| `StatusTag.jsx` | статус теста | `passed/failed/broken/skipped/no_run` → цвет и иконка |
| `ReportTables.jsx` | таблицы отчёта | `SuiteTable`, `CaseTable`, бейджи статусов набора, fallback `getDurationMs` |
| `RunDetails.jsx` | детали запуска | `Descriptions`; `FailureFeedbackFields` — `Select` причин + комментарий с сохранением по `onChange`/`onBlur` |
| `ResultsChart.jsx` | донат результатов | чистая SVG, `stroke-dasharray` на `pathLength="100"`, без библиотеки графиков |
| `ReportsSummaryChart.jsx` | сводка по отчётам | CSS-полосы, нормализация по максимальному `total` |
| `pages/report-dashboard/` | аналитика отчёта | `ReportDashboard` (композиция), `metrics.js` (`buildReportMetrics`), секции `OwnerSection` / `AnalysisSection` / `SlowTests` и таблицы/графики в `components/*` |
| `pages/phase-analytics/` | аналитика фазы | KPI, SVG-тренд, сравнение, CSS-Grid-матрица, ошибки, владельцы, наборы, гигиена; компоненты в `components/*` |
| `components/charts/` | SVG-графики аналитики | `index.js` — barrel; `StackedBarChart`, `ColumnChart`, `LineChart`, `DonutChart`, `BoxPlot`, `DurationProfile`, `ParetoChart` в отдельных файлах; без внешней chart-библиотеки |
| `CatalogTableParts.jsx` | колонки каталога | `toDtoPayload()` — только DTO-поля; `getCaseColumns`, `getSuiteColumns` |
| `TestCatalogModal.jsx` | каталог тестов фазы | импорт JSON, Harvest, видимость (индивидуальная, по набору, по выбранным), удаление, группировка по наборам |
| `HarvestModal.jsx` | сбор из запусков | `RangePicker`, пояснение про окружение, форма в родителе |
| `CreatePhaseModal.jsx` | создание фазы | имя, окружение, период; валидация «конец ≥ начало» |
| `CreateReportModal.jsx` | создание отчёта | имя, окно; подсказка о пересечении запусков |

## Работа с API (`src/services/dataService.js`)

Базовый URL: `${VITE_API_URL || 'http://localhost:3001'}/api`.

`request(path, options)`:

- по умолчанию ставит `Content-Type: application/json`;
- сетевую ошибку превращает в русское сообщение «Backend is unavailable…»;
- пытается разобрать JSON, при ошибке `payload = null`;
- при `!response.ok` бросает `Error(payload?.message || 'Request failed (<status>')` —
  поэтому сообщения `class-validator` из Nest показываются в UI.

Функции:

| Функция | HTTP |
| --- | --- |
| `getData(route)` | набор запросов по странице (см. выше) |
| `getWorkspaces()` | `GET /workspaces` |
| `createWorkspace(values)` | `POST /workspaces` |
| `deleteWorkspace(id)` | `DELETE /workspaces/:id` |
| `createPhase(values)` | `POST /phases` |
| `deletePhase(id)` | `DELETE /phases/:id` |
| `createReport(values)` | `POST /phases/:phaseId/reports` |
| `deleteReport(id)` | `DELETE /reports/:id` |
| `getPhaseAnalytics(phaseId)` | `GET /phases/:phaseId/analytics` |
| `updateResultFeedback(resultId, values)` | `PATCH /reports/results/:resultId/feedback` |
| `getAutomatedTests(environment, workspaceId)` | `GET /tests?environment=&workspaceId=` |
| `createAutomatedTest(values)` | `POST /tests` |
| `createAutomatedTestsBulk(tests)` | `POST /tests/bulk` |
| `updateAutomatedTestsVisibility(paths, visible, workspaceId)` | `POST /tests/visibility` |
| `deleteAutomatedTest(id)` | `DELETE /tests/:id` |
| `harvestAutomatedTests(start, end, environment, workspaceId)` | `POST /tests/harvest?...` |
| `importLegacyData(data)` | `POST /import` (с `X-Import-Confirmation: yes`) |

## Импорт каталога из JSON

`src/utils/testFileParser.js`:

- принимает массив или объект `{ tests: [...] }`;
- нормализует строки (`trim`, обрезка по лимитам: `resultPath` 300, `fullResponsibility` 200,
  `defaultSuiteName` 200, `defaultCaseName` 300, `defaultOwner` 120);
- теги: массив, JSON-строка или строка с `,`/`;`, максимум 100;
- `defaultCaseName` по умолчанию = `resultPath`;
- `visible` передаётся только если явно `false` (или строка `n/no/false/0`);
- дубликаты `resultPath` (без учёта регистра) и пустые записи отбрасываются, счётчик `skipped`;
- ошибка парсинга → исключение с именем файла.

Дальше `TestCatalogModal` показывает предпросмотр (`parsed.tests.length`, `skipped`) и по кнопке
отправляет `POST /tests/bulk` с добавленным `workspaceId`.

## Темизация и стили

- `App.jsx` задаёт токены antd: акцент `#8b5cf6` (тёмная) / `#7c3aed` (светлая), радиус 10,
  шрифт `Inter`.
- `styles.css` определяет CSS-переменные для `:root` (тёмная по умолчанию) и
  `:root[data-theme="light"]`; `App.jsx` выставляет `document.documentElement.dataset.theme`.
- Ant Design рендерит модальные окна в портал, поэтому светлая тема для них задана селекторами
  `:root[data-theme="light"] .ant-modal-root ...`.
- Подключены веб-шрифты Google Fonts (`Manrope`, `DM Mono`) — при отсутствии сети используется
  системный fallback.
- Адаптивность: брейкпоинты 600/800 px, `Sider` сворачивается на `lg`, таблицы получают
  горизонтальный скролл.
- Часть стилей продублирована (два блока `:root` и повторяющиеся правила таблиц) — известный
  техдолг.

## Нюансы

- **Ветка «не зарегистрирован»**. `ReportTables` умеет показывать тег для `inCatalog === false`, но
  `ReportsService.findResults` возвращает строки только для записей каталога, поэтому сейчас тег не
  отображается. Чтобы показать запуски без каталога, нужно менять контракт API.
- **`@ant-design/charts`** больше не импортируется: графики аналитики отчёта и фазы перерисованы
  на собственные SVG-компоненты `components/charts`. Зависимость осталась в `package.json` и может быть удалена.
- **Создание сущностей без workspace**. `workspaceId` берётся из `localStorage`; если он не выбран,
  `createPhase`/`createTest` отправят `null` и API ответит `400` (`workspaceId must be an integer`).
- **Автор отчёта** не передаётся с клиента: `Report.author` имеет дефолт `"You"` в БД.
- **Поиск** в отчёте — регистронезависимая подстрока по `name` и `path`, без дебаунса.
- **Обновление** после сохранения обратной связи вызывает полный `reload()` маршрута.
- **StrictMode** включён, поэтому эффекты в dev-режиме выполняются дважды — запросы идемпотентны,
  но в Network это видно.

## Связанные документы

- API — [05-api.md](05-api.md)
- Контракт запусков и каталога — [07-ingestion-and-import.md](07-ingestion-and-import.md)
- Индекс файлов фронтенда — [09-code-index.md](09-code-index.md#frontend)
