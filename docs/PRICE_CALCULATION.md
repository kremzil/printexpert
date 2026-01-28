# Логика расчёта цены товаров

Документ описывает текущую логику расчёта цен для товаров с фиксированными размерами и с расчётом по площади (area-based). Используется как руководство для ручного добавления атрибутов и матриц цен.

## Термины

- **matrix type (mtid)** — матрица цен; может быть базовой (simple) или финишной (finishing).
- **ntp** — тип расчёта количества:
  - `0` — по количеству (fixed)
  - `2` — по площади (width × height)
  - `3` — по периметру
  - `4` — по ширине/погонным
- **breakpoints** — точки интерполяции/диапазоны в матрице цен.
- **smatrix / fmatrix** — наборы цен: для базовых и финишных матриц.
- **nmbVal** — нормализованное количество, по которому выбирается цена.

## Источник данных

Расчёты берут данные из БД (WP-таблицы и внутренние матрицы).
Сбор данных для калькулятора выполняется в `lib/wp-calculator.ts` и
`lib/pricing.ts` (для внутренних матриц).

## Общая логика расчёта

1) Определить выбранные значения атрибутов (selects) для каждой матрицы.
2) Рассчитать `nmbVal` в зависимости от `ntp`:
   - `0`: `nmbVal = quantity`
   - `2`: `nmbVal = quantity * width * height`
   - `3`: `nmbVal = quantity * (2 * width + 2 * height)`
   - `4`: `nmbVal = quantity * (2 * width)`
3) Если `ntp` равен `2/3/4`, выполнить округление:
   - `nmbVal = ceilDecimal(nmbVal, -1)` (округление до 0.1)
4) Найти цену по матрице:
   - `price = priceMap[keyBase + "-" + breakpoint]` с интерполяцией.
5) Суммировать цены всех матриц (simple + finishing).
6) Применить надбавки/скидки (если используются):
   - production speed (%)
   - user discount (%)

## Выбор цен по матрице

Для каждого `nmbVal`:
- если `nmbVal` меньше минимального брейкпоинта:
  - для area (`ntp = 2`) цена масштабируется пропорционально:
    `price = price_min * (nmbVal / minBreakpoint)`
  - для остальных типов берётся цена минимального брейкпоинта без масштабирования
- если `nmbVal` между брейкпоинтами — линейная интерполяция
- если `nmbVal` больше максимального брейкпоинта — берётся цена максимального брейкпоинта

## Ключи (keyBase)

### Simple (базовая матрица)

`keyBase` формируется из выбранных атрибутов:
```
<aid1>:<term1>-<aid2>:<term2>-...
```
Пример:
`1:874-2:908-4:105`

### Finishing (финишная матрица)

Возможны два варианта:
1) **С префиксом размера** (если в `fmatrix` есть ключи вида `size-...`):
```
<sizeAid>:<sizeTerm>-<aid>:<term>
```
2) **Без размера**:
```
<aid>:<term>
```

Если финишная матрица скрыта (selects пустые), выбирается единственная подходящая пара
из `fmatrix` по текущему набору уже выбранных finishing‑атрибутов.

## Fixed vs Area
### Fixed (ntp = 0)
- Поля ширины/высоты не нужны.
- `nmbVal = quantity`
- Цена берётся по брейкпоинтам без масштабирования ниже минимума.

### Area (ntp = 2)
- Поля ширины/высоты обязательны.
- `nmbVal = quantity * width * height` (с нормализацией единиц).
- Округление до 0.1.
- Цена ниже минимального брейкпоинта масштабируется пропорционально.

## Единицы измерения
`dim_unit` фиксирован как `"cm"`. `a_unit` хранится **на уровне матрицы**
(`WpMatrixType.aUnit` или `PricingModel.aUnit`) и определяет единицы площади:
- `cm2` — площадь считается в cm²
- `m2` — размеры переводятся в метры, площадь считается в m²

Если у матрицы `a_unit` не задан, используется fallback.

## Отображение количества
Для матрицы используется `numStyle`:
- `0` — поле ввода (input)
- `1` — выпадающий список (select, значения берутся из breakpoints)

## Список товаров для проверки a_unit
Источник: `data/wp/wpDB/kpkp_wp2print_table_wp_print_products_matrix_types.json`  
Критерий: `num_type` ∈ {2, 3, 4} (площадь/периметр/ширина).

