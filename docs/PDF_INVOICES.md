# Генерация PDF-счетов (Faktúry)

Дата создания: 2026-02-01

## Общее описание

Система генерации PDF-счетов для заказов с возможностью:
- **Автоматической генерации** при изменении статуса заказа
- **Ручной генерации** и отправки администратором
- **Скачивания** клиентом в личном кабинете
- **Настройки** через админку (данные компании, банковские реквизиты, визуал)

## Архитектура

### Технологии

| Компонент | Технология |
|-----------|------------|
| PDF-рендеринг | `@react-pdf/renderer` |
| Хранение | S3 (через `OrderAsset` с `kind: INVOICE`) |
| Отправка email | Nodemailer |
| Настройки | JSON в `ShopSettings.pdfSettings` |

### Структура модуля

```
lib/pdf/
├── index.ts              # Экспорты модуля
├── types.ts              # Типы данных и дефолтные настройки
├── invoice-template.tsx  # React-компонент шаблона счёта
├── generate-invoice.ts   # Логика генерации PDF
└── settings.ts           # Чтение/запись настроек из БД
```

## Модель данных

### ShopSettings.pdfSettings (JSON)

```typescript
interface PdfSettings {
  // Данные компании
  companyName: string;      // "SHARK.SK j.s.a."
  companyAddress: string;   // "Komenského 40"
  companyCity: string;      // "040 01 Košice"
  companyIco: string;       // "51154439"
  companyDic: string;       // "2120614628"
  companyIcDph: string;     // "SK2120614628"
  
  // Банковские реквизиты
  bankName: string;         // "ČSOB, a.s."
  bankBic: string;          // "CEKOSKBX"
  bankCode: string;         // "7500"
  bankIban: string;         // "SK41..."
  
  // Визуал PDF
  logoUrl: string;          // URL логотипа
  signatureUrl: string;     // URL подписи/печати
  footerText: string;       // Текст в päte
  
  // Автогенерация
  autoGenerateOnStatus: string;  // "CONFIRMED"
  autoSendEmail: boolean;        // true
  
  // Нумерация
  invoicePrefix: string;    // "" или "FV"
  invoiceNextNumber: number; // Следующий номер
  
  // Платёжные условия
  paymentDueDays: number;   // 14
}
```

### OrderAsset (kind: INVOICE)

Сгенерированные счета сохраняются как `OrderAsset` с:
- `kind: "INVOICE"`
- `status: "UPLOADED"`
- `mimeType: "application/pdf"`
- Хранение в S3: `invoices/{orderId}/{filename}.pdf`

## API Endpoints

### GET /api/orders/[orderId]/invoice

Скачивание PDF-счёта.

**Доступ:** Владелец заказа или ADMIN

**Response:** `application/pdf` файл

```typescript
// Пример использования
<a href={`/api/orders/${orderId}/invoice`} target="_blank">
  Stiahnuť faktúru
</a>
```

### POST /api/orders/[orderId]/invoice/send

Генерация и отправка счёта на email клиента.

**Доступ:** Только ADMIN

**Response:**
```json
{
  "success": true,
  "assetId": "clxxx...",
  "message": "Faktúra bola odoslaná na customer@email.sk"
}
```

### GET /api/admin/settings/pdf

Получение настроек PDF.

**Доступ:** Только ADMIN

### PUT /api/admin/settings/pdf

Обновление настроек PDF.

**Доступ:** Только ADMIN

**Body:** `Partial<PdfSettings>`

## Автоматическая генерация

При изменении статуса заказа через `/api/admin/orders/[orderId]/status`:

1. Проверяется `pdfSettings.autoGenerateOnStatus`
2. Если новый статус совпадает:
   - Генерируется PDF
   - Сохраняется в S3 как `OrderAsset`
   - Если `autoSendEmail: true` — отправляется на `customerEmail`

```typescript
// app/api/admin/orders/[orderId]/status/route.ts
if (pdfSettings.autoGenerateOnStatus === newStatus) {
  await generateAndSaveInvoice(orderId);
  if (pdfSettings.autoSendEmail) {
    await sendInvoiceEmail(orderId);
  }
}
```

## Шаблон счёта

Шаблон реализован как React-компонент с `@react-pdf/renderer`:

