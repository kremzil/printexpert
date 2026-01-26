# Система корзины и заказов

Дата создания: 2026-01-26

## Общее описание

Полностью функциональная e-commerce система с корзиной, оформлением заказов и управлением в админке. Реализована с учетом следующих принципов:
- **Серверный расчет цен** — единственный источник истины для всех цен
- **Type safety** — строгая типизация без `any`
- **Поддержка гостей** — корзина работает без авторизации через sessionId
- **B2B/B2C учет** — режим аудитории сохраняется в заказе

## Архитектура

### Модели данных (Prisma)

#### Cart
```prisma
model Cart {
  id        String     @id @default(cuid())
  userId    String?    @unique
  sessionId String?    @unique
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  user      User?      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Особенности:**
- Связь через `userId` (авторизованные) или `sessionId` (гости)
- Unique constraint гарантирует одну корзину на пользователя/сессию
- Cascade delete при удалении пользователя

#### CartItem
```prisma
model CartItem {
  id              String   @id @default(cuid())
  cartId          String
  productId       String
  quantity        Int
  width           Decimal? @db.Decimal(10, 2)
  height          Decimal? @db.Decimal(10, 2)
  selectedOptions Json?
  priceSnapshot   Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  cart            Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product         Product  @relation(fields: [productId], references: [id])
}
```

**Особенности:**
- `priceSnapshot` — кэшированная цена для UI (не используется при создании заказа!)
- `selectedOptions` — JSON с выбранными опциями калькулятора
- `width`, `height` — параметры размеров (Decimal для точности)

#### Order
```prisma
model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique
  userId          String?
  audience        String
  status          OrderStatus @default(PENDING)
  subtotal        Decimal     @db.Decimal(10, 2)
  vatAmount       Decimal     @db.Decimal(10, 2)
  total           Decimal     @db.Decimal(10, 2)
  customerName    String
  customerEmail   String
  customerPhone   String?
  shippingAddress Json?
  billingAddress  Json?
  notes           String?     @db.Text
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  user            User?       @relation(fields: [userId], references: [id])
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  COMPLETED
  CANCELLED
}
```

**Особенности:**
- `orderNumber` — уникальный читаемый номер заказа
- `audience` — сохраненный режим B2B/B2C
- `status` — enum для жизненного цикла заказа
- `userId` nullable — поддержка гостевых заказов

#### OrderItem
```prisma
model OrderItem {
  id              String  @id @default(cuid())
  orderId         String
  productId       String
  productName     String
  quantity        Int
  width           Decimal? @db.Decimal(10, 2)
  height          Decimal? @db.Decimal(10, 2)
  selectedOptions Json?
  priceNet        Decimal  @db.Decimal(10, 2)
  priceVat        Decimal  @db.Decimal(10, 2)
  priceGross      Decimal  @db.Decimal(10, 2)
  priceSnapshot   Json?
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product         Product  @relation(fields: [productId], references: [id])
}
```

**Особенности:**
- `productName` — копия названия на момент заказа (защита от изменений)
- Отдельные поля `priceNet`, `priceVat`, `priceGross` — зафиксированные цены
- `priceSnapshot` — полный расчет цены для аудита

#### OrderAsset
Файлы, прикрепленные к заказу (графика, превью, инвойсы).

**Ключевые поля:**
- `orderId`, `orderItemId` (опционально)
- `kind`: ARTWORK | PREVIEW | INVOICE | OTHER
- `status`: PENDING | UPLOADED | APPROVED | REJECTED
- `fileNameOriginal`, `mimeType`, `sizeBytes`
- `bucket`, `objectKey`, `region`

## Server Actions

### lib/cart.ts

**Функции для управления корзиной:**

```typescript
// Получить или создать корзину
export async function getOrCreateCart(sessionId?: string): Promise<Cart | null>

// Добавить товар (с проверкой дубликатов)
export async function addToCart(
  data: CartItemData & { priceSnapshot?: PriceSnapshot },
  sessionId?: string
): Promise<CartItem>

// Обновить количество (удаляет если <= 0)
export async function updateCartItem(
  itemId: string, 
  quantity: number, 
  priceSnapshot?: PriceSnapshot
): Promise<CartItem | null>

// Удалить товар
export async function removeFromCart(itemId: string): Promise<CartItem>

// Очистить корзину
export async function clearCart(sessionId?: string): Promise<void>

// Получить корзину с итогами
export async function getCart(sessionId?: string): Promise<CartData | null>

