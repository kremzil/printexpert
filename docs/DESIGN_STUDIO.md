# Design Studio (v3)

Дата добавления: 2026-02-08  
Последнее обновление: 2026-02-20

## Кратко

Текущая реализация Design Studio работает по модели **canvas-профилей**:
- для товара создаются профили canvas, привязанные к значению `Veľkosť`;
- пользователь на витрине получает профиль по выбранному размеру;
- если профиля для выбранного размера нет, дизайнер не показывается;
- все геометрические параметры в UI редактора работают в **мм**;
- шаблоны привязаны к конкретному canvas-профилю;
- шаблоны поддерживают **многостраничный формат** (face/back, multi-page);
- экспорт в PDF и сохранение дизайна поддерживают страницы.

---

## Основные файлы

```txt
components/
  print/
    design-editor.tsx                     # редактор (страницы, экспорт PDF, слои, шаблоны)
  admin/
    product-designer-settings.tsx         # toggle designerEnabled в карточке товара
    design-canvas-profiles-manager.tsx    # профили canvas + шаблоны + SVG import

app/
  (admin)/admin/products/[id]/page.tsx    # вкладка Design Studio в админке товара
  (site)/(content)/product/[slug]/
    page.tsx                              # отдает runtime designerConfig
    product-page-client.tsx               # выбор профиля по Veľkosť + модалка редактора
  api/
    design-canvas-profiles/               # CRUD профилей
    design-templates/                     # CRUD шаблонов

lib/
  design-studio.ts                        # normalize/extract helpers, pages/legacy compat
  catalog.ts                              # сериализация профилей/шаблонов в runtime
  orders.ts                               # копирование designData в OrderItem
```

---

## Модель данных

## 1) `DesignCanvasProfile` (source of truth для canvas)

Профиль хранит:
- привязку к размеру: `sizeAid`, `sizeTermId`, `sizeLabel`;
- trim в мм: `trimWidthMm`, `trimHeightMm`;
- печатные параметры: `dpi`, `bgColor`, `colorProfile`;
- зоны: `bleedTop/Right/Bottom/LeftMm`, `safeTop/Right/Bottom/LeftMm`;
- сортировку и активность.

Уникальность: один профиль на одну пару `(productId, sizeAid, sizeTermId)`.

## 2) `DesignTemplate`

Шаблон привязан к:
- `productId` (совместимость и простые выборки),
- `canvasProfileId` (фактическая область применения).

Поле `elements` (`Json`) поддерживает два формата:

1. Legacy (одностраничный):
```json
[{ "...": "DesignElement" }]
```

2. Новый (многостраничный):
```json
{
  "pages": [
    { "id": "page-1", "name": "Strana 1", "elements": [] },
    { "id": "page-2", "name": "Strana 2", "elements": [] }
  ],
  "elements": []
}
```

`elements` (flatten) в объекте сохраняется для обратной совместимости и быстрых счетчиков.

## 3) `designData` в `CartItem`/`OrderItem`

Текущий runtime-формат:
```json
{
  "canvasProfileId": "uuid",
  "sizeKey": "aid:termId",
  "trimMm": { "width": 90, "height": 50 },
  "bleedMm": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "safeMm": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
  "dpi": 300,
  "elements": [],
  "pages": [
    { "id": "page-1", "name": "Strana 1", "elements": [] }
  ]
}
```

---

## Runtime helpers (`lib/design-studio.ts`)

Ключевые функции:
- `normalizeDesignDataV2` — нормализация `designData`;
- `extractDesignPages` / `extractDesignElements` — чтение страниц/элементов с legacy fallback;
- `getDesignElementCount` — считает элементы по всем страницам;
- `extractTemplatePages` — парсинг форматов шаблонов (legacy + новый);
- `getTemplateElementCount` — счетчик элементов шаблона по страницам.

Это обеспечивает совместимость старых записей и новых многостраничных данных без миграции БД.

---

## Админка (товар → вкладка Design Studio)

## Профили canvas

В `design-canvas-profiles-manager.tsx` администратор:
- создает профиль для конкретного значения `Veľkosť`;
- задает trim/bleed/safe в мм;
- задает DPI, фон, цветовой профиль;
- включает/отключает профиль.

Если в базовой матрице товара не найден size-select (`smatrix-size`), настройка профилей/шаблонов для витрины блокируется.

