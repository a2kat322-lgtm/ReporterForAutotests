# 10. Запуск на удалённом сервере

Инструкция для развёртывания проекта на одном Linux-сервере (VPS) с доступом по домену и HTTPS.
Проверена логика миграций, seed и запуск API на чистой PostgreSQL; конфигурации Nginx/systemd
приведены как рабочий шаблон для Ubuntu 24.04 LTS.

## Схема размещения

```text
Интернет
   │  80/443
   ▼
┌──────────────────────────────────────────────┐
│ Ubuntu 24.04 (VPS)                           │
│                                              │
│  Nginx :443                                  │
│   ├── /            → /var/www/reporter (SPA) │
│   └── /api/        → 127.0.0.1:3001          │
│                                              │
│  reporter-api (systemd, Node.js) :3001       │
│        │                                     │
│  PostgreSQL 16 :5432 (только 127.0.0.1)      │
└──────────────────────────────────────────────┘
```

Компоненты:

| Компонент | Где живёт | Как запускается |
| --- | --- | --- |
| SPA (статика) | `/var/www/reporter` | Nginx |
| API | `/srv/reporter/api` | systemd, `node dist/main.js` |
| PostgreSQL | Docker-контейнер или управляемая БД | Docker / облако |

Требования к серверу: 2 vCPU, 2 ГБ RAM, 20 ГБ SSD, Ubuntu 22.04/24.04, домен с A-записью на IP.
Для сборки фронтенда нужно ~1 ГБ RAM; при 1 ГБ добавьте swap (см. шаг 2).

