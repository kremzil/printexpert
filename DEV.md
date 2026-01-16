# DEV / DEPLOY guide (Printexpert Next)
Next.js (App Router) + Prisma + PostgreSQL + Docker Compose

---

## 0) Что это за проект
Это приложение с фронтом и бэкендом на Next.js (App Router), базой Postgres и Prisma ORM. Для локальной разработки и деплоя на VPS используется Docker Compose.

Ключевые части:
- Next.js (App Router) — UI + API (route handlers)
- Prisma — ORM и миграции
- PostgreSQL — база данных
- Docker Compose — запуск сервисов локально и на VPS

---

## 1) Локальная разработка

### 1.1 Установка зависимостей
```bash
npm install
```
Prisma Client генерируется автоматически после `postinstall` (см. `package.json`).

### 1.2 Запуск базы данных (Docker)
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

---

## 2) Переменные окружения (env)

### 2.1 Локально: `.env` (не коммитить)
Пример:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shop?schema=public"
```

### 2.2 Пример для репозитория: `.env.example`
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/shop?schema=public"
```

### 2.3 Production: `.env.production` (на VPS)
На VPS создать `.env.production` на основе `.env.production.example`.

---

## 3) Docker Compose (локальная БД)

### 3.1 `docker-compose.yml` (dev)
Файл поднимает Postgres и пробрасывает порт `5432:5432`.

Команды:
```bash
npm run db:up
npm run db:down
npm run db:logs
npm run db:reset
```

---

## 4) Prisma (локальная разработка)

### 4.1 Создание миграций (dev)
```bash
npm run prisma:migrate:dev
```

### 4.2 Prisma Studio
```bash
npm run prisma:studio
```

---

## 5) Миграции

- Dev: `prisma migrate dev` (создание и применение миграций)
- VPS/Prod: `prisma migrate deploy` (применение уже созданных миграций)

На VPS **нельзя** запускать `migrate dev`.

---

## 6) Production Docker Compose (VPS)

### 6.1 `docker-compose.prod.yml`
Файл используется на VPS.

Пример Postgres-сервиса:
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
Также в compose есть сервис `web` (Next.js production).

---

## 7) Пример `.env.production`
Файл: `.env.production.example`

```env
# Strong password, set real value on VPS in .env.production (not committed)
POSTGRES_PASSWORD="CHANGE_ME_STRONG"

# Inside docker compose network host is "db", not localhost
DATABASE_URL="postgresql://postgres:CHANGE_ME_STRONG@db:5432/shop?schema=public"
```

---

## 8) VPS (Docker Compose)

### 8.1 Требования к серверу
- Ubuntu 22.04 / 24.04
- Docker + Docker Compose plugin
- SSH доступ (порт 22)
- Открытые порты 80/443

### 8.2 Установка Docker на Ubuntu (если не установлен)
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
# После этого выйти из SSH и зайти снова

docker --version
docker compose version
```

### 8.3 Клонирование репозитория
```bash
git clone <repo>
cd <repo>
npm install
```

### 8.4 Создание `.env.production` на VPS
Создать рядом с `docker-compose.prod.yml`:
```env
POSTGRES_PASSWORD="SUPER_STRONG_PASSWORD"
DATABASE_URL="postgresql://postgres:SUPER_STRONG_PASSWORD@db:5432/shop?schema=public"
```
Файл не коммитить.

### 8.5 Запуск Postgres на VPS
```bash
npm run prod:up
docker ps
```

---

## 9) Запуск web-сервиса (Next.js) в продакшене
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
```
Smoke-check:
```bash
curl -sS http://127.0.0.1:3000/api/health
```

---

## 10) Обновление на VPS (после нового деплоя)
```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
```

---

## 11) Бэкапы Postgres

Ручной бэкап:
```bash
docker exec -t shop-db pg_dump -U postgres -d shop > backup_$(date +%F).sql
```

Автоматизация:
- добавить cron
- складывать бэкапы вне VPS (S3/Drive/другой сервер)

---

## 12) Полезные команды
```bash
docker ps
docker logs -f shop-db
```
Сброс БД (осторожно):
```bash
npm run db:reset
```
Prisma:
```bash
npm run prisma:generate
npm run prisma:studio
```

---

## 13) Troubleshooting

### 13.1 `docker: not recognized`
- перезапустить shell
- проверить, что Docker установлен
- установить Docker Desktop (Windows)

### 13.2 Prisma Client не найден (`Cannot find module '.prisma/client/default'`)
```bash
npx prisma generate
```
Проверить наличие в `package.json`:
```json
"postinstall": "prisma generate"
```

### 13.3 Нет подключения к БД
Проверить контейнеры:
```bash
docker ps
```
Проверить хост:
- локально: `localhost:5432`
- в docker compose: `db:5432`

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
npm run prisma:studio
```

---

## 15) Что нужно решить/добавить позже (когда появится что деплоить)

### 15.1 `docker-compose.prod.yml` с сервисом `web` (Next standalone)
Когда фронт/бэк будут готовы и появится смысл деплоя, нужно добавить в `docker-compose.prod.yml` сервис `web`, который будет:
- собирать Next.js в production режиме
- запускать приложение на порту `3000`
- подключаться к Postgres внутри docker-сети по хосту `db`

Это потребует:
- `Dockerfile` (multi-stage build)
- `next.config.js` с `output: "standalone"`
- env-переменных для production (`.env.production`)

После добавления `web` появится полный deploy flow:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
```

### 15.2 Reverse proxy + SSL (HTTPS)
Когда сайт будет опубликован на домене, потребуется reverse proxy, который будет:
- принимать трафик на 80/443
- выдавать SSL сертификат (Let’s Encrypt)
- проксировать запросы на Next.js (внутренний порт 3000)

Есть 2 рабочих варианта:

Вариант A: Nginx вручную (конфиг + certbot)  
Подходит если хочешь полный контроль и минимальный overhead.

Нужно будет:
- установить nginx
- настроить server block под домен
- подключить certbot и автообновление

Вариант B: Nginx Proxy Manager (панель)  
Подходит если хочешь быстрее и проще:
- всё управляется из UI
- SSL и проксирование настраиваются кликами

### 15.3 Что выбрать
Решение можно принять ближе к моменту деплоя, когда будет понятно:
- сколько доменов/сайтов будет на VPS
- нужен ли UI для управления SSL
- насколько часто будут меняться прокси-настройки
