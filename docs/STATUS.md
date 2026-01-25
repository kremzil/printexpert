# Статус проекта

Дата: 2026-01-25  
Версия: 0.1.7

## База данных и Prisma
- PostgreSQL 16 для dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: `User` (с UserRole), `Account`, `Session`, `VerificationToken` (NextAuth) + каталог `Category` (иерархия через `parentId`), `Product`, `ProductImage`, enum `PriceType`, а также WP-таблицы для матриц (включая флаг видимости `WpMatrixType.isActive`).
- Миграции:
  - `20260117195653_add_category_product_productimage`
  - `20260124190528_add_show_in_b2b_b2c`
  - `20260125181055_add_nextauth_support` — NextAuth v5
- Prisma Client генерируется в `lib/generated/prisma`, используется `@prisma/adapter-pg` + `pg` (`lib/prisma.ts`).
- Сидинг: `npm run db:seed` (читает `data/*`).
- Health-check: `app/api/health/route.ts` (SELECT 1).
- Флаги видимости: `showInB2b` и `showInB2c` в Product и Category

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
- `/admin/kategorie` — настройки категорий.
- `/admin/vlastnosti` — свойства (атрибуты).
- `/admin/vlastnosti/[attributeId]` — значения свойства.

Что реализовано:
- Список товаров с переходом в карточку.
- Поиск и фильтры в списке товаров (`q`, `status`, `category`) с синхронизацией в URL.
- Сохранение карточки товара (название, slug, описания, цена от, DPH).
- WYSIWYG редактор (Tiptap) для детального описания с сохранением HTML и серверной очисткой.
 - Встроенный редактор заголовка/slug в карточке товара без постоянных инпутов.
 - WYSIWYG редактор для краткого описания.
 - Вставка медиа (URL + загрузка файлов) в редактор, сохранение в `/public/uploads`.
- Матрицы цен из WP-таблиц:
  - Создание матрицы на основе выбранных свойств и значений.
  - Добавление новых матриц через Dialog: вкладки для нескольких свойств, выбор значений, тип и breakpoints.
  - Редактирование матрицы через тот же Dialog (предзаполненные данные).
  - Названия новых матриц формируются как `название продукта – набор свойств` и отображаются в заголовке.
  - В списке матриц показываются названия матриц и названия атрибутов (не ID).
  - Переключатель видимости матрицы на странице товара (Switch) скрывает отображение, но не исключает матрицу из расчётов.
  - Генерация строк цен по комбинациям выбранных значений × breakpoints.
  - Редактирование цен и сохранение одной кнопкой на матрицу.
  - Удаление матрицы с подтверждением.
- Свойства (атрибуты):
  - Создание/удаление свойства с подтверждением.
  - Значения свойства: создание/удаление.
- Категории:
  - Создание и редактирование категорий (название, slug, изображение, описание, порядок, активность, родитель).
  - Флаги видимости по аудитории B2B/B2C.
  - Удаление запрещено при наличии товаров или подкатегорий.

## Ограничения:
- Новые строки `WpMatrixPrice` создаются только через кнопку генерации цен.
- Докончавающая матрица может иметь только одно свойство.

## Безопасность и авторизация (обновлено 25.01.2026)
- Миграция на **NextAuth v5** (beta) для production-ready аутентификации
- Роли: `UserRole` enum (USER, ADMIN)
- Провайдеры:
  - Nodemailer (magic links через SMTP)
  - Credentials (пароли с bcrypt)
- JWT сессии (30 дней)
- Middleware защита:
  - `/admin/*` → только ADMIN
  - `/account/*` → требуется авторизация
- Server actions защищены через `requireAdmin()`:
  - `updateProductDetails`, `deleteMatrix`, `createMatrix`, `createCategory`
  - `deleteCategory`, `updateCategory`, `createAttribute`, `deleteAttribute`
- Upload API требует активную сессию
- Первый администратор назначается вручную через Prisma Studio