```tsx
// lib/pdf/invoice-template.tsx
<Document>
  <Page size="A4">
    {/* Шапка: логотип + данные компании */}
    <View style={styles.header}>
      <Image src={settings.logoUrl} />
      <Text>{company.name}</Text>
      ...
    </View>
    
    {/* Заголовок: FAKTÚRA */}
    <Text style={styles.title}>FAKTÚRA</Text>
    
    {/* Адреса: Odberateľ + Odoslať na + Детали */}
    <View style={styles.addressSection}>...</View>
    
    {/* Таблица позиций */}
    <View style={styles.table}>
      {items.map(item => (
        <View style={styles.tableRow}>
          <Text>{item.name}</Text>
          <Text>{item.quantity}</Text>
          <Text>{item.unitPrice} €</Text>
          ...
        </View>
      ))}
    </View>
    
    {/* Итоги + Банковые реквизиты */}
    <View style={styles.summarySection}>
      <View>{/* Банк, IBAN, VS */}</View>
      <View>{/* Spolu bez DPH, DPH, Spolu */}</View>
    </View>
    
    {/* Подпись/печать */}
    <Image src={settings.signatureUrl} />
    
    {/* Päta */}
    <Text style={styles.footer}>{settings.footerText}</Text>
  </Page>
</Document>
```

### Стилизация

Используются `StyleSheet.create()` с:
- Шрифт Roboto (CDN) для поддержки словацких символов
- Цвета: primary `#E65100`, text `#333`, border `#E0E0E0`
- Размер A4, padding 40px

## UI компоненты

### Админка: Настройки PDF

**Страница:** `/admin/settings` → таб "PDF / Faktúry"

**Компонент:** `components/admin/pdf-settings-form.tsx`

**Секции формы:**
1. **Údaje o firme** — название, адрес, IČO, DIČ, IČ DPH
2. **Bankové údaje** — банк, BIC, код, IBAN
3. **Číslovanie faktúr** — префикс, следующий номер, дни сплатности
4. **Automatická generácia** — статус для генерации, отправка email
5. **Vzhľad faktúry** — URL логотипа, подписи, текст päty

### Админка: Детали заказа

**Страница:** `/admin/orders/[orderId]`

**Добавлено:** Карточка "Faktúra" с кнопками:
- "Stiahnuť faktúru" — скачивание PDF
- "Odoslať faktúru e-mailom" — генерация + отправка

### Личный кабинет: Детали заказа

**Страница:** `/account/orders/[orderId]`

**Добавлено:** Кнопка "Stiahnuť faktúru" в блоке "Súhrn"

## Нумерация счетов

Формат: `{prefix}{YYMM} {00001}`

Пример: `2602 00004` (февраль 2026, счёт #4)

При каждой генерации `invoiceNextNumber` инкрементируется в БД.

## Функции модуля

### generateInvoicePdf(orderId)

Генерирует PDF buffer из данных заказа.

```typescript
const pdfBuffer = await generateInvoicePdf(orderId);
// Returns: Buffer
```

### generateAndSaveInvoice(orderId)

Генерирует PDF и сохраняет в S3 + создаёт OrderAsset.

```typescript
const assetId = await generateAndSaveInvoice(orderId);
// Returns: string (asset ID)
```

### sendInvoiceEmail(orderId)

Отправляет email с PDF-вложением.

```typescript
await sendInvoiceEmail(orderId);
// Returns: boolean
```

### getPdfSettings() / updatePdfSettings(settings)

Чтение/запись настроек из `ShopSettings.pdfSettings`.

## S3 интеграция

### Загрузка счёта

```typescript
// lib/s3.ts
export async function uploadInvoiceToS3(
  pdfBuffer: Buffer,
  orderId: string,
  fileName: string
): Promise<{ bucket: string; objectKey: string; region: string }>
```

### Скачивание счёта

```typescript
export async function getInvoiceFromS3(
  bucket: string,
  objectKey: string
): Promise<Buffer>
```

## Email уведомления

### sendInvoiceEmail

```typescript
// lib/notifications.ts
export async function sendInvoiceEmail(orderId: string): Promise<boolean>
```

**Содержимое письма:**
- Subject: `Faktúra k objednávke #ORD-XXX`
- Body: Приветствие + сумма заказа
- Attachment: PDF файл

## Миграция базы данных

```sql
-- 20260201184836_add_pdf_generation
ALTER TABLE "ShopSettings" ADD COLUMN "pdfSettings" JSONB;
```

## Конфигурация

### Дефолтные значения

При отсутствии настроек используются данные из `defaultPdfSettings`:

```typescript
// lib/pdf/types.ts
export const defaultPdfSettings: PdfSettings = {
  companyName: "SHARK.SK j.s.a.",
  companyAddress: "Komenského 40",
  companyCity: "040 01 Košice – mestská časť Sever",
  companyIco: "51154439",
  companyDic: "2120614628",
  companyIcDph: "SK2120614628",
  bankName: "Československá obchodná banka, a.s.",
  bankBic: "CEKOSKBX",
  bankCode: "7500",
  bankIban: "SK4175000000004025159032",
  // ...
};
```

### Требования к логотипу

- Формат: PNG или JPG
- Рекомендуемый размер: 200×80 px
- URL должен быть доступен публично

## Следующие шаги

- [ ] Генерация расчёта стоимости корзины (quote/estimate)
- [ ] Поддержка нескольких шаблонов
- [ ] Кастомные поля в счёте
- [ ] QR-код для платежа
