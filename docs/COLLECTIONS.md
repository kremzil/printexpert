# Коллекции товаров (`Kolekcie`)

Документ описывает текущую реализацию коллекций товаров в проекте PrintExpert.

## Что это

Коллекции — отдельная сущность каталога для объединения товаров из разных категорий в ручные подборки.

Поддерживаются:
- название, slug, изображение, описание;
- ручной упорядоченный список товаров;
- флаги видимости по аудитории (`B2B`/`B2C`);
- активность коллекции и порядок вывода.

## Маршруты и интерфейсы

- Админка: `GET /admin/kolekcie`
- Публичная страница коллекции: `GET /kolekcie/[slug]`
- Индексная страница `/kolekcie` в текущей итерации не добавляется.

## Модель данных (Prisma)

Файл: `prisma/schema.prisma`

```prisma
model ProductCollection {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  image       String
  description String?
  productIds  String[]
  isActive    Boolean  @default(true)
  showInB2b   Boolean  @default(true)
  showInB2c   Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([isActive, sortOrder])
}
```

Миграция применяется локально пользователем:

```bash
npx prisma migrate dev
```

## Кэш и инвалидация

Файл: `lib/cache-tags.ts`

- Добавлен тег `TAGS.COLLECTIONS = "catalog:collections"`.
- При изменении коллекций вызывается `revalidateTag(TAGS.COLLECTIONS, "max")` в admin API.
- `TAGS.COLLECTIONS` также включен в:
  - `invalidateProduct(...)`
  - `invalidateCategories()`
  - `invalidateAllCatalog()`

## Серверные выборки каталога

Файл: `lib/catalog.ts`

- `getHomepageCollections(audience)`:
  - возвращает только активные коллекции;
  - фильтрует по аудитории (`showInB2b/showInB2c`);
  - сортирует по `sortOrder`, затем `name`;
  - обернут в `unstable_cache` с тегом `TAGS.COLLECTIONS`.

- `getCollectionBySlug(slug, audience)`:
  - ищет активную и видимую для текущей аудитории коллекцию;
  - возвращает `null`, если коллекция скрыта/неактивна/не найдена.

- `getCollectionProducts(productIds, audience)`:
  - берёт товары только из `productIds`;
  - исключает неактивные товары;
  - исключает товары из неактивных/скрытых категорий;
  - применяет фильтр аудитории;
  - сохраняет ручной порядок из `productIds`.

## Admin API

### `GET /api/admin/collections`
- Возвращает список коллекций, сортировка `sortOrder`, `name`.
- Доступ: только `ADMIN`.

### `POST /api/admin/collections`
- Создаёт коллекцию.
- Валидация:
  - обязательны `name` и `image`;
  - `slug` генерируется из `name`, если пустой;
  - проверка уникальности `slug`;
  - `productIds` дедуплицируются и очищаются от несуществующих ID.
- После создания: `revalidateTag(TAGS.COLLECTIONS, "max")`.

### `PATCH /api/admin/collections/[collectionId]`
- Обновляет коллекцию.
- Поддерживает частичное обновление полей.
- Повторная валидация slug, image/name, productIds.
- После обновления: `revalidateTag(TAGS.COLLECTIONS, "max")`.

### `DELETE /api/admin/collections/[collectionId]`
- Удаляет коллекцию.
- После удаления: `revalidateTag(TAGS.COLLECTIONS, "max")`.

Безопасность:
- Авторизация через `auth()` + роль `ADMIN`.
- Для mutating-запросов используется CSRF-защита проекта через `proxy.ts` (`x-csrf-token` + cookie), клиент отправляет `getCsrfHeader()`.

## Админка (`/admin/kolekcie`)

Файл: `app/(admin)/admin/kolekcie/page.tsx`

Текущий UX:
- кнопка `+ Nová kolekcia` открывает диалог создания;
- существующие коллекции показываются в таблице (по одной строке на коллекцию);
- редактирование открывается диалогом `Upraviť`;
- удаление — отдельная кнопка в строке.

В форме:
- поля `name`, `slug`, `image`, `description`, `sortOrder`;
- флаги `Aktívna`, `B2B`, `B2C`;
- выбор товаров через multiselect combobox;
- ручное упорядочивание выбранных товаров (`↑`, `↓`, remove).