## WP-матрицы и калькулятор
- Таблицы: `WpMatrixType`, `WpMatrixPrice`, `WpTerm`, `WpTermTaxonomy`, `WpTermRelationship`, `WpTermMeta`, `WpAttributeTaxonomy`.
- Импорт JSON → DB: `scripts/import-wp-calculator-tables.js`.
- Логика парсинга и данных матриц: `lib/wp-calculator.ts`.
- Привязка WP продукта через `Product.wpProductId`.
- Кэширование данных матриц и каталога: `use cache`, `cacheTag`, `cacheLife`.
- Серверный расчёт цены: `lib/pricing.ts` (единый источник истины).
- Endpoint для пересчёта цены: `POST /api/price` (возвращает `net/vat/gross`).
- Поддержка внутренних матриц `PricingModel/PricingEntry` для расчёта (без `wpProductId`).

## Кэш и revalidate
- Включены Cache Components (`cacheComponents: true`).
- `updateTag()` в админских действиях для актуализации витрины (каталог, атрибуты, матрицы).
 - Важно: нельзя вызывать `cookies()` или другие динамические источники данных внутри функций, помеченных `"use cache"`. Паттерн: резолвить `AudienceContext` вне кэшируемых функций (в page/route), и передавать `audience` как аргумент в `getProducts` или использовать проверку видимости на уровне страницы.
 - `getProducts` теперь принимает опциональный `audience` и учитывает `showInB2b`/`showInB2c` при выборке; страница товара выполняет дополнительную проверку и возвращает 404 для товара, скрытого для текущей аудитории.

## AudienceContext (B2B/B2C)
- Добавлен единый серверный резолвер с приоритетами `query → account (stub) → cookie → default`.
- `?mode=b2b|b2c` сохраняется в cookie через `proxy.ts` (бывший middleware).
- Используется в RSC и API: витрина `/product/[slug]` показывает `bez DPH/s DPH`, API возвращает `x-audience`/`x-audience-source`.
- Серверный расчёт цены учитывает `AudienceContext` и возвращает `PriceResult`.
- Навигация в хедере зависит от аудитории и показывает категории/товары, доступные для выбранного режима.

## Главная страница
- Контент B2B/B2C вынесен в отдельные компоненты: `components/home/home-b2b.tsx`, `components/home/home-b2c.tsx`.
- Добавлена карусель (shadcn/ui + Embla) с автоплеем и высотой 592px.
- B2B-слайды используют изображения из `/public/homepage/b2b`.

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
- HTML описаний очищается на сервере (whitelist тегов, ссылки только https).
- Медиа‑теги очищаются на сервере, допускаются только `https://` и `/uploads/`.

## Деплой и сборка
- `docker-compose.prod.yml` поднимает `db` и `web`.
- `Dockerfile` для production Next.js (standalone), `next.config.ts` с `output: "standalone"`.
- Пример env: `.env.production.example`.
- ESLint игнорирует сгенерированные Prisma файлы и служебные скрипты.

## Решения
- Однократный перенос данных из WP и переход на нормализованную схему пока **отложен**.

## Следующие шаги
- Роли/права доступа. пока **отложен**.

## Пользователи и аутентификация (NextAuth v5)
- Модели Prisma: `User` (с role), `Account`, `Session`, `VerificationToken`
- Провайдеры: Nodemailer (magic links), Credentials (пароли)
- Magic links: NextAuth `signIn("nodemailer")` с SMTP
- Пароли: bcrypt hash, установка через `/api/auth/set-password`
- JWT сессии с поддержкой `role` в токене
- Middleware: `proxy.ts` с проверкой `authorized` callback
- Защита: `requireAuth()` и `requireAdmin()` helpers
- UI: `/auth` (формы), `/account` (кабинет с выходом)
- В хедере: динамические ссылки в зависимости от сессии

## WP posts для SEO/описаний
- Источник: `wp_posts` (файл `kpkp_wp2print_table_wp_posts.json`).
- Фильтр: `post_type = "product"`, `post_status = "publish"`.
- Маппинг в `Product`:
  - `post_name` → `slug`
  - `post_title` → `name`
  - `post_excerpt` → `excerpt`
  - `post_content` → `description`
- В админке `/admin/products/[id]` есть форма для сохранения `WP ID` (обновляет витрину через revalidate).
