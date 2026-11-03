# 06. Модель данных

СУБД — PostgreSQL 16, схема описана в `api/prisma/schema.prisma`, изменения — в
`api/prisma/migrations/`.

## ER-диаграмма

```mermaid
erDiagram
    Workspace ||--o{ Phase : "workspaceId"
    Workspace ||--o{ AutomatedTest : "workspaceId"
    Workspace ||--o{ TestResult : "workspaceId"
    Workspace ||--o{ AllureLaunch : "workspaceId"
    Phase ||--o{ Report : "phaseId"
    AutomatedTest ||--o{ AutomatedTestEnvironment : "automatedTestId"
    AutomatedTest ||..o{ TestResult : "path = resultPath (логическая связь, без FK)"
    AllureLaunch ||..o{ TestResult : "launchId (логическая связь, без FK)"
```

Связи:

- Все сущности, кроме `AutomatedTestEnvironment`, имеют `workspaceId` и каскадно удаляются вместе
  с workspace.
- `Phase → Report` — каскадное удаление.
- `AutomatedTest → AutomatedTestEnvironment` — каскадное удаление.
- `TestResult` **не связан** ни с `Report`, ни с `AutomatedTest`: отчёт выбирает запуски по окну
  дат, а каталог сопоставляется по строковому `path = resultPath`. Это позволяет хранить запуски
  тестов, ещё не добавленных в каталог.
- `AllureLaunch` связан с запусками логически по строковому `launchId`; отдельного FK нет, потому
  что строка истории — это метаданные импорта, а запуски могут попасть в неё только при импорте.

## Таблицы

### `Workspace`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | `BIGINT` | PK, autoincrement |
| `name` | `VARCHAR(200)` | NOT NULL, UNIQUE; каноническая форма: `lower(trim(...))` |
| `createdAt` | `TIMESTAMPTZ(3)` | NOT NULL, default `now()` |
| `updatedAt` | `TIMESTAMPTZ(3)` | NOT NULL, `@updatedAt` |

Индексы: `Workspace_name_key` (unique), `Workspace_createdAt_idx`.

Имя приходит из `projectName` запусков; при первом запуске нового проекта workspace создаётся
автоматически.

### `Phase`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | `BIGINT` | PK, autoincrement |
| `workspaceId` | `BIGINT` | NOT NULL, FK → `Workspace.id`, `ON DELETE CASCADE` |
| `name` | `VARCHAR(200)` | NOT NULL |
| `environment` | `TEXT` | NOT NULL; CHECK `environment = lower(btrim(environment))` |
| `startedAt` | `DATE` | NOT NULL |
| `endedAt` | `DATE` | NOT NULL |
| `createdAt` | `TIMESTAMPTZ(3)` | NOT NULL, default `now()` |
| `updatedAt` | `TIMESTAMPTZ(3)` | NOT NULL, `@updatedAt` |

Индексы: `Phase_createdAt_idx`, `Phase_workspaceId_idx`.
Ограничение `Phase_environment_lowercase_check` входит в baseline-миграцию
`20261018000000_baseline` (исторически оно появилось в
`20261020000000_canonicalize_environment_and_paths`).

### `Report`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | `BIGINT` | PK, autoincrement |
| `phaseId` | `BIGINT` | NOT NULL, FK → `Phase.id`, `ON DELETE CASCADE` |
| `name` | `VARCHAR(200)` | NOT NULL; UNIQUE в паре с `phaseId` |
| `startDate` | `DATE` | NOT NULL |
| `endDate` | `DATE` | NOT NULL |
| `createdAt` | `TIMESTAMPTZ(3)` | NOT NULL, default `now()` |
| `updatedAt` | `TIMESTAMPTZ(3)` | NOT NULL, `@updatedAt` |
| `author` | `VARCHAR(120)` | NOT NULL, default `'You'` |

Индексы: `Report_phaseId_name_key` (unique), `Report_phaseId_createdAt_idx`,
`Report_phaseId_startDate_endDate_idx`.

