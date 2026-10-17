# 04. Backend (NestJS API)

API — приложение NestJS 10 на TypeScript, работающее с PostgreSQL через Prisma 6. Все маршруты
доступны под префиксом `/api`.

## Запуск и bootstrap

`api/src/main.ts`:

1. `NestFactory.create(AppModule)`.
2. Переопределяет `BigInt.prototype.toJSON` → `Number(this)`, чтобы ID сериализовались числами
   (в JSON нет BigInt).
3. `app.setGlobalPrefix('api')`.
4. Подключает `json({ limit: '10mb' })` и `urlencoded({ extended: true, limit: '10mb' })` —
   второй нужен контракту автоматизации.
5. Глобальный `ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })`.
6. `enableCors({ origin: CORS_ORIGIN })`, `enableShutdownHooks()`.
7. `listen(API_PORT ?? 3001)`.

Скрипты (`api/package.json`): `start:dev` (nest watch), `build` (nest build), `start` (node dist/main.js),
`test` (jest, тестов сейчас нет), `prisma:*`.

## Конфигурация

`api/src/config/app.config.ts` регистрирует namespace `app`:

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | — (обязательна) | строка подключения Prisma, читается самой Prisma |
| `API_PORT` | `3001` | порт HTTP-сервера |
| `CORS_ORIGIN` | `http://localhost:5173` | единственный разрешённый origin |
| `ENABLE_LEGACY_IMPORT` | `false` | включает `POST /api/import` только при `true` |

`ConfigModule.forRoot({ isGlobal: true, load: [appConfig] })` — конфигурация доступна во всех
модулях; `ImportService` получает её через `@Inject(appConfig.KEY)`.

## Корневой модуль

`app.module.ts` подключает:

- `ConfigModule` (глобальный);
- `ThrottlerModule` с двумя окнами: `short` — 10 запросов/сек, `long` — 300/мин;
- `PrismaModule` (глобальный, экспортирует `PrismaService`);
- `PhasesModule`, `ReportsModule`, `ResultsModule`, `TestsModule`, `WorkspacesModule`, `ImportModule`;
- глобальный guard `ThrottlerGuard`.

## Модули

| Модуль | Controllers | Providers | Экспортирует | Импортирует |
| --- | --- | --- | --- | --- |
| `workspaces` | `WorkspacesController` | `WorkspacesService`, `WorkspacesRepository` | `WorkspacesService` | — |
| `phases` | `PhasesController` | `PhasesService`, `PhasesRepository` | `PhasesService` | — |
| `reports` | `PhaseReportsController`, `ReportsController` | `ReportsService`, `ReportsRepository` | — | `PhasesModule`, `ResultsModule`, `TestsModule` |
| `results` | `ResultsController` | `ResultsService`, `ResultsRepository` | `ResultsService`, `ResultsRepository` | `WorkspacesModule` |
| `tests` | `TestsController` | `TestsService`, `TestsRepository` | `TestsService`, `TestsRepository` | `ResultsModule` |
| `import` | `ImportController` | `ImportService`, `ImportRepository` | — | — |

`PrismaModule` помечен `@Global()`, поэтому репозитории получают `PrismaService` без явного импорта.

## Слои и типовые паттерны

### Controller

Только HTTP: декораторы маршрутов, извлечение параметров, вызов сервиса. Числовые path-параметры
проходят через `ParseBigIntPipe`. Пример — `phases.controller.ts`:

```ts
@Get(':phaseId')
findById(@Param('phaseId', ParseBigIntPipe) phaseId: bigint) {
  return this.phasesService.findById(phaseId)
}
```

Query-параметры `workspaceId` парсятся вручную через `BigInt(workspaceId)` (см. «Нюансы»).

### Service

Бизнес-правила и оркестрация: проверка дат, канонизация строк, преобразование Prisma-ошибок в HTTP,
вычисления отчёта. Примеры:

- `PhasesService.create` проверяет `endedAt >= startedAt` и нормализует `environment` в нижний регистр.
- `ReportsService.createForPhase` проверяет, что окно отчёта лежит внутри периода фазы.
- `TestsService.create` делает upsert по `(workspaceId, resultPath)`.
- `ResultsService.normalize` вручную валидирует внешний контракт.

### Repository

