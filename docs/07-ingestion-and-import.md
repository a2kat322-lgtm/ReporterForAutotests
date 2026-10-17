# 07. Приём запусков и импорт

Документ описывает все способы попадания данных в систему:

1. `POST /api/results` — основной поток от автоматизации.
2. `POST /api/tests/harvest` — наполнение каталога из уже сохранённых запусков.
3. `POST /api/tests` / `POST /api/tests/bulk` — ручное создание и импорт JSON-каталога.
4. `POST /api/import` — разовый legacy-импорт старого снимка.

## 1. `POST /api/results` — контракт запуска

Автоматизация отправляет **один запрос на один завершённый тест**. Формат тела —
`application/x-www-form-urlencoded` (как в Java/CI), JSON тоже принимается. Лимит тела — 10 МБ,
частота — 50 запросов/сек и 5000/мин.

### Поля

| Поле | Обязательно | Нормализация | Ограничение |
| --- | --- | --- | --- |
| `path` | да | `trim` | 300 символов, непустой |
| `status` | да | `lower(trim)`, одно из `passed/failed/broken/skipped` | — |
| `startDate` | да | `new Date(value)` | валидная дата |
| `endDate` | нет | `new Date(value)`, по умолчанию = `startDate` | не раньше `startDate` |
| `projectName` | нет | `lower(trim)`, по умолчанию `default` | 200 символов |
| `suiteName` | нет | `trim` | 200 |
| `caseName` | нет | `trim` | 300 |
| `owner` | нет | `trim` | 120 |
| `circuit` | нет | `lower(trim)` | 120 |
| `message` | нет | `trim` | без обрезки (TEXT) |
| `tags` | нет | см. ниже | до 100 элементов в UI-каталоге, в запуске без жёсткого лимита |

Неизвестные поля **игнорируются** (контракт внешний). Пустые строки превращаются в `null`.

### Кодирование повторяющихся полей

`urlencoded` с `extended: true` разворачивает повторяющиеся ключи в массивы
(`tags=a&tags=b` → `['a','b']`). `firstString()` берёт первый элемент массива для скалярных полей,
`parseTags()` обрабатывает массив целиком.

### Теги

Поддерживаются все варианты, которые встречаются в CI:

| Формат | Пример | Результат |
| --- | --- | --- |
| JSON-массив в строке | `["auth","smoke"]` | `["auth","smoke"]` |
| Строка с разделителями | `checkout,smoke` или `export;feature-flag` | `["checkout","smoke"]` |
| Повторяющиеся ключи формы | `tags=a&tags=b` | `["a","b"]` |
| Настоящий массив в JSON-теле | `["a","b"]` | `["a","b"]` |
| Пусто / null | — | `[]` |

Значения обрезаются по краям, пустые отбрасываются.

### Даты

`new Date(value)` принимает ISO 8601, RFC 2822 и другие форматы, которые понимает JS. Рекомендуемый
формат — `YYYY-MM-DDTHH:mm:ssZ` (UTC). Время хранится с таймзоной (`TIMESTAMPTZ`); окно отчёта
считается по UTC-суткам.

### Workspace

`projectName` канонизируется (`trim().toLowerCase()`) и ищется `Workspace` с таким именем:

- найден — используется;
- не найден — создаётся (гонка двух одновременных запросов обрабатывается: при `P2002` выполняется
  повторный поиск);
- `projectName` не передан — используется workspace `default` (создаётся при необходимости).

Если имя проекта длиннее 200 символов, оно обрезается **до** канонизации. Пустое имя после trim
превращается в `null` и заменяется на `default` (см. `firstString`).

### Ответ

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

HTTP `201`. Ошибки `400`:

- `path is required`;
- `status must be one of passed, failed, broken, skipped`;
- `startDate is required and must be a valid date`;
- `endDate cannot be before startDate`.

### Примеры

`curl` (форма):

```bash
curl -X POST http://localhost:3001/api/results \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "projectName=myapp" \
  --data-urlencode "path=com.acme.shop.auth.LoginValidCredentialsTest" \
  --data-urlencode "status=passed" \
  --data-urlencode "startDate=2026-10-17T09:00:00Z" \
  --data-urlencode "endDate=2026-10-17T09:00:03Z" \
  --data-urlencode "suiteName=Auth" \
  --data-urlencode "caseName=loginWithValidCredentials" \
  --data-urlencode "owner=maria.petrova" \
  --data-urlencode "circuit=stage" \
  --data-urlencode "tags=auth,smoke"
```

PowerShell:

```powershell
$body = @{
  projectName = 'myapp'
  path        = 'com.acme.shop.auth.LoginValidCredentialsTest'
  status      = 'passed'
  startDate   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  endDate     = (Get-Date).ToUniversalTime().AddSeconds(3).ToString('yyyy-MM-ddTHH:mm:ssZ')
  owner       = 'maria.petrova'
  circuit     = 'stage'
  tags        = 'auth,smoke'
}
Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/results' `
  -Body $body -ContentType 'application/x-www-form-urlencoded'
