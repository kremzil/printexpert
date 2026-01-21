# Статус проекта

Дата: 2026-01-19  
Версия: 0.1.4.5

## База данных и Prisma
- PostgreSQL 16 для dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: `User` + каталог `Category` (иерархия через `parentId`), `Product`, `ProductImage`, enum `PriceType`, а также WP-таблицы для матриц.
- Миграция: `20260117195653_add_category_product_productimage`.
- Prisma Client генерируется в `lib/generated/prisma`, используется `@prisma/adapter-pg` + `pg` (`lib/prisma.ts`).
- Сидинг: `npm run db:seed` (читает `data/*`).
- Health-check: `app/api/health/route.ts` (SELECT 1).

## Каталог (DB-backed)
- Страницы `/kategorie`, `/catalog`, `/product/[slug]` читают данные из Postgres через `lib/catalog.ts`.
- Фильтр по категории: `/catalog?cat=<slug>` (родитель выбирает товары из подкатегорий).
- Продукт без slug → 404.
 - `/kategorie` группирует категории по родителям и показывает подкатегории отдельными карточками.

## Админка
Маршруты:
- `/admin` — список товаров.
- `/admin/products/[id]` — карточка товара + матрицы цен.
- `/admin/vlastnosti` — свойства (атрибуты).
- `/admin/vlastnosti/[attributeId]` — значения свойства.

Что реализовано:
- Список товаров с переходом в карточку.
- Отображение карточки товара (сохранение полей пока не реализовано).
- Матрицы цен из WP-таблиц:
  - Создание матрицы на основе выбранных свойств и значений.
  - Генерация строк цен по комбинациям выбранных значений × breakpoints.
  - Редактирование цен и сохранение одной кнопкой на матрицу.
  - Удаление матрицы с подтверждением.
- Свойства (атрибуты):
  - Создание/удаление свойства с подтверждением.
  - Значения свойства: создание/удаление.

## Ограничения:
- Новые строки `WpMatrixPrice` создаются только через кнопку генерации цен.
- Нет авторизации.

## WP-матрицы и калькулятор
- Таблицы: `WpMatrixType`, `WpMatrixPrice`, `WpTerm`, `WpTermTaxonomy`, `WpTermRelationship`, `WpTermMeta`, `WpAttributeTaxonomy`.
- Импорт JSON → DB: `scripts/import-wp-calculator-tables.js`.
- Логика парсинга и данных матриц: `lib/wp-calculator.ts`.
- Привязка WP продукта через `Product.wpProductId`.

## Контакты
- Форма обратной связи (если включена): `/api/contact`.
- Валидация: Zod.
- Защита: honeypot + rate limit.

## Деплой и сборка
- `docker-compose.prod.yml` поднимает `db` и `web`.
- `Dockerfile` для production Next.js (standalone), `next.config.ts` с `output: "standalone"`.
- Пример env: `.env.production.example`.

## Решения
- Однократный перенос данных из WP и переход на нормализованную схему пока **отложен**.

## Следующие шаги
- Реализация сохранения карточки товара.
- Редактирование параметров матрицы (title/numType/breakpoints).
- Поиск/фильтры в админке.
- Авторизация.

## WP posts для SEO/описаний
- Источник: `wp_posts` (файл `kpkp_wp2print_table_wp_posts.json`).
- Фильтр: `post_type = "product"`, `post_status = "publish"`.
- Маппинг в `Product`:
  - `post_name` → `slug`
  - `post_title` → `name`
  - `post_excerpt` → `excerpt`
  - `post_content` → `description`
- В админке `/admin/products/[id]` есть форма для сохранения `WP ID` (обновляет витрину через revalidate).
