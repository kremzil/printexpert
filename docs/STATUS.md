# Статус проекта

Дата: 2026-02-21
Версия: 0.3.3

## SEO и индексация (обновлено 21.02.2026)
- Централизация SEO-конфигурации в `lib/seo.ts`:
  - `ROOT_METADATA` для глобальных `metadataBase/title/openGraph/twitter/robots`.
  - `SEO_PAGES` + `buildStaticPageMetadata(...)` для статических страниц.
  - `NOINDEX_ROBOTS` для служебных зон.
- Подключены page-level metadata на ключевых страницах витрины и legal.
- Динамическая мета работает для:
  - `/product/[slug]` (включая OG/Twitter параметры шаринга),
  - `/kategorie/[slug]`,
  - `/kolekcie/[slug]`,
  - `/catalog` (canonical и переход на SEO URL категории).
- Включены SEO endpoints:
  - `/robots.txt` (`app/robots.ts`),
  - `/sitemap.xml` (`app/sitemap.ts`, включая товары/категории/коллекции),
  - `/llms.txt` (`app/llms.txt/route.ts`, генерация из публичного контента: whitelist статических публичных страниц + активные категории/коллекции/товары; ответ кэшируется через `Cache-Control` и использует data-cache `unstable_cache` в `lib/catalog.ts`).
- Для `auth/account/checkout/admin/cart/dashboard` применён `noindex`.
- Для товаров, скрытых для текущей аудитории, страница `/product/[slug]` может быть доступна по прямому URL; сейчас `robots/canonical` остаются стандартными (авто-`noindex` для этого кейса не включён).
- Подробная карта SEO-настроек: `docs/SEO.md`.

## База данных и Prisma
- PostgreSQL 16 для dev через `docker-compose.yml` (контейнер `shop-db`).
- Prisma schema: `User` (с UserRole), `Account`, `Session`, `VerificationToken` (NextAuth) + каталог `Category`, `Product`, `ProductImage`, enum `PriceType`, а также WP-таблицы для матриц (включая флаг видимости `WpMatrixType.isActive`).
- E-commerce модели: `Cart`, `CartItem`, `Order`, `OrderItem` с enum `OrderStatus`.
- Пользовательские данные: `CompanyProfile` (B2B) и `UserAddress` (адреса).
- Новые модели:
  - `OrderAsset` (файлы к заказу) + enums `OrderAssetKind`, `OrderAssetStatus`, `OrderAssetStorageProvider`.
  - `NotificationLog` + enums `NotificationType`, `NotificationStatus`.
  - `DesignCanvasProfile` — профили canvas для Design Studio (привязка к `Product` и значению `Veľkosť`).
  - `DesignTemplate` — шаблоны дизайнов (JSON, привязка к `Product` и `DesignCanvasProfile`, поддержка `pages`).
  - `OrderStatusHistory` — история изменений статуса заказа (связь с `User` кто изменил).
  - `SavedCart`, `SavedCartItem` — сохранённые корзины (для B2B клиентов).
  - `StripeEvent` — логирование событий Stripe для идемпотентности.
  - `ShopSettings` — настройки магазина (НДС, PDF-счета).
  - `RateLimitEntry` — rate limiting через PostgreSQL.
- Prisma Client генерируется в `lib/generated/prisma`, используется `@prisma/adapter-pg` + `pg` (`lib/prisma.ts`).
- Сидинг: `npm run db:seed` (читает `data/*`).
- Health-check: `app/api/health/route.ts` (SELECT 1).
- Флаги видимости: `showInB2b` и `showInB2c` в Product и Category
- Поля Design Studio в `Product`: `designerEnabled` + legacy-поля `designerWidth`, `designerHeight`, `designerBgColor`, `designerDpi`, `designerColorProfile` (read-compat).
- Добавлено поле `Product.priceAfterDiscountFrom` (ручная скидочная цена "od", `Cena po zľave od` в админке).

