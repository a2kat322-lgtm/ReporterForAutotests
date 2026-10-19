# 05. Справочник API

Базовый URL: `http://localhost:3001/api`. Все ответы — JSON (`Content-Type: application/json`),
кроме запроса запусков, который принимает и `application/x-www-form-urlencoded`.

## Общие соглашения

- **Идентификаторы** в БД — `BIGINT`, в JSON — числа (`BigInt` сериализуется через `toJSON`).
- **Даты без времени** (`Phase.startedAt/endedAt`, `Report.startDate/endDate`) — `YYYY-MM-DD`.
- **Даты-время** (`TestResult.startDate/endDate`, `createdAt`) — ISO 8601 с UTC.
- **Ошибки** — формат Nest:
  ```json
  { "statusCode": 400, "message": ["workspaceId must be an integer number"], "error": "Bad Request" }
  ```
- **Пагинации нет**: списки возвращаются целиком, сортировка фиксирована в репозиториях.
- **Аутентификации нет**: сервис рассчитан на доверенный контур.
- **Лимиты** — см. [04-backend.md](04-backend.md#ограничение-частоты). При превышении — `429`.
- **`workspaceId`** — необязательный query-параметр списков; без него возвращаются данные всех
  workspace (кроме Harvest, где он обязателен).

### Сводная таблица эндпоинтов

| Метод | Путь | Назначение | Успех |
| --- | --- | --- | --- |
| `GET` | `/workspaces` | список проектов | `200` |
| `POST` | `/workspaces` | создать проект | `201` |
| `GET` | `/workspaces/:workspaceId` | проект по ID | `200` |
| `DELETE` | `/workspaces/:workspaceId` | удалить проект (каскадно) | `200` |
| `GET` | `/phases` | фазы (опц. `?workspaceId=`) | `200` |
| `POST` | `/phases` | создать фазу | `201` |
| `GET` | `/phases/:phaseId` | фаза по ID | `200` |
| `DELETE` | `/phases/:phaseId` | удалить фазу и её отчёты | `200` |
| `GET` | `/phases/:phaseId/reports` | отчёты фазы | `200` |
| `GET` | `/phases/:phaseId/reports/results-summary` | сводка статусов по отчётам | `200` |
| `GET` | `/phases/:phaseId/analytics` | аналитика фазы: KPI, сравнение, матрица, гигиена | `200` |
| `POST` | `/phases/:phaseId/reports` | создать отчёт | `201` |
| `GET` | `/reports/:reportId` | отчёт с фазой | `200` |
| `GET` | `/reports/:reportId/results` | результаты отчёта | `200` |
| `PATCH` | `/reports/results/:resultId/feedback` | обратная связь по падению | `200` |
| `DELETE` | `/reports/:reportId` | удалить отчёт | `200` |
| `POST` | `/results` | принять запуск от автоматизации | `201` |
| `GET` | `/tests` | каталог тестов | `200` |
| `POST` | `/tests` | создать/обновить тест каталога | `201` |
| `POST` | `/tests/bulk` | пакетный upsert каталога | `200` |
| `POST` | `/tests/visibility` | показать/скрыть тесты | `200` |
| `POST` | `/tests/harvest` | собрать каталог из запусков | `200` |
| `DELETE` | `/tests/:testId` | удалить тест из каталога | `200` |
| `POST` | `/import` | legacy-импорт (по флагу) | `201` |

> `README.md` в корне содержит устаревший список эндпоинтов (в частности, `POST /api/reports/:id/results`).
> Актуальный контракт — в этом документе и в коде контроллеров.

---

## Workspaces

### `GET /workspaces`

Все проекты, сортировка по `createdAt` (возрастание).

```json
[
  { "id": 1, "name": "default", "createdAt": "2026-10-17T09:00:00.000Z", "updatedAt": "2026-10-17T09:00:00.000Z" }
]
```

### `POST /workspaces`

Создать проект. Имя канонизируется (`trim().toLowerCase()`), затем проверяется уникальность.

```bash
curl -X POST http://localhost:3001/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"myapp"}'
```

| Поле | Тип | Ограничения |
| --- | --- | --- |
| `name` | string | 1–200, regex `^[a-z0-9][a-z0-9 ._\-]*$` |

Ответ `201` — созданная запись. `400` — невалидное имя или лишние поля; `409` не используется:
конфликт уникальности проявится как ошибка Prisma `P2002` (обычно `500`), поэтому имя лучше
проверять заранее.

### `GET /workspaces/:workspaceId`

`200` — запись; `404` — `{ "message": "Workspace not found" }`; `400` — нечисловой ID.

### `DELETE /workspaces/:workspaceId`

Удаляет проект **каскадно**: фазы, отчёты, каталог, окружения и запуски этого workspace.
Ответ: `{ "deleted": true, "id": 1 }`. `404` — если записи нет.

---

## Phases

Модель фазы:

```json
{
  "id": 1,
  "workspaceId": 1,
  "name": "Release 2.4.0",
  "environment": "stage",
  "startedAt": "2025-04-18T00:00:00.000Z",
  "endedAt": "2025-04-21T00:00:00.000Z",
  "createdAt": "2026-10-17T09:00:00.000Z",
  "updatedAt": "2026-10-17T09:00:00.000Z"
}
```

### `GET /phases`

Query: `workspaceId?` — фильтр по проекту. Сортировка `createdAt DESC`.

### `POST /phases`

```bash
curl -X POST http://localhost:3001/api/phases \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":1,"name":"Release 2.5.0","environment":"Stage","startedAt":"2026-10-01","endedAt":"2026-10-10"}'
```

| Поле | Тип | Правила |
| --- | --- | --- |
| `workspaceId` | number | целое, существует в БД |
| `name` | string | 1–200 |
| `environment` | string | 1–100, приводится к нижнему регистру |
| `startedAt`, `endedAt` | string | строго `YYYY-MM-DD`; `endedAt >= startedAt` |

Ответ `201` — фаза. Ошибки: `400` (валидация, даты), `500` при несуществующем `workspaceId`
(нарушение FK).

### `GET /phases/:phaseId` · `DELETE /phases/:phaseId`

`GET` → фаза или `404`. `DELETE` → `{ "deleted": true, "id": 1 }`; каскадно удаляются отчёты,
**но не запуски** (они не привязаны к фазе).

---

## Reports

### `GET /phases/:phaseId/reports`

Все отчёты фазы, `createdAt DESC`. Предварительно проверяется существование фазы (`404`).

### `GET /phases/:phaseId/reports/results-summary`

Сводка по каждому отчёту фазы: для видимых тестов каталога окружения фазы выбирается запуск по тому же
правилу, что и в отчёте (последний успешный, иначе последний), но в окне конкретного отчёта.
Отсутствие запуска → `no_run`.

```json
[
  {
    "reportId": 2,
    "counts": { "passed": 3, "failed": 1, "broken": 0, "skipped": 1, "no_run": 2 },
    "total": 7
  }
]
```

Если у фазы нет отчётов — `[]`. Если каталог для окружения пуст — `total: 0` и все счётчики `0`.

### `POST /phases/:phaseId/reports`

```bash
curl -X POST http://localhost:3001/api/phases/1/reports \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke tests","startDate":"2025-04-21","endDate":"2025-04-21"}'
```

| Поле | Тип | Правила |
| --- | --- | --- |
| `name` | string | непустое; уникально в пределах фазы (БД `UNIQUE(phaseId, name)`) |
| `startDate`, `endDate` | string | `YYYY-MM-DD`, `endDate >= startDate`, окно внутри `phase.startedAt…endedAt` |

Ошибки: `400` — даты вне фазы или конец раньше начала; `404` — фазы нет; конфликт имени даёт
ошибку БД (`P2002`), которая сейчас не преобразуется в `409`.

### `GET /reports/:reportId`

Отчёт вместе с фазой (Prisma `include: { phase: true }`):

```json
{
  "id": 2,
  "phaseId": 1,
  "name": "Smoke tests",
  "startDate": "2025-04-21T00:00:00.000Z",
  "endDate": "2025-04-21T00:00:00.000Z",
  "createdAt": "2025-04-21T10:42:00.000Z",
  "updatedAt": "2025-04-21T10:42:00.000Z",
  "author": "You",
  "phase": { "id": 1, "name": "Release 2.4.0", "environment": "stage", "...": "..." }
}
```

### `GET /reports/:reportId/results`

Главный эндпоинт отчёта. Возвращает массив `ReportResultRow`:

| Поле | Тип | Описание |
| --- | --- | --- |
| `rowKey` | number \| string | `resultId` или `catalog-<id>` |
| `path` | string | `resultPath` / `path` |
| `name` | string | `caseName` → `defaultCaseName` → `path` |
| `suiteName`, `caseName` | string \| null | из запуска, иначе из каталога |
| `owner` | string \| null | из запуска, иначе `defaultOwner` |
| `circuit` | string \| null | окружение запуска |
| `message` | string \| null | сообщение об ошибке |
| `failureReason`, `failureComment` | string \| null | обратная связь |
| `status` | enum | `passed \| failed \| broken \| skipped \| no_run` |
| `startDate`, `endDate` | ISO \| null | окно запуска |
| `durationMs` | number \| null | `end - start`, не меньше 0 |
| `tags` | string[] | теги запуска или каталога |
| `inCatalog` | boolean | сейчас всегда `true` |
| `catalogId` | number \| null | ID записи каталога |
| `fullResponsibility` | string \| null | ответственность из каталога |
| `resultId` | number \| null | ID выбранного запуска |
| `runCount` | number | сколько запусков пути попало в окно отчёта |
| `firstStatus`, `latestStatus` | enum \| null | хронологически первый и последний статус запуска |
| `firstStartDate`, `latestStartDate` | ISO \| null | окно первого и последнего запуска |
| `firstFailedStartDate`, `latestFailedStartDate` | ISO \| null | первое и последнее падение |
| `latestResultId` | number \| null | ID последнего запуска (для drill-down) |
| `passedRuns`, `failedRuns` | number | число успешных и упавших/сломанных запусков |
| `everPassed`, `everFailed`, `flaky` | boolean | были ли успехи/падения и оба одновременно |
| `staleGreen` | boolean | отчёт показывает `passed`, но последний запуск — `failed/broken` |
| `retryFixed` | boolean | первый запуск упал, последний прошёл |
| `regressed` | boolean | первый запуск прошёл, последний упал |
| `recentStatuses` | enum[] | до пяти последних статусов, новые первыми |
| `latestMessage`, `latestFailureReason` | string \| null | сообщение последнего запуска и причина последнего падения |

Правила выборки:

1. Только каталог фазы и её workspace, отфильтрованный по `environment` фазы (через
   `AutomatedTestEnvironment`).
2. Скрытые (`visible = false`) тесты исключаются вместе с их запусками.
3. Запуски берутся с пересечением интервала с **инклюзивным** окном отчёта
   (`00:00:00.000` первого дня … `23:59:59.999` последнего).
4. Для пути выбирается последний успешный запуск; если успешных нет — последний запуск.
5. Нет запуска → строка со статусом `no_run` и `null`-полями запуска.

Поля `runCount`…`latestFailureReason` считаются по **всем** запускам пути в окне, поэтому
позволяют отличить `status` отчёта (правило «passed побеждает») от фактического последнего
результата (`latestStatus`), увидеть флаки, ретраи и `staleGreen`.

### `PATCH /reports/results/:resultId/feedback`

Обратная связь по упавшему/сломанному тесту.

```bash
curl -X PATCH http://localhost:3001/api/reports/results/42/feedback \
  -H "Content-Type: application/json" \
  -d '{"failureReason":"Таймаут","failureComment":"Ждём фикс в 2.5.1"}'
```

| Поле | Тип | Правила |
| --- | --- | --- |
| `failureReason` | string \| null | ≤120; пустая строка → `null` |
| `failureComment` | string \| null | ≤5000; пустая строка → `null` |

`200` — обновлённая строка `TestResult`. Ошибки: `404` — запуска нет; `400` — статус не `failed`
и не `broken`.

### `DELETE /reports/:reportId`

`{ "deleted": true, "id": 2 }`. Запуски сохраняются. `404` — отчёта нет.

---

## Analytics

### `GET /phases/:phaseId/analytics`

Read-only агрегат по всей фазе: KPI, сравнение отчётов, матрица «тест × отчёт», владельцы, наборы,
подписи ошибок и гигиена данных. Один запрос — одна фаза; пагинации нет. `404` — фазы нет.

```json
{
  "phase": { "id": 1, "name": "Release 2.4.0", "environment": "stage", "...": "..." },
  "kpi": {
    "reports": 4, "catalog": 8, "executed": 7, "passedOnce": 6,
    "neverPassed": 2, "alwaysFailed": 1, "flaky": 2,
    "passRate": 0.75, "coverage": 0.875, "totalRuns": 42
  },
  "reports": [
    {
      "reportId": 1, "name": "Smoke 01.10",
      "startDate": "2026-10-01T00:00:00.000Z", "endDate": "2026-10-03T00:00:00.000Z",
      "counts": { "passed": 6, "failed": 1, "broken": 0, "skipped": 0, "no_run": 1 },
      "total": 8, "passRate": 0.75, "effectivePassRate": 0.86, "coverage": 0.88,
      "p90": 3900, "flaky": 1, "newFailures": 0, "fixed": 0, "analysisRate": 0.8
    }
  ],
  "matrix": {
    "columns": [{ "reportId": 1, "name": "Smoke 01.10", "startDate": "...", "endDate": "..." }],
    "rows": [{ "path": "com.acme.CheckoutTest", "name": "checkout", "suiteName": "Checkout", "owner": "alex.kim", "cells": ["p", "f", "p"] }]
  },
  "owners": [{ "owner": "alex.kim", "total": 3, "passed": 2, "failed": 1, "broken": 0, "skipped": 0, "no_run": 0, "passRate": 0.67, "analysisRate": 0.8, "flaky": 1 }],
  "suites": [{ "suiteName": "Auth", "total": 2, "failed": 1, "broken": 0, "no_run": 0, "passRate": 0.5, "p90": 4100 }],
  "failures": {
    "totalFailures": 9,
    "signatures": [{ "signature": "expected: <n> but was: <n> at <location>", "message": "...", "count": 4, "share": 0.44 }],
    "reasons": [{ "reason": "Дефект", "count": 4, "share": 0.44 }]
  },
  "hygiene": {
    "totalRuns": 47, "environmentRuns": 42, "uncataloguedRuns": 12, "uncataloguedPaths": 3,
    "duplicateRuns": 2, "duplicateGroups": 2, "wrongCircuitRuns": 5,
    "overlappingReportPairs": 1, "overlappingReports": 2,
    "missingOwnerRuns": 6, "missingMessageRuns": 1,
    "runsByDay": [{ "date": "2026-10-01", "count": 4 }]
  }
}
```

Правила расчёта:

1. Каталог — видимые тесты окружения фазы (`AutomatedTestEnvironment`), тот же, что в отчётах.
2. Запуски — все `TestResult` workspace за период `phase.startedAt…endedAt`; для KPI и матрицы
   учитываются только `circuit = phase.environment`. `hygiene` видит и чужие окружения.
3. Статус отчёта — по тому же правилу, что `GET /reports/:id/results`: последний запуск, но
   `passed` побеждает. Поэтому `reports[].counts` сходится с `results-summary`.
4. `passRate` — `passed / catalog` (накопительный, как в сводке); `effectivePassRate` —
   `passed / executed`; `coverage` — `executed / catalog`.
5. `flaky` — у пути в фазе есть и `passed`, и `failed/broken`. `newFailures` — регресс
   (`passed` в предыдущем отчёте → `failed/broken` в этом), `fixed` — обратный переход.
6. `alwaysFailed` — все запуски пути в фазе `failed/broken`; `neverPassed` — путь ни разу не
   показан как `passed` ни в одном отчёте.
7. `p90` — ближайший ранг по длительностям выбранных запусков (`durationMs > 0`).
8. Матрица: `cells[i]` соответствует `columns[i]`, коды `p/f/b/s/n` — passed/failed/broken/
   skipped/no_run.
9. `failures.signatures` — топ-10 по нормализованному сообщению (нижний регистр; удалены
   timestamp, UUID, hex, `file:line`, числа и URL), `share` — доля от всех упавших запусков.
10. `hygiene.overlappingReportPairs` — число пар отчётов с пересекающимися окнами дат;
    `duplicateRuns` — лишние запуски в группах `(path, startDate)`.

---

## Results (приём запусков)

### `POST /results`

Контракт подробно описан в [07-ingestion-and-import.md](07-ingestion-and-import.md).

```bash
curl -X POST http://localhost:3001/api/results \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "projectName=myapp" \
  --data-urlencode "path=com.acme.shop.checkout.PaymentFlowTest" \
  --data-urlencode "status=passed" \
  --data-urlencode "startDate=2026-10-17T09:00:00Z" \
  --data-urlencode "endDate=2026-10-17T09:00:08Z" \
  --data-urlencode "owner=alex.kim" \
  --data-urlencode "circuit=stage" \
  --data-urlencode "tags=checkout,smoke"
```

Ответ `201`:

```json
{
  "received": true,
  "id": 101,
  "path": "com.acme.shop.checkout.PaymentFlowTest",
  "status": "passed",
  "workspaceId": 2,
  "projectName": "myapp"
}
```

Ошибки `400`: нет `path`, неверный `status`, отсутствует/невалиден `startDate`, `endDate < startDate`.
Rate limit: 50/сек, 5000/мин.

---

## Tests (каталог)

Модель `AutomatedTest`:

```json
{
  "id": 5,
  "workspaceId": 1,
  "resultPath": "com.acme.shop.checkout.PaymentFlowTest",
  "fullResponsibility": "Payments squad",
  "defaultSuiteName": "Checkout IT",
  "defaultCaseName": "paymentSucceedsWithValidCard",
  "defaultOwner": "alex.kim",
  "tags": ["checkout", "smoke"],
  "visible": true,
  "source": "harvested",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `GET /tests`

Query: `environment?`, `workspaceId?`.

- без `environment` — весь каталог (с учётом workspace);
- с `environment` — только тесты, у которых есть членство в этом окружении
  (`lower(trim(environment))`);
- сортировка `createdAt ASC`.

### `POST /tests`

Upsert по `(workspaceId, resultPath)`: если запись есть — обновляет поля, иначе создаёт.

```json
{
  "workspaceId": 1,
  "resultPath": "com.acme.shop.cart.AddItemToCartTest",
  "defaultCaseName": "addItemIncreasesCount",
  "defaultSuiteName": "Cart",
  "defaultOwner": "dana.lee",
  "tags": ["cart"],
  "visible": true
}
```

Ответ `201`: `{ "test": { ... }, "created": true|false }`.

Особенности:

- `source` при создании — `manual`;
- при обновлении `visible: undefined` сохраняет текущее значение;
- **окружение не назначается** — новый тест не попадёт в отчёт, пока не выполнен Harvest для нужного
  окружения.

### `POST /tests/bulk`

```json
{ "tests": [ { "workspaceId": 1, "resultPath": "...", "defaultCaseName": "..." } ] }
```

Максимум 2000 записей. Ответ `200`: `{ "created": 3, "updated": 2, "total": 5 }`. Обрабатывается
последовательно (без общей транзакции): частичный сбой оставит уже применённые upsert'ы.

### `POST /tests/visibility`

```json
{ "workspaceId": 1, "resultPaths": ["com.acme.X", "com.acme.Y"], "visible": false }
```

Ответ `200`: `{ "updated": 2, "total": 2 }`. `400` — пустой список, невалидные поля.

### `POST /tests/harvest`

Query: `startDate`, `endDate` (обе даты или ни одной), `environment?`, `workspaceId` (обязателен).

```bash
curl -X POST "http://localhost:3001/api/tests/harvest?startDate=2026-10-01&endDate=2026-10-17&environment=stage&workspaceId=1"
```

- находит уникальные `path` в запусках, пересекающихся с периодом (при наличии `environment` —
  только с совпадающим `circuit`);
- создаёт отсутствующие записи каталога (`source = 'harvested'`) и назначает им окружение;
- существующие записи не изменяет, но добавляет членство в окружении.

Ответ `200`: `{ "created": 4, "skipped": 6, "paths": 10 }`, где `skipped = paths - created`.

Ограничения: `1 запрос / 10 с`, `10 / мин`.

### `DELETE /tests/:testId`

`{ "deleted": true, "id": 5 }`. Запуски остаются.

---

## Import

### `POST /import`

Требует `ENABLE_LEGACY_IMPORT=true` и заголовок `X-Import-Confirmation: yes`.

```bash
curl -X POST http://localhost:3001/api/import \
  -H "Content-Type: application/json" \
  -H "X-Import-Confirmation: yes" \
  -d '{"phases":[],"reports":[],"results":[]}'
```

Ответ `201`:

```json
{ "imported": true, "phases": 2, "reports": 3, "results": 10, "skippedResults": 4 }
```

Ошибки: `400` — импорт выключен, нет подтверждения, отсутствуют массивы, невалидные ссылки/даты.
Лимит: `1 / мин`, `3 / час`.

---

## Примеры ошибок

```json
// 400 — невалидный DTO
{ "statusCode": 400, "message": ["startDate must be a valid ISO 8601 date string"], "error": "Bad Request" }

// 400 — нечисловой path-параметр
{ "statusCode": 400, "message": "Validation failed (numeric string is expected)", "error": "Bad Request" }

// 404 — сущность не найдена
{ "statusCode": 404, "message": "Report not found", "error": "Not Found" }

// 429 — throttle
{ "statusCode": 429, "message": "ThrottlerException: Too Many Requests" }
```

## Связанные документы

- Расширенный контракт приёма запусков — [07-ingestion-and-import.md](07-ingestion-and-import.md)
- Модель данных — [06-data-model.md](06-data-model.md)
- Валидация и слои — [04-backend.md](04-backend.md)
