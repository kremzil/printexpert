# SEO: текущее устройство и где что менять

Дата: 2026-02-21

## Короткий ответ: где менять meta и OG

### 1) Глобальные дефолты (весь сайт)
Файл: `lib/seo.ts`

- `ROOT_METADATA` — глобальные `metadataBase`, `title.template`, `description`, `openGraph`, `twitter`, `robots`.
- `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`, `DEFAULT_OG_IMAGE` — базовые константы бренда.

Использование в корневом layout:
- `app/layout.tsx` -> `export const metadata: Metadata = ROOT_METADATA`.

### 2) Статические страницы (home, доставка, контакты, legal и т.д.)
Файл: `lib/seo.ts`

- `SEO_PAGES` — словарь page-level метаданных.
- `buildStaticPageMetadata(pageKey)` — единый builder для `title/description/canonical/openGraph`.

Страницы подключают это так:
- `export const metadata = buildStaticPageMetadata("home")`
- `export const metadata = buildStaticPageMetadata("kontakt")`
- и т.д.

### 3) Noindex для служебных зон
Файл: `lib/seo.ts`

- `NOINDEX_ROBOTS` (`index: false`, `follow: false`).

Используется в layout/страницах:
- `app/(admin)/layout.tsx`
- `app/(site)/(content)/auth/layout.tsx`
- `app/(site)/(content)/checkout/layout.tsx`
- `app/(site)/(content)/account/layout.tsx`
- а также page-level metadata для `cart`, `checkout`, `account/orders`, `account/saved-carts`, `dashboard`.

## Где динамическая SEO-мета

### Product page
Файл: `app/(site)/(content)/product/[slug]/page.tsx`

- `generateMetadata()` формирует dynamic `title/description/canonical`.
- Поддерживает share-параметры `st`, `sd`, `sc`, `sp`, `si` для OG/Twitter карточек.
- Встроены JSON-LD: `Product` и `BreadcrumbList`.

### Category page
Файл: `app/(site)/(content)/kategorie/[slug]/page.tsx`

- `generateMetadata()` строит `title/description/canonical/openGraph` из данных категории.
- Встроен JSON-LD: `BreadcrumbList`.

### Collection page
Файл: `app/(site)/(content)/kolekcie/[slug]/page.tsx`

- `generateMetadata()` строит `title/description/canonical` по коллекции.

### Catalog canonicalization
Файл: `app/(site)/(content)/catalog/page.tsx`

- Для `/catalog?cat=...` canonical указывает на `/kategorie/[slug]`.
- Реальный запрос с `cat` редиректится на SEO-URL категории.

## SEO endpoints

### Robots
Файл: `app/robots.ts`

- Публикует `/robots.txt`.
- Содержит `sitemap: https://printexpert.sk/sitemap.xml`.

### Sitemap
Файл: `app/sitemap.ts`

- Публикует `/sitemap.xml`.
- Включает статические маршруты + динамику:
  - товары: `/product/[slug]`
  - категории: `/kategorie/[slug]`
  - коллекции: `/kolekcie/[slug]`

### LLMs
Файл: `app/llms.txt/route.ts`

- Публикует `/llms.txt`.
- Генерируется автоматически при запросе (не нужно переписывать вручную после обновлений контента).
- Источники: категории, коллекции, товары + ключевые страницы + noindex-зоны.

## Каноникал-политика

- Канонический домен: `https://printexpert.sk` (через `NEXT_PUBLIC_SITE_URL`, fallback в `lib/seo.ts`).
- Каноникалы формируются без завершающего `/` (кроме корня `/`).
- Для листинга категории приоритетный URL: `/kategorie/[slug]`.

## Как добавить новую SEO-страницу (быстрый шаблон)

1. Добавить запись в `SEO_PAGES` в `lib/seo.ts`:

```ts
novaStranka: {
  title: "Názov stránky",
  description: "Popis stránky",
  canonicalPath: "/nova-stranka",
}
```

2. На странице экспортировать:

```ts
export const metadata = buildStaticPageMetadata("novaStranka")
```

3. Если это индексируемая публичная страница, добавить URL в `STATIC_ROUTES` в `app/sitemap.ts`.

## Минимальная проверка после изменений SEO

1. `npm run build`
2. Проверить вручную:
   - `/` (title/description/canonical/OG)
   - `/product/[slug]`
   - `/kategorie/[slug]`
   - `/robots.txt`
   - `/sitemap.xml`
   - `/llms.txt`
3. Проверить, что служебные зоны отдают `noindex`:
   - `/auth`, `/account`, `/checkout`, `/admin`, `/cart`, `/dashboard`