Бизнес-правило «окно отчёта внутри периода фазы» проверяется в сервисе, а не в БД.

### `AutomatedTest`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | `BIGINT` | PK, autoincrement |
| `workspaceId` | `BIGINT` | NOT NULL, FK → `Workspace.id`, `ON DELETE CASCADE` |
| `resultPath` | `VARCHAR(300)` | NOT NULL; CHECK `resultPath = btrim(resultPath) AND resultPath <> ''`; UNIQUE с `workspaceId` |
| `fullResponsibility` | `VARCHAR(200)` | NULL |
| `defaultSuiteName` | `VARCHAR(200)` | NULL |
| `defaultCaseName` | `VARCHAR(300)` | NULL |
| `defaultOwner` | `VARCHAR(120)` | NULL |
| `tags` | `JSONB` | NOT NULL, default `'[]'` |
| `visible` | `BOOLEAN` | NOT NULL, default `true` |
| `source` | `VARCHAR(30)` | NOT NULL, default `'manual'` (`manual`, `file`, `harvested`) |
| `createdAt` / `updatedAt` | `TIMESTAMPTZ(3)` | NOT NULL |

Индексы: `AutomatedTest_workspaceId_resultPath_key` (unique).

### `AutomatedTestEnvironment`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `automatedTestId` | `BIGINT` | FK → `AutomatedTest.id`, `ON DELETE CASCADE` |
| `environment` | `TEXT` | CHECK `environment = lower(btrim(environment)) AND environment <> ''` |

PK — составной `(automatedTestId, environment)`; индекс `AutomatedTestEnvironment_environment_idx`.
Таблица определяет, в каких окружениях тест участвует (какие фазы его видят).

### `TestResult`

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | `BIGINT` | PK, autoincrement |
| `workspaceId` | `BIGINT` | NOT NULL, FK → `Workspace.id`, `ON DELETE CASCADE` |
| `projectName` | `VARCHAR(200)` | NOT NULL; каноническая форма `projectName` запуска |
| `path` | `VARCHAR(300)` | NOT NULL; CHECK `path = btrim(path) AND path <> ''` |
| `suiteName` | `VARCHAR(200)` | NULL |
| `caseName` | `VARCHAR(300)` | NULL |
| `status` | `TestStatus` | NOT NULL (`passed`, `failed`, `broken`, `skipped`) |
| `epic` | `VARCHAR(200)` | NULL; Allure `labels.epic` — верхний уровень иерархии Behaviour |
| `owner` | `VARCHAR(120)` | NULL |
| `circuit` | `VARCHAR(120)` | NULL; CHECK `circuit IS NULL OR circuit = lower(circuit)` |
| `failureReason` | `VARCHAR(120)` | NULL |
| `failureComment` | `TEXT` | NULL |
| `startDate` / `endDate` | `TIMESTAMPTZ(3)` | NOT NULL |
| `tags` | `JSONB` | NOT NULL, default `'[]'` |
| `externalId` | `VARCHAR(128)` | NULL; `uuid` результата Allure, ключ идемпотентности импорта |
| `launchId` | `VARCHAR(128)` | NULL; один загруженный архив = один прогон CI |
| `createdAt` / `updatedAt` | `TIMESTAMPTZ(3)` | NOT NULL |

Это «горячая» строка запуска: её выбирают списковые запросы (отчёт — тысячи строк за запрос,
аналитика — сотни тысяч), поэтому в ней остались только поля, нужные для таблицы и агрегатов.
`epic` хранится здесь же, а не в `TestResultDetail`: страница отчёта фильтрует по нему каждую
строку, и отдельная догрузка добавила бы запрос на каждый отчёт.

Индексы:

| Индекс | Назначение |
| --- | --- |
| `TestResult_workspaceId_path_startDate_idx` | история запусков по пути |
| `TestResult_workspaceId_startDate_endDate_idx` | диапазонные выборки |
| `TestResult_workspaceId_circuit_startDate_idx` | контур + диапазон дат одним индексом |
| `TestResult_period_overlap_gist_idx` | `GIST (tstzrange("startDate","endDate",'[]'))` — пересечение интервалов |
| `TestResult_workspaceId_externalId_key` | UNIQUE — идемпотентность импорта архивов |
| `TestResult_workspaceId_launchId_idx` | группировка запусков одного прогона CI |

### `TestResultDetail`

«Холодная» часть запуска, связь 1:1 по `resultId` (PK, FK → `TestResult.id`, `ON DELETE CASCADE`):

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `resultId` | `BIGINT` | PK, FK → `TestResult.id`, `ON DELETE CASCADE` |
| `message` | `TEXT` | NULL; текст ошибки от формы или из `allure-results` |
| `steps` | `JSONB` | NOT NULL, default `'[]'`; дерево шагов из `allure-results` |
| `attachments` | `JSONB` | NOT NULL, default `'[]'`; метаданные вложений (`name`, `type`, `size`, `key`) |
| `parameters` | `JSONB` | NOT NULL, default `'[]'`; параметры параметризованного запуска |
| `links` | `JSONB` | NOT NULL, default `'[]'`; ссылки Allure: `[{ name, url, type }]` (`tms`, `issue`, `link`) |
| `statusDetails` | `JSONB` | NULL; `{ message, trace, known, muted, flaky }` |

Почему отдельно: списковые запросы (`findRunsCoveringWindow`) отдают тысячи строк запусков, а
сообщение и Allure-детали нужны либо для одного запуска (рисование деталей), либо только для
упавших (аналитика подписей ошибок). Колонки в горячей строке заставляли бы каждое чтение
пролистывать в разы больше страниц. Поэтому:

- строка `TestResultDetail` создаётся только если у запуска есть текст ошибки или Allure-детали
  (у «сухих» прогонов её нет);
- сообщения для строки отчёта читаются точечно по PK — только для выбранного и последнего запуска
  пути (`ResultsRepository.findMessagesByIds`);
- аналитика догружает сообщения только по `failed`/`broken` (`findFailureMessages`);
- `GET /api/results/:resultId/details` склеивает обе таблицы обратно в плоский объект, поэтому
  контракт API не менялся.

`steps`, `attachments`, `parameters`, `links`, `statusDetails` заполняются только импортом
`allure-results`; у запусков, отправленных формой, их нет. Файлы вложений в PostgreSQL **не
хранятся**: в JSONB лежат метаданные с ключом `sha256`, сами байты — в `ATTACHMENTS_DIR`
(по умолчанию `api/storage/attachments`, каталог нужно бэкапить отдельно от БД).

### `AllureLaunch`

История загруженных архивов `allure-results`; одна строка — один прогон CI (`launchId`).

| Колонка | Тип | Ограничения |
| --- | --- | --- |
| `id` | `VARCHAR(128)` | PK; Allure `launchId`, он же в `TestResult.launchId` |
| `workspaceId` | `BIGINT` | NOT NULL, FK → `Workspace.id`, `ON DELETE CASCADE` |
| `environment` | `VARCHAR(120)` | NOT NULL; канонический `circuit` архива |
| `origin` | `RunOrigin` | NOT NULL, default `unknown`; `ci`, `local` или `unknown` (не передан клиентом) |
| `projectName` | `VARCHAR(200)` | NOT NULL; имя workspace на момент импорта |
| `fileName` | `VARCHAR(255)` | NULL; имя последнего загруженного ZIP |
| `archives` | `INTEGER` | NOT NULL, default `1`; сколько архивов объединено в прогон |
| `imported` / `enriched` / `duplicates` | `INTEGER` | NOT NULL, default `0`; итог импорта |
| `totalResults` | `INTEGER` | NOT NULL, default `0`; результатов в архивах |
| `attachments` / `catalogCreated` | `INTEGER` | NOT NULL, default `0` |
| `warnings` | `JSONB` | NOT NULL, default `'[]'`; не более 100 записей |
| `startedAt` / `finishedAt` | `TIMESTAMPTZ(3)` | NULL; окно запусков из архива |
| `createdAt` / `updatedAt` | `TIMESTAMPTZ(3)` | NOT NULL |