// Объединить гостевую корзину при входе
export async function mergeGuestCart(
  guestSessionId: string, 
  userId: string
): Promise<void>
```

**Логика проверки дубликатов:**
```typescript
const existingItem = cart.items.find(
  (item) =>
    item.productId === data.productId &&
    item.width?.toString() === data.width?.toString() &&
    item.height?.toString() === data.height?.toString() &&
    JSON.stringify(item.selectedOptions) === JSON.stringify(data.selectedOptions)
);
```

### lib/orders.ts

**Функции для управления заказами:**

```typescript
// Создать заказ (с ОБЯЗАТЕЛЬНЫМ пересчетом цен!)
export async function createOrder(
  checkoutData: CheckoutData,
  audienceContext: AudienceContext
): Promise<OrderData>

// Получить заказы пользователя
export async function getUserOrders(): Promise<OrderData[]>

// Получить заказ по ID
export async function getOrderById(orderId: string): Promise<OrderData | null>

// Получить заказ по номеру
export async function getOrderByNumber(orderNumber: string): Promise<OrderData | null>
```

**КРИТИЧНО: Серверный пересчет при создании заказа:**
```typescript
// Для каждого товара в корзине пересчитываем цену
const freshPrice = await calculate({
  productId: item.productId,
  quantity: item.quantity,
  width: item.width ? Number(item.width) : undefined,
  height: item.height ? Number(item.height) : undefined,
  selectedOptions: item.selectedOptions,
  audience: audienceContext.audience,
});

// Используем ТОЛЬКО серверные цены, игнорируем priceSnapshot из корзины!
const itemNet = new Prisma.Decimal(freshPrice.net);
const itemVat = new Prisma.Decimal(freshPrice.vatAmount);
const itemGross = new Prisma.Decimal(freshPrice.gross);
```

**Сериализация Decimal для клиента:**
```typescript
return orders.map(order => ({
  ...order,
  subtotal: Number(order.subtotal),
  vatAmount: Number(order.vatAmount),
  total: Number(order.total),
  items: order.items.map(item => ({
    ...item,
    width: item.width ? Number(item.width) : null,
    height: item.height ? Number(item.height) : null,
    priceNet: Number(item.priceNet),
    priceVat: Number(item.priceVat),
    priceGross: Number(item.priceGross),
  })),
}));
```

## API Routes

### Cart API
- `GET /api/cart` — получение корзины с cookie sessionId
- `POST /api/cart/add` — добавление товара
- `PATCH /api/cart/[itemId]` — обновление количества
- `DELETE /api/cart/[itemId]` — удаление товара
- `POST /api/cart/clear` — очистка корзины

**Пример ответа GET /api/cart:**
```json
{
  "id": "clx123...",
  "items": [
    {
      "id": "clx456...",
      "productId": "clx789...",
      "quantity": 100,
      "width": 210,
      "height": 297,
      "selectedOptions": {
        "paper": "135g",
        "print": "full-color"
      },
      "priceSnapshot": {
        "net": 45.50,
        "vatAmount": 9.10,
        "gross": 54.60,
        "currency": "EUR",
        "calculatedAt": "2026-01-26T10:30:00Z"
      },
      "product": {
        "id": "clx789...",
        "name": "Letáky A4",
        "slug": "letaky-a4",
        "priceType": "WP_CALCULATOR"
      }
    }
  ],
  "totals": {
    "subtotal": 45.50,
    "vatAmount": 9.10,
    "total": 54.60
  }
}
```

### Orders API
- `POST /api/checkout` — создание заказа
- `GET /api/orders` — список заказов пользователя
- `GET /api/orders/[orderId]` — детали заказа
- `POST /api/uploads/presign` — presigned PUT для загрузки файла
- `POST /api/uploads/confirm` — подтверждение загрузки (HEAD)
- `GET /api/orders/[orderId]/assets` — список файлов заказа
- `GET /api/assets/[assetId]/download` — 302 redirect на presigned GET

**Тело POST /api/checkout:**
```json
{
  "customerName": "Ján Novák",
  "customerEmail": "jan@example.com",
  "customerPhone": "+421901234567",
  "notes": "Prosím doručiť ráno"
}
```

**Ответ:**
```json
{
  "id": "clx999...",
  "orderNumber": "ORD-1738024800-ABC123",
  "status": "PENDING",
  "audience": "b2c",
  "total": 54.60,
  "items": [...]
}
```

### Admin API
- `PATCH /api/admin/orders/[orderId]/status` — изменение статуса заказа (только ADMIN)

**Тело запроса:**
```json
{
  "status": "CONFIRMED"
}
```

## UI Компоненты

### Страницы

#### /cart (app/cart/page.tsx)
- Отображение корзины с товарами
- Управление количеством через +/- кнопки
- Удаление товаров
- Подсчет итогов
- Переход к оформлению

#### /checkout (app/checkout/page.tsx)
- Форма контактных данных
- Валидация полей
- Создание заказа через API
- Redirect на страницу заказа с ?success=true

#### /account/orders (app/account/orders/page.tsx)
- Список заказов пользователя
- Сортировка по дате (новые сверху)
- Карточки с основной информацией
- Переход к деталям заказа

#### /account/orders/[orderId] (app/account/orders/[orderId]/page.tsx)
- Детальная информация о заказе
- Success alert при ?success=true
- Список товаров с ценами
- Контактные данные
- Статус заказа
- Блок загрузки “Nahrať grafiku” + список файлов + скачивание

#### /admin/orders (app/admin/orders/page.tsx)
- Список всех заказов системы
- Фильтрация по статусу
- Информация о клиенте
- Переход к управлению заказом

#### /admin/orders/[orderId] (app/admin/orders/[orderId]/page.tsx)
- Полная информация о заказе
- Dropdown для изменения статуса
- Связанный пользовательский аккаунт
- Все товары и суммы

### Компоненты

#### components/cart/cart-button.tsx
Mini-cart в хедере:
- Badge с количеством товаров
- Обновление через event listener "cart-updated"
- Fetch корзины при монтировании

#### components/cart/cart-content.tsx
Основное содержимое корзины:
- Список CartItem с картинками
- Quantity controls с optimistic updates (useTransition)
- Кнопка удаления товара
- Расчет итогов
- Кнопка "Pokračovať k pokladni"
- Отображение выбранного файла (миниатюра/заглушка) в карточке товара

#### components/cart/checkout-form.tsx
Форма оформления заказа:
- Поля: meno, email, telefón, poznámka
- Client-side валидация (required)
- Submit через fetch к /api/checkout
- Dispatch "cart-updated" после успеха
- Redirect на /account/orders/[id]?success=true
- Если выбран файл в корзине, выполняется upload (presign → PUT → confirm) после создания заказа

#### components/cart/orders-list.tsx
Список заказов пользователя:
- Карточки Order
- Badge статуса
- Форматирование даты (sk-SK)
- Форматирование цены (€)
- Link на детали заказа

#### components/cart/order-detail.tsx
Детали заказа:
- Success alert (conditional)
- Статус badge
- Список OrderItem
- Контактные данные
- Суммы (subtotal, VAT, total)
- Audience режим
- Кнопка "Späť na objednávky"

#### components/admin/admin-orders-list.tsx
Список заказов в админке:
- Карточки с расширенной информацией
- Данные клиента + связанный аккаунт
- Количество товаров
- Сумма заказа
- Кнопка "Detail"

#### components/admin/admin-order-detail.tsx
Детали заказа в админке:
- Dropdown изменения статуса
- Loader при обновлении
- Полная информация о клиенте
- Связанный user account
- Список товаров
- Все суммы

## Типы (TypeScript)

### types/cart.ts
```typescript
export interface CartItemData {
  productId: string;
  quantity: number;
  width?: number;
  height?: number;
  selectedOptions?: Record<string, unknown>;
}

