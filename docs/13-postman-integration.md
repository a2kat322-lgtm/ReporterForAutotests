# 13. Подключение Postman: коллекции и Newman

Инструкция для владельцев коллекций Postman: как отправлять результаты в
**Reporter for autotests**, чтобы запросы коллекции появлялись в отчёте сразу, а проверки
(`pm.test`) — шагами в карточке запуска. Серверная часть не меняется: используются те же два
канала, что и у Java-клиента ([12-client-integration.md](12-client-integration.md)):
`POST /api/results` и `POST /api/allure/import`. Контракты описаны в
[05-api.md](05-api.md) и [07-ingestion-and-import.md](07-ingestion-and-import.md).

Готовый клиент лежит в `postman/`:

```text
postman/
├── newman-reporter-report/   # npm-пакет newman-reporter-report
│   ├── index.js              # оба канала: форма + архив
│   └── package.json
├── collection-runner/        # готовая коллекция для импорта в Postman UI
│   ├── Reporter-for-autotests.postman_collection.json
│   ├── build.js
│   └── README.md
├── instrument.js              # автоинструментирование существующей коллекции
├── run.js                    # запуск коллекции без публикации пакета
├── smoke.js                  # смоук-тест клиента на мок-API
├── postman-ui-snippet.js     # вариант для Postman UI (только форма)
└── package.json              # newman, adm-zip, локальный репортер
```

## 1. Два канала отправки

| Канал | Эндпоинт | Когда вызывается | Что даёт |
| --- | --- | --- | --- |
| **Форма** | `POST /api/results` | после каждого запроса | строка запуска в отчёте сразу: путь, статус, время, владелец, теги, сообщение |
| **Архив** | `POST /api/allure/import` | один раз в конце прогона | проверки как шаги, параметры запроса/ответа, `statusDetails`, путь в каталоге |

Каналы независимы, склейка — та же, что у JUnit/TestNG: импорт ищет строку с тем же `path`,
`circuit` и временем старта ±10 секунд и **дополняет** её (`enriched`), а не создаёт вторую.
Поэтому основной канал — форма, архив — «обогащение»; повторная загрузка того же архива
идемпотентна по `externalId` (`uuid` результата).

Ключевое отличие от Java: в Postman нет классов и методов, единица теста — **запрос**
коллекции. Путь строится как `Коллекция/Папка#Запрос`, например
`Shop API/Checkout#POST /orders`. Это тот же формат `Class#method`, что у JUnit, поэтому
оба клиента могут писать в один и тот же каталог отчёта.

## 2. Требования

| Компонент | Что нужно |
| --- | --- |
| Node.js | 18+ (`fetch`, `AbortSignal.timeout`) |
| Newman | 6.x, ставится зависимостью в `postman/package.json` |
| Зависимости | `newman`, `adm-zip`; устанавливаются в папке `postman/` |
| Коллекция | JSON v2.1 (экспорт из Postman) или запуск в Postman UI |
| API | доступный `http://…:3001`, проект и окружение фазы |

## 3. Установка и быстрый старт

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

В консоли появляются две строки:

```text
[reporter] form: 12 posted, 0 failed, archive: imported=0 enriched=12
[reporter] POST /api/allure/import: {"imported":0,"enriched":12,"duplicates":0,...}
```

`form: N posted` — строки ушли; `enriched` — архив дописал шаги и параметры в те же строки.
Если `enriched = 0`, а `imported > 0`, пути или время не совпали (см. раздел 9) либо форма не
дошла до API.

Тот же прогон через штатный Newman (репортер уже установлен локально):

```powershell
cd postman
npx newman run ..\collection.json -r cli,report
```

`run.js` — тонкая обёртка: принимает файл коллекции, окружение, данные итераций, папку и
задержку, а затем ждёт завершения обоих каналов. Штатный Newman удобнее, если в CI уже есть
своя команда `newman run`.

Полезные параметры `run.js`:

| Параметр | Смысл |
| --- | --- |
| `-e, --environment <file>` | окружение Postman |
| `-d, --iteration-data <file>` | данные итераций |
| `-f, --folder <name>` | только выбранная папка коллекции |
| `--delay-request <ms>` | пауза между запросами |
| `--no-archive` | только форма, без архива |

## 4. Настройки

Как и у Java-клиента, настройки берутся из переменных окружения — в CI их задают на шаге
прогона, локально — в терминале или `.env`-обёртке.

