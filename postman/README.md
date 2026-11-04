# Postman → Reporter for autotests

Клиент для отправки результатов коллекций Postman в отчёт. Полная инструкция —
[`docs/13-postman-integration.md`](../docs/13-postman-integration.md).

```text
postman/
├── newman-reporter-report/   # npm-пакет newman-reporter-report (оба канала)
├── collection-runner/        # готовая коллекция для импорта в Postman UI
├── instrument.js             # автоинструментирование существующей коллекции
├── run.js                    # запуск коллекции: node run.js collection.json
├── smoke.js                  # смоук-тест на мок-API (npm run smoke)
├── postman-ui-snippet.js     # вариант для Postman UI (только форма)
└── package.json              # зависимости: newman, acorn, adm-zip
```

Если у вас уже есть своя коллекция, не вставляйте блоки вручную: экспортируйте её и выполните
`node instrument.js ..\collection.json` — инструмент добавит helper/send и перепишет `pm.test`
на `check`. Результат — `collection.reporter.postman_collection.json`.

Для Postman UI импортируйте
[`collection-runner/Reporter-for-autotests.postman_collection.json`](collection-runner/Reporter-for-autotests.postman_collection.json):
скрипты уже вставлены, останется задать переменные `reporter*`. Инструкция —
[`collection-runner/README.md`](collection-runner/README.md).

Быстрый старт:

```powershell
cd postman
npm install
$env:REPORTER_API = 'http://localhost:3001'
$env:REPORTER_PROJECT = 'cwi'
$env:REPORTER_ENVIRONMENT = 'dso'
$env:REPORTER_LAUNCH = $env:BUILD_NUMBER
$env:REPORTER_ORIGIN = 'ci'
node run.js ..\collection.json
```

Проверка самого клиента (без API и БД):

```powershell
npm --prefix postman run smoke
```
