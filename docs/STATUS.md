# Статус проекта

Дата: 2026-02-04
Версия: 0.2.5

## База данных и Prisma
- PostgreSQL 16 для dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: `User` (с UserRole), `Account`, `Session`, `VerificationToken` (NextAuth) + каталог `Category`, `Product`, `ProductImage`, enum `PriceType`, а также WP-таблицы для матриц (включая флаг видимости `WpMatrixType.isActive`).
- E-commerce модели: `Cart`, `CartItem`, `Order`, `OrderItem` с enum `OrderStatus`.
- Пользовательские данные: `CompanyProfile` (B2B) и `UserAddress` (адреса).
- Новые модели:
  - `OrderAsset` (файлы к заказу) + enums `OrderAssetKind`, `OrderAssetStatus`, `OrderAssetStorageProvider`.
  - `NotificationLog` + enums `NotificationType`, `NotificationStatus`.
- Миграции:
  - `20260117195653_add_category_product_productimage`
  - `20260124190528_add_show_in_b2b_b2c`
  - `20260125181055_add_nextauth_support` — NextAuth v5
  - `20260125222322_add_cart_and_orders` — корзина и заказы
  - `20260126_add_top_products` — Top produkty для главной страницы
  - `20260126_add_order_assets_notifications` — ассеты заказов и лог уведомлений
  - `20260201184836_add_pdf_generation` — настройки генерации PDF-счетов
- Prisma Client генерируется в `lib/generated/prisma`, используется `@prisma/adapter-pg` + `pg` (`lib/prisma.ts`).
- Сидинг: `npm run db:seed` (читает `data/*`).
- Health-check: `app/api/health/route.ts` (SELECT 1).
- Флаги видимости: `showInB2b` и `showInB2c` в Product и Category

## Каталог (DB-backed)
- Страницы `/kategorie`, `/catalog`, `/product/[slug]` читают данные из Postgres через `lib/catalog.ts`.
- Фильтр по категории: `/catalog?cat=<slug>` (родитель выбирает товары из подкатегорий).
- Поиск/сортировка/пагинация каталога выполняются на сервере: `?q=...&sort=...&page=...`.
- Продукт без slug → 404.
- `/kategorie` группирует категории по родителям и показывает подкатегории отдельными карточками.
- `catalog` и `product/[slug]` обернуты в `<Suspense>` для устранения blocking-route по `searchParams/params`.
- Данные для витрины сериализуются (Decimal → string) перед передачей в клиентские компоненты.
- Для товаров без калькулятора (нет матриц цен) на `/product/[slug]` используется простой фолбэк: только ввод количества (`Množstvo kusov`), без статических опций и без блока «Objemové zľavy».

## Админка
Маршруты:
- `/admin` — дашборд с реальной статистикой (Recharts + Prisma Aggregations).
- `/admin/products` — улучшенный список товаров (TanStack Table).
  - Колонки: Изображение, Цена (отформатированная), Варианты видимости (B2B/B2C/Hidden), Статистика продаж.
  - Фильтры: Категория, Статус, Поиск.
  - Действия: Просмотр на сайте, Редактирование, Удаление.
- `/admin/products/[id]` — карточка товара + матрицы цен.
  - Редактирование: Категория (native select), Изображение (URL preview), Видимость (Checkboxes).
- `/admin/orders` — список всех заказов.
- `/admin/orders/[orderId]` — детали заказа с изменением статуса.
  - Список файлов заказа + скачивание
- `/admin/kategorie` — настройки категорий.
- `/admin/vlastnosti` — свойства (атрибуты).
- `/admin/vlastnosti/[attributeId]` — значения свойства.
- `/admin/top-products` — управление блоком Top produkty на главной (B2B/B2C).

Что реализовано:
- Дашборд: График выручки по месяцам, счетчики заказов (всего/новых/активных пользователей), топ продукты.
- Список товаров: Полный редизайн таблицы, добавлены превью изображений, форматирование цен, бейджи статусов.
- Карточка товара: Добавлена возможность смены категории и установки главного изображения по URL.
- Поиск и фильтры в списке товаров (`q`, `status`, `category`) с синхронизацией в URL.
- Сохранение карточки товара (название, slug, описания, цена от, DPH, категория, изображение).
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
- Управление заказами:
  - Список всех заказов с фильтрацией и статусами.
  - Детальный просмотр заказа (товары, контакты, сумма).
  - Изменение статуса заказа (PENDING → CONFIRMED → PROCESSING → COMPLETED / CANCELLED).
  - Отображение связанного пользовательского аккаунта.
  - Список файлов заказа + скачивание (presigned GET).
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
- Cache Components выключены (`cacheComponents: false`).
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
- Добавлена карусель (shadcn/ui + Embla) с автоплеем и высотой
- Блок «Top produkty pre online tlač»:
  - Отображается в обоих режимах (B2B/B2C) с отдельной конфигурацией для каждого.
  - Показывает 8 товаров в виде сетки 2 строки × 4 колонки.
  - Три режима выбора товаров (настройка в `/admin/top-products`):
    - Рандомно из всех активных товаров
    - Рандомно из выбранных категорий
    - Ручной выбор товаров (с дополнением случайными)
  - Включает изображения товаров, название, цену и краткое описание при hover.
  - Клиентский компонент с loading states и обработкой ошибок. 592px.
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