WP product_id (по `data/wp/wc-product-export-21-1-2026-1768984148845.csv`):
- 378 — (не найдено)
- 675 — (не найдено)
- 688 — (не найдено)
- 694 — (не найдено)
- 706 — (не найдено)
- 722 — (не найдено)
- 724 — (не найдено)
- 726 — (не найдено)
- 730 — (не найдено)
- 732 — (не найдено)
- 734 — (не найдено)
- 1426 — Reklamné tabule
- 1429 — Bannery, sieťoviny
- 1431 — Back-lighty do svetelných boxov
- 1432 — (не найдено)
- 1433 — Magnetické fólie
- 1440 — Samolepiace fólie na pevné podklady
- 1444 — Tlačoviny - vlastné veľkosti
- 7466 — (не найдено)

Внутренние матрицы:
- `Letáky` (slug `letaky`) — проверить `aUnit` в `PricingModel`.

## Таблицы и связи (БД)
### Настройка конкретного товара
- `WpMatrixType` (`wp_print_products_matrix_types`)
  - связь: `productId` → WP ID товара
  - ключ: `mtypeId` (ID матрицы)
  - важные поля: `mtype` (0/1), `numbers` (breakpoints), `numType` (ntp),
    `attributes`/`aterms` (PHP‑serialized связь атрибутов и терминов)

### Внутренние матрицы (новый источник)
- `PricingModel`
  - связь: `productId` → `Product.id`
  - `kind`: `BASE | FINISHING`
  - `breakpoints`: JSON (числа или строка, парсится как список)
  - `numType`: аналог `ntp`
  - `sourceMtypeId`: используется как `mtid` для матрицы
- `PricingEntry`
  - связь: `pricingModelId` → `PricingModel.id`
  - `attrsKey`: формат `aid:term-aid:term` (как в WP)
  - `breakpoint`: число
  - `price`: цена

### Матрицы цен
- `WpMatrixPrice` (`wp_print_products_matrix_prices`)
  - связь: `mtypeId` → `WpMatrixType.mtypeId`
  - ключ цены: `aterms + "-" + number`
  - `number` — брейкпоинт, `price` — значение цены

### Атрибуты и их названия
- `WpAttributeTaxonomy` (`wp_woocommerce_attribute_taxonomies`)
  - связь: `attributeId` используется как `aid` в матрицах
  - используется для определения классов `smatrix-size/colour/material`

### Термины (значения атрибутов)
- `WpTerm` (`wp_terms`)
  - `termId` используется как значение опции (option.value)
  - `name` используется как `label`
- `WpTermTaxonomy` (`wp_term_taxonomy`)
  - связь: `termId` → `WpTerm.termId`
  - содержит тип терма (`taxonomy`)
- `WpTermRelationship` (`wp_term_relationships`)
  - связь товара с `term_taxonomy_id` (нужно при восстановлении атрибутов по продукту)
- `WpTermMeta` (`wp_termmeta`)
  - дополнительные метаданные терминов (опционально)

## Добавление данных для нового товара (из БД)
1) Убедиться, что в `WpMatrixType` есть строки для `productId` товара.
2) Проверить, что для этих `mtypeId` есть строки в `WpMatrixPrice`.
3) Атрибуты и названия подтягиваются из `WpAttributeTaxonomy` и `WpTerm`.
4) В `app/product/[slug]/page.tsx` добавить `wpProductIdBySlug`.

## Серверный источник истины
- Серверный сервис `calculate(productId, params, audienceContext)` выполняет расчёт
  и возвращает `net/vat/gross`.
- `POST /api/price` вызывает серверный расчёт и не принимает цену от клиента.
- Клиент отображает только предварительную цену.

## Примечания
- Данные берутся из БД, а `attributes/aterms` остаются в PHP‑serialized формате.
- Разбор `attributes/aterms` выполняется в `lib/wp-calculator.ts`.

## Данные товара из wp_posts (для SEO и карточек)
- Таблица: `wp_posts` (экспорт `kpkp_wp2print_table_wp_posts.json`).
- Фильтр: `post_type = "product"`, `post_status = "publish"`.
- Маппинг в `Product`: 
  - `post_name` → `slug` (сохраняем старые URL)
  - `post_title` → `name`
  - `post_excerpt` → `excerpt`
  - `post_content` → `description`

