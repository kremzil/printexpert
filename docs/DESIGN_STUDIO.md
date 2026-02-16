# Design Studio — встроенный редактор дизайна

Дата добавления: 2026-02-08
Последнее обновление: 2026-02-10 (v2)

## Обзор

Design Studio — canvas-редактор дизайна, встроенный в страницу товара.
Позволяет клиенту создавать макеты (визитки, листовки, наклейки и т.д.) прямо в браузере.

Функция включается **на уровне отдельного продукта** чекбоксом в админке.
Администратор настраивает параметры canvas (размеры, фон, DPI, цветовой профиль) и управляет библиотекой шаблонов.

---

## Структура файлов

```
components/
  print/
    design-editor.tsx            ← основной canvas-редактор (~1560 строк, "use client")
  admin/
    product-designer-settings.tsx ← секция настроек в карточке товара
    design-templates-manager.tsx  ← CRUD шаблонов дизайнера
    admin-order-detail.tsx       ← индикатор Design Studio в деталях заказа
  cart/
    cart-content.tsx             ← бейдж Design Studio в корзине
    checkout-form.tsx            ← загрузка PDF дизайна в S3 при оформлении

app/
  api/
    design-templates/
      route.ts                   ← GET (список) + POST (создание)
      [id]/
        route.ts                 ← PUT (обновление) + DELETE (удаление)

prisma/
  schema.prisma                  ← модель DesignTemplate + поля Product + OrderItem.designData

lib/
  orders.ts                      ← копирование designData из CartItem в OrderItem

types/
  cart.ts                        ← CartItemWithProduct с полем designData

app/(admin)/admin/products/[id]/
  page.tsx                       ← интеграция настроек в форму товара
  actions.ts                     ← парсинг и сохранение полей дизайнера

app/(site)/(content)/product/[slug]/
  page.tsx                       ← передача designerConfig в клиент
  product-page-client.tsx        ← кнопка + модальный редактор + превью дизайна
```

---

## Модель данных (Prisma)

### Поля в модели `Product`

| Поле | Тип | По умолчанию | Описание |
|------|-----|-------------|----------|
| `designerEnabled` | `Boolean` | `false` | Включает Design Studio для товара |
| `designerWidth` | `Int?` | — | Ширина canvas (px) |
| `designerHeight` | `Int?` | — | Высота canvas (px) |
| `designerBgColor` | `String?` | — | Цвет фона (hex, напр. `#ffffff`) |
| `designerDpi` | `Int?` | `300` | Разрешение для печати |
| `designerColorProfile` | `String?` | `"CMYK"` | Цветовой профиль (CMYK / RGB / sRGB) |
| `designTemplates` | `DesignTemplate[]` | — | Шаблоны дизайнов (relation) |

### Модель `DesignTemplate`

```prisma
model DesignTemplate {
  id           String   @id @default(uuid()) @db.Uuid
  productId    String   @db.Uuid
  product      Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name         String
  elements     Json     // массив DesignElement объектов
  thumbnailUrl String?
  isDefault    Boolean  @default(false)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([productId])
}
```

**Миграция:** `prisma/migrations/20260208170844_add_product_designer/migration.sql`

### Поле `designData` в модели `OrderItem`

| Поле | Тип | Описание |
|------|-----|----------|
| `designData` | `Json?` | JSON-массив элементов дизайна, скопированный из CartItem при создании заказа |

**Миграция:** `prisma/migrations/…_add_order_item_design_data/migration.sql`

При добавлении товара в корзину с дизайном, `designData` сохраняется в `CartItem`.
При создании заказа (`lib/orders.ts` → `createOrder()`) данные копируются из `CartItem.designData` в `OrderItem.designData`.

### Структура `elements` (JSON)

Каждый элемент в массиве `elements` описывается интерфейсом `DesignElement`:

```typescript
interface DesignElement {
  id: string                    // crypto.randomUUID()
  type: "text" | "image" | "shape"
  x: number                     // позиция X на canvas
  y: number                     // позиция Y на canvas
  width: number
  height: number
  content?: string              // текст (для type=text)
  fontSize?: number
  fontFamily?: string           // "Arial", "Helvetica", "Roboto", ...
  fontWeight?: string           // "normal" | "bold"
  fontStyle?: string            // "normal" | "italic"
  color?: string                // цвет текста (hex)
  textAlign?: "left" | "center" | "right"
  backgroundColor?: string      // заливка фигуры
  imageUrl?: string             // URL изображения (для type=image)
  shapeType?: "rectangle" | "circle"
  borderRadius?: number          // скругление углов прямоугольника (px)
  rotation?: number
  visible?: boolean             // видимость в слоях
  locked?: boolean              // блокировка перемещения
}
```

