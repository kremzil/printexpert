# Статус проекта

Дата: 2026-01-18  
Версия: 0.1.3

## Система и Prisma
- PostgreSQL 16 для dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: `User` + сущности `Category`, `Product`, `ProductImage` и enum `PriceType`.
- Миграция: `20260117195653_add_category_product_productimage`.
- Prisma Client генерируется в `lib/generated/prisma` с адаптером `@prisma/adapter-pg` + `pg` (`lib/prisma.ts`).
- Сидирование: `npm run db:seed` (читает `data/*`, делает upsert по `(productId, url)` и обновляет `sortOrder/isPrimary`; лишние изображения удаляются).
- Prisma health-check: `app/api/health/route.ts` выполняет `SELECT 1`.

## Каталог (DB-backed)
- Страницы `/kategorie`, `/catalog`, `/product/[slug]` читают данные из Postgres через `lib/catalog.ts`.
- Фильтрация по категории: `/catalog?cat=<slug>`.
- Скрытые категории/товары не показываются; slug без совпадения -> 404.
- `data/*` используется только для сидирования (не для runtime).

## Деплой и окружение
- `docker-compose.prod.yml` поднимает `db` и `web`, добавлены `prod:*` скрипты в `package.json`.
- `Dockerfile` под production Next.js (standalone), в `next.config.ts` включен `output: "standalone"`.
- Примеры env: `.env.production.example`.
- Документировано: `DEPLOY.md`.

## Маршруты
- App Router: `/`, `/kategorie`, `/catalog`, `/kontaktujte-nas`, `/product/[slug]`.
- API: `/api/health`.
- Статическое: `/icon.svg`.

## Калькулятор цен и DOM-экспорты
- Добавлены DOM-экспорты ценовых матриц для товаров (по одному JSON на продукт).
- Калькулятор поддерживает два типа: фиксированный размер и площадной (area-based, `ntp = 2`).
- Учитываются скрытые finishing-матрицы при подборе цены.
- Для площадных товаров цена ниже первого брейкпоинта считается пропорционально базовой цене (1 м²).
- Страница товара подхватывает нужный DOM-экспорт по slug.

## Примечания
- Источник ценовых данных: `data/wp/wp2print_dom_export_*.json`.
- Подключены товары: `letaky`, `samolepiaca-folia`.

## Идеи / follow-ups
- Добавить CRUD для категорий и товаров (админка).
- Подключать новые DOM-экспорты по мере расширения ассортимента.