## Каталог (DB-backed)
- Страницы `/kategorie`, `/catalog`, `/product/[slug]` читают данные из Postgres через `lib/catalog.ts`.
- Фильтр по категории: `/catalog?cat=<slug>` (родитель выбирает товары из подкатегорий).
- Поиск/сортировка/пагинация каталога выполняются на сервере: `?q=...&sort=...&page=...`.
- Продукт без slug → 404.
- `/kategorie` группирует категории по родителям и показывает подкатегории отдельными карточками.
- `catalog` и `product/[slug]` обернуты в `<Suspense>` для устранения blocking-route по `searchParams/params`.
- Данные для витрины сериализуются (Decimal → string) перед передачей в клиентские компоненты.
- Для товаров без калькулятора (нет матриц цен) на `/product/[slug]` используется простой фолбэк: выбор количества (`Množstvo kusov`) и цена из `priceAfterDiscountFrom ?? priceFrom`, умноженная на количество, без блока «Objemové zľavy».
- Для товаров без матриц на странице товара не показывается блок загрузки «Nahrajte podklady», а в корзине для таких позиций не показывается действие «Nahrať súbor».
- Карточка товара поддерживает скидочную цену: при `priceAfterDiscountFrom < priceFrom` показываются новая цена, зачёркнутая старая и бейдж `ZĽAVA -X%`.
- Для товаров с калькулятором блок `Objemové zľavy` на `/product/[slug]` показывается только при `useQuantitySelect` (количество из breakpoints базовой матрицы: `numStyle=1`, `ntp=0` и есть breakpoints).
- В таблице `Objemové zľavy` добавлена колонка `Zľava/ks`: процент удешевления за единицу относительно первого брейкпоинта (первой строки таблицы).
- В конфигураторе товара добавлена `Rýchlosť výroby`:
  - `Štandardná (do 5 dní)` — `0%`
  - `Zrýchlene (do 2 dní)` — `+30%`
  Надбавка применяется в UI-предпросмотре и подтверждается серверным пересчётом.
- На странице товара добавлено `Display Shipment date` с меткой `U Vás na adrese`:
  - исключаются выходные (сб/вс)
  - cutoff: `13:00:00` локального времени (`Europe/Bratislava`); `13:00:00` включительно остаётся текущий день, перенос начинается с `13:01`
  - пятница после cutoff (начиная с `13:01`) переносится на понедельник
  - государственные праздники сейчас не учитываются (учитываются только сб/вс)
  - таймзона `Europe/Bratislava`
  - к сроку производства добавляется `+1` день доставки
- **Design Studio** — встроенный canvas-редактор дизайна на странице товара:
  - Включается чекбоксом `designerEnabled` в настройках товара (админка).
  - Кнопка «Otvoriť dizajnér» показывается только если для выбранного `Veľkosť` найден активный `DesignCanvasProfile`.
  - Полноэкранный редактор поддерживает bleed/safe зоны, единицы в мм и многостраничный дизайн.
  - Поддержка шаблонов (встроенные + из БД `DesignTemplate`), включая многостраничные шаблоны (`pages`).
  - В админке на уровне профиля canvas доступны: SVG import, создание пустых шаблонов на N страниц, выбор default-шаблона профиля.

## Маршрутизация и layout
- Витрина и админка разделены на route groups:
  - `app/(site)` — публичная часть с хедером/футером.
  - `app/(admin)/admin` — админская часть без хедера/футера витрины.
- `app/layout.tsx` оставлен как корневой (html/body + шрифты), без логики определения маршрута.

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
  - История изменений статуса (OrderStatusHistory)
  - Генерация и отправка PDF-счетов
- `/admin/kategorie` — настройки категорий.
- `/admin/vlastnosti` — свойства (атрибуты).
- `/admin/vlastnosti/[attributeId]` — значения свойства.
- `/admin/top-products` — управление блоком Top produkty на главной (B2B/B2C).
- `/admin/users` — управление пользователями (список, смена роли USER/ADMIN).
- `/admin/settings` — добавлена ручная кнопка «Obnoviť cache» для регенерации навигации и категорий.

Что реализовано:
- Дашборд: График выручки по месяцам, счетчики заказов (всего/новых/активных пользователей), топ продукты.
- Список товаров: Полный редизайн таблицы, добавлены превью изображений, форматирование цен, бейджи статусов.
- Карточка товара: Добавлена возможность смены категории и установки главного изображения по URL.
- Поиск и фильтры в списке товаров (`q`, `status`, `category`) с синхронизацией в URL.
- Сохранение карточки товара (название, slug, описания, цена от, DPH, категория, изображение).
- WYSIWYG редактор (Tiptap) для детального описания с сохранением HTML и серверной очисткой.
- Встроенный редактор заголовка/slug в карточке товара без постоянных инпутов.
- WYSIWYG редактор для краткого описания.
- Вставка медиа (URL + загрузка файлов) в редакторы/коллекции, сохранение в `/public/uploads` только для публичного контента (описания и изображения коллекций); upload whitelist ограничен изображениями/видео (без произвольных типов файлов), ссылки в HTML допускаются только `https://` и `/uploads/`; клиентские файлы заказов и инвойсы хранятся через `OrderAsset` в S3.
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
  - Credentials (пароли с scrypt)