Все обращения к Prisma. Здесь же — `$transaction` и `$queryRaw` (выборка запусков по пересечению
интервалов). HTTP-исключения не бросаются, кроме доменных проверок внутри импорта.

### DTO и валидация

DTO — классы `class-validator`; глобальный pipe включён с `forbidNonWhitelisted`, поэтому лишние поля
в теле запроса дают `400`. Основные DTO:

| DTO | Где | Поля |
| --- | --- | --- |
| `CreateWorkspaceDto` | workspaces | `name`: 1–200, regex `^[a-z0-9][a-z0-9 ._\-]*$` |
| `CreatePhaseDto` | phases | `workspaceId: int`, `name: 1–200`, `environment: 1–100`, `startedAt/endedAt: YYYY-MM-DD` |
| `CreateReportDto` | reports | `name: string (min 1)`, `startDate/endDate: YYYY-MM-DD` |
| `UpdateResultFeedbackDto` | reports | `failureReason?: ≤120`, `failureComment?: ≤5000` |
| `CreateAutomatedTestDto` | tests | `workspaceId: int`, `resultPath ≤300`, `fullResponsibility ≤200`, `defaultSuiteName ≤200`, `defaultCaseName ≤300`, `defaultOwner ≤120`, `tags ≤100`, `visible?: boolean` |
| `BulkAutomatedTestsDto` | tests | `tests: CreateAutomatedTestDto[]`, макс. 2000 |
| `UpdateVisibilityDto` | tests | `workspaceId: int`, `resultPaths: string[1..2000]`, `visible: boolean` |

Булевы поля принимают строки: `visible` конвертируется трансформером (`"false"`, `"0"`, `"n"` → `false`).

### Валидация контракта запусков

`POST /api/results` **не использует DTO**: тело приходит как `application/x-www-form-urlencoded`,
где значения могут быть `string | string[]`. `ResultsService.normalize`:

- `path` обязателен, обрезается до 300;
- `status` обязателен, приводится к нижнему регистру, должен быть из `passed|failed|broken|skipped`;
- `startDate` обязателен, парсится `new Date(...)`;
- `endDate` опционален, по умолчанию равен `startDate`; `endDate < startDate` → `400`;
- `projectName` по умолчанию `default`, приводится к нижнему регистру и обрезается до 200;
- `circuit` приводится к нижнему регистру, обрезается до 120;
- `tags`: массив, JSON-массив в строке или строка с разделителями `,`/`;`;
- неизвестные поля игнорируются — контракт внешний и может расширяться.

## Обработка ошибок

| Ситуация | Ответ |
| --- | --- |
| Невалидное тело DTO / лишнее поле | `400` (Nest `BadRequestException`, массив сообщений) |
| Невалидный `:id` в пути | `400` («Validation failed (numeric string is expected)») |
| Сущность не найдена | `404` (`NotFoundException`) |
| Prisma `P2025` (удаление несуществующей записи) | `404` |
| Prisma `P2002` при создании workspace | повторный поиск по имени, затем успешный ответ |
| Неверные бизнес-правила (даты, статус, обратная связь) | `400` |
| Превышен rate limit | `429` |
| Невалидный `workspaceId` в query | `500` — `BigInt('abc')` бросает исключение (см. нюансы) |

Формат ошибки — стандартный Nest: `{ "statusCode": 400, "message": [...], "error": "Bad Request" }`.
Клиент (`dataService.js`) показывает `message` в UI.

## Ограничение частоты

| Область | `short` | `long` |
| --- | --- | --- |
| Глобально | 10 / 1 с | 300 / 1 мин |
| `POST /api/results` | 50 / 1 с | 5000 / 1 мин |
| `POST /api/tests/harvest` | 1 / 10 с | 10 / 1 мин |
| `POST /api/import` | 1 / 1 мин | 3 / 1 час |

`@Throttle` переопределяет **оба** именованных окна. Лимиты считаются по IP.

## Ключевые реализации

### Выборка запусков по окну

`ResultsRepository.findRunsCoveringWindow` использует `$queryRaw` с оператором пересечения
интервалов и GiST-индексом:

```sql
SELECT * FROM "TestResult"
WHERE "workspaceId" = $1
  AND tstzrange("startDate", "endDate", '[]') && tstzrange($2, $3, '[]')
  AND "circuit" = $4            -- если environment задан
ORDER BY "startDate" DESC
```