> **Важно:** в приложении нет аутентификации. Не публикуйте его в открытый интернет без
> дополнительной защиты (VPN, allowlist, basic auth) — см. раздел [Безопасность](#14-безопасность).

## Краткий порядок действий

1. Подготовить сервер: пользователь, обновления, firewall, swap.
2. Установить Node.js 22, Nginx, certbot, Docker (если БД в контейнере).
3. Склонировать репозиторий в `/srv/reporter` от пользователя `reporter`.
4. Поднять PostgreSQL, создать БД и пароль.
5. Заполнить `/srv/reporter/api/.env`.
6. Выполнить `prisma generate` и `prisma migrate deploy` (seed — только для демо).
7. Собрать API и фронтенд (`VITE_API_URL=https://<домен>`).
8. Запустить API через systemd, раздать статику через Nginx, выпустить TLS.
9. Проверить API, UI и приём запусков.
10. Настроить бэкапы и порядок обновлений.

---

## 1. Подготовка сервера

Подключитесь по SSH и выполните от пользователя с `sudo`:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw ca-certificates gnupg unzip

# Часовой пояс: приложение хранит время в UTC, сервер удобнее держать в UTC.
sudo timedatectl set-timezone UTC

# Swap на 2 ГБ (страховка для сборки на сервере с 1–2 ГБ RAM).
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Отдельный пользователь приложения.
sudo adduser --disabled-password --gecos "" reporter
sudo mkdir -p /srv/reporter
sudo chown reporter:reporter /srv/reporter
```

Firewall (порт SSH может быть не 22 — проверьте `ss -tlnp`):

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Не открывайте наружу `3001` (API) и `5432` (PostgreSQL): они должны быть доступны только локально.
Docker публикует порты в обход UFW, поэтому в примере ниже PostgreSQL явно биндится на `127.0.0.1`.

Рекомендуется также отключить вход по паролю для SSH и включить `fail2ban`:

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

## 2. Установка зависимостей

### Node.js 22 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v    # v22.x
npm -v
```

Проект собирался и проверялся на Node 24.21 — 24 LTS тоже подходит (`setup_24.x`). Главное —
Node.js 20+ и системная установка (не через nvm), чтобы systemd мог найти бинарник.

### Nginx и certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

### Docker (вариант с PostgreSQL в контейнере)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker reporter
```

После `usermod` перелогиньтесь под `reporter` (или выполняйте docker-команды через `sudo`).
Проверка: `docker run --rm hello-world`.

### Вариант без Docker: PostgreSQL из пакетов

```bash
sudo apt install -y postgresql-16 postgresql-client-16
sudo systemctl enable --now postgresql

sudo -u postgres psql <<'SQL'
CREATE ROLE reporter LOGIN PASSWORD 'ЗАМЕНИТЕ_НА_СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE reporter OWNER reporter;
SQL
```

Убедитесь, что PostgreSQL слушает только localhost (`listen_addresses = 'localhost'` в
`/etc/postgresql/16/main/postgresql.conf`) и использует `scram-sha-256` в `pg_hba.conf`.
Перезапуск: `sudo systemctl restart postgresql`.

## 3. Код приложения

```bash
sudo -iu reporter
cd /srv/reporter
git clone <URL_РЕПОЗИТОРИЯ> .
# или, если каталог не пустой:
# git clone <URL_РЕПОЗИТОРИЯ> app && mv app/* app/.[!.]* . && rmdir app

npm ci
npm --prefix api ci
```

Оба `package-lock.json` (корневой и `api/package-lock.json`) есть в репозитории, поэтому `npm ci`
воспроизводим. Если lock-файл рассинхронизирован, используйте `npm install` и закоммитьте
обновлённый lock.

Каталоги, которые не должны попадать в git (`.env`, `node_modules`, `dist`), уже в `.gitignore`.

## 4. База данных

### Вариант A: PostgreSQL в Docker (рекомендуется для одного сервера)

Создайте каталог и файлы:

```bash
sudo mkdir -p /srv/reporter/deploy /etc/reporter /var/backups/reporter
sudo chown -R reporter:reporter /srv/reporter/deploy
sudo chown root:root /etc/reporter
sudo chmod 700 /etc/reporter
sudo chown root:root /var/backups/reporter
sudo chmod 700 /var/backups/reporter
```

`/srv/reporter/deploy/postgres-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: reporter-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    ports:
      - "127.0.0.1:5432:5432"   # только локально, не наружу
    volumes:
      - reporter_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  reporter_pgdata:
```

`/etc/reporter/postgres.env` (пароль сгенерируйте, например, `openssl rand -base64 24`):

```dotenv
POSTGRES_USER=reporter
POSTGRES_PASSWORD=ЗАМЕНИТЕ_НА_СИЛЬНЫЙ_ПАРОЛЬ
POSTGRES_DB=reporter
```

```bash
sudo chmod 600 /etc/reporter/postgres.env
sudo docker compose --env-file /etc/reporter/postgres.env \
  -f /srv/reporter/deploy/postgres-compose.yml up -d
sudo docker compose --env-file /etc/reporter/postgres.env \
  -f /srv/reporter/deploy/postgres-compose.yml ps
```

Проверка готовности:

```bash
sudo docker exec reporter-postgres pg_isready -U reporter -d reporter
```

> Не используйте корневой `docker-compose.yml` как есть: он предназначен для разработки, публикует
> `5432` на все интерфейсы и содержит dev-пароль `test_insights_dev`.

Пароль в `DATABASE_URL` должен быть URL-encoded, если содержит символы `@ : / ? # %`.
Надёжнее сгенерировать пароль из букв и цифр.

### Вариант B: управляемая БД (облако)

1. Создайте инстанс PostgreSQL 16, БД `reporter` и пользователя.
2. Разрешите подключения только с IP сервера (security group / firewall).
3. Используйте строку вида
   `postgresql://reporter:PASSWORD@db-host:5432/reporter?schema=public&sslmode=require`.
4. Бэкапы и обновления — на стороне провайдера; проверьте retention.

## 5. Конфигурация API

Создайте `/srv/reporter/api/.env` (файл не хранится в git):

```dotenv
DATABASE_URL="postgresql://reporter:ПАРОЛЬ@127.0.0.1:5432/reporter?schema=public"
API_PORT=3001
API_HOST=127.0.0.1
CORS_ORIGIN="https://reporter.example.com"
ENABLE_LEGACY_IMPORT=false
TRUST_PROXY=true
```

| Переменная | Значение в продакшене | Зачем |
| --- | --- | --- |
| `DATABASE_URL` | строка подключения | Prisma; при локальной БД — `127.0.0.1`, не `localhost` |
| `API_PORT` | `3001` | порт API |
| `API_HOST` | `127.0.0.1` | API доступен только через Nginx |
| `CORS_ORIGIN` | `https://<домен>` | точный origin фронтенда, без слэша на конце |
| `ENABLE_LEGACY_IMPORT` | `false` | legacy-импорт не нужен в проде |
| `TRUST_PROXY` | `true` | реальный IP клиента из `X-Forwarded-For` для throttle |

```bash
sudo -iu reporter
chmod 600 /srv/reporter/api/.env
```

Почему `127.0.0.1`, а не `localhost`: `localhost` может разрешиться в IPv6 (`::1`), а PostgreSQL
в контейнере опубликован на IPv4 `127.0.0.1`. Явный адрес исключает ошибку `P1001`.

`TRUST_PROXY=true` включайте только при работе за прокси: иначе клиенты смогут подделывать
`X-Forwarded-For`. Без этого флага за Nginx все запросы выглядят как `127.0.0.1`, и общий лимит
10 запросов/сек применяется ко всем пользователям сразу.

## 6. Миграции и seed

От пользователя `reporter`:

```bash
sudo -iu reporter
cd /srv/reporter
npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate:deploy
```

Ожидаемый результат: `All migrations have been successfully applied.` На чистой БД применяются все
18 миграций, включая `20261021000000_workspaces`.

Проверка таблиц:

```bash
sudo docker exec -it reporter-postgres psql -U reporter -d reporter -c '\dt'
```

Seed **необязателен** и содержит демо-данные (`default` workspace, фазы, отчёты, тесты). Для
боевого контура его запускать не нужно:

```bash
# Только для демо/стенда:
npm --prefix api run prisma:seed
```

Seed требует `ts-node` (devDependency), поэтому выполняется до возможной очистки dev-зависимостей.
На пустой БД seed проверен вместе с миграциями.

### Если миграции уже применялись старой версией

- переименованная миграция `20261013130000_add_failure_feedback` использует
  `ADD COLUMN IF NOT EXISTS` и безопасно применяется поверх существующих колонок;
- запись старого имени в `_prisma_migrations` не мешает;
- при ошибке `P3009` (неудачная миграция) найдите её в `_prisma_migrations`, устраните причину и
  выполните `cd /srv/reporter/api && npx prisma migrate resolve --rolled-back <migration_name>`,
  затем повторите deploy.

## 7. Сборка

```bash
sudo -iu reporter
cd /srv/reporter

# API
npm run api:build

# Фронтенд: URL встраивается в бандл на этапе сборки!
VITE_API_URL=https://reporter.example.com npm run build
```

Особенности:

- `VITE_API_URL` должен быть **полным origin без слэша на конце** (`https://reporter.example.com`).
  Если переменную не задать, фронтенд будет обращаться к `http://localhost:3001` и сломается у
  пользователей. Пустая строка тоже не подойдёт — сработает fallback на localhost.
- После изменения домена или `VITE_API_URL` фронтенд нужно пересобрать.
- Результат: `dist/` (хэшированные `assets/*`, `index.html`).

Публикация статики:

```bash
sudo mkdir -p /var/www/reporter
sudo rsync -a --delete /srv/reporter/dist/ /var/www/reporter/
sudo chown -R www-data:www-data /var/www/reporter
```

## 8. systemd: API как сервис

Создайте `/etc/systemd/system/reporter-api.service`:

```ini
[Unit]
Description=Reporter for autotests API
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=reporter
Group=reporter
WorkingDirectory=/srv/reporter/api
EnvironmentFile=/srv/reporter/api/.env
Environment=NODE_ENV=production
Environment=TZ=UTC
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/reporter/api
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now reporter-api
sudo systemctl status reporter-api --no-pager
```

Логи:

```bash
sudo journalctl -u reporter-api -n 100 --no-pager
sudo journalctl -u reporter-api -f
```

Проверка, что API слушает только localhost:

```bash
ss -ltnp | grep 3001
# 127.0.0.1:3001 ...
curl -fsS http://127.0.0.1:3001/api/workspaces
```

Если сервис падает при старте с ошибкой подключения к БД, убедитесь, что PostgreSQL запущен,
а `DATABASE_URL` указывает на `127.0.0.1`. `Restart=always` будет повторять запуск каждые 3 секунды.

## 9. Nginx и HTTPS

### 9.1. HTTP-конфигурация

`/etc/nginx/sites-available/reporter`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name reporter.example.com;

    root /var/www/reporter;
    index index.html;

    # API принимает тела до 10 МБ; даём запас.
    client_max_body_size 12m;

    # API: префикс /api сохраняется (у NestJS global prefix).
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Хэшированные ассеты можно кэшировать надолго.
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA: любой неизвестный путь отдаёт index.html.
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/reporter /etc/nginx/sites-enabled/reporter
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Проверка до TLS: `curl -I http://reporter.example.com`.

### 9.2. TLS

```bash
sudo certbot --nginx -d reporter.example.com --redirect \
  --agree-tos -m admin@example.com --no-eff-email
sudo nginx -t && sudo systemctl reload nginx
systemctl list-timers | grep certbot   # автопродление
```

Certbot добавит `listen 443 ssl`, сертификаты и редирект с HTTP. Если сертификат не выпускается,
проверьте A-запись домена и доступность порта 80.

Итоговая проверка:

```bash
curl -I https://reporter.example.com
curl -fsS https://reporter.example.com/api/workspaces
```

### 9.3. Ограничение доступа (настоятельно рекомендуется)

В приложении нет логина. Варианты:

**VPN / allowlist** — вставить в `server`-блок до `location`:

```nginx
allow 203.0.113.0/24;   # ваш офис/VPN
deny all;
```

**Basic auth**:

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd qa
```

```nginx
auth_basic "Reporter";
auth_basic_user_file /etc/nginx/.htpasswd;
```

После правок: `sudo nginx -t && sudo systemctl reload nginx`.

## 10. Проверка после развёртывания

1. **API напрямую:**

   ```bash
   curl -fsS http://127.0.0.1:3001/api/workspaces
   # [{"id":1,"name":"default",...}] или []
   ```

2. **API через Nginx:**

   ```bash
   curl -fsS https://reporter.example.com/api/workspaces
   ```

3. **UI:** откройте `https://reporter.example.com` — должен загрузиться интерфейс, список workspace
   слева. Если пусто, создайте workspace.

4. **Приём запуска** (проверяет запись в БД и создание workspace):

   ```bash
   curl -fsS -X POST https://reporter.example.com/api/results \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     --data-urlencode 'projectName=prod-smoke' \
     --data-urlencode 'path=com.example.DeploySmokeTest' \
     --data-urlencode 'status=passed' \
     --data-urlencode 'startDate=2026-10-17T10:00:00Z' \
     --data-urlencode 'endDate=2026-10-17T10:00:02Z' \
     --data-urlencode 'circuit=stage'
   # {"received":true,"id":...,"workspaceId":...,"projectName":"prod-smoke"}
   ```

5. **Логи:**

   ```bash
   sudo journalctl -u reporter-api -n 50 --no-pager
   sudo tail -n 50 /var/log/nginx/error.log
   ```

6. **Перезагрузка сервера** (проверка автозапуска): `sudo reboot`, затем повторите проверки.
   API должен подняться сам, PostgreSQL-контейнер — благодаря `restart: unless-stopped`.

7. **Мобильная версия и светлая тема** — быстрый smoke-тест UI.

## 11. Обновление версии

Перед обновлением сделайте бэкап БД (раздел 12). Затем:

```bash
sudo -iu reporter
cd /srv/reporter

git pull --ff-only

npm ci
npm --prefix api ci

npm --prefix api run prisma:generate
npm --prefix api run prisma:migrate:deploy

npm run api:build
VITE_API_URL=https://reporter.example.com npm run build
```

```bash
# Сохранить предыдущую статику для быстрого отката.
sudo rm -rf /var/www/reporter.prev
sudo cp -a /var/www/reporter /var/www/reporter.prev
sudo rsync -a --delete /srv/reporter/dist/ /var/www/reporter/
sudo chown -R www-data:www-data /var/www/reporter

sudo systemctl restart reporter-api
sudo nginx -t && sudo systemctl reload nginx
```

Порядок и простои:

- API перезапускается за 1–2 секунды; brief 502 возможен, если запрос попал в момент рестарта.
- Миграции применяются до перезапуска API. Они должны быть обратно совместимы с предыдущей версией
  кода — иначе откат кода без отката БД сломается.
- Фронтенд и API раздаются с одного домена, поэтому обновление статики можно делать сразу после
  перезапуска API.
- Полноценного blue-green/zero-downtime в проекте нет.

## 12. Резервное копирование и восстановление

### Бэкап (Docker)

```bash
sudo docker exec reporter-postgres \
  pg_dump -U reporter -d reporter -Fc \
  > /var/backups/reporter/reporter-$(date +%F-%H%M).dump
```

Cron `/etc/cron.d/reporter-backup` (обратите внимание на экранирование `%`):

```cron
15 2 * * * root docker exec reporter-postgres pg_dump -U reporter -d reporter -Fc > /var/backups/reporter/reporter-$(date +\%F).dump
30 2 * * * root find /var/backups/reporter -name '*.dump' -mtime +14 -delete
```

```bash
sudo chmod 644 /etc/cron.d/reporter-backup
```

Для управляемой БД используйте `pg_dump "postgresql://..." -Fc` (нужен `postgresql-client-16`).

### Восстановление

```bash
sudo systemctl stop reporter-api
sudo docker exec -i reporter-postgres \
  pg_restore -U reporter -d reporter --clean --if-exists \
  < /var/backups/reporter/reporter-2026-10-17.dump
sudo systemctl start reporter-api
```

Обязательно проверяйте восстановление на отдельной БД хотя бы раз в квартал. Храните копии вне
сервера (S3/другой хост) и шифруйте, если в данных есть чувствительная информация.

## 13. Откат

**Код:**

```bash
cd /srv/reporter
git log --oneline -10
git switch --detach <предыдущий_коммит>
npm ci && npm --prefix api ci
npm run api:build
VITE_API_URL=https://reporter.example.com npm run build
sudo rsync -a --delete /srv/reporter/dist/ /var/www/reporter/
sudo systemctl restart reporter-api
```

После проверки вернитесь на ветку: `git switch master` (или `main`). Не делайте `git pull` в
состоянии detached HEAD.

Если фронтенд уже обновлён, можно вернуть предыдущую статику:

```bash
sudo rm -rf /var/www/reporter
sudo mv /var/www/reporter.prev /var/www/reporter
```

**БД:** миграции применяются только вперёд. Если новая версия схемы несовместима со старым кодом,
восстановите дамп (раздел 12) — это откатит и данные, появившиеся после бэкапа.

## 14. Безопасность

- **Нет аутентификации.** Ограничьте доступ на уровне Nginx (VPN, allowlist, basic auth) или
  размещайте сервис во внутренней сети.
- **Не открывайте наружу 3001 и 5432.** `API_HOST=127.0.0.1` и привязка PostgreSQL к `127.0.0.1`
  обязательны; UFW — вторая линия защиты.
- **TLS** — только HTTPS; HSTS можно добавить после проверки:
  `add_header Strict-Transport-Security "max-age=31536000" always;`.
- **Секреты** — `.env` и `postgres.env` с правами `600`, не в git; при утечке смените пароль БД.
- **`ENABLE_LEGACY_IMPORT=false`** — импорт legacy-данных в проде не нужен.
- **`TRUST_PROXY=true`** — только если API недоступен напрямую. Иначе `X-Forwarded-For` можно
  подделать и обойти throttle.
- **Пароль БД** — длинный случайный, уникальный; не используйте dev-креденшелы из
  `docker-compose.yml`.
- **Обновления** — регулярно `apt upgrade`, `npm audit` для зависимостей, следите за версиями
  Node.js/PostgreSQL.
- **Лимиты** — глобально 10 запросов/сек на IP; для массовой отправки результатов используйте
  `/api/results` (50/сек, 5000/мин).
- **Логи** — не логируйте тела запросов с персональными данными; Nginx access log уже содержит IP.
- **Резервные копии** — шифруйте и храните вне сервера.
- **Дополнительно** — `fail2ban`, запрет паролей SSH, отдельный пользователь БД для приложения
  (DDL-миграции можно выполнять отдельной ролью).

## 15. Troubleshooting

| Симптом | Причина и решение |
| --- | --- |
| `502 Bad Gateway` | API не слушает `127.0.0.1:3001`. Проверьте `systemctl status reporter-api`, `ss -ltnp \| grep 3001`, `API_HOST`, `API_PORT`. |
| API не стартует: `P1001` / `Can't reach database server` | Неверный `DATABASE_URL`, БД не запущена, порт закрыт. Проверьте `docker compose ps`, `pg_isready`, используйте `127.0.0.1` вместо `localhost`. |
| `P1000` authentication failed | Неверный пароль или спецсимволы не URL-encoded в `DATABASE_URL`. |
| `404` при обновлении страницы `/phase/1` | Нет SPA-fallback: `try_files $uri $uri/ /index.html;` в `location /`. |
| Пустая страница / запросы на `localhost:3001` | Фронтенд собран без `VITE_API_URL`. Пересоберите: `VITE_API_URL=https://<домен> npm run build`. |
| CORS-ошибка в консоли | `CORS_ORIGIN` не совпадает с origin (схема, домен, порт). Для same-origin через Nginx CORS не нужен, но значение должно быть корректным. |
| `429 Too Many Requests` у всех пользователей | Включён ли `TRUST_PROXY=true`? Проверьте заголовок `X-Forwarded-For` в Nginx. |
| `P3009` failed migration | В `_prisma_migrations` есть незавершённая миграция. Устраните причину и выполните `cd /srv/reporter/api && npx prisma migrate resolve --rolled-back <name>`, затем `prisma migrate deploy`. |
| `P3018` migration failed | Смотрите SQL и лог; исправьте данные/миграцию, затем resolve. |
| `Prisma Client ... engine` / OpenSSL | Установите `openssl`/`libssl3`, проверьте поддерживаемую версию Node. |
| `EADDRINUSE` | Порт 3001 занят: `ss -ltnp \| grep 3001`, остановите старый процесс или измените `API_PORT`. |
| Nginx `403 Forbidden` | Права на `/var/www/reporter` (владелец `www-data`, каталоги 755) или SELinux/AppArmor. |
| Сборка падает по памяти | Добавьте swap, соберите фронтенд локально и загрузите `dist/`, либо увеличьте RAM. |
| `npm ci` падает | Lock-файл рассинхронизирован; используйте `npm install` и закоммитьте `package-lock.json`. |
| Время в отчёте не совпадает | Окно отчёта считается по UTC; сервер держите в UTC, а браузер показывает локальное время. |
| TLS не выпускается | DNS не указывает на сервер, порт 80 закрыт, домен не подтверждён. Проверьте `dig +short <домен>`, `ufw status`. |
| После reboot API не поднялся | `systemctl is-enabled reporter-api`, `sudo journalctl -u reporter-api -b`, проверьте, что контейнер БД стартует (`restart: unless-stopped`). |

## 16. Чек-лист первого запуска

- [ ] Домен указывает на IP сервера, порты 80/443 открыты.
- [ ] Node.js 20+ установлен системно, `node -v` работает.
- [ ] PostgreSQL 16 запущен, БД и пользователь созданы, порт доступен только локально.
- [ ] `api/.env` заполнен, права `600`, `TRUST_PROXY=true`, `API_HOST=127.0.0.1`.
- [ ] `prisma generate` и `prisma migrate deploy` прошли, таблицы созданы.
- [ ] API собран (`npm run api:build`), systemd-сервис активен.
- [ ] `curl http://127.0.0.1:3001/api/workspaces` отвечает.
- [ ] Фронтенд собран с `VITE_API_URL=https://<домен>`, статика в `/var/www/reporter`.
- [ ] Nginx проксирует `/api/`, SPA-fallback работает, `nginx -t` успешен.
- [ ] TLS выпущен, HTTP редиректит на HTTPS.
- [ ] Доступ ограничен (VPN/allowlist/basic auth), 3001 и 5432 закрыты снаружи.
- [ ] Приём запуска через `POST /api/results` работает, workspace создаётся.
- [ ] Настроен ежедневный бэкап и проверено восстановление.
- [ ] После `reboot` сервис и UI поднимаются автоматически.

## Связанные документы

- [08-development.md](08-development.md) — локальная разработка и проверки
- [04-backend.md](04-backend.md) — конфигурация, throttle, ошибки
- [05-api.md](05-api.md) — эндпоинты и примеры
- [06-data-model.md](06-data-model.md) — миграции и ограничения
- [07-ingestion-and-import.md](07-ingestion-and-import.md) — контракт запусков
