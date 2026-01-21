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

Сейчас расчёты берут данные из БД (таблицы, импортированные из WP).
Сбор данных для калькулятора выполняется в `lib/wp-calculator.ts`.

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
Используются `globals.dim_unit` и `globals.a_unit`:
- при `dim_unit = "cm"` и `a_unit = 1` площадь считается в cm²
- при других комбинациях значения нормализуются до базовых единиц

## Таблицы и связи (БД)
### Настройка конкретного товара
- `WpMatrixType` (`wp_print_products_matrix_types`)
  - связь: `productId` → WP ID товара
  - ключ: `mtypeId` (ID матрицы)
  - важные поля: `mtype` (0/1), `numbers` (breakpoints), `numType` (ntp),
    `attributes`/`aterms` (PHP‑serialized связь атрибутов и терминов)

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