```

JSON:

```bash
curl -X POST http://localhost:3001/api/results \
  -H "Content-Type: application/json" \
  -d '{"path":"com.acme.X","status":"failed","startDate":"2026-10-17T09:00:00Z","endDate":"2026-10-17T09:00:05Z","tags":["smoke"],"projectName":"myapp"}'
```

### Демо-генератор `scripts/send-test-runs.ps1`

Скрипт отправляет 12 положительных и 4 отрицательных кейса, используя все форматы тегов,
повторные прогоны, незарегистрированные классы и минимальный payload.

```powershell
pwsh -File scripts/send-test-runs.ps1 -DryRun   # только печать payload'ов
pwsh -File scripts/send-test-runs.ps1            # отправка на http://localhost:3001/api
pwsh -File scripts/send-test-runs.ps1 -BaseUrl http://localhost:3001/api
```

Скрипт завершается с кодом `1`, если хотя бы один положительный кейс не принят или отрицательный
кейс не вернул `400`.

> Замечание: комментарий в скрипте утверждает, что более поздний `broken` «должен победить»
> ранний `passed`. Фактическая логика отчёта (`ReportsService.findResults`) предпочитает успешный
> запуск. Ожидайте `passed` в отчёте, если в окне есть успешный прогон.

## 2. Harvest — сбор каталога из запусков

`POST /api/tests/harvest` регистрирует в каталоге пути, которые уже встречались в запусках.

Query-параметры:

| Параметр | Обязателен | Смысл |
| --- | --- | --- |
| `workspaceId` | да | проект |
| `startDate`, `endDate` | пара (обе или ни одной) | период пересечения запусков; формат `YYYY-MM-DD` |
| `environment` | фактически да | окружение; фильтр по `circuit` и назначаемое членство |

Алгоритм (`TestsService.harvestFromResults`):

1. Валидирует параметры: обе даты или ни одной; `environment` не пустой; `workspaceId` передан.
2. Период: `[startDate 00:00:00.000Z, endDate 23:59:59.999Z]`; без дат — `1970-01-01 … 9999-12-31`.
3. `groupBy(path)` по запускам за период (`circuit = lower(environment)`, если задан).
4. Для каждого пути берёт самый поздний запуск за тот же период.
5. Формирует записи каталога: `defaultCaseName = caseName || path`, `defaultSuiteName`, `defaultOwner`,
   `tags` — из последнего запуска.
6. В одной транзакции: `createMany(skipDuplicates)` новых записей + `createMany(skipDuplicates)`
   членств `AutomatedTestEnvironment` для **всех** найденных путей.
7. Возвращает `{ created, skipped, paths }`.

Особенности:

- существующие записи каталога **не перезаписываются**, но получают членство в окружении;
- `source = 'harvested'`;
- запуски без каталога в отчётах не видны — Harvest как раз делает их видимыми;
- **Harvest без `environment` приводит к `500`**: пустая строка нарушает CHECK
  `environment <> ''`. Всегда передавайте окружение (фронтенд передаёт `phase.environment`);
- rate limit: 1 запрос / 10 секунд, 10 / минуту.

## 3. Каталог: ручное создание и JSON-импорт

### `POST /api/tests` (single upsert)

Ключ — `(workspaceId, resultPath)`. Если запись есть, обновляются:

- `fullResponsibility`, `defaultSuiteName`, `defaultCaseName`, `defaultOwner`, `tags`;
- `visible` — только если поле передано (иначе сохраняется текущее значение).

`source` устанавливается в `manual` только при создании. Ответ: `{ test, created }`.

Важно: **окружение не назначается**. Такой тест будет виден в отчётах только после Harvest
для нужного окружения. Это же поведение использует UI при переключении видимости
(`toDtoPayload` + `createAutomatedTest`), но для существующих записей членства сохраняются.

### `POST /api/tests/bulk`

Массив `tests` (до 2000). Каждый элемент обрабатывается тем же upsert'ом с `source = 'file'`.
Ответ: `{ created, updated, total }`. Транзакции на весь пакет нет: при ошибке на середине
предыдущие записи останутся в БД.

### Формат файла для UI

`src/utils/testFileParser.js` принимает:

```json
[
  {
    "resultPath": "com.acme.shop.checkout.PaymentFlowTest",
    "defaultCaseName": "paymentSucceedsWithValidCard",
    "defaultSuiteName": "Checkout IT",
    "defaultOwner": "alex.kim",
    "fullResponsibility": "Payments squad",
    "tags": ["checkout", "smoke"],
    "visible": true
  }
]
```

или `{ "tests": [ ... ] }`.

Правила парсера:

- `resultPath` обязателен; пустые/нестроковые записи отбрасываются (`skipped`);
- строки обрезаются (`trim`) и ограничиваются по длине полей БД;
- `defaultCaseName` по умолчанию = `resultPath`;
- `tags`: массив, JSON-строка или строка с `,`/`;`, максимум 100;
- `visible` передаётся только при явном `false` (или `"n"/"no"/"false"/"0"`);
- дубликаты `resultPath` в файле (без учёта регистра) отбрасываются;
- ошибка JSON → сообщение с именем файла.

UI показывает предпросмотр (`Разобрано N тестов…`) и только после подтверждения отправляет
`POST /api/tests/bulk`.

### Видимость

`POST /api/tests/visibility` с `{ workspaceId, resultPaths, visible }` обновляет флаг массово
(до 2000 путей). Скрытые тесты не попадают в отчёт и в сводку по отчётам, даже если у них есть
запуски. UI поддерживает переключение по одному, по набору и по выбранным строкам.

## 4. Legacy-импорт

Предназначен для разового переноса данных из старой localStorage-версии.

### Включение

```dotenv
ENABLE_LEGACY_IMPORT=true
```

Перезапустите API. По умолчанию импорт выключен. Запрос должен содержать заголовок
`X-Import-Confirmation: yes`. Эндпоинт не имеет аутентификации и ограничен
`1 запрос / минуту` и `3 / час`; включайте его только на время миграции в доверенном контуре.

### Тело запроса

```json
{
  "phases": [
    { "id": "p1", "name": "Release 2.3.0", "environment": "Stage", "startedAt": "2025-03-01", "endedAt": "2025-03-05" }
  ],
  "reports": [
    { "id": "r1", "phaseId": "p1", "name": "Smoke", "author": "QA", "createdAt": "2025-03-05T10:00:00Z" }
  ],
  "results": [
    { "reportId": "r1", "automatedTestId": "com.acme.shop.LoginTest", "name": "loginWorks", "status": "passed", "lastRunAt": "2025-03-05T10:05:00Z", "errorMessage": null }
  ]
}
```

### Правила отображения

| Legacy | Куда попадает |
| --- | --- |
| `phases[].name/environment/startedAt/endedAt` | `Phase` в workspace `default`; `environment` → нижний регистр |
| `phases[].id` | сопоставляется с новым `Phase.id` в памяти |
| `reports[].name/author/createdAt` | `Report`; окно отчёта = дата `createdAt` (UTC) в `startDate` и `endDate` |
| `reports[].id` | сопоставляется с новым `Report.id` |
| `results[].automatedTestId` | `TestResult.path` (обрезается до 300) |
| `results[].name` | `TestResult.caseName` |
| `results[].status` | `passed/failed/broken/skipped`; `running` и неизвестные → строка пропускается |
| `results[].lastRunAt` | `startDate = endDate`; если нет — `createdAt` отчёта |
| `results[].errorMessage` | `TestResult.message` |

Дополнительно:

- всё выполняется в одной транзакции — при любой ошибке откатываются все изменения;
- фазы дедуплицируются по `(name, startedAt, workspaceId)`, отчёты — по `(phaseId, name)`;
- запуски дедуплицируются по `(workspaceId, path, startDate)`;
- записи без `automatedTestId`, без известного статуса или без валидной даты попадают в
  `skippedResults`;
- каталог (`AutomatedTest`) **не импортируется** — после переноса выполните Harvest;
- `projectName` у импортированных запусков = `default`;
- старые localStorage-данные не удаляются;
- ответ: `{ imported, phases, reports, results, skippedResults }`.

Ошибки `400`: импорт выключен, нет заголовка, отсутствует один из массивов, невалидная фаза
(нет имени/окружения/дат), отчёт ссылается на неизвестную фазу.

## Идемпотентность: сводка

| Операция | Повторный вызов |
| --- | --- |
| `POST /results` | создаёт новый запуск (дубликаты допустимы) |
| `POST /tests` (single) | upsert по `(workspaceId, resultPath)` |
| `POST /tests/bulk` | upsert по каждому элементу |
| `POST /tests/harvest` | создаёт только отсутствующие записи, повторно добавляет членства (`skipDuplicates`) |
| `POST /tests/visibility` | идемпотентно выставляет флаг |
| `POST /import` | пропускает уже существующие фазы/отчёты/запуски |
| `prisma:seed` | обновляет фазы/отчёты/каталог, не дублирует запуски |

## Связанные документы

- HTTP-справочник — [05-api.md](05-api.md)
- Схема БД и ограничения — [06-data-model.md](06-data-model.md)
- Настройка окружения — [08-development.md](08-development.md)
