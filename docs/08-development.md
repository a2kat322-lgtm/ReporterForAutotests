# 08. Разработка и эксплуатация

## Требования

- Node.js 20+ (сборка проверена на Node 24.21.0, npm 11.19.0).
- Docker Desktop (для PostgreSQL 16) либо собственный PostgreSQL 16.
- PowerShell 7 (`pwsh`) — для `scripts/send-test-runs.ps1`.
- npm (основной сценарий); `pnpm` опционален — в репозитории есть `pnpm-workspace.yaml` и
  `pnpm-lock.yaml`.

## Первичная установка

```powershell
npm install                     # зависимости фронтенда
npm run api:install             # зависимости API (npm --prefix api install)
Copy-Item api/.env.example api/.env
npm run db:up                   # docker compose up -d postgres
npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate:deploy
npm --prefix api run prisma:seed
```

`api/.env`:

```dotenv
DATABASE_URL="postgresql://test_insights:test_insights_dev@localhost:5432/test_insights?schema=public"
API_PORT=3001
API_HOST=
CORS_ORIGIN="http://localhost:5173"
ENABLE_LEGACY_IMPORT=false
TRUST_PROXY=false
```

## Запуск

Два терминала:

```powershell
npm run api:dev     # Nest watch, http://localhost:3001/api
npm run dev         # Vite,     http://localhost:5173
```

- API доступен по префиксу `/api`; корень `/` отдаст `404`.
- Фронтенд обращается к `VITE_API_URL` (по умолчанию `http://localhost:3001`). Если API на другом
  хосте:

  ```powershell
  $env:VITE_API_URL = 'https://api.example.com'
  npm run dev
  ```

  Переменная встраивается на этапе сборки/старта Vite, поэтому после изменения нужен перезапуск.
- CORS разрешает только `CORS_ORIGIN` (по умолчанию `http://localhost:5173`); при другом порте
  фронтенда обновите `.env` API.

## Скрипты

### Корень

| Скрипт | Что делает |
| --- | --- |
| `npm run dev` | Vite dev-сервер |
| `npm run build` | production-сборка в `dist/` |
| `npm run preview` | предпросмотр собранного фронтенда |
| `npm run api:install` | `npm --prefix api install` |
| `npm run api:dev` | Nest в watch-режиме |
| `npm run api:build` | сборка API в `api/dist/` |
| `npm run db:up` / `db:down` | PostgreSQL в Docker |

### API (`api/package.json`)

| Скрипт | Что делает |
| --- | --- |
| `build` | `nest build` (tsc) |
| `start` | `node dist/main.js` |
| `start:dev` | `nest start --watch` |
| `test` | `jest --runInBand` (тестов в репозитории нет) |
| `test:e2e` | `jest --config ./test/jest-e2e.json` (конфига и каталога нет) |
| `prisma:generate` | генерация Prisma Client |
| `prisma:validate` | проверка схемы |
| `prisma:migrate:dev` | создать/применить миграцию в разработке |
| `prisma:migrate:deploy` | применить готовые миграции |
| `prisma:seed` | `ts-node prisma/seed.ts` |

## Проверки состояния

На момент составления документации (17.10.2026) проверено:

| Проверка | Результат |
| --- | --- |
| `npm --prefix api run prisma:validate` | схема валидна |
| `npm run api:build` | успешно |
| `npm run build` | успешно, если `TEMP`/`TMP` указывают на локальный каталог (см. troubleshooting) |
| `npm run build` с системным `TEMP` | падение `[vite:esbuild-transpile] remove ... Access is denied` — проблема окружения, не кода |

Сборка фронтенда выдаёт предупреждения:

- `Circular chunk: dayjs -> antd -> dayjs` — следствие `manualChunks` в `vite.config.js`;
- чанк `antd` ~1 МБ (> 500 КБ) — можно уменьшить ленивой загрузкой или ручным разбиением.

Интеграционные тесты с БД не запускались: Docker на машине не был доступен.

### Инструменты качества

- ESLint/Prettier в репозитории не настроены (нет конфигов и зависимостей) — стиль поддерживается
  вручную, ориентируйтесь на существующие файлы.
