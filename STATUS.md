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
- Есть `docker-compose.prod.yml` с сервисами `db` и `web` + скрипты `prod:*` в `package.json`.
- Добавлен `Dockerfile` для production-сборки Next.js (standalone).
- `next.config.ts` настроен на `output: "standalone"`.
- Есть `.env.production.example` и локальный `.env.production` с `POSTGRES_PASSWORD` и `DATABASE_URL`.
- Инструкции деплоя описаны в `DEPLOY.md` (сборка, запуск, миграции).

## Сайт: страницы и маршруты
- App Router: `/`, `/kategorie`, `/catalog`, `/kontaktujte-nas`, `/product/[slug]`.
- API: `/api/health` (проверка БД через `SELECT 1`).
- Статические: `/icon.svg`.
- Фронтенд: страницы каталога и карточек товаров используют данные из `data/*` и изображения из `public/products/*`.
- Бэкенд: Prisma подключен, но доменные сущности/CRUD пока не заведены (кроме `User`).

## Что еще не сделано
- Миграции есть, но данные каталога пока в `data/*` и `public/products/*`.
- Нет сидов/инициализации данных для БД.
- Не настроен reverse proxy/SSL для VPS.