| Переменная | По умолчанию | Смысл |
| --- | --- | --- |
| `REPORTER_API` | `http://localhost:3001` | адрес API без `/api` на конце |
| `REPORTER_PROJECT` | `default` | `projectName` / workspace |
| `REPORTER_ENVIRONMENT` | `local` | окружение: `circuit` формы и `environment` импорта; сравнивается с `Phase.environment` без учёта регистра |
| `REPORTER_LAUNCH` | случайный UUID на прогон | `launchId`: в CI передавайте номер сборки, чтобы прогон группировался в «Истории запусков» |
| `REPORTER_ORIGIN` | `ci` при `CI`, иначе `local` | источник прогона (`ci` / `local` / `unknown`) |
| `REPORTER_TAGS` | — | теги через запятую |
| `REPORTER_OWNER` | — | владелец (подпись в отчёте) |
| `REPORTER_EPIC` | — | эпик (фильтр на странице отчёта) |
| `REPORTER_UPLOAD` | `true` | `false` — не отправлять архив |
| `REPORTER_ARCHIVE_NAME` | `postman-results.zip` | имя архива в «Истории запусков» |

Отключить архив можно опцией репортера `--reporter-report-upload=false` — это то же самое, что
`REPORTER_UPLOAD=false`; остальные настройки задаются переменными окружения.

## 5. Путь, статусы и сообщения

### 5.1. Путь

`path = <коллекция>/<папка>/…/<папка>#<имя запроса>`. Имя запроса — последний сегмент после
`#`, папки — через `/`. Если запрос лежит прямо в коллекции, путь — `Коллекция#Запрос`.

Правила:

- путь обрезается до 300 символов — как на сервере, так и в клиенте; метод сохраняется в конце;
- имена запросов должны быть уникальны в пределах папки: одинаковые имена в одной папке
  склеятся в одну строку отчёта;
- форму и архив клиент строит из одного и того же значения, поэтому склейка работает всегда;
- параметризованные итерации (`--iteration-data`) дают несколько запусков одного пути —
  отчёт покажет их как историю и ретраи.

### 5.2. Статусы

| Что произошло | Статус |
| --- | --- |
| все `pm.test` прошли | `passed` |
| хотя бы одна проверка упала | `failed` |
| ошибка скрипта, исключение или запрос не выполнился (ECONNREFUSED, таймаут) | `broken` |
| все проверки пропущены (`pm.test.skip`) | `skipped` |
| проверок нет | `passed` |

Приоритет: `broken` важнее `failed` — если запрос не дошёл, падение проверки вторично.
Сообщение об ошибке — имя и текст упавших проверок (`status 200: expected …`), для `broken` —
текст ошибки запроса или скрипта.

## 6. Архив: что попадает в отчёт

Для каждого запроса клиент пишет `*-result.json` в формате `allure-results` и в конце прогона
упаковывает их в zip:

| Поле | Значение |
| --- | --- |
| `uuid` | `externalId` запуска (идемпотентность импорта) |
| `labels.testClass` | `Коллекция/Папка` |
| `labels.testMethod` | имя запроса |
| `labels.feature` / `suite` | последняя папка (или коллекция) |
| `labels.story` | имя запроса |
| `labels.owner`, `epic`, `tag` | из `REPORTER_OWNER`, `REPORTER_EPIC`, `REPORTER_TAGS` |
| `status` | совпадает со статусом формы |
| `steps` | проверки `pm.test` с их статусами и сообщениями |
| `parameters` | метод и URL запроса, код ответа |
| `statusDetails` | сообщение и стектрейс первой ошибки |

Почему не `newman-reporter-allure`: он строит `fullName` как
`<project>:Коллекция/Папка#Запрос`, где `project` — имя корня проекта. Сервер берёт `fullName`
как `path`, и такой путь не совпадёт с путём формы — вместо `enriched` появятся две строки.
Свой минимальный writer даёт одинаковый путь в обоих каналах и не тянет лишнюю зависимость.

Ограничения текущей версии:

- вложения (тела запросов/ответов, скриншоты) не загружаются — шаги и параметры есть, файлов нет;
- контейнеры `*-container.json` не пишутся — сервер их и не импортирует;
- один архив на прогон: не отправляйте архив после каждого запроса (лимит импорта — 2 запроса
  за 10 секунд, 30 в минуту; архив до 512 МиБ).