- JWT сессии (30 дней)
- Middleware защита:
  - `/admin/*` → только ADMIN
  - `/account/*` → требуется авторизация
- Server actions защищены через `requireAdmin()`:
  - `updateProductDetails`, `deleteMatrix`, `createMatrix`, `createCategory`
  - `deleteCategory`, `updateCategory`, `createAttribute`, `deleteAttribute`
- API шаблонов Design Studio защищён через `requireAdmin()`
- Upload API требует активную сессию
- Первый администратор назначается вручную через Prisma Studio

## Наблюдаемость и алерты (обновлено 19.02.2026)
- Внедрён structured logging на базе `pino`:
  - `lib/observability/logger.ts` (redaction + env-настройка),
  - `lib/observability/events.ts` (taxonomy событий),
  - `lib/request-utils.ts` (`requestId`, `ipHash`, `getClientIp`).
- Для API-хендлеров используется `withObservedRoute(routeId, handler)`:
  - покрыты все route-файлы в `app/api` (48 файлов, 58 handler-экспортов).
  - каждое обращение логируется как `http.request.completed` со статусом/латентностью.
- Security-события:
  - `proxy.ts` пишет `security.origin_blocked` и `security.csrf_blocked`,
  - rate-limit denial фиксируется как `security.rate_limit_denied` (в т.ч. auth/contact/price/checkout/quote-request).
- Auth-события в `auth.ts`:
  - `auth.login_attempt`,
  - `auth.login_failed`,
  - `auth.login_success`.
- Глобальные ошибки:
  - сервер: `instrumentation.ts` (`server.unhandled_error`),
  - клиент: `app/global-error.tsx` + `POST /api/client-error` (`client.unhandled_error`).
- Политика данных логов:
  - raw IP не логируется, используется `ipHash`,
  - редактируются чувствительные поля (`authorization`, cookies, tokens, secrets, password fields).
- Production monitoring stack в `docker-compose.prod.yml`:
  - `loki`, `promtail`, `grafana`,
  - для `web` зафиксирован `logging.driver: json-file` + ротация (`max-size`, `max-file`),
  - alert rules provisioning в `ops/grafana/provisioning/alerting/*`.
- Подробно: `docs/OBSERVABILITY_LOGGING.md`.

## WP-матрицы и калькулятор
- Таблицы: `WpMatrixType`, `WpMatrixPrice`, `WpTerm`, `WpTermTaxonomy`, `WpTermRelationship`, `WpTermMeta`, `WpAttributeTaxonomy`.
- Импорт JSON → DB: `scripts/import-wp-calculator-tables.js`.
- Логика парсинга и данных матриц: `lib/wp-calculator.ts`.
- Привязка WP продукта через `Product.wpProductId`.
- Кэширование данных матриц и каталога: `unstable_cache` с гранулярными тегами (см. `lib/cache-tags.ts`).
- Серверный расчёт цены: `lib/pricing.ts` (единый источник истины).
- Endpoint для пересчёта цены: `POST /api/price` (возвращает `net/vat/gross`).
- Скорость производства хранится в `selectedOptions._productionSpeed` и передается
  в `calculate(...)` как `productionSpeedPercent`.
- Для старых записей без `_productionSpeed` используется `0`.
- Поддержка внутренних матриц `PricingModel/PricingEntry` для расчёта (без `wpProductId`).
- Для `priceType=FIXED` и для fallback без матриц (`PricingModel` отсутствуют) сервер считает цену как `(priceAfterDiscountFrom ?? priceFrom) * quantity`.

## Кэш и revalidate
- Cache Components выключены (`cacheComponents: false`).
- Все теги и хелперы инвалидации вынесены в `lib/cache-tags.ts`.
- Используется `unstable_cache` с гранулярными тегами:
  - `catalog:categories` — список категорий.
  - `catalog:products` — списки товаров (каталог, поиск).
  - `catalog:counts` — счётчики товаров по категориям.
  - `catalog:related` — блоки related products (TTL 1 час).
  - `catalog:calculators` — бланкетный тег для всех калькуляторов.
  - `product:{slug}` — данные одного товара (per-entity).
  - `calculator:{id}` — калькулятор/матрицы одного товара (per-entity, TTL 1 час).
  - `top-products` — виджет «Топ-товары».
  - `nav-data` — навигация в хедере.
  - `shop-settings` — настройки магазина (TTL 5 мин), покрывает и `getShopSettings()`, и `getPdfSettings()`.