export interface PriceSnapshot {
  net: number;
  vatAmount: number;
  gross: number;
  currency: string;
  calculatedAt: string;
}

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  width: number | null;
  height: number | null;
  selectedOptions: unknown;
  priceSnapshot: PriceSnapshot | null;
  product: {
    id: string;
    name: string;
    slug: string;
    priceType: string;
    images: Array<{ url: string; alt: string | null }>;
  };
}

export interface CartData {
  id: string;
  items: CartItemWithProduct[];
  totals: {
    subtotal: number;
    vatAmount: number;
    total: number;
  };
}
```

### types/order.ts
```typescript
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";

export interface CheckoutData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  notes?: string;
}

export interface OrderItemData {
  productId: string;
  productName: string;
  quantity: number;
  width?: number;
  height?: number;
  selectedOptions?: Record<string, unknown>;
  priceNet: number;
  priceVat: number;
  priceGross: number;
  priceSnapshot?: unknown;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  audience: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress?: unknown;
  billingAddress?: unknown;
  notes?: string | null;
  items: OrderItemData[];
  createdAt: Date;
  updatedAt: Date;
}
```

## Интеграция с калькулятором цен

### Страница товара (components/product/price-calculator-letaky.tsx)

**Обе кнопки добавляют в корзину:**
- Кнопка “Nahrať grafiku a objednať” позволяет выбрать файл, который отображается в корзине и загружается после оформления заказа.
```typescript
const addToCart = async (uploadNow: boolean) => {
  // 1. Получаем серверную цену
  const priceResponse = await fetch("/api/price", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      quantity: formData.quantity,
      width: formData.customWidth,
      height: formData.customHeight,
      selectedOptions: formData.options,
    }),
  });
  
  const priceData = await priceResponse.json();
  
  // 2. Добавляем в корзину с priceSnapshot
  const cartResponse = await fetch("/api/cart/add", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      quantity: formData.quantity,
      width: formData.customWidth,
      height: formData.customHeight,
      selectedOptions: formData.options,
      priceSnapshot: {
        net: priceData.net,
        vatAmount: priceData.vatAmount,
        gross: priceData.gross,
        currency: "EUR",
        calculatedAt: new Date().toISOString(),
      },
    }),
  });
  
  // 3. Обновляем UI корзины
  window.dispatchEvent(new Event("cart-updated"));
  
  // 4. Переход на страницу корзины
  router.push("/cart");
};
```

## Ключевые паттерны

### 1. Серверный расчет - источник истины
```typescript
// ❌ НЕПРАВИЛЬНО - использовать priceSnapshot из корзины
const orderItem = {
  priceNet: item.priceSnapshot.net, // НЕ делайте так!
};