## Шаблоны в профиле

Для каждого профиля доступны:
- создание пустого шаблона;
- назначение default шаблона профиля;
- удаление шаблона;
- импорт SVG.

### Многостраничные шаблоны

1. **Пустой шаблон**  
Можно задать количество страниц (`Strán`) при создании.

2. **SVG import (1+)**  
Можно выбрать несколько SVG файлов:
- каждый файл становится отдельной страницей шаблона;
- порядок страниц соответствует порядку выбранных файлов.

3. **Парсинг SVG**
- поддерживаются `text`, `rect`, `circle`, `ellipse`, `image`;
- неподдержанные элементы пропускаются с отчетом;
- если editable-элементов нет, используется fallback: locked image из исходного SVG.

---

## Витрина (product page)

## Выбор профиля по `Veľkosť`

`product-page-client.tsx`:
- определяет текущий `sizeKey` из базовой матрицы;
- ищет профиль по `(sizeAid, sizeTermId)`;
- показывает кнопку дизайнера только если профиль найден.

### Смена размера после созданного дизайна

Если у пользователя уже есть дизайн и выбран другой размер (другой профиль):
- показывается confirm;
- при подтверждении сбрасываются:
  - `designData`,
  - `designThumbnail`,
  - `window.__pendingDesignPdf`.

## Загрузка шаблонов в редактор

На витрине шаблоны проходят через `toEditorTemplates`:
- legacy-массив превращается в `pages: [page-1]`;
- новый объект с `pages` передается как есть;
- редактор применяет шаблон целиком (все страницы), а не только текущую страницу.

---

## Редактор (`components/print/design-editor.tsx`)

Актуальные возможности:
- страницы (`Strana`, `+ Strana`, `Odstrániť`);
- работа в мм для X/Y/width/height (внутренний рендер в px);
- отображение линий bleed/trim/safe;
- слои, выделение, resize, выравнивание, распределение;
- шаблоны (built-in + из БД, включая многостраничные);
- экспорт PDF по всем страницам;
- `onSave` возвращает и `flattened elements`, и `pages`.

### Растровые изображения

Исправлено поведение растра:
- при рендере используется кэш загрузки изображения и перерисовка после `onload`;
- порядок слоев сохраняется корректно;
- при PDF-экспорте raster элементы включаются в экспорт.

---

## Экспорт и заказ

1. При `Použiť v objednávke`:
- генерируется thumbnail;
- генерируется PDF (все страницы);
- `designData` сохраняется в state страницы товара.

2. При добавлении в корзину:
- `designData` сохраняется в `CartItem`.

3. При checkout:
- PDF из `window.__pendingDesignPdf` загружается как `OrderAsset`.

4. При создании заказа:
- `designData` копируется `CartItem -> OrderItem`.

5. Бейджи в корзине и админке заказа:
- используют `getDesignElementCount` (сумма по страницам).

---

## API (актуально)

## Canvas profiles
- `GET /api/design-canvas-profiles?productId=...`
- `POST /api/design-canvas-profiles`
- `PUT /api/design-canvas-profiles/[id]`
- `DELETE /api/design-canvas-profiles/[id]`

Доступ: admin-only (кроме публичного чтения на витрину через server data flow).

## Templates
- `GET /api/design-templates?productId=...` или `?canvasProfileId=...`
- `POST /api/design-templates`
- `PUT /api/design-templates/[id]`
- `DELETE /api/design-templates/[id]`

Ограничения:
- шаблон валидируется на принадлежность профиля тому же товару;
- `isDefault` работает в рамках профиля (`canvasProfileId`).

---

## Совместимость и миграции

- Миграция на v3 (профили canvas) была сделана ранее.
- Для добавления многостраничных шаблонов **новая миграция БД не требовалась**:
  - используется существующее JSON-поле `DesignTemplate.elements`.
- Legacy-форматы читаются через helpers в `lib/design-studio.ts`.

---

## Ограничения / TODO

- Встроенный редактор пока не имеет отдельного admin-UI для визуального редактирования шаблона страниц (создание идет через пустой шаблон + SVG import).
- Типографика в редакторе остается в px (`fontSize`) на первом этапе.
- Цветовые профили CMYK остаются metadata-уровнем (jsPDF + browser canvas).