- Юнит/e2e-тестов нет: `api/package.json` содержит скрипты `test`/`test:e2e`, но ни тестов, ни
  `api/test/jest-e2e.json` нет.
- Минимальный набор проверок: `prisma:validate`, `api:build`, `build`, `send-test-runs.ps1 -DryRun`
  и ручной сценарий из раздела «Проверка перед коммитом».

## Git и состояние репозитория

- Основная ветка — `master`.
- В рабочем дереве есть **незакоммиченная** функциональность workspace:

  ```text
  M  api/prisma/schema.prisma, api/prisma/seed.ts, api/src/app.module.ts, ...
  M  src/App.jsx, src/components/Shell.jsx, src/pages/*.jsx, src/services/dataService.js
  ?? api/prisma/migrations/20261021000000_workspaces/
  ?? api/src/modules/workspaces/
  ```

  То есть `master` описывает версию без workspace, а документация — рабочее дерево. Перед
  коммитом проверьте, что миграция и схема согласованы.
- `.gitignore`: `node_modules/`, `dist/`, `.dsh-code-index/`, `.env`, `.env.*` (кроме
  `.env.example`), `node-compile-cache/`.
- Правило `dist/` действует на любом уровне вложенности, поэтому и корневой `dist/`, и `api/dist/`
  не попадают в git.
- `api/.env` содержит локальные dev-креденшелы, в репозиторий не попадает.

## Troubleshooting

### «Backend is unavailable. Start PostgreSQL and the NestJS API…»

Так `dataService.js` сообщает о сетевой ошибке `fetch`. Проверьте:

1. запущен ли API (`npm run api:dev`, порт 3001);
2. запущен ли PostgreSQL (`npm run db:up`, `docker compose ps`);
3. совпадает ли `VITE_API_URL` с адресом API;
4. не блокирует ли запрос CORS (ошибка в консоли браузера будет иной).

### Ошибки CORS

`main.ts` разрешает ровно один origin из `CORS_ORIGIN`. Если Vite поднялся на другом порту,
поправьте `api/.env` и перезапустите API.

### Порт занят

`EADDRINUSE` — измените `API_PORT` (API) или запустите Vite с `--port`. Не забудьте синхронизировать
`VITE_API_URL` и `CORS_ORIGIN`.

### Docker не запущен

Наблюдаемая ошибка:

```text
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
```

Запустите Docker Desktop и повторите `npm run db:up`. Альтернатива — локальный PostgreSQL с
параметрами из `DATABASE_URL`.

### Prisma Client устарел

После правки `schema.prisma`:

```powershell
npm --prefix api run prisma:generate
```

Иначе TypeScript не увидит новые поля/модели, а API может падать на этапе выполнения.

### Сборка фронтенда падает на `esbuild ... Access is denied`

Симптом:

```text
[vite:esbuild-transpile] remove C:\Users\...\Temp\esbuild-...: Access is denied.
```

Это ошибка удаления временного файла (антивирус/политика Windows), а не ошибка кода. Обход:

```powershell
New-Item -ItemType Directory -Force .tmp-build | Out-Null
$env:TEMP = (Resolve-Path .tmp-build); $env:TMP = $env:TEMP
npm run build
```

Либо добавьте каталог `%TEMP%` в исключения антивируса. Не коммитьте `.tmp-build`.

### `prisma migrate deploy` падает на пустой БД

Историческая проблема с порядком миграций исправлена: миграция `add_failure_feedback` перенесена
в `20261013130000` (после `automation_contract`, который пересоздаёт `TestResult`) и использует
`ADD COLUMN IF NOT EXISTS`. Свежая БД разворачивается штатно (проверено).