`Prisma.sql`/`Prisma.empty` собирают условие безопасно (параметризация сохраняется).

### Сборка строк отчёта

`ReportsService.findResults`:

1. Загружает отчёт с фазой.
2. Параллельно: каталог для окружения (`findForEnvironment`) и запуски за окно.
3. Складывает запуски в `Map<path, run>` по правилу: первый (самый поздний) запуск, но если текущий
   не `passed`, а новый `passed` — заменяет. Итог: **последний успешный запуск в окне**, иначе
   последний запуск.
4. Для каждой видимой записи каталога строит `ReportResultRow` (`toRow`): значения запуска имеют
   приоритет над значениями каталога; `durationMs = max(0, end - start)`; нет запуска → `no_run`.

### Каталог и окружения

- `findForEnvironment(env, workspaceId)` фильтрует по `environments.some.environment = lower(env)`.
- `harvestBatch` в одной транзакции: находит существующие пути, вставляет новые
  (`skipDuplicates`), затем добавляет членства в `AutomatedTestEnvironment` (`skipDuplicates`).
- `TestsService.create` (ручное создание/импорт) **не добавляет окружение**: параметр `environment`
  в `TestsRepository.create` есть, но сервис его не передаёт. Тест появится в отчётах только после
  Harvest для нужного окружения или прямой записи в `AutomatedTestEnvironment`.
- `updateVisibility` обновляет `visible` по списку `resultPath` в рамках workspace.

### Legacy-импорт

`ImportRepository.executeImport` выполняет всё в одной транзакции:

1. Находит/создаёт workspace `default` (legacy-данные не содержат проекта).
2. Фазы: валидирует имя/окружение/даты, дедуплицирует по `(name, startedAt, workspaceId)`.
3. Отчёты: дедуплицирует по `(phaseId, name)`, `startDate = endDate = дата createdAt`.
4. Запуски: пропускает строки без `automatedTestId`, с неизвестным статусом (включая legacy
   `running`) и дубликаты `(path, startDate)`; создаёт `TestResult` с `projectName = 'default'`.

Возвращает `{ imported, phases, reports, results, skippedResults }`.

## Тесты и качество

- В репозитории нет `*.spec.ts`/`*.e2e-spec.ts`; `api/package.json` содержит `test` и `test:e2e`,
  но каталог `api/test/` и конфиг `jest-e2e.json` отсутствуют.
- `prisma validate` проходит (проверено).
- `npm run api:build` проходит без ошибок (проверено).

## Нюансы и известные проблемы

- **`BigInt()` без pipe в query**: `GET /phases?workspaceId=abc`, `GET /tests?workspaceId=abc` и
  `POST /tests/harvest?workspaceId=abc` возвращают `500`, а не `400`. Для path-параметров такой
  проблемы нет — там `ParseBigIntPipe`.
- **Harvest без `environment`**: сервис передаёт пустую строку в `harvestBatch`, а CHECK-ограничение
  `AutomatedTestEnvironment_environment_lowercase_check` запрещает `''` → транзакция падает с `500`.
  Передавайте `environment` (фронтенд так и делает).
- **Пустой `resultPath`**: `CreateAutomatedTestDto` не требует `MinLength`, поэтому пустая строка
  проходит валидацию и превращается в `404` («resultPath is required») в сервисе — семантически
  это `400`.
- **`CreateReportDto.name` без `MaxLength`**: значение длиннее 200 символов приведёт к ошибке БД
  (`VarChar(200)`), а не к `400`.
- **Неиспользуемый код**: `TestsRepository.addEnvironment`, `ReportsRepository.findPhaseWithReports`,
  `TestsService.findAll`, `ImportService` (используется только через контроллер) — кандидаты на
  удаление.
- **`ImportService` использует `ConfigType`** и `appConfig.KEY` — при добавлении новых настроек
  нужно обновлять `app.config.ts`.
- **Нет глобального фильтра исключений**: Prisma-ошибки, не являющиеся `P2025`, отдаются как `500`.

## Связанные документы

- Эндпоинты и примеры — [05-api.md](05-api.md)
- Схема БД — [06-data-model.md](06-data-model.md)
- Контракты приёма — [07-ingestion-and-import.md](07-ingestion-and-import.md)