---

## Компоненты

### `DesignEditor` — основной редактор

**Файл:** `components/print/design-editor.tsx`
**Директива:** `"use client"`
**Размер:** ~1560 строк

#### Props

```typescript
interface DesignEditorProps {
  width: number             // ширина canvas (px)
  height: number            // высота canvas (px)
  dpi?: number              // для информационной панели (default: 300)
  colorProfile?: string     // для информационной панели (default: "CMYK")
  productLabel?: string     // название товара
  bgColor?: string          // фон canvas (default: "#ffffff")
  templates?: DesignTemplate[]  // шаблоны из БД
  onSave?: (elements: DesignElement[], thumbnailDataUrl?: string, pdfBlob?: Blob) => void
  onClose?: () => void
}
```

#### Функциональность

**Тулбар (верхняя панель):**
- Добавление текста (Type), изображения (ImageIcon), прямоугольника (Square), круга (Circle)
- Дублирование (Copy) и удаление (Trash2) выделенного/выделенных элементов
- Undo / Redo (стек истории)
- **Кнопка «Vrstvy»** — toggle панели слоёв (variant secondary/outline)
- Zoom In / Zoom Out (шаг 0.1, диапазон 0.3–3.0)
- **«Použiť v objednávke»** (ShoppingCart) — генерирует thumbnail (PNG) + PDF (jsPDF), вызывает `onSave(elements, thumbnailDataUrl, pdfBlob)`. Кнопка неактивна при пустом canvas. Градиентный стиль purple → pink.
- Скачивание (Download) — экспорт canvas как PNG
- Шаблоны (Sparkles) — открывает модальное окно с библиотекой

**Панель свойств (левая):**
- Шрифт (`fontFamily`) — select из 9 шрифтов
- Размер шрифта (`fontSize`)
- Цвет (`color`) — color picker
- Жирность (Bold) / Курсив (Italic)
- Выравнивание (Left / Center / Right)
- Позиция X / Y
- Ширина / Высота
- **Скругление углов** (`borderRadius`) — слайдер 0–50px + числовой ввод (только для прямоугольников)

**Canvas (центр):**
- HTML5 Canvas API с зумом
- Drag & drop элементов
- Выделение по клику (синяя пунктирная рамка + ручки)
- **8 resize-ручек** (nw, n, ne, e, se, s, sw, w) — белые квадраты с синей обводкой, курсор меняется при наведении
- Изменение размеров перетаскиванием ручек (min 10px)
- **Пропорциональное трансформирование (Shift)** — зажатый Shift сохраняет соотношение сторон при resize любой ручкой
- **Масштабирование шрифта** — при resize текстового элемента `fontSize` масштабируется пропорционально изменению высоты (min 6px)
- **Авто-размер текста** — bounding box текстового элемента автоматически подстраивается под содержимое (`ctx.measureText`)
- **Эллипс** — круги рендерятся через `ctx.ellipse()`, позволяя деформировать их в овалы при resize
- **Скруглённые прямоугольники** — `drawRoundedRect()` с `arcTo` при наличии `borderRadius`
- **Мульти-выделение** — Shift/Ctrl+Click для выбора нескольких элементов, подсветка синей рамкой
- **Групповое перетаскивание** — все выделенные элементы двигаются одновременно
- Сетка с DPI-информацией

**Панель мульти-выделения (левая, при selectedIds.size > 1):**
- Информация: «Vybraných N elementov»
- **Выравнивание** — 6 кнопок:
  - По левому краю (AlignStartVertical)
  - По центру горизонтально (AlignCenterVertical)
  - По правому краю (AlignEndVertical)
  - По верхнему краю (AlignStartHorizontal)
  - По центру вертикально (AlignCenterHorizontal)
  - По нижнему краю (AlignEndHorizontal)
- **Распределение** (при 3+ элементах) — 2 кнопки:
  - Горизонтальное равномерное распределение
  - Вертикальное равномерное распределение
