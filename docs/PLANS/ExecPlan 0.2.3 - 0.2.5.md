# ExecPlan 0.2.3 → 0.2.5 (Stripe payments + Audit trail + Admin Orders)

Дата: 2026-01-29  
Проект: Printexpert Next  
Версия плана: 0.2.5-B (consolidated)  
Цель: Stripe Checkout + webhook как “истина” по оплате → audit истории статусов → усиленная админка заказов (поиск/фильтры/индексы).

---

## Purpose

- Добавить платежный поток через Stripe Checkout Session с серверным пересчетом суммы.
- Реализовать Stripe webhook с проверкой подписи и идемпотентной обработкой событий.
- Добавить audit trail изменения статусов заказа (`OrderStatusHistory`) и отображение в админке.
- Усилить админку заказов: фильтры, поиск, сортировка + checklist индексов.

---

## Constraints

- Агент **НЕ запускает миграции** и не проверяет БД командами. Он:
  - вносит изменения в код/Prisma schema,
  - обновляет документацию “что запустить вручную”.
- Сумма платежа всегда серверная. Клиент не передает totals.
- Webhook — единственный источник истины по успешной оплате.
- Идемпотентность webhook обязательна (`StripeEvent` по `event.id`).
- Не добавлять лишних внешних библиотек (Stripe SDK допустим).

---

## Scope

### In scope (0.2.3)
- Prisma: поля оплаты в `Order` + enum’ы + индексы.
- Endpoint: `POST /api/stripe/checkout-session`
- Endpoint: `POST /api/stripe/webhook`
- Prisma: `StripeEvent` для идемпотентности

### In scope (0.2.4)
- Prisma: `OrderStatusHistory`
- Запись истории при:
  - изменении статуса из админки
  - webhook-изменениях (если меняют OrderStatus)
- UI: блок “History” в `/admin/orders/[orderId]`
- (опционально) упрощенная история в `/account/orders/[orderId]`

### In scope (0.2.5)
- Админка: список заказов с фильтрами/поиском/сортировкой
- Checklist индексов БД (добавить/проверить в Prisma schema)

### Non-goals
- Uploads/OrderAsset/Notifications (это ExecPlan A).
- Refund flow UI (можно только фиксировать `REFUNDED` по webhook).
- Накопительные скидки, B2B спец-логика.
- Внешние аналитические системы.

---

## Decisions (фиксируем заранее)

### D1 — OrderStatus на успешную оплату (M4)
- На `checkout.session.completed`:
  - `Order.paymentStatus = PAID`
  - `Order.paidAt = now`
  - `Order.status = CONFIRMED` (если текущий `OrderStatus` не имеет отдельного `PAID`)
- Причина: `paymentStatus` отвечает за оплату, а `OrderStatus` — за бизнес-стадию заказа.

### D2 — Permission для создания checkout-session (M2)
- Разрешить: **owner + ADMIN**.

### D3 — Refund events (M3)
- Слушать **оба**:
  - `charge.refunded` (быстрый сигнал)
  - `refund.updated` (истина по финальному статусу `succeeded|pending|failed|canceled`)
- Финальный `paymentStatus=REFUNDED` ставим по `refund.updated` при `status === "succeeded"`.
- При `refund.updated` со `failed` — лог/alert (без UI, но фиксируем как событие).

### D4 — Abandoned checkout (M3)
- Обрабатываем `checkout.session.expired`.
- Поведение по умолчанию: `paymentStatus = FAILED` (или оставить `PENDING` — но для админки и UX проще FAILED).
- Принято: **ставим FAILED** на expired, если заказ еще не PAID.

---

## Milestones

### M1 — Prisma: payment fields on Order (+ indexes)

#### Изменения в `Order`
Добавить:
- `paymentStatus` enum: `UNPAID | PENDING | PAID | FAILED | REFUNDED`
- `paymentProvider` enum: `STRIPE`
- `stripePaymentIntentId` String? (nullable)
- `stripeCheckoutSessionId` String? (nullable)
- `paidAt` DateTime? (nullable)

#### Indexes / constraints
- `stripePaymentIntentId` unique (nullable unique)
- `stripeCheckoutSessionId` unique (nullable unique)
- `paymentStatus` index (для фильтров админки)

#### Acceptance
- Prisma schema компилируется.
- Nullable unique реализован корректно (в Postgres допускается несколько NULL).

---

### M2 — Endpoint: create Stripe Checkout Session (server-side totals)

`POST /api/stripe/checkout-session`