// ✅ ПРАВИЛЬНО - пересчитать на сервере
const freshPrice = await calculate({
  productId: item.productId,
  quantity: item.quantity,
  // ... остальные параметры
});
const orderItem = {
  priceNet: new Prisma.Decimal(freshPrice.net),
};
```

### 2. Decimal сериализация для клиента
```typescript
// Server Component
const order = await prisma.order.findUnique({ where: { id } });

// ❌ НЕПРАВИЛЬНО - передать Decimal напрямую
return <OrderDetail order={order} />; // Error!

// ✅ ПРАВИЛЬНО - сериализовать в number
return <OrderDetail order={{
  ...order,
  total: Number(order.total),
  subtotal: Number(order.subtotal),
  vatAmount: Number(order.vatAmount),
}} />;
```

### 3. Event-based обновление UI
```typescript
// После изменения корзины (добавление/удаление/checkout)
window.dispatchEvent(new Event("cart-updated"));

// В компоненте CartButton
useEffect(() => {
  const handleCartUpdate = () => fetchCart();
  window.addEventListener("cart-updated", handleCartUpdate);
  return () => window.removeEventListener("cart-updated", handleCartUpdate);
}, []);
```

### 4. Session-based гостевые корзины
```typescript
// В API route
import { cookies } from "next/headers";

const cookieStore = await cookies();
let sessionId = cookieStore.get("sessionId")?.value;

if (!sessionId) {
  sessionId = crypto.randomUUID();
  cookieStore.set("sessionId", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 дней
  });
}

const cart = await getOrCreateCart(sessionId);
```

### 5. Suspense для Prisma queries
```typescript
// ❌ НЕПРАВИЛЬНО - blocking route
export default async function OrderPage({ params }) {
  const order = await getOrderById(params.id);
  return <OrderDetail order={order} />;
}

// ✅ ПРАВИЛЬНО - с Suspense
async function OrderContent({ orderId }) {
  const order = await getOrderById(orderId);
  if (!order) notFound();
  return <OrderDetail order={order} />;
}

export default async function OrderPage({ params }) {
  const { orderId } = await params;
  return (
    <Suspense fallback={<Skeleton />}>
      <OrderContent orderId={orderId} />
    </Suspense>
  );
}
```

## Безопасность

### Защита API
```typescript
// Cart API - требует sessionId или userId
const session = await auth();
const sessionId = session?.user?.id || cookieStore.get("sessionId")?.value;
if (!sessionId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Orders API - требует авторизацию
const session = await auth();
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Admin API - требует ADMIN роль
const session = await auth();
if (!session?.user || session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

### Валидация данных
- Email валидация на клиенте (HTML5) и сервере (будущее: Zod)
- Обязательные поля: customerName, customerEmail
- Проверка существования товара перед добавлением в корзину
- Проверка прав доступа к заказу (userId match)

## Performance оптимизации

### Database queries
- Include только необходимые relations
- Select для ограничения полей
- Index на userId, sessionId, orderNumber

### Client-side
- useTransition для optimistic updates
- Event-based updates вместо polling
- Lazy loading компонентов

### Caching
- PriceSnapshot кэширует расчет для UI
- НО: всегда пересчитывается при checkout!

## Troubleshooting

### Проблема: Badge корзины не обновляется
**Решение:** Проверьте dispatch события "cart-updated" после операций с корзиной

### Проблема: Error "Only plain objects can be passed to Client Components"
**Решение:** Сериализуйте Prisma Decimal в number перед передачей в клиент

### Проблема: Цены в заказе не совпадают с корзиной
**Это нормально!** Цены пересчитываются при создании заказа через `lib/pricing.ts`

### Проблема: "Cannot find name 'JsonValue'"
**Решение:** Используйте локальный тип или unknown вместо Prisma JsonValue

## Будущие улучшения
- [ ] История изменений статуса
- [ ] Фильтры в списке заказов админки
- [ ] Export заказов в CSV/Excel
- [ ] Печать накладных
- [ ] Интеграция платежных систем
- [ ] Tracking номера доставки