Загрузка изображения:
- можно ввести URL вручную;
- можно загрузить файл через `POST /api/uploads` (`kind=image`), полученный URL подставляется в поле.

Multiselect поведение:
- выбранные товары подсвечиваются цветом в выпадающем списке;
- включен видимый scrollbar (`showScrollbar`);
- для wheel добавлен ручной scroll-хендлер для стабильной прокрутки списка внутри диалога.

## Публичная витрина

### Главная (`/`)

Файлы:
- `app/(site)/page.tsx`
- `components/print/homepage.tsx`

Что происходит:
- коллекции загружаются вместе с остальными данными (`Promise.all`);
- секция `Kolekcie` рендерится отдельно от `Top produkty`;
- показываются все активные коллекции текущей аудитории;
- сетка:
  - мобильные: 1 карточка в строке;
  - `md`: 2 колонки;
  - `lg+`: если коллекций нечётное количество, последняя карточка занимает `2x2` (`col-span-2 row-span-2`).

Мобильный вид карточки:
- заголовок коллекции показывается сверху на тёмной плашке;
- описание скрыто на мобильных;
- на `sm+` используется desktop-слой с заголовком и описанием справа.

### Страница коллекции (`/kolekcie/[slug]`)

Файл: `app/(site)/(content)/kolekcie/[slug]/page.tsx`

- коллекция грузится через `getCollectionBySlug(slug, audience)`;
- при отсутствии/скрытии коллекции — `notFound()` (404);
- товары выводятся grid-ом через `ProductCard`;
- если после фильтров товаров нет, показывается корректное пустое состояние;
- генерируются `metadata` и canonical URL.

## Связанные файлы

- `prisma/schema.prisma`
- `lib/cache-tags.ts`
- `lib/catalog.ts`
- `app/api/admin/collections/route.ts`
- `app/api/admin/collections/[collectionId]/route.ts`
- `app/(admin)/admin/kolekcie/page.tsx`
- `components/admin/admin-sidebar.tsx`
- `app/(admin)/admin/layout.tsx`
- `app/(site)/page.tsx`
- `components/print/homepage.tsx`
- `app/(site)/(content)/kolekcie/[slug]/page.tsx`
- `components/ui/combobox.tsx`

## Редактирование стилей

Ниже кратко, где менять внешний вид коллекций.

### Витрина (главная, блок `Kolekcie`)

Файл: `components/print/homepage.tsx`

- Сетка карточек:
  - класс контейнера секции коллекций (`grid-cols`, `gap`, `auto-rows`, `col-span/row-span`).
- Поведение «большой» последней карточки:
  - условие `isLastOddCollection` и передача `isWide` в `CollectionCard`.
- Карточка коллекции:
  - базовые размеры/рамка/hover (`CollectionCard` root `className`);
  - позиционирование и кроп изображения (`Image` с `object-*`);
  - мобильная плашка заголовка сверху (`sm:hidden`);
  - desktop/tablet текстовый слой справа (`sm:flex`) и типографика.
- Скрытие описания на мобильных:
  - делается через responsive-классы (`hidden sm:block` или мобильный/desktop split слоёв).

### Публичная страница коллекции (`/kolekcie/[slug]`)

Файл: `app/(site)/(content)/kolekcie/[slug]/page.tsx`

- Заголовок, описание, breadcrumb и пустое состояние.
- Сетка товаров коллекции (`grid gap-* sm:grid-cols-* xl:grid-cols-*`).

### Админка (`/admin/kolekcie`)

Файл: `app/(admin)/admin/kolekcie/page.tsx`

- Лэйаут страницы: таблица, кнопки, диалоги создания/редактирования.
- Размеры диалогов (`DialogContent`, `max-h-*`, `overflow-*`).
- Форма и блок сортировки товаров в коллекции.
- Стили dropdown для выбора товаров (подсветка выбранных пунктов).

Файл: `components/ui/combobox.tsx`

- Общие стили списка combobox.
- Видимость и контраст скроллбара через `showScrollbar`.
- Поведение скролла списка внутри popup (если требуется точечная настройка).