Если на существующей БД осталась запись о неудачной миграции (`P3009`), посмотрите
`_prisma_migrations`, исправьте причину и выполните
`cd api; npx prisma migrate resolve --rolled-back <migration_name>`, затем повторите
`prisma migrate deploy`. Подробности — в [06-data-model.md](06-data-model.md#порядок-миграций).

### `429 Too Many Requests`

Сработал throttle. Значения: глобально 10/сек и 300/мин; для `/results` — 50/сек и 5000/мин;
harvest — 1/10 сек; import — 1/мин. Для массовых прогонов используйте `/results` (самый высокий
лимит) и не дергайте harvest в цикле.

### `400` при создании фазы/отчёта/теста

- не выбран workspace → `workspaceId` = `null`;
- даты не в формате `YYYY-MM-DD`;
- окно отчёта выходит за период фазы;
- неизвестное поле в теле (глобальный `forbidNonWhitelisted`) — это часто случается при
  копировании объекта из ответа API: отправляйте только поля DTO.

### Дубликат имени отчёта

`UNIQUE(phaseId, name)` в БД; сервис не перехватывает `P2002`, поэтому клиент увидит `500`.
Проверяйте имя перед созданием (в будущем стоит отдавать `409`).

### Harvest возвращает `500`

Проверьте, что передан `environment`. Без него сервис пишет пустую строку в
`AutomatedTestEnvironment`, что запрещено CHECK-ограничением.

### Тест есть в каталоге, но отсутствует в отчёте

Причины по частоте:

1. У теста нет членства в окружении фазы (создан вручную/импортом, Harvest не выполнялся).
2. Окружение запуска (`circuit`) не совпадает с `phase.environment`.
3. Запуск вне окна отчёта.
4. У теста `visible = false`.

### Время в отчёте «съезжает» на часы

Окно отчёта считается по UTC-суткам (`dayStart`/`dayEnd`), а браузер отображает локальное время
через `dayjs`. Для запусков около полуночи по местному времени это может выглядеть как сдвиг.
Проверяйте `startDate`/`endDate` запусков в UTC.

### Потеря точности ID

`BigInt.prototype.toJSON` отдаёт `Number`. ID больше `2^53` потеряют точность. На практике
недостижимо; при необходимости меняйте сериализацию на строки.

## Как добавить новую функциональность

### Backend

1. Создайте модуль `api/src/modules/<feature>/` с подкаталогами `controller`, `service`,
   `repository`, `dto` и файлом `<feature>.module.ts`.
2. Опишите DTO с `class-validator` (помните про `forbidNonWhitelisted`).
3. Контроллер — только HTTP + `ParseBigIntPipe` для path-параметров.
4. Сервис — бизнес-правила, преобразование ошибок Prisma (`P2025` → `404`).
5. Репозиторий — Prisma-запросы; при необходимости транзакция.
6. Зарегистрируйте модуль в `app.module.ts`; если сервис нужен другим модулям — `exports`.
7. При изменении схемы: миграция + `prisma:generate` + обновление seed.

### Frontend

1. Добавьте функцию в `src/services/dataService.js` (не вызывайте `fetch` из компонентов).
2. Для нового экрана: компонент в `src/pages/`, маршрут в `getRoute`/`getPath`, загрузка данных
   в `getData` и рендер в `Dashboard`.
3. Используйте существующие `PageHeading`, `StatusTag`, `ReportTables`, `formatDate`,
   `formatDuration`.
4. Тёмная тема — по умолчанию; проверяйте светлую (`data-theme="light"`) и мобильные
   брейкпоинты 600/800 px.
5. Новые CSS-переменные добавляйте в оба блока `:root` в `src/styles.css`.

### Проверка перед коммитом

```powershell
npm --prefix api run prisma:validate
npm run api:build
npm run build
pwsh -File scripts/send-test-runs.ps1 -DryRun
```

Плюс ручной сценарий: создать workspace → фазу → отчёт → отправить запуски → Harvest →
открыть отчёт и аналитику.

## Документация

- Документы лежат в `docs/`, точка входа — [`docs/README.md`](README.md).
- При изменении контрактов обновляйте:
  - `docs/05-api.md` — маршруты и поля;
  - `docs/06-data-model.md` — схему и миграции;
  - `docs/07-ingestion-and-import.md` — правила нормализации;
  - `docs/09-code-index.md` — карту файлов.
- Даты в документации указаны в формате ДД.ММ.ГГГГ, примеры — для локального контура.

## Связанные документы

- Архитектура — [02-architecture.md](02-architecture.md)
- API — [05-api.md](05-api.md)
- Модель данных — [06-data-model.md](06-data-model.md)
- Развёртывание на сервере — [10-deployment.md](10-deployment.md)