- Кнопки «Duplikovať všetky» и «Odstrániť všetky»

**Панель слоёв (правая, toggle):**
- Список всех элементов (снизу вверх)
- **Изменение порядка слоёв** — кнопки ChevronUp / ChevronDown для перемещения выше/ниже (неактивны на границах)
- Переключатель видимости (Eye / EyeOff)
- Клик для выделения (Shift/Ctrl+Click — мульти-выделение)
- Подсветка выделенных элементов в группе (синий фон)

**Модальное окно шаблонов:**
- Встроенные шаблоны (визитка, флаер)
- Загруженные из БД (prop `templates`)
- Применение шаблона заменяет все элементы

**Информационная панель (нижняя):**
- Название товара, DPI, цветовой профиль
- Текущий зум (%), кол-во элементов

### `ProductDesignerSettings` — настройки в админке

**Файл:** `components/admin/product-designer-settings.tsx`
**Директива:** `"use client"`

Рендерится внутри формы редактирования товара. Содержит:

1. **Чекбокс** `designerEnabled` — включение/выключение.
2. Условный блок настроек (раскрывается при `enabled = true`):
   - `designerWidth` / `designerHeight` — Input number (100–5000 px).
   - `designerBgColor` — `<input type="color">` + readonly текстовое поле.
   - `designerDpi` — Input number (72–1200).
   - `designerColorProfile` — Select (CMYK / RGB / sRGB).

Все поля используют `name=...` для передачи через FormData в server action.

### `DesignTemplatesManager` — управление шаблонами

**Файл:** `components/admin/design-templates-manager.tsx`
**Директива:** `"use client"`

Рендерится **отдельной карточкой** ниже формы товара (условно, если `designerEnabled`).

Функции:
- **Список шаблонов** — имя, кол-во элементов, бейдж «Predvolená».
- **Добавить** — текстовое поле + кнопка → `POST /api/design-templates`.
- **Удалить** — кнопка → `DELETE /api/design-templates/[id]`.
- **Сделать по умолчанию** — кнопка ★ → `PUT /api/design-templates/[id]`.
- Состояния обновляются оптимистично через `useState` + `useTransition`.

---

## API маршруты

### `GET /api/design-templates?productId=xxx`

Публичный. Возвращает массив шаблонов для продукта.

**Query params:** `productId` (обязательный)

**Ответ:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Šablóna vizitky",
    "elements": [...],
    "thumbnailUrl": null,
    "isDefault": true,
    "sortOrder": 0
  }
]
```

### `POST /api/design-templates`

**Доступ:** Admin only (`requireAdmin()`).

**Body:**
```json
{
  "productId": "uuid",
  "name": "Nová šablóna",
  "elements": [],
  "thumbnailUrl": null,
  "isDefault": false
}
```

**Ответ:** `201 Created` — созданный шаблон.

При `isDefault: true` автоматически сбрасывает флаг у других шаблонов этого продукта.

### `PUT /api/design-templates/[id]`

**Доступ:** Admin only.

**Body** (все поля опциональные):
```json
{
  "name": "Обновлённое имя",
  "elements": [...],
  "thumbnailUrl": "https://...",
  "isDefault": true,
  "sortOrder": 1
}
```

**Ответ:** `200 OK` — обновлённый шаблон.

### `DELETE /api/design-templates/[id]`

**Доступ:** Admin only.

**Ответ:** `200 OK` — `{ "success": true }`.

---

## Интеграция в админку

### Страница товара (`/admin/products/[id]`)

В форму редактирования добавлена секция Design Studio:

```tsx
<ProductDesignerSettings
  designerEnabled={product.designerEnabled}
  designerWidth={product.designerWidth}
  designerHeight={product.designerHeight}
  designerBgColor={product.designerBgColor}
  designerDpi={product.designerDpi}
  designerColorProfile={product.designerColorProfile}
/>
```

Ниже формы — менеджер шаблонов (условно):

```tsx
{product.designerEnabled && (
  <DesignTemplatesManager
    productId={product.id}
    templates={product.designTemplates ?? []}
  />
)}
```

### Server Action (`actions.ts`)

`updateProductDetails` разбирает designer-поля из FormData:

```typescript
const designerEnabledRaw = formData.get("designerEnabled")
const designerEnabled = designerEnabledRaw === "1"
const designerWidth = parseInt(formData.get("designerWidth") as string) || null
const designerHeight = parseInt(formData.get("designerHeight") as string) || null
const designerBgColor = (formData.get("designerBgColor") as string) || null
const designerDpi = parseInt(formData.get("designerDpi") as string) || null
const designerColorProfile = (formData.get("designerColorProfile") as string) || null
```

Сохраняет в `prisma.product.update({ data: { designerEnabled, ... } })`.

### Запрос данных (`lib/catalog.ts`)

`getAdminProductById` включает `designTemplates` в select:

```typescript
designTemplates: {
  orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
}
```

---

## Интеграция в витрину

### Server Component (`/product/[slug]/page.tsx`)

Формирует `designerConfig` из полей товара и передаёт в client component:

```typescript
designerConfig={product.designerEnabled ? {
  enabled: true,
  width: product.designerWidth ?? 1050,
  height: product.designerHeight ?? 600,
  bgColor: product.designerBgColor ?? "#ffffff",
  dpi: product.designerDpi ?? 300,
  colorProfile: product.designerColorProfile ?? "CMYK",
} : null}
```

### Server Component (`/product/[slug]/page.tsx`) — авторизация

Страница проверяет сессию пользователя через `auth()` из `@/auth` и передаёт `isLoggedIn={!!session?.user}` в client component.

### Client Component (`product-page-client.tsx`)

Если `designerConfig` не null:
1. В блоке конфигурации товара показывает карточку с кнопкой **«Otvoriť dizajnér»**.
   - Для товаров с матрицами — после блока «Nahrajte podklady».
   - Для товаров без матриц — без блока загрузки файла.
2. **Гейт авторизации:** если `isLoggedIn=false`, кнопка оборачивается в `LoginDialog` — при клике открывается диалог входа с toast-уведомлением «Design Studio je dostupné len pre prihlásených používateľov». Если `isLoggedIn=true` — кнопка открывает редактор напрямую.
3. Кнопка переключает `showDesigner` state.
4. Overlay рендерится через **`createPortal(…, document.body)`** с `z-[9999]` — обход stacking context заголовка (`sticky top-0 z-50`).
5. Передаются все параметры из `designerConfig`.
6. Кнопка закрытия возвращает в обычный вид.
4. При нажатии **«Použiť v objednávke»** в редакторе:
   - Генерируется thumbnail canvas → `designThumbnail` state (data URL).
   - Генерируется PDF blob (jsPDF) → сохраняется в `window.__pendingDesignPdf` как `File`.
   - Элементы дизайна сохраняются в `designData` при добавлении в корзину.
   - Под карточкой Design Studio показывается превью thumbnail (200×120 px).

---

## Интеграция в заказ (Order flow)

### Данные дизайна в корзине и заказе

1. **CartItem** — при добавлении в корзину, `designData` (JSON array of `DesignElement`) записывается в CartItem.
2. **Корзина** (`components/cart/cart-content.tsx`) — для товаров с `designData` показывается фиолетовый бейдж «Design Studio (N elementov)» с иконкой Paintbrush.
3. **OrderItem** — при создании заказа (`lib/orders.ts`) `designData` копируется из CartItem в OrderItem.
4. **Admin** (`components/admin/admin-order-detail.tsx`) — в деталях заказа отображается фиолетовый индикатор «Design Studio dizajn (N elementov)».

### PDF-генерация и загрузка в S3

При оформлении заказа (`components/cart/checkout-form.tsx`):

1. Проверяется наличие `window.__pendingDesignPdf` (File объект).
2. Запрашивается presigned URL: `POST /api/uploads/presign` с `kind: "ARTWORK"`.
3. PDF загружается в S3: `PUT` на presigned URL.
4. Подтверждается загрузка: `POST /api/uploads/confirm` → создаётся `OrderAsset` привязанный к заказу.
5. При ошибке загрузки заказ НЕ отменяется — ошибка логируется в console.
6. После завершения `window.__pendingDesignPdf` очищается (`delete`).

**Зависимости:** jsPDF (клиентская генерация PDF), S3 presigned URL flow.

---

## Миграция БД

```bash
npx prisma migrate dev --name add-design-studio
npm run prisma:generate
```

SQL миграция (`20260208170844_add_product_designer`):
- `ALTER TABLE "Product"` — 6 новых колонок.
- `CREATE TABLE "DesignTemplate"` — новая таблица с FK на Product (CASCADE).
- Индекс `DesignTemplate_productId_idx`.

SQL миграция (`add_order_item_design_data`):
- `ALTER TABLE "OrderItem"` — добавлена колонка `designData JSONB`.

---

## UX-поведение

| Действие | Результат |
|----------|-----------|
| Админ включает чекбокс | Раскрываются настройки canvas + секция шаблонов |
| Админ сохраняет форму | Все designer-поля пишутся в Product |
| Клиент открывает товар | Видит кнопку «Otvoriť dizajnér» в блоке конфигурации (для матричных — после загрузки файлов) |
| Неавторизованный клиент нажимает кнопку | Открывается диалог входа + toast-уведомление |
| Авторизованный клиент нажимает кнопку | Открывается полноэкранный canvas-редактор (portal в body) |
| Клиент добавляет текст | Элемент появляется на canvas, в панели слоёв, в properties |
| Клиент нажимает «Použiť v objednávke» | Генерируется thumbnail + PDF, данные сохраняются в state, появляется превью |
| Клиент добавляет товар в корзину | `designData` записывается в CartItem, PDF сохраняется в `window.__pendingDesignPdf` |
| Корзина | Бейдж «Design Studio» с кол-вом элементов у товаров с дизайном |
| Клиент оформляет заказ | `designData` копируется в OrderItem, PDF загружается в S3 как OrderAsset |
| Админ открывает заказ | Видит индикатор «Design Studio dizajn» с кол-вом элементов |
| Клиент нажимает Download | Экспорт canvas как PNG файл |
| Клиент закрывает редактор | Возврат к странице товара |

---

## Безопасность

- **Design Studio доступен только авторизованным пользователям.** Проверка через `auth()` на сервере, `isLoggedIn` prop на клиенте.
- API шаблонов: `GET` — публичный, `POST/PUT/DELETE` — только admin (`requireAdmin()`).
- Server action `updateProductDetails` — защищён `requireAdmin()`.
- Данные шаблонов хранятся как JSON в PostgreSQL (JSONB).
- `onDelete: Cascade` — удаление товара каскадно удаляет все его шаблоны.

---

## Планы развития

- [x] Сохранение готового дизайна как `OrderAsset` (привязка к заказу). ✅ 2026-02-10
- [x] Генерация PDF из canvas (jsPDF) + загрузка в S3 при checkout. ✅ 2026-02-10
- [x] Передача `designData` через CartItem → OrderItem. ✅ 2026-02-10
- [x] Индикатор Design Studio в корзине и в админке заказа. ✅ 2026-02-10
- [x] Ограничение доступа — только для авторизованных пользователей (`auth()` + `LoginDialog`). ✅ 2026-02-10
- [x] Portal-рендеринг overlay (`createPortal` в `document.body`, `z-[9999]`). ✅ 2026-02-10
- [x] Toggle панели слоёв (кнопка «Vrstvy» в тулбаре). ✅ 2026-02-10
- [x] Скругление углов прямоугольников (`borderRadius`, слайдер + ввод). ✅ 2026-02-10
- [x] Мульти-выделение (Shift/Ctrl+Click), групповое перетаскивание и удаление/дублирование. ✅ 2026-02-10
- [x] Инструменты выравнивания (6 режимов) и распределения (горизонтальное/вертикальное). ✅ 2026-02-10
- [x] Автоматический размер bounding box текста по содержимому (`measureText`). ✅ 2026-02-10
- [x] Деформация круга в эллипс (`ctx.ellipse()` с раздельными полуосями). ✅ 2026-02-10
- [x] Пропорциональное трансформирование с зажатым Shift (сохранение aspect ratio). ✅ 2026-02-10
- [ ] Улучшение print-ready PDF (учёт DPI, цветового профиля CMYK, bleed marks).
- [ ] Загрузка готовых шаблонов с превью-изображением в админке.
- [ ] Сохранение пользовательских дизайнов в личном кабинете.
- [ ] Drag & drop reorder шаблонов в админке.
- [ ] Многостраничные дизайны (лицо + оборот).
- [ ] Импорт/экспорт шаблонов как JSON.