#### Input
- `{ orderId }`

#### Server behavior
- Auth required.
- Permission: **owner of order OR ADMIN** (D2).
- Validate:
  - order exists
  - `paymentStatus` not `PAID`
  - order allowed for payment (если есть правило — описать, иначе пропустить)
- Recalculate totals server-side:
  - использовать единый серверный калькулятор totals (не из клиента)
- Create Stripe Checkout Session:
  - обязательно связать заказ:
    - `metadata: { orderId }`
    - `client_reference_id = orderId` (fallback)
  - success_url/cancel_url → ваши `/checkout/success` и `/checkout/cancel` (или эквивалент)
- Persist:
  - save `stripeCheckoutSessionId`
  - set `paymentStatus = PENDING`
  - set `paymentProvider = STRIPE`
- Return:
  - `{ url }` для redirect

#### Acceptance
- Невозможно создать сессию по “клиентской сумме”.
- Повторный вызов на уже оплаченный заказ — отказ.
- orderId надежно доступен webhook через metadata/client_reference_id.

---

### M3 — Endpoint: Stripe webhook (signature + idempotency)

`POST /api/stripe/webhook`

#### Signature verification (Next.js App Router)
- Read raw body: `await req.text()`
- Get signature: `req.headers.get('stripe-signature')`
- Verify: `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`

#### Idempotency (StripeEvent)
- Store `StripeEvent` with `id = event.id` (unique / PK).
- If event already processed: return 200 immediately.

#### Event handling (minimal set)
1) `checkout.session.completed` (истина по оплате в Checkout)
- Find `orderId`:
  - `data.object.metadata.orderId` (primary)
  - `data.object.client_reference_id` (fallback)
- Update order:
  - `paymentStatus = PAID`
  - `paidAt = now`
  - save `stripeCheckoutSessionId` (если еще не сохранен)
  - save `stripePaymentIntentId` (если доступен в объекте сессии)
- Apply D1:
  - set `Order.status = CONFIRMED` (если еще не confirmed)
  - write history row if OrderStatus changed

2) `checkout.session.expired`
- Find orderId as above
- If order not PAID:
  - set `paymentStatus = FAILED` (D4)

3) `payment_intent.payment_failed`
- If you can link order by stored `stripePaymentIntentId`:
  - set `paymentStatus = FAILED`

4) Refunds
- `charge.refunded`:
  - fast signal; optional interim log/note (не обязательно менять статус здесь)
- `refund.updated`:
  - if `refund.status === 'succeeded'`:
    - set `paymentStatus = REFUNDED`
  - if `refund.status === 'failed'`:
    - log/alert (без UI)

#### Implementation notes
- Use DB transaction where appropriate:
  - insert StripeEvent + update Order + (optional) insert history
- Avoid double-writing history on duplicate events.
- Webhook always returns 2xx for handled/unhandled events (after signature ok).

#### Acceptance
- Duplicate webhook calls don’t create duplicate updates.
- Signature verification is enforced (reject without valid signature).
- Idempotency is guaranteed by `StripeEvent`.

---

### M4 — Decision: OrderStatus transition on payment (explicit rule)

**Chosen (D1):**
- On `checkout.session.completed`:
  - `paymentStatus=PAID`
  - `paidAt=now`
  - `OrderStatus=CONFIRMED`

Acceptance:
- Status transitions are consistent everywhere (admin UI + webhook).

---

### M5 — Prisma: OrderStatusHistory + write points

Add model:

**OrderStatusHistory**
- `id`
- `orderId`
- `fromStatus`
- `toStatus`
- `changedByUserId` nullable (system changes = null)
- `note` nullable
- `createdAt`

Write history when:
- Admin changes status in `/admin/orders/[orderId]`:
  - create history row with `changedByUserId = admin.id`
- Webhook changes OrderStatus (if it does):
  - create history row with `changedByUserId = null`
  - `note = stripe:webhook:<eventId>`

Acceptance:
- Every OrderStatus change creates exactly one history row.
- Webhook-driven changes are traceable.

---

### M6 — UI: show History block in admin order detail

Page: `/admin/orders/[orderId]`
- Add “History” section:
  - list rows newest-first
  - show: time, from→to, user/system, note
- Performance:
  - fetch history in the same query (avoid N+1)

(Optionally) `/account/orders/[orderId]`:
- show simplified status history (optional; document decision if shipped)

Acceptance:
- History appears and is readable.
- No extra DB load per row.

---

