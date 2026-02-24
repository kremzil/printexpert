# DEV / DEPLOY guide (Printexpert Next)
Next.js (App Router) + Prisma + PostgreSQL + Docker Compose

---

## 0) Что это за проект
Проект на Next.js (App Router) с Postgres и Prisma ORM. Для локальной разработки и VPS-деплоя используется Docker Compose.

Ключевые части:
- Next.js (App Router) — UI + API (route handlers)
- Prisma — ORM и миграции
- PostgreSQL — база данных
- Docker Compose — запуск инфраструктуры

---

## Каталог из БД
- Категории/товары читаются из Postgres через Prisma (`lib/catalog.ts`).
- Сиды берутся из `data/*` и выполняются командой `npm run db:seed`.
- Каталог `/catalog` использует серверные фильтры/поиск/сортировку/пагинацию через query params: `?cat=...&q=...&sort=...&page=...`.

---

## 1) Установка и запуск (dev)

### 1.1 Установка зависимостей
```bash
npm install
```
Prisma Client генерируется автоматически через `postinstall` (см. `package.json`).

### 1.2 Запуск базы (Docker)
```bash
npm run db:up
npm run db:ps
```

### 1.3 Запуск Next.js
```bash
npm run dev
```

### 1.4 Smoke-check API
```bash
npm run health
```
Ожидаемый ответ:
```json
{"ok": true}
```

### 1.5 Тесты (unit + e2e)
Unit-тесты (Vitest):
```bash
npm run test
```

E2E smoke (Playwright):
```bash
npx playwright install chromium
npm run test:e2e
```

Примечания по E2E:
- Для локального запуска нужен доступный `DATABASE_URL`, если требуется сценарий с наполнением корзины.
- Тест checkout с заполнением формы автоматически пропускается (`skipped`), если не удалось найти активный товар (например, при недоступной БД).
- В `playwright.config.ts` есть fallback для `NEXTAUTH_SECRET` и `NEXT_PUBLIC_SITE_URL`, чтобы dev-сервер стартовал в тестовом окружении.

---

## 2) Переменные окружения

### 2.1 Локальный `.env`
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shop?schema=public"
```

S3 для загрузок:
```env
S3_BUCKET="printexpertskuploads"
S3_REGION="eu-central-1"
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_ENDPOINT=""
UPLOAD_MAX_BYTES="100000000"
NEXT_PUBLIC_UPLOAD_MAX_BYTES="100000000"
```

> Для AWS `S3_ENDPOINT` оставлять пустым.  
> В S3 бакете нужен CORS для методов `GET`, `PUT`, `HEAD`.

Stripe (платежи):
```env
STRIPE_SECRET_KEY="sk_test_... или sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_test_... или pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

> Для тестирования использовать test-ключи.
> Webhook secret получается при настройке webhook в Stripe Dashboard.
> Локально можно использовать `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### 2.2 Пример `.env.example`
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shop?schema=public"
```

### 2.3 Production `.env.production`
На VPS создаётся `.env.production` по образцу `.env.production.example`.

---

## 3) Docker Compose (dev)
Команды:
```bash
npm run db:up
npm run db:down
npm run db:logs
npm run db:reset
```

---

## 4) Prisma (dev)

### 4.1 Миграции (dev)
```bash
npm run prisma:migrate:dev
```

### 4.2 Seed (dev)
```bash
npm run db:seed
```

### 4.3 Prisma Studio
```bash
npm run prisma:studio
```

---

## 5) Миграции: dev vs prod
- Dev: `prisma migrate dev` (создание + применение миграций)
- VPS/Prod: `prisma migrate deploy` (применение уже созданных миграций)

На VPS **не** запускать `migrate dev`.

---

## 6) Production Docker Compose (VPS)
Файл: `docker-compose.prod.yml`

Postgres-часть:
```yaml
services:
  db:
    image: postgres:16
    container_name: shop-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: shop
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```
Также содержит сервис `web` (Next.js production).

---

## 7) `.env.production`
Пример: `.env.production.example`

```env
# Strong password, set real value on VPS in .env.production (not committed)
POSTGRES_PASSWORD="CHANGE_ME_STRONG"

# Inside docker compose network host is "db", not localhost
DATABASE_URL="postgresql://postgres:CHANGE_ME_STRONG@db:5432/shop?schema=public"
```

---

## 8) VPS (Docker Compose)

### 8.1 Требования
- Ubuntu 22.04 / 24.04
- Docker + Docker Compose plugin
- SSH доступ
- Открытые порты 80/443

### 8.2 Установка Docker (Ubuntu)
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
# затем перелогиниться по SSH

docker --version
docker compose version
```

### 8.3 Клонирование репо
```bash
git clone <repo>
cd <repo>
npm install
```

### 8.4 `.env.production` на VPS
Создать `.env.production` рядом с `docker-compose.prod.yml`:
```env
POSTGRES_PASSWORD="SUPER_STRONG_PASSWORD"
DATABASE_URL="postgresql://postgres:SUPER_STRONG_PASSWORD@db:5432/shop?schema=public"
DIRECT_URL="postgresql://postgres:SUPER_STRONG_PASSWORD@127.0.0.1:5432/shop?schema=public"
AUTH_SECRET="LONG_RANDOM_SECRET_MIN_16_CHARS"
```

### 8.5 Запуск Postgres на VPS
```bash
npm run prod:up
docker ps
```

---

## 9) Запуск web-сервиса (Next.js)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
npm run db:migrate:prod:deploy
```
Smoke-check:
```bash
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/auth/session
```

---

## 10) Обновление на VPS
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
npm run db:migrate:prod:deploy
```

---

## 11) Бэкапы Postgres
```bash
docker exec -t shop-db pg_dump -U postgres -d shop > backup_$(date +%F).sql
```

---

## 12) Полезные команды
```bash
docker ps
docker logs -f shop-db
```
Dev reset:
```bash
npm run db:reset
```
Prisma:
```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run db:seed
npm run prisma:studio
```

Testing:
```bash
npm run test
npm run test:watch
npm run test:e2e
```

---

## 13) Troubleshooting

### 13.1 `docker: not recognized`
- Перезапустить shell
- Проверить, что Docker установлен
- Установить Docker Desktop (Windows)

### 13.2 Prisma Client не найден (`Cannot find module '.prisma/client/default'`)
```bash
npx prisma generate
```
Проверь, что есть скрипт в `package.json`:
```json
"postinstall": "prisma generate"
```

### 13.3 Нет подключения к БД
```bash
docker ps
```
Проверить хост:
- локально: `localhost:5432`
- в Docker Compose: `db:5432`

---

## 14) Скрипты (package.json)

Dev:
```bash
npm run dev
npm run health
```

DB:
```bash
npm run db:up
npm run db:down
npm run db:logs
npm run db:reset
```

Prod (VPS):
```bash
npm run prod:up
npm run prod:down
npm run prod:logs
```

Prisma:
```bash
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run db:seed
npm run prisma:studio
```