## Stripe интеграция (платежи)
- **Payment Intents API** — создание платёжного намерения для каждого заказа
- **Stripe Elements** — встроенные компоненты для ввода карты (`@stripe/react-stripe-js`)
- **Ленивая загрузка SDK** — Stripe SDK загружается только при выборе оплаты картой
- **Webhook-обработка** — `POST /api/stripe/webhook` обрабатывает события:
  - `payment_intent.succeeded` — оплата прошла
  - `payment_intent.payment_failed` — ошибка оплаты
  - `checkout.session.completed` — сессия завершена
  - `checkout.session.expired` — сессия истекла
- **Идемпотентность** — события Stripe логируются в `StripeEvent` для защиты от дублей
- **Автоматическое обновление заказа** — при успешной оплате статус меняется на CONFIRMED
- **Очистка корзины** — происходит только после подтверждённой оплаты (на странице success)

### API Routes (Stripe):
- `POST /api/stripe/payment-intent` — создание PaymentIntent для заказа
- `POST /api/stripe/checkout-session` — альтернативный Checkout Session flow
- `POST /api/stripe/webhook` — обработка событий от Stripe

### Переменные окружения:
```env
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Оптимизации производительности (02.02.2026)
### Кэширование
- **Homepage API** — `/api/top-products` кэшируется 60 секунд (`next: { revalidate: 60 }`)
- **Навигация** — данные категорий и товаров для меню кэшируются через `unstable_cache` (5 минут)
 - **Хедер** — выборка товаров для меню ограничена (по 6 на подкатегорию или 12 на категорию без подкатегорий)

### Изображения
- Все `<img>` заменены на `<Image>` из `next/image` с оптимизацией
- Добавлены `sizes` для responsive images
- Настроены `remotePatterns` для внешних доменов (unsplash)

### Статическая генерация
- Добавлен `generateStaticParams` для `/product/[slug]` — первые 100 товаров
- Уменьшение TTFB за счёт ISR

### Каталог
- Серверная пагинация/поиск/сортировка сокращают payload и ускоряют гидратацию

### CSS
- Удалён тяжёлый SVG noise filter (feTurbulence) из `globals.css`

### Stripe SDK
- Ленивая загрузка — SDK грузится только при выборе "Platba kartou"
- Использование `useRef` для предотвращения дублирования инициализации

### Защита от race condition (checkout)
- `isPreparingRef` предотвращает двойные вызовы `preparePayment`
- Проверка `orderId` исключает повторное создание заказа

## Пользователи и аутентификация (NextAuth v5)
- Модели Prisma: `User` (с role), `Account`, `Session`, `VerificationToken`
- Провайдеры: Nodemailer (magic links), Credentials (пароли)
- Magic links: NextAuth `signIn("nodemailer")` с SMTP
- Пароли: scrypt hash, установка через `/api/account/set-password`
- JWT сессии с поддержкой `role` в токене
- Middleware: `proxy.ts` с проверкой `authorized` callback
- Защита: `requireAuth()` и `requireAdmin()` helpers
- UI: `/auth` (формы), `/account` (кабинет с боковым меню)
- Личный кабинет:
  - Стандартное боковое меню (без collapsible sidebar)
  - Навигация: Домов, Мой účet, Objednávky, Nastavenia
  - Кнопка выхода в футере меню
- В хедере: динамические ссылки в зависимости от сессии + badge корзины

## Корзина и заказы
### Модели данных:
- `Cart` — корзина (привязка через `userId` или `sessionId` для гостей)
- `CartItem` — позиция в корзине (товар + размеры + опции + цена)
- `Order` — заказ со статусом (PENDING, CONFIRMED, PROCESSING, COMPLETED, CANCELLED)
- `OrderItem` — позиция заказа (сохраненная копия товара и цен)

### Server Actions (lib/cart.ts):
- `getOrCreateCart()` — получение/создание корзины для пользователя или гостя
- `addToCart()` — добавление товара (с проверкой дубликатов по параметрам)
- `updateCartItem()` — изменение количества
- `removeFromCart()` — удаление позиции
- `clearCart()` — очистка корзины
- `getCart()` — получение корзины с подсчетом итогов
- `mergeGuestCart()` — перенос гостевой корзины при входе

### Server Actions (lib/orders.ts):
- `createOrder()` — создание заказа с **обязательным серверным пересчетом** всех цен
- `getUserOrders()` — список заказов пользователя
- `getOrderById()` — детали заказа
- `getOrderByNumber()` — поиск по номеру заказа
- Все Decimal поля сериализуются в number для Client Components

### Уведомления
- `NotificationService` отправляет письма: order created, status changed, artwork uploaded.
- Идемпотентность обеспечена таблицей `NotificationLog` (уникальный ключ по событию/заказу/получателю).

### API Routes:
- `GET /api/cart` — получение корзины
- `POST /api/cart/add` — добавление товара
- `PATCH /api/cart/[itemId]` — обновление количества
- `DELETE /api/cart/[itemId]` — удаление товара
- `POST /api/cart/clear` — очистка корзины
- `POST /api/checkout` — создание заказа
- `GET /api/orders` — список заказов пользователя
- `GET /api/orders/[orderId]` — детали заказа
- `PATCH /api/admin/orders/[orderId]/status` — изменение статуса (только ADMIN)
- `POST /api/uploads/presign` — presigned PUT для загрузки файла
- `POST /api/uploads/confirm` — подтверждение загрузки (HEAD)
- `GET /api/orders/[orderId]/assets` — список файлов заказа
- `GET /api/assets/[assetId]/download` — 302 redirect на presigned GET

### Защита API (корзина/checkout):
- CSRF: unsafe запросы на `/api/cart/*` и `/api/checkout` требуют `X-CSRF-Token` (cookie `pe_csrf`), проверяется в `proxy.ts`.
- Anti-spam: `POST /api/checkout` rate limited (5/15мин на IP), 429 + `Retry-After`.

### PDF-счета (Faktúry):
- `GET /api/orders/[orderId]/invoice` — скачивание PDF-счёта
- `POST /api/orders/[orderId]/invoice/send` — генерация и отправка на email (ADMIN)
- `GET /api/admin/settings/pdf` — настройки PDF
- `PUT /api/admin/settings/pdf` — обновление настроек PDF

### UI Страницы:
- `/cart` — корзина с управлением количеством и удалением
- `/checkout` — форма оформления заказа
- `/account/orders` — список заказов пользователя
- `/account/orders/[orderId]` — детали заказа с success alert
  - Блок “Nahrať grafiku” + список файлов + скачивание

### Компоненты:
- `cart-button.tsx` — badge в хедере с количеством товаров
- `cart-content.tsx` — отображение корзины
- `checkout-form.tsx` — форма чекаута с валидацией
- `orders-list.tsx` — список заказов
- `order-detail.tsx` — детали заказа
- `admin-orders-list.tsx` — список заказов в админке
- `admin-order-detail.tsx` — детали заказа с изменением статуса и отправкой счетов

## Генерация PDF-счетов (Faktúry)
- Технология: `@react-pdf/renderer`
- Настройки хранятся в `ShopSettings.pdfSettings` (JSON)
- Модуль: `lib/pdf/` (template, generate, settings, types)
- Функции:
  - Автоматическая генерация при смене статуса заказа
  - Ручная генерация и отправка администратором
  - Скачивание клиентом в личном кабинете
- Хранение: S3 (через `OrderAsset` с `kind: INVOICE`)
- Отправка email: Nodemailer с PDF-вложением
- UI настроек: `/admin/settings` → таб "PDF / Faktúry"
- Шаблон: словацкий формат, данные компании, банковские реквизиты, подпись
- Документация: `docs/PDF_INVOICES.md`

### Интеграция с товарами:
- Страница товара `/product/[slug]`: обе кнопки калькулятора добавляют товар в корзину
- После добавления — автоматический переход на `/cart`
- Badge корзины обновляется через `window.dispatchEvent("cart-updated")`
- Кнопка “Nahrať grafiku a objednať” позволяет выбрать файл, который отображается в корзине и загружается после оформления заказа

### Ключевые особенности:
- **Серверный пересчет цен**: при создании заказа все цены пересчитываются заново через `lib/pricing.ts`
- **PriceSnapshot**: цены сохраняются в корзине для UI, но при checkout пересчитываются
- **Audience сохраняется**: режим B2B/B2C фиксируется в заказе
- **Гостевые корзины**: поддержка через sessionId cookie
- **Decimal → number**: все Prisma Decimal поля конвертируются перед передачей в клиент
- **Type safety**: замена `any` на `unknown`/`JsonValue` для Prisma JSON полей

## WP posts для SEO/описаний
- Источник: `wp_posts` (файл `kpkp_wp2print_table_wp_posts.json`).
- Фильтр: `post_type = "product"`, `post_status = "publish"`.
- Маппинг в `Product`:
  - `post_name` → `slug`
  - `post_title` → `name`
  - `post_excerpt` → `excerpt`
  - `post_content` → `description`
- В админке `/admin/products/[id]` есть форма для сохранения `WP ID` (обновляет витрину через revalidate).

## Следующие шаги
- [x] Интеграция платежных систем → **реализовано (Stripe)**
- [ ] Роли/права доступа — пока **отложен**
- [ ] Генерация расчёта стоимости корзины (quote/estimate) в PDF