## 7. Postman UI (Collection Runner)

Если коллекция запускается из приложения Postman, установить Newman-репортер нельзя. Для этого
случая есть готовая коллекция:
[`postman/collection-runner/Reporter-for-autotests.postman_collection.json`](../postman/collection-runner/Reporter-for-autotests.postman_collection.json)
(инструкция — [`postman/collection-runner/README.md`](../postman/collection-runner/README.md)).
Импортируйте её в Postman: скрипты уже вставлены в каждый запрос, останется задать переменные
`reporter*` и запустить Collection Runner. Сниппет для ручной вставки в свои запросы —
`postman/postman-ui-snippet.js`.

Коллекция отправляет строку формы через `pm.sendRequest` после каждого запроса. Скрипт читает
настройки через `pm.variables.get`, поэтому Environment переопределяет Collection Variables.

### 7.1. Не вставлять код в каждый запрос

Песочница Postman изолирует каждый скрипт, а collection-level post-response выполняется **до**
request-level, поэтому общий скрипт не видит результаты `pm.test` конкретного запроса: блок
отправки приходится держать в каждом запросе. Варианты, как не делать это руками:

| Способ | Код в тестах | Когда подходит |
| --- | --- | --- |
| **Newman** (`postman/run.js` или `newman run … -r report`) | 0 строк | CI и локальные прогоны; рекомендуемый вариант |
| **`postman/instrument.js`** | 0 вручную — инструмент вставляет сам | коллекция уже есть, нужен Postman UI |
| **Postman Packages** (`pm.require`) | 2–3 строки | тариф с Package Library, все прогоны в облаке Postman |
| Ручной сниппет | ~60 строк | разовая вставка в один запрос |

Автоинструментирование: экспортируйте коллекцию из Postman и выполните

```powershell
cd postman
node instrument.js ..\collection.json
# результат: ..\collection.reporter.postman_collection.json
```

Инструмент проходит по всем запросам, добавляет `helper` (`check`) и `send`, переписывает
`pm.test(...)` на `check(...)`, чтобы падения попадали в отчёт, и сохраняет проверки, папки и
остальные скрипты. Повторный запуск заменяет сгенерированные блоки по маркерам
`reporter:helper:start` / `reporter:send:start`, поэтому инструмент можно запускать после правок.

Ограничения:

- `pm.test.skip(...)` остаётся как есть: пропущенная проверка не считается и не влияет на статус;
- если скрипт падает до блока отправки (например, необработанный `pm.response.json()`), строка
  не уйдёт — инструмент не оборачивает пользовательский код в `try/finally`;
- скрипты уровня коллекции/папки не инструментируются: они выполняются раньше проверок запроса;
- после правок тестов в Postman экспортируйте коллекцию заново и повторите команду.

Postman Packages (если тариф позволяет) убирают блок из запроса почти полностью: helper и send
один раз кладутся в Package Library, а в запросе остаётся

```js
const reporter = pm.require('@team/reporter')
reporter.check('status 200', () => pm.response.to.have.status(200))
reporter.send()
```

Пакеты не выполняются в Newman — для CI всё равно используйте `postman/run.js`.

Если вставляете сниппет вручную:

1. В **Collection → Variables** добавьте `reporterUrl`, `reporterProject`,
   `reporterEnvironment`, `reporterCollection`, `reporterOwner`, `reporterTags`,
   `reporterOrigin`.
2. В начало **post-response** скрипта запроса вставьте блок «НАЧАЛО».
3. Проверки пишите через `check('имя', function () { … })` вместо `pm.test(...)`.
4. В конец скрипта вставьте блок «КОНЕЦ».

Ограничения варианта для UI:

- путь — только `Коллекция#Запрос`, папки из песочницы недоступны;
- архив не отправляется — шагов и параметров не будет, строки появятся после Harvest;
- обычные `pm.test(...)` в отчёт не попадают: `check()` — обёртка, которая запоминает ошибку;
- collection-level post-response выполняется **до** request-level, поэтому общий скрипт
  коллекции не может отправить результат конкретного запроса;
- подменять `pm.test` нельзя: рантайм падает с `t.test.index is not a function`, и событие
  завершения запроса не приходит.

Для CI и полного паритета с JUnit/TestNG используйте Newman: он видит все проверки и умеет
отправлять архив.