### M7 — Admin orders list: filters/search/sort (performance-minded)

Upgrade `/admin/orders`:
- Filters (server-side):
  - status (multi)
  - paymentStatus (optional but useful)
  - date from/to (createdAt)
- Search by (server-side):
  - orderNumber
  - customerEmail/email
  - name (если хранится)
- Sort:
  - newest/oldest (createdAt)
  - (optional) by status

Acceptance:
- Filtering is server-side (not client-only).
- Query uses indexes where possible (see M8).

---

### M8 — DB indexes checklist (Prisma schema updates)

Ensure / add indexes:
- `Order.createdAt`
- `Order.status`
- `Order.paymentStatus`
- `Order.orderNumber` unique
- `Order.userId`
- `Order.audience`
- `Order.email` or `Order.customerEmail` (что реально есть)

Acceptance:
- Indexes defined in Prisma schema (or documented if already present).
- Search/filter fields exist; if not, record in Surprises.

---

## Stripe Webhooks Recommendations (Appendix)

This appendix is the “one-file” summary of Stripe webhook best practices used by this ExecPlan.

### A1) Signature verification (App Router)

- Read raw body: `await req.text()`
- Signature header: `req.headers.get('stripe-signature')`
- Verify: `stripe.webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET)`

### A2) Local testing (Stripe CLI)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
Use the shown whsec_... as STRIPE_WEBHOOK_SECRET in .env.local.
```

## A3) Checkout events as source of truth

- **Paid:** `checkout.session.completed`
- **Abandoned/expired:** `checkout.session.expired`
- **Refund lifecycle:** `refund.updated` (final), optional `charge.refunded` (fast signal)

## A4) Passing orderId

Recommended: set both

- `metadata: { orderId }` (primary)
- `client_reference_id: orderId` (fallback)

---

# Validation and Acceptance (manual verification)

## Stripe

- [ ] checkout session создаётся только на серверной сумме
- [ ] после оплаты webhook ставит `paymentStatus=PAID` и `paidAt`
- [ ] webhook идемпотентен (`StripeEvent`)
- [ ] `orderId` reliably привязан к Stripe событию (`metadata`/`client_reference_id`)
- [ ] заказ отображается как **PAID** в админке/аккаунте

## Audit

- [ ] все изменения `OrderStatus` пишутся в `OrderStatusHistory`
- [ ] история отображается в админке

## Admin Orders

- [ ] фильтры/поиск работают
- [ ] индексы покрывают основные запросы

---

# Env checklist

## Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Auth

- `NEXTAUTH_SECRET`

---

# Manual steps (you run these)

After code/schema changes:

## Apply Prisma migrations

- `npx prisma migrate dev` (dev)
- `npx prisma migrate deploy` (prod)

## Stripe setup

- Configure webhook endpoint URL in Stripe dashboard or Stripe CLI.
- Set signing secret `STRIPE_WEBHOOK_SECRET`.

## Local dev webhook testing (recommended)

- Forward webhooks:
  - `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Use printed signing secret `whsec_...` in `.env.local`.
- Run a real Checkout flow and confirm webhook updates DB.

---

# Progress (keep updated with timestamps)

- [x] (2026-01-29 15:51) M1 Prisma: Order payment fields + enums + indexes
- [x] (2026-01-29 15:51) M2 API: `POST /api/stripe/checkout-session`
- [x] (2026-01-29 15:51) M3 API: `POST /api/stripe/webhook` (signature + `StripeEvent` idempotency)
- [x] (2026-01-29 15:51) M4 Decision: OrderStatus transition on payment finalized
- [x] (2026-01-29 15:51) M5 Prisma: `OrderStatusHistory` + write points
- [x] (2026-01-29 15:51) M6 UI: Admin order History block
- [x] (2026-01-29 15:51) M7 UI: Admin orders list filters/search/sort
- [x] (2026-01-29 15:51) M8 DB: index checklist reflected in Prisma schema
- [ ] (YYYY-MM-DD HH:MM) Final: acceptance checklist reviewed + summary notes

---

# Surprises & Discoveries (append entries)

- (YYYY-MM-DD) Existing Order model lacks `customerEmail`/`name` fields used for admin search; decision taken.
- (YYYY-MM-DD) Existing pricing calculation unavailable in route handler; refactor needed.
- (YYYY-MM-DD) OrderStatus enum differs from expected; mapping adjusted.

---

# Outcomes & Retrospective (fill at end)

- What shipped:
- What was deferred:
- Follow-ups:
