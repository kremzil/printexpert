# Статус проекта

Дата: 2026-01-16  
Версия: 0.1.0

## БД и Prisma
- PostgreSQL 16 в dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: модель `User` + миграция `20260116134024_init`.
- Prisma Client генерируется в `lib/generated/prisma`, подключение через `@prisma/adapter-pg` и `pg` пул (`lib/prisma.ts`).
- Переменные окружения: `.env.example` (dev) и `.env.production.example` (prod/VPS).
- Проверка подключения БД: `app/api/health/route.ts` выполняет `SELECT 1`.

## Подготовка к деплою
- Есть `docker-compose.prod.yml` (только Postgres) и скрипты `prod:*` в `package.json`.
- Есть шаблон `.env.production.example` с `POSTGRES_PASSWORD` и `DATABASE_URL`.
- Инструкции деплоя описаны в `DEPLOY.md`, но шаги про `web` требуют добавления сервиса.

## Что еще не сделано
- Нет сервиса `web` и `Dockerfile` для production-сборки Next.js.
- Миграции есть, но данные каталога пока в `data/*` и `public/products/*`.
- Нет сидов/инициализации данных для БД.
- Не настроен reverse proxy/SSL для VPS.