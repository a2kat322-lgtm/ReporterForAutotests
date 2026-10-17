# Документация проекта «Reporter for autotests»

Репозиторий: `reporter-for-autotests` — веб-приложение для просмотра результатов автоматических
тестов: фазы тестирования → отчёты → каталог тестов → запуски → аналитика.

Документация описывает **текущее состояние рабочего дерева** (ветка `master`, рабочая копия
с незакоммиченной функциональностью workspace), а не отдельный релиз.

## Карта документации

| Документ | О чём |
| --- | --- |
| [01-overview.md](01-overview.md) | Назначение, предметная область, глоссарий, сценарии |
| [02-architecture.md](02-architecture.md) | Архитектура, слои, потоки данных, ключевые решения |
| [03-frontend.md](03-frontend.md) | React-приложение: маршруты, страницы, компоненты, темы |
| [04-backend.md](04-backend.md) | NestJS API: модули, конфигурация, валидация, ошибки |
| [05-api.md](05-api.md) | Справочник HTTP-эндпоинтов с примерами |
| [06-data-model.md](06-data-model.md) | Модель данных, ограничения, индексы, миграции |
| [07-ingestion-and-import.md](07-ingestion-and-import.md) | Приём запусков, Harvest, импорт каталога и legacy-данных |
| [08-development.md](08-development.md) | Запуск, скрипты, проверки, troubleshooting |
| [09-code-index.md](09-code-index.md) | Индекс кода: файлы, символы, эндпоинты, точки входа |
| [10-deployment.md](10-deployment.md) | Развёртывание на удалённом сервере: Nginx, systemd, TLS, бэкапы |

## Технологический стек

- **Frontend:** React 19, Vite 6, Ant Design 5, `dayjs`, собственные SVG/CSS-графики.
- **Backend:** NestJS 10, TypeScript, Prisma 6, `class-validator`, `@nestjs/throttler`.
- **БД:** PostgreSQL 16 (Docker Compose), миграции Prisma.
- **Пакетные менеджеры:** `npm` (основной, скрипты в `package.json`), есть `pnpm-lock.yaml`.

## Структура репозитория

```text
.
├── src/                    # React-приложение (Vite)
│   ├── App.jsx             # провайдеры, тема, ручной роутинг
│   ├── pages/              # экраны: фазы, отчёты, отчёт, аналитика
│   ├── components/         # UI-компоненты и модальные окна
│   ├── services/           # dataService.js — единственная точка обращения к API
│   ├── utils/              # форматирование, парсер JSON-каталога
│   └── styles.css          # CSS-переменные тем и стили Ant Design
├── api/                    # NestJS API
│   ├── src/
│   │   ├── common/         # PrismaModule, ParseBigIntPipe
│   │   ├── config/         # app.config.ts (env)
│   │   └── modules/        # phases, reports, results, tests, workspaces, import
│   ├── prisma/             # schema.prisma, migrations/
│   └── .env.example
├── scripts/
│   └── send-test-runs.ps1  # генератор реалистичных запусков в API
├── public/                 # логотипы
├── docker-compose.yml      # PostgreSQL 16 для локальной разработки
├── vite.config.js
└── index.html
```

## Быстрый старт

Полная инструкция — в [08-development.md](08-development.md). Кратко:

```powershell
npm install
npm run api:install
Copy-Item api/.env.example api/.env
npm run db:up
npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate:deploy
npm run api:dev     # http://localhost:3001/api
npm run dev         # http://localhost:5173
```

База после установки пустая: seed-скрипта нет. Создайте workspace в интерфейсе или отправьте запуск
с `projectName` — workspace появится автоматически. Для продакшена (VPS, Nginx, systemd, TLS,
бэкапы) — отдельная инструкция: [10-deployment.md](10-deployment.md).

## Соглашения документации

- Термины кода (`Workspace`, `Phase`, `Report`, `AutomatedTest`, `TestResult`) не переводятся.
- Пути к файлам указаны относительно корня репозитория.
- Примеры HTTP-запросов даны для `http://localhost:3001/api`.
- Статусы тестов: `passed`, `failed`, `broken`, `skipped`; в отчётах дополнительно вычисляется
  `no_run` (тест есть в каталоге, но запусков в окне отчёта нет).
- Даты в API — `YYYY-MM-DD`, даты-время — ISO 8601 UTC.
