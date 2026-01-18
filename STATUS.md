# Текущее состояние

Дата: 2026-01-17  
Версия: 0.1.2

## БД и Prisma
- PostgreSQL 16 в dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: `User` + новые модели `Category`, `Product`, `ProductImage` и enum `PriceType`.
- Миграция создана и применена: `20260117195653_add_category_product_productimage`.
- Prisma Client генерируется в `lib/generated/prisma` и используется через `@prisma/adapter-pg` + `pg` (`lib/prisma.ts`).
- Сидирование настроено и идемпотентно: `npm run db:seed` (источник `data/*`, изображения upsert по `(productId, url)` с обновлением `sortOrder/isPrimary`; лишние изображения удаляются).
- Prisma health-check: `app/api/health/route.ts` выполняет `SELECT 1`.

## Каталог (DB-backed)
- Страницы `/kategorie`, `/catalog`, `/product/[slug]` читают данные из Postgres через `lib/catalog.ts`.
- Фильтр по категории: `/catalog?cat=<slug>`.
- Неактивные категории/товары скрыты; прямой доступ к неактивному товару -> 404.
- Файлы `data/*` сохранены в репозитории (не удалены).

## Продакшен и деплой
- `docker-compose.prod.yml` с сервисами `db` и `web`, команды `prod:*` в `package.json`.
- `Dockerfile` для production Next.js (standalone), `next.config.ts` с `output: "standalone"`.
- Шаблоны env: `.env.production.example`.
- Документация деплоя: `DEPLOY.md`.

## Роуты
- App Router: `/`, `/kategorie`, `/catalog`, `/kontaktujte-nas`, `/product/[slug]`.
- API: `/api/health`.
- Статика: `/icon.svg`.

## Бэклог / follow-ups
- Админка для CRUD категорий/товаров (будущая задача).