## 8. CI

GitHub Actions:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm ci
  working-directory: postman
- run: node run.js ./collection.json
  working-directory: postman
  env:
    REPORTER_API: http://reporter.internal:3001
    REPORTER_PROJECT: cwi
    REPORTER_ENVIRONMENT: dso
    REPORTER_LAUNCH: ${{ github.run_number }}
    REPORTER_ORIGIN: ci
```

GitLab CI:

```yaml
postman:
  image: node:20
  script:
    - cd postman
    - npm ci
    - node run.js ../collection.json
  variables:
    REPORTER_API: http://reporter.internal:3001
    REPORTER_PROJECT: cwi
    REPORTER_ENVIRONMENT: dso
    REPORTER_LAUNCH: $CI_PIPELINE_ID
    REPORTER_ORIGIN: ci
```

Коды возврата `run.js`: `0` — прогон и отправка успешны; `1` — есть упавшие проверки или
строки не отправились; `2` — ошибка запуска (нет коллекции, Newman не установлен). Так CI
заметит и потерю отчётности, а не только падение тестов.

## 9. Проверка и диагностика

Смоук-тест самого клиента (поднимает мок-API, гоняет Newman и проверяет оба канала):

```powershell
npm --prefix postman run smoke
```

Ожидаемый вывод — `Все проверки прошли`. Тест не требует реального API и БД.

Ручная проверка формы:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/results' `
  -ContentType 'application/json' `
  -Body (@{
    projectName = 'cwi'
    path        = 'Shop API/Checkout#POST /orders'
    status      = 'passed'
    circuit     = 'dso'
    startDate   = (Get-Date).ToUniversalTime().ToString('o')
    endDate     = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json)
```

Типовые ошибки:

| Симптом | Причина / решение |
| --- | --- |
| `400 environment query parameter is required` | пустой `REPORTER_ENVIRONMENT` |
| `400 workspaceId or projectName query parameter is required` | пустой `REPORTER_PROJECT` |
| `429` на форме | больше 50 запросов/с; клиент повторяет 3 раза с паузой, уменьшите темп |
| `429` на импорте | архив шлётся чаще 2 раз за 10 с — отправляйте один архив на прогон |
| `imported = 0, duplicates > 0` | архив уже импортировался (идемпотентность) — ожидаемо |
| `imported > 0, enriched = 0` | пути формы и архива разные (UI-сниппет + Newman) или старт разошёлся больше 10 с |
| строк нет в отчёте фазы | `REPORTER_ENVIRONMENT` не совпадает с окружением фазы; путь не в каталоге — сделайте Harvest или залейте архив |
| в архиве нет шагов | проверки писались через `pm.test` в UI-варианте; для архива нужен Newman |
| `Archive is too large` | больше 512 МиБ (`ALLURE_IMPORT_MAX_BYTES`) |

## 10. Чеклист подключения

- [ ] в `postman/` выполнен `npm install`;
- [ ] заданы `REPORTER_API`, `REPORTER_PROJECT`, `REPORTER_ENVIRONMENT`;
- [ ] в CI заданы `REPORTER_LAUNCH` (номер сборки) и `REPORTER_ORIGIN=ci`;
- [ ] прогон выполняется через `node run.js` или `newman run … -r cli,report`;
- [ ] в логе есть `form: N posted` и `POST /api/allure/import` с `enriched`;
- [ ] строки видны в отчёте фазы (окружение совпадает, путь в каталоге);
- [ ] при использовании UI-сниппета проверки переписаны на `check(...)`, а пути собраны Harvest;
- [ ] при использовании готовой коллекции импортирован файл из `postman/collection-runner/`,
      проверены переменные `reporter*` и выполнен Harvest;
- [ ] `npm --prefix postman run smoke` проходит.

## Полезные ссылки

- Postman Sandbox: [`pm.sendRequest`](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-send-request)
- Postman: [порядок выполнения скриптов](https://learning.postman.com/docs/tests-and-scripts/write-scripts/intro-to-scripts/)
- Postman: [Package Library](https://learning.postman.com/docs/tests-and-scripts/write-scripts/packages/package-library/), [`pm.require`](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-require/)
- Newman: [внешние репортеры](https://github.com/postmanlabs/newman#external-reporters), [события прогона](https://github.com/postmanlabs/newman/wiki/Newman-Run-Events)