- Хелперы инвалидации (server actions вызывают эти функции):
  - `invalidateProduct(slug, productId?)` — точечно: один товар + списки + калькулятор.
  - `invalidateCalculator(productId)` — только калькулятор одного товара.
  - `invalidateCategories()` — категории + зависимые списки + навигация.
  - `invalidateAllCatalog()` — полный сброс (для импорта, ручной кнопки).
- Ручная регенерация для навигации/категорий доступна в `/admin/settings`.
- `updateProductDetails` при смене `categoryId`, `isActive`, `showInB2b` или `showInB2c` дополнительно вызывает `invalidateCategories()` + `revalidatePath("/kategorie")` + `revalidatePath("/catalog")` — страховка для клиентского Router Cache/префетченных страниц при смене видимости и категорий.
- Важно: `AudienceContext` использует динамические источники (`searchParams`, `cookies()`), поэтому он резолвится в page/route, а в `unstable_cache` передаётся уже готовый `audience`.
- `getProducts` и связанные листинги учитывают `showInB2b`/`showInB2c`; текущая реализация `/product/[slug]` прямой URL не блокирует по audience (visibility = скрытие из списков, не access-control).

## AudienceContext (B2B/B2C)
- Добавлен единый серверный резолвер с приоритетами `query → account (stub) → cookie → default`.
- `?mode=b2b|b2c` сохраняется в cookie через `proxy.ts` (бывший middleware).
- Используется в RSC и API: витрина `/product/[slug]` показывает `bez DPH/s DPH`, API возвращает `x-audience`/`x-audience-source`.
- Серверный расчёт цены учитывает `AudienceContext` и возвращает `PriceResult`.
- Навигация в хедере зависит от аудитории:
  - если у категории есть подкатегории, в меню показываются только подкатегории;
  - если подкатегорий нет, показываются товары категории (как раньше);
  - ссылки подкатегорий и «Všetky ...» ведут в каталог с фильтром `/catalog?cat=<slug>`.
- **Выбор режима (первое посещение):**
  - При `source === "default"` на главной отображается `ModeSelectionPage` с карточками B2C/B2B.
  - Выбор режима: `POST /api/audience` сохраняет cookie, затем `router.replace` на главную с `?mode=`.
  - **Transition overlay** — анимированная заставка при переключении режима:
    - Цвет фона зависит от выбранного режима (`--b2c-primary` / `--b2b-primary`).
    - Анимация: fade-in → обводка контура логотипа SVG-лучом с пульсацией → morph в цветной логотип → fade-out.
    - Фазы: `enter` (400ms) → `draw` (2000ms) → `morph` (600ms) → `exit` (1000ms), итого ~4 секунды.
    - Текст «Pripravujeme ponuku pre vás...» с пульсирующей анимацией, размещён под логотипом.
    - `window.scrollTo({ top: 0, behavior: "smooth" })` при появлении оверлея.
    - Поддержка `prefers-reduced-motion`: все анимации отключаются.
  - **Архитектура оверлея:**
    - `lib/mode-overlay-store.ts` — module-level store (`useSyncExternalStore`) для состояния оверлея.
    - `components/print/mode-overlay-provider.tsx` — `ModeOverlayPortal` (standalone client component, не обёртка).
    - Портал размещён как сиблинг в `app/(site)/layout.tsx` — не оборачивает серверные компоненты, исключая hydration mismatch.
    - Навигация запускается параллельно с анимацией — страница грузится под оверлеем (`z-index: 9999`).

## Главная страница
- Главная использует `components/print/homepage.tsx`, подготовка данных вынесена в `lib/homepage-model.ts`.
- Добавлена карусель (shadcn/ui + Embla) с автоплеем и высотой.
- Блок «Top produkty pre online tlač»:
  - Отображается в обоих режимах (B2B/B2C) с отдельной конфигурацией для каждого.
  - Показывает 8 товаров в виде сетки 2 строки × 4 колонки.
  - Ручной выбор товаров (настройка в `/admin/top-products`).
  - Включает изображения товаров, название, цену и краткое описание при hover.
- B2B-слайды используют изображения из `/public/homepage/b2b`.

