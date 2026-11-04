# Готовое решение для Postman UI

Папка самодостаточна: импортируйте
`Reporter-for-autotests.postman_collection.json` в Postman и запускайте Collection Runner.
Скрипты уже вставлены в каждый запрос — ничего копировать вручную не нужно.

## 1. Импорт

1. Postman → **File → Import** (или перетащите файл в окно).
2. Выберите `Reporter-for-autotests.postman_collection.json`.
3. Откройте коллекцию **Reporter Demo API**.

## 2. Настройки

Collection → вкладка **Variables**:

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `baseUrl` | `https://postman-echo.com` | API, по которому идут демо-запросы; замените на свой |
| `reporterUrl` | `http://localhost:3001` | адрес Reporter API **без** `/api` на конце |
| `reporterProject` | `cwi` | проект (workspace) |
| `reporterEnvironment` | `dso` | окружение; должно совпадать с окружением фазы |
| `reporterCollection` | `Reporter Demo API` | префикс пути в отчёте |
| `reporterOwner` | `qa` | владелец (необязательно) |
| `reporterTags` | `postman,ui` | теги через запятую |
| `reporterOrigin` | `local` | источник прогона (`local` / `ci`) |

Скрипт читает переменные через `pm.variables`, поэтому **Environment переопределяет**
Collection Variables: если у вас выбран environment, задайте значения там.

## 3. Запуск

Коллекция → **Run** → выберите папку:

- `Smoke` — два проходящих запроса (`GET echo`, `POST echo`);
- `Demo failure (намеренно)` — запрос `GET expected 200` на `/status/404`: в отчёте появится
  `failed` с сообщением проверки. Папку можно не запускать.

После прогона в Reporter появятся строки:

```text
Reporter Demo API#GET echo            passed
Reporter Demo API#POST echo           passed
Reporter Demo API#GET expected 200    failed
```

Если строк нет — проверьте `reporterUrl`, что API запущен, и консоль Postman
(**View → Show Postman Console**): ошибки отправки печатаются с префиксом `[reporter]`.

## 4. Важно: каталог и Harvest

Коллекция отправляет **только форму** (`POST /api/results`): строки появляются в БД сразу, но
отчёт фазы строится по каталогу (`AutomatedTest`). После первого прогона выполните **Harvest**
на странице фазы (кнопка «Собрать из запусков») или:

```text
POST /api/tests/harvest?workspaceId=<id>&environment=dso
```

Иначе запуски есть, но в отчёте их не видно. Это ограничение канала формы; Newman-клиент из
соседней папки `postman/` заливает архив `allure-results` и регистрирует пути автоматически.

## 5. Как добавить свой запрос

1. Duplicate любого запроса (`GET echo` — самый простой).
2. Замените URL и проверки. Проверки пишите через `check(...)`:

   ```js
   check('status 200', function () { pm.response.to.have.status(200) })
   check('id есть', function () { pm.expect(pm.response.json().id).to.be.a('number') })
   ```

3. Не удаляйте блоки `reporter-helper` (в начале) и `reporter-send` (в конце) — это отправка.
4. Имя запроса должно быть уникальным: путь строится как `reporterCollection#requestName`,
   папки в UI-варианте недоступны.

Обычные `pm.test(...)` отправка не видит — только `check(...)`. Подменять `pm.test` нельзя:
рантайм Postman падает с `t.test.index is not a function`.

## 6. Ограничения

- путь — `Коллекция#Запрос`, без папок;
- шаги и вложения не отправляются: архив `allure-results` из песочницы не собрать;
- если запрос не дошёл (`pm.response` пуст), строка уходит со статусом `broken`;
- для CI и полного паритета с JUnit/TestNG используйте Newman-клиент:
  [`../run.js`](../run.js) и [`../../docs/13-postman-integration.md`](../../docs/13-postman-integration.md).

## 7. Пересборка коллекции

JSON сгенерирован из сниппета [`../postman-ui-snippet.js`](../postman-ui-snippet.js):

```powershell
node postman/collection-runner/build.js
```

Если добавляете много запросов, правьте `build.js` (там список запросов и проверок) и
перегенерируйте JSON; для пары запросов проще Duplicate в Postman.

## 8. Своя коллекция

Если у вас уже есть коллекция, не вставляйте блоки в каждый запрос: экспортируйте её и выполните
[`../instrument.js`](../instrument.js) — он добавит helper/send и перепишет `pm.test` на `check`:

```powershell
cd postman
node instrument.js ..\my-collection.postman_collection.json
# результат: ..\my-collection.reporter.postman_collection.json
```