Индекс `AllureLaunch_workspaceId_createdAt_idx` обслуживает историю рабочего пространства.
Статусы (`passed/failed/broken/skipped`) в строке не хранятся: `GET /launches` считает их
группировкой по `TestResult.launchId`, поэтому отчёт прогона всегда отражает фактическое состояние
запусков. При нескольких архивах с одним `launchId` счётчики складываются, окно расширяется,
`fileName` остаётся от последнего архива. Если архив целиком состоял из дублей, строка всё равно
создаётся — иначе отправка исчезла бы из истории. `origin` задаётся при первом импорте; повторный
импорт с тем же `launchId` не перезаписывает уже известный источник, но может заполнить `unknown`.

Индекс GiST объявлен **только в baseline-миграции** (`20261018000000_baseline`), его нет в
`schema.prisma`: Prisma не умеет описывать индексы по выражениям. Без него окно отчёта падает в
последовательное сканирование (на 1,5 млн строк замер дал 194 мс против 4,3 мс с индексом),
поэтому существование индекса закреплено проверкой `npm --prefix api run db:verify`
(`api/scripts/verify-db-invariants.cjs`): она падает, если индекс пропал или его удаляет какая-то
миграция. Прогоняйте её после `prisma migrate deploy`.

## Инварианты

1. **Канонические строки.** `Phase.environment`, `TestResult.circuit`,
   `AutomatedTestEnvironment.environment`, `TestResult.path`, `AutomatedTest.resultPath`
   хранятся в нижнем регистре и/или обрезанными по краям; CHECK-ограничения не дают записать
   неканонические значения в обход приложения.
2. **Уникальность.**
   - workspace name — глобально;
   - `(workspaceId, resultPath)` — в каталоге;
   - `(phaseId, name)` — у отчётов;
   - `(automatedTestId, environment)` — членство.
3. **Ссылочная целостность.** Удаление workspace удаляет всё; удаление фазы — её отчёты; удаление
   каталога — его членства. Запуски не удаляются ни при удалении фазы, ни при удалении отчёта.
4. **Логическая связь запуск ↔ каталог** по `path = resultPath` и одному workspace; FK нет
   намеренно, чтобы принимать запуски до регистрации теста.
5. **Нет идемпотентности запусков**: `POST /results` всегда создаёт новую строку; одинаковые
   `path + startDate` допускаются (в отличие от legacy-импорта, который их пропускает).
6. **История импорта не теряется.** `AllureLaunch` создаётся после каждого успешного импорта,
   включая архивы без новых запусков; повторный импорт с тем же `launchId` дополняет ту же строку,
   а не создаёт вторую.

## Алгоритм сопоставления отчёта и запусков

Вход: `report` (с фазой), `environment = trim(report.phase.environment)`, окно
`[dayStart(report.startDate), dayEnd(report.endDate)]`, где `dayEnd = 23:59:59.999 UTC`.

1. Каталог: `AutomatedTest` этого workspace, у которого есть членство в `environment`.
2. Запуски: `TestResult` этого workspace, у которых `tstzrange(startDate, endDate, '[]')`
   пересекается с окном, и `circuit = environment` (точное совпадение, оба в нижнем регистре).
   Сортировка `startDate DESC`.
3. Скрытые записи каталога (`visible = false`) отбрасываются.
4. Для каждого `path` выбирается одна строка:
   - самый поздний запуск;
   - если он не `passed`, но в окне есть более ранний `passed` — показывается последний `passed`.
5. Строка отчёта собирается из каталога и запуска: значения запуска приоритетны; отсутствие
   запуска → `status = 'no_run'`, `startDate/endDate/durationMs = null`.
6. `durationMs = max(0, endDate - startDate)`.

Это же правило используется в `results-summary` для подсчёта статусов по каждому отчёту фазы
(без построения строк).