## Контакты
- Форма обратной связи (если включена): `/api/contact`.
- Валидация: Zod.
- Защита: honeypot + rate limit.
- B2B dopyt na cenovú ponuku (письмо менеджеру): `POST /api/quote-request`.
  - Источник: кнопки `Cenová ponuka` в карточке товара и на странице товара.
  - UI: индикатор рядом с корзиной (только B2B, появляется после первого товара) + `Sheet` со списком и формой.
  - Хранение на клиенте: `localStorage` (`printexpert_quote_request_v1`, `printexpert_quote_contact_v1`).
  - Валидация/защита: Zod + honeypot + rate limit.

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
- `docker-compose.prod.yml` поднимает `db`, `web`, `loki`, `promtail`, `grafana`.
- `Dockerfile` для production Next.js (standalone), `next.config.ts` с `output: "standalone"`.
- Пример env: `.env.production.example`.
- ESLint игнорирует сгенерированные Prisma файлы и служебные скрипты.
- Acceptance-критерий стабильности сборки: `npm run build` должен успешно завершаться при недоступной БД (например, с невалидным `DATABASE_URL`).
- Для этого в `generateMetadata` на маршрутах `/product/[slug]` и `/kolekcie/[slug]` добавлен fail-safe fallback; build-этап отделён от runtime-проверок БД (health/migrations выполняются после деплоя).

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
- **Серверная консистентность цен** — при создании Stripe-сессий/интентов пересчёт
  учитывает `productionSpeedPercent` из `selectedOptions._productionSpeed`

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
- **Товар по slug** — `unstable_cache` с тегом `product:{slug}` (без TTL, точечная инвалидация).
- **Калькулятор** — `unstable_cache` с тегом `calculator:{id}` (TTL 1 час, точечная инвалидация).
- **Top produkty** — кэширование по тегу `top-products` (без TTL, ревалидация по изменению).
- **Навигация** — данные категорий и меню кэшируются по тегу `nav-data` (без TTL).
- **Категории/счётчики** — кэшируются по тегам `catalog:categories` / `catalog:counts` (без TTL).
- **Related products** — кэшируются по тегу `catalog:related` (TTL 1 час).
- **Хедер** — выборка товаров для меню выполняется только для категорий без подкатегорий (до 12 товаров).

### Изображения
- Все `<img>` заменены на `<Image>` из `next/image` с оптимизацией
- Добавлены `sizes` для responsive images
- Настроены `remotePatterns` для внешних доменов (unsplash)

### Статическая генерация
- Добавлен `generateStaticParams` для `/product/[slug]` — known routes по всем активным товарам.
- `/product/[slug]` остаётся dynamic route из-за `AudienceContext` (`searchParams` + `cookies()`), поэтому Full Route ISR не является источником ускорения TTFB.
- TTFB снижен за счёт data-cache (`unstable_cache`) и гранулярных cache-тегов; `generateStaticParams` используется для покрытия известных slug.

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
  - Навигация: Domov, Objednávky, Uložené košíky (B2B), Nastavenia
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
- `POST /api/quote-request` — отправка B2B dopytu на цену менеджеру
- `GET /api/orders` — список заказов пользователя
- `GET /api/orders/[orderId]` — детали заказа
- `PATCH /api/admin/orders/[orderId]/status` — изменение статуса (только ADMIN)
- `POST /api/uploads/presign` — presigned PUT для загрузки файла
- `POST /api/uploads/confirm` — подтверждение загрузки (HEAD)
- `GET /api/orders/[orderId]/assets` — список файлов заказа
- `GET /api/assets/[assetId]/download` — 302 redirect на presigned GET

### Защита API (корзина/checkout):
- CSRF: все unsafe запросы на `/api/*` требуют `X-CSRF-Token` (cookie `pe_csrf`), проверяется в `proxy.ts`.
- Явные исключения из double-submit CSRF: `/api/auth/*` и `/api/stripe/webhook`.
- Реестр исключений хранится в `lib/csrf.ts` (`CSRF_EXCLUDED_API_PREFIXES`).
- Anti-spam: `POST /api/checkout` rate limited (5/15мин на IP), 429 + `Retry-After`.
- Anti-spam: `POST /api/quote-request` rate limited (5/15мин на IP), 429 + `Retry-After`.

### PDF-счета (Faktúry):
- `GET /api/orders/[orderId]/invoice` — скачивание уже созданного PDF-счёта (ADMIN)
- `POST /api/orders/[orderId]/invoice/send` — генерация и отправка на email (ADMIN)
- `GET /api/admin/settings/pdf` — настройки PDF
- `PUT /api/admin/settings/pdf` — обновление настроек PDF

