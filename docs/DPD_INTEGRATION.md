# DPD Integration (SK)

Актуальное описание интеграции DPD Shipper API и DPD Pickup Widget в проекте.

## Что реализовано

### Checkout
- Способы доставки:
  - `Osobný odber - Rozvojová 2, Košice` (`PERSONAL_PICKUP`)
  - `DPD kuriér` (`DPD_COURIER`)
  - `DPD Pickup/Pickup Station` (`DPD_PICKUP`)
- Способы оплаты:
  - `STRIPE` (карта)
  - `BANK_TRANSFER` (банковский перевод)
  - `COD` (dobierka)
- Для `DPD_PICKUP` выбор точки делается через DPD widget (`https://pus-maps.dpd.sk/lib/library.js`).
- В заказ сохраняются:
  - `deliveryMethod`
  - `paymentMethod`
  - `pickupPoint` (если pickup)
  - `dpdProduct` (после создания shipment)
  - DPD transport-поля (`carrierShipmentId`, `carrierParcelNumbers`, `carrierMeta` и т.д.)

### Admin
- Настройки DPD: вкладка в `/admin/settings`.
- Ручные действия по заказу:
  - `Vytvoriť DPD zásielku`
  - `Tlačiť štítky`
  - `Zrušiť DPD zásielku`

## DPD настройки (Admin -> Settings)

Хранятся в `ShopSettings.dpdSettings` (JSON).

Ключевые поля:
- `delisId`
- `clientEmail` (DPDSecurity.SecurityToken.Email)
- `apiKey` (DPDSecurity.SecurityToken.ClientKey)
- `senderAddressId`
- `bankAccountId` (нужен для COD)
- `defaultProduct`
- `labelFormat` (`A4`/`A6`)
- `labelPosition`
- `mapWidgetEnabled`
- `mapApiKey` (ключ карты, отдельный от API key shipment)
- `mapLanguage`
- `pickupDateOffsetDays`, `pickupTimeFrom`, `pickupTimeTo`

Важно:
- `DPD_API_BASE_URL` задаёт API среду (`https://api.dpd.sk` / test endpoint).
- Ключ для widget map и ключ для shipment API — разные сущности.

## API маршруты

### Public / Checkout
- `GET /api/shop-settings`
  - Возвращает `paymentSettings` + `dpdWidget` конфиг для checkout.
- `POST /api/checkout`
  - Валидация pickup/COD.
  - Создание заказа.

### Admin / DPD
- `GET /api/admin/settings/dpd`
- `PUT /api/admin/settings/dpd`
- `POST /api/admin/orders/[orderId]/dpd/shipment`
- `POST /api/admin/orders/[orderId]/dpd/labels`
- `POST /api/admin/orders/[orderId]/dpd/cancel`

Все admin-роуты требуют роль `ADMIN`.

## Логика shipment

`lib/dpd.ts -> createDpdShipment(orderId)`:
- Проверяет обязательные DPD настройки.
- Для `PERSONAL_PICKUP` shipment не создаётся.
- Продукт:
  - pickup: `17`
  - courier: `defaultProduct`
- COD добавляется в `services.cod` только при `paymentMethod === "COD"`.
- После успеха сохраняет:
  - `carrier = "DPD"`
  - `carrierShipmentId` (`mpsid`)
  - `carrierParcelNumbers`
  - `carrierMeta` (сырой ответ DPD)

## Логика печати labels

`lib/dpd.ts -> printDpdLabels(orderId)` поддерживает 2 режима:

1. Стандартный:
- есть `carrierParcelNumbers`
- вызывается `printLabels`

2. Fallback для TEST/edge-case:
- `carrierParcelNumbers` пустой
- берётся `label` URL из `carrierMeta` (`create` response)
- PDF скачивается по URL

Это закрывает кейс, когда DPD тестовая среда возвращает `mpsid + label`, но не отдаёт `parcelno[]`.

## Известные особенности

- Кнопка `Tlačiť štítky` в админке активна, если:
  - есть `carrierParcelNumbers`, или
  - есть `label` URL в `carrierMeta`.
- Отмена shipment (`Zrušiť DPD zásielku`) сейчас требует `carrierParcelNumbers`.
- В первом релизе shipment создаётся только вручную из админки.

## Быстрый smoke-check

1. Создать заказ `DPD_COURIER`.
2. В админке нажать `Vytvoriť DPD zásielku`.
3. Убедиться, что появился `Shipment ID`.
4. Нажать `Tlačiť štítky`:
   - либо через `printLabels` (parcel numbers),
   - либо через fallback `label` URL.
