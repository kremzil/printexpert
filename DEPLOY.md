# Deploy checklist (VPS)

## Prereqs
- Docker + Docker Compose installed
- Repo cloned on server
- .env.production created (based on .env.production.example)

## From DEV to VPS deploy
1) Make sure all Prisma migrations are created locally and committed:
```bash
npm run prisma:migrate:dev
```
2) Push changes to the remote repo (code + `prisma/migrations`).
3) On VPS, pull latest changes:
```bash
git pull
```
4) Rebuild and start services:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
5) Apply production migrations inside the `web` container:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
```

## Start DB
npm run prod:up

## Apply migrations
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
# (если контейнер web ещё не поднят, выполните после его запуска)

## Smoke check
- GET /api/health should return {"ok":true}

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