### DPD:
- `GET/PUT /api/admin/settings/dpd` — настройки DPD
- `POST /api/admin/orders/[orderId]/dpd/shipment` — создать shipment
- `POST /api/admin/orders/[orderId]/dpd/labels` — печать labels
- `POST /api/admin/orders/[orderId]/dpd/cancel` — отмена shipment
- checkout использует `GET /api/shop-settings` для DPD widget и payment settings

### UI Страницы:
- `/cart` — корзина с управлением количеством и удалением
- `/checkout` — форма оформления заказа
- `/account/orders` — список заказов пользователя
- `/account/orders/[orderId]` — детали заказа с success alert
  - Блок “Nahrať grafiku” + список файлов + скачивание

### Компоненты:
- `cart-button.tsx` — badge в хедере с количеством товаров
- `quote-request-button.tsx` — B2B индикатор dopytu с `Sheet` (список товаров + форма отправки)
- `cart-content.tsx` — отображение корзины
- `checkout-form.tsx` — форма чекаута с валидацией
- `orders-list.tsx` — список заказов
- `order-detail.tsx` — детали заказа
- `admin-orders-list.tsx` — список заказов в админке
- `admin-order-detail.tsx` — детали заказа с изменением статуса и отправкой счетов

## Генерация PDF-счетов (Faktúry)
- Технология: `@react-pdf/renderer`
- Настройки хранятся в `ShopSettings.pdfSettings` (JSON)
- `getPdfSettings()` обёрнут в `unstable_cache` с тегом `shop-settings` (TTL 5 мин), инвалидируется вместе с НДС.
- `updatePdfSettings()` вызывает `revalidateTag(TAGS.SHOP_SETTINGS)` — новые настройки применяются сразу.
- Модуль: `lib/pdf/` (template, generate, settings, types)
- Функции:
  - Автоматическая генерация при смене статуса заказа
  - Ручная генерация и отправка администратором
  - Скачивание клиентом в личном кабинете
- Хранение: S3 (через `OrderAsset` с `kind: INVOICE`)
- Отправка email: Nodemailer с PDF-вложением
- UI настроек: `/admin/settings` → таб "PDF / Faktúry"
- Шаблон: словацкий формат, данные компании, банковские реквизиты, подпись
- **Cenová ponuka (B2B, PDF из корзины):** Предварительный расчёт цены
  - API: `GET /api/cart/quote`
  - Кнопка в корзине для B2B пользователей
  - Подробная таблица с конфигурацией каждого товара
- **B2B dopyt na cenovú ponuku (email менеджеру):**
  - API: `POST /api/quote-request`
  - Список собирается из карточек/страницы товара, отправка через `Sheet` в хедере
- Документация: `docs/PDF_INVOICES.md`

### Интеграция с товарами:
- Страница товара `/product/[slug]`: `Pridať do košíka` добавляет товар в корзину и переводит на `/cart`.
- Страница товара `/product/[slug]` (B2B): `Cenová ponuka` добавляет текущую конфигурацию в список dopytu.
- Карточка товара (B2B): `Cenová ponuka` добавляет товар в список dopytu без дублей (dedupe по `slug`).
- Badge корзины обновляется через `window.dispatchEvent("cart-updated")`
- Badge dopytu обновляется через `window.dispatchEvent("quote-request-updated")`
- После успешного `POST /api/quote-request` список dopytu очищается, контактные поля остаются в `localStorage`.
- Кнопка “Nahrať grafiku a objednať” позволяет выбрать файл, который отображается в корзине и загружается после оформления заказа

### Ключевые особенности:
- **Серверный пересчет цен**: при создании заказа все цены пересчитываются заново через `lib/pricing.ts`
- **PriceSnapshot**: цены сохраняются в корзине для UI, но при checkout пересчитываются
- **Rýchlosť výroby в заказе**: значение сохраняется в `_productionSpeed` и
  отображается менеджеру через `_attributes["Rýchlosť výroby"]`
- **Audience сохраняется**: режим B2B/B2C фиксируется в заказе
- **Гостевые корзины**: поддержка через sessionId cookie
- **Очистка корзины после заказа**:
  - Stripe flow: на `/checkout/success`
  - Bank/COD flow: перед redirect на страницу заказа + fallback на `?success=true`
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
