# Статус проекта

Дата: 2026-01-22  
Версия: 0.1.5

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
- `catalog` и `product/[slug]` обернуты в `<Suspense>` для устранения blocking-route по `searchParams/params`.
- Данные для витрины сериализуются (Decimal → string) перед передачей в клиентские компоненты.

## Админка
Маршруты:
- `/admin` — список товаров.
- `/admin/products/[id]` — карточка товара + матрицы цен.
- `/admin/vlastnosti` — свойства (атрибуты).
- `/admin/vlastnosti/[attributeId]` — значения свойства.

Что реализовано:
- Список товаров с переходом в карточку.
- Поиск и фильтры в списке товаров (`q`, `status`, `category`) с синхронизацией в URL.
- Сохранение карточки товара (название, slug, описания, цена от, DPH).
- Матрицы цен из WP-таблиц:
  - Создание матрицы на основе выбранных свойств и значений.
  - Добавление новых матриц через Dialog: вкладки для нескольких свойств, выбор значений, тип и breakpoints.
  - Названия новых матриц формируются как `название продукта – набор свойств` и отображаются в заголовке.
  - В списке матриц показываются названия матриц и названия атрибутов (не ID).
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
- Кэширование данных матриц и каталога: `use cache`, `cacheTag`, `cacheLife`.

## Кэш и revalidate
- Включены Cache Components (`cacheComponents: true`).
- `updateTag()` в админских действиях для актуализации витрины (каталог, атрибуты, матрицы).

## Контакты
- Форма обратной связи (если включена): `/api/contact`.
- Валидация: Zod.
- Защита: honeypot + rate limit.

## Оптимизации UI/доступность
- Добавлен skip‑link к основному контенту.
- Убраны `transition-all`, заменены на явные списки свойств.
- Добавлены `aria-label` для icon‑only действий и `aria-live` для сообщений статуса.
- Явные `<label>` для полей в админских формах и корректные placeholders с примерами.
- Улучшены focus‑стили для модалок и комбобокса, добавлено `overscroll-contain`.
- Для кнопок задан `cursor: pointer`.
- Чекбоксы в диалоге матриц используют основной цвет через `accent-primary`.

## Деплой и сборка
- `docker-compose.prod.yml` поднимает `db` и `web`.
- `Dockerfile` для production Next.js (standalone), `next.config.ts` с `output: "standalone"`.
- Пример env: `.env.production.example`.
- ESLint игнорирует сгенерированные Prisma файлы и служебные скрипты.

## Решения
- Однократный перенос данных из WP и переход на нормализованную схему пока **отложен**.

## Следующие шаги
- Авторизация. пока **отложен**.

## WP posts для SEO/описаний
- Источник: `wp_posts` (файл `kpkp_wp2print_table_wp_posts.json`).
- Фильтр: `post_type = "product"`, `post_status = "publish"`.
- Маппинг в `Product`:
  - `post_name` → `slug`
  - `post_title` → `name`
  - `post_excerpt` → `excerpt`
  - `post_content` → `description`
- В админке `/admin/products/[id]` есть форма для сохранения `WP ID` (обновляет витрину через revalidate).