> Из-за правила 4 отчет может показать `passed`, хотя последний прогон упал. Это осознанное
> решение (коммит «Prefer earliest passing run over later failures in report view»), но комментарий
> в `scripts/send-test-runs.ps1` («должен победить более поздний broken») ему противоречит — верьте
> реализации и этому документу.

## Идентификаторы

- Все ключи — `BIGINT` с автоинкрементом: `Phase`/`Report` через последовательности (`SERIAL` →
  `BIGINT`), `AutomatedTest`/`TestResult` — через `GENERATED BY DEFAULT AS IDENTITY`; в самых ранних
  версиях использовались CUID-строки.
- В JSON `BigInt` превращается в `Number` (глобальный `toJSON`).
- Точность `Number` — до `2^53 - 1` (≈ 9·10^15). При текущих объёмах недостижимо, но при экспорте
  больших ID возможна потеря точности; при необходимости возвращайте ID строками.

## История миграций

> **18.10.2026 история схлопнута.** В репозитории осталась одна миграция
> `20261018000000_baseline`, которая создаёт финальную схему на чистой БД. Таблица ниже —
> историческая хронология до схлопывания: на новой установке этих миграций нет, а в
> `_prisma_migrations` старой БД могут остаться их имена. Как перевести существующую БД на
> baseline — см. [10-deployment.md](10-deployment.md#если-миграции-уже-применялись-старой-версией).

Порядок — лексикографический по имени каталога.

| Миграция | Что делает |
| --- | --- |
| `20260501000000_init` | начальная схема: enum `Environment`, `TestStatus` (с `running`), `Phase`, `Report`, `TestResult` с `steps`, привязкой к отчёту и FK |
| `20261013104649_add_automated_tests` | первая версия каталога (`name`, `description`, `suite`) |
| `20261013110000_automated_tests_external_id` | `automatedTestId`, уникальность вместо `name` |
| `20261013120000_automation_contract` | новый контракт: `broken` вместо `running`; `TestResult` — самостоятельный запуск без FK на отчёт; каталог по `resultPath` |
| `20261013130000_add_failure_feedback` | добавляет `TestResult.failureReason`, `failureComment` (после пересоздания таблицы; `IF NOT EXISTS`) |
| `20261013200000_automated_tests_visible_flag` | флаг `visible` |
| `20261013210000_report_integer_id` | `Report.id` → autoincrement integer, перенумерация |
| `20261013220000_remove_automated_test_display` | `display` → `defaultCaseName`, удаление колонки |
| `20261013230000_report_date_range` | `Report.startDate/endDate` + индекс |
| `20261014090000_environment_as_string` | `environment` из enum в `TEXT` |
| `20261014100000_bigint_autoincrement_ids` | все ID → `BIGINT` |
| `20261015120000_catalog_environment` | временная `AutomatedTest.environments TEXT[]` + GIN |
| `20261016120000_normalize_test_environments` | нормализация в `AutomatedTestEnvironment`, CHECK нижнего регистра |
| `20261020000000_canonicalize_environment_and_paths` | канонизация окружений/путей, CHECK-ограничения, индекс `circuit` |
| `20261020010000_report_unique_name_per_phase` | переименование дублей и `UNIQUE(phaseId, name)` |
| `20261020020000_add_updated_at` | `updatedAt` в `Phase`, `Report`, `TestResult` |
| `20261020030000_gist_overlap_index` | GiST-индекс по `tstzrange(startDate, endDate)` |
| `20261021000000_workspaces` | `Workspace`, сквозной `workspaceId`, `projectName`, FK, скоуп-индексы |
| `20261022000000_remove_empty_default_workspace` | удаляет пустой служебный workspace `default` на чистой установке (создан для бэкфилла) |

После схлопывания добавлены миграции: `20261101150000_allure_results_import` — колонки
`steps`, `attachments`, `parameters`, `statusDetails`, `externalId`, `launchId` в `TestResult` и
два индекса (уникальный по `(workspaceId, externalId)`, обычный по `(workspaceId, launchId)`);
`20261101170000_allure_links` — колонка `links`; `20261101180000_test_result_detail_split` — вынос
`message`, `steps`, `attachments`, `parameters`, `links`, `statusDetails` в `TestResultDetail`
(данные переносятся, колонки удаляются) и замена индекса `(workspaceId, circuit)` на
`(workspaceId, circuit, startDate)`; `20261102130000_test_result_epic` — колонка `TestResult.epic`
для фильтра отчёта по Epic; `20261102235500_allure_launch_history` — таблица `AllureLaunch` для
страницы «История запусков» с бэкфиллом уже импортированных `launchId` из `TestResult`;
`20261103003100_allure_launch_origin` — enum `RunOrigin` и колонка `AllureLaunch.origin`
(`ci`/`local`/`unknown`) для разделения CI/CD и локальных прогонов.

### Порядок миграций

> Историческая справка: на новую установку не влияет, потому что осталась одна baseline-миграция.

Ранее миграция с полями `failureReason`/`failureComment` была датирована `20260309000000` — раньше
`init`, хотя изменяет таблицу, создаваемую в `init`. Prisma применяет миграции в лексикографическом
порядке, поэтому на чистой БД `prisma migrate deploy` падал с `P3018` («отношение TestResult не
существует»). Дополнительно `20261013120000_automation_contract` пересоздаёт `TestResult`, так что
добавление колонок сразу после `init` всё равно потерялось бы.

Исправление:

- каталог переименован в `20261013130000_add_failure_feedback` — сразу после `automation_contract`;
- SQL использует `ADD COLUMN IF NOT EXISTS`, поэтому миграция безопасна и для БД, где старая
  версия уже была применена;
- проверено на пустой БД: `prisma migrate deploy` проходит.

Что делать с существующими БД:

- если старая миграция уже применена, новая применится как no-op — ручные действия не нужны;
- запись старого имени (`20260309000000_add_failure_feedback`) остаётся в `_prisma_migrations`,
  `migrate deploy` она не мешает;
- если в `_prisma_migrations` есть **неудачная** миграция (`finished_at IS NULL`, ошибка `P3009`),
  устраните причину и выполните `cd api && npx prisma migrate resolve --rolled-back <migration_name>`,
  затем повторите deploy.

Других нарушений порядка нет; остальные миграции идут по возрастанию и согласованы со схемой.

## Пустая установка

В проекте **нет seed-скрипта** и демо-данных. После `prisma migrate deploy` база пустая:

```text
Workspace = 0, Phase = 0, Report = 0, AutomatedTest = 0, TestResult = 0
```

Служебный workspace `default` больше не создаётся на чистой установке: baseline сразу сбрасывает
последовательность `Workspace`, поэтому первый созданный workspace получает `id = 1`.

Дальше workspace появляется одним из способов:

- пользователь создаёт его в интерфейсе (кнопка «Новое пространство»);
- `POST /api/results` с `projectName` создаёт workspace автоматически;
- запуск без `projectName` или legacy-импорт создают workspace `default` по требованию.

Для наполнения стенда используйте `scripts/send-test-runs.ps1` (отправляет запуски) и создайте
фазу/отчёт в интерфейсе; каталог наполняется через Harvest.

## Работа со схемой

```powershell
npm --prefix api run prisma:validate
npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate:dev     # разработка: создать миграцию
npm --prefix api run prisma:migrate:deploy  # применение готовых миграций
```

Правила проекта:

- API **не** применяет миграции при старте;
- `db push`/`synchronize` не используются — ограничения (CHECK, GiST) живут только в миграциях;
- изменения схемы сопровождаются новой миграцией; демо-данные в репозиторий не добавляются.

## Связанные документы

- Как данные попадают в БД — [07-ingestion-and-import.md](07-ingestion-and-import.md)
- Сервисная логика выборки — [04-backend.md](04-backend.md)
- API — [05-api.md](05-api.md)
