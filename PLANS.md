# ExecPlan: Products in Postgres (Prisma) + Seed + DB-backed Storefront

> Project: Printexpert Next (Next.js App Router)  
> Scope: Move catalog/product pages from `data/*` to Postgres via Prisma, without changing UX/UI.  
> Non-goals: pricing matrices, payments, cart, accounts, external libs.

---

## Purpose

- Add domain tables `Category`, `Product`, `ProductImage` to Postgres via Prisma migrations.
- Add **idempotent seeds** from existing `data/categories.ts` + `data/products.ts`.
- Switch pages `/kategorie`, `/catalog`, `/product/[slug]` to read from DB via **server-only** functions in `lib/`.
- Preserve current UI/UX, texts (Slovak), and image paths from `public/products/*`.
- MVP scope: data model and seed are minimal and can be extended later (extra fields, multiple images, richer pricing).

---

## Context and Orientation

- Next.js App Router.
- Dev DB: PostgreSQL 16 in Docker (`docker-compose.yml`, service `shop-db`).
- Prisma already wired:
  - existing `User` model + initial migration.
  - Prisma client generated to `lib/generated/prisma`.
  - connection through `@prisma/adapter-pg` + `pg` pool (`lib/prisma.ts`).
- Storefront data currently from `data/*`.
- Images are served from `public/products/*` and referenced via URLs like `/products/.../*.webp`.

---

## Scope

### In scope
- Prisma schema: `Category`, `Product`, `ProductImage` (+ enum for price type).
- Migration for new tables.
- Seed mechanism that реально работает в репо (см. M3).
- Server-only read layer in `lib/`:
  - `getCategories()`
  - `getCategoryBySlug(slug)`
  - `getProducts({ categorySlug? })`
  - `getProductBySlug(slug)` (incl. category + images)
- Update pages:
  - `/kategorie`
  - `/catalog` (+ category filter)
  - `/product/[slug]` (+ notFound on missing/inactive)

### Non-goals (do not do)
- No pricing matrices logic.
- No checkout/cart/accounts.
- No external libraries.
- Do not delete `data/*` yet.

---

## Plan of Work (Milestones)

### M1 — Add Prisma models and relations (explicit DB types)
Implement in `prisma/schema.prisma`:

**IDs (Postgres UUID, not text)**
- Use Prisma pattern:
  - `id String @id @default(uuid()) @db.Uuid`

**Money/VAT (explicit precision/scale)**
- `priceFrom Decimal? @db.Decimal(12, 2)`
- `vatRate Decimal @default(0.20) @db.Decimal(4, 2)`

**Category**
- `id` UUID
- `slug` unique
- `name`
- `image` (string URL path, from existing `data/categories.ts`)
- `description?`
- `sortOrder` Int default 0
- `isActive` Boolean default true
- Optional: `parentId?` + self relation (ONLY if needed now; otherwise omit)

**Product**
- `id` UUID
- `slug` unique
- `name`
- `categoryId` FK -> Category
- `excerpt?`, `description?`
- `priceType` enum: `ON_REQUEST | FIXED | MATRIX | AREA`
- `priceFrom` Decimal? (see above)
- `vatRate` Decimal (see above)
- `isActive` Boolean default true
- `createdAt`, `updatedAt` timestamps

**ProductImage**
- `id` UUID
- `productId` FK -> Product
- `url` string (keep current paths like `/products/<...>.webp`)
- `alt?`
- `sortOrder` Int default 0
- `isPrimary` Boolean default false

**Indexes**
- unique: `Category.slug`, `Product.slug`
- index: `Product.categoryId`, `ProductImage.productId`

Acceptance for M1:
- Prisma schema validates.
- Prisma client generation succeeds.

---

### M2 — Create migration and ensure dev workflow
- Create Prisma migration for the new tables.
- Confirm it applies cleanly in dev (docker Postgres).

Acceptance for M2:
- Migration applies without errors.
- Tables exist in dev DB with expected types:
  - `id` columns are UUID
  - `priceFrom` is decimal(12,2)
  - `vatRate` is decimal(4,2) (or chosen)

---

### M3 — Implement idempotent seed from existing `data/*` (delete+recreate images)
Goal: reliable MVP seeding, repeatable.

**Seed entry**
Codex MUST detect what works in THIS repo:
- If `package.json -> prisma.seed` already configured: use it.
- Otherwise: add `npm run db:seed` that реально запускает TypeScript seed:
  - via `tsx`, `ts-node`, or node build step (choose what repo already uses).
- Document the chosen method in README/DEPLOY.md (short).

**Data sources**
- Read `data/categories.ts` and `data/products.ts`.
  - Map `Product.title` -> `Product.name` in DB seed.
  - Use `Product.image` as the initial (single) `ProductImage` entry.

**Upsert rules**
- Category: upsert by `slug`.
- Product: upsert by `slug`.
  - Resolve `categoryId` by mapping product's `categorySlug` (or equivalent field) to Category.
  - If category not found: **throw error and fail seed** (do not silently fallback).
  - Defaults for missing product pricing data from `data/products.ts`:
    - `priceType = ON_REQUEST`
    - `priceFrom = null`
    - `vatRate = 0.20`

**Images strategy (chosen)**
For each product:
- After Product upsert:
  - `deleteMany({ where: { productId } })`
  - `createMany({ data: [...] })` using image list from data
This is idempotent and avoids composite unique complexity.

Acceptance for M3:
- `db:seed` populates DB with categories/products/images.
- Running seed twice produces identical result (no duplicates; images stable).
- Seed fails fast if product references missing category.

---

### M4 — Add server-only data access layer in `lib/`
Create `lib/` functions (server-only; no API endpoints in this task):

**Activity rules**
- All reads must include `isActive = true` (categories and products).
- If slug found but `isActive=false` => treat as not found.

Functions:

- `getCategories()`  
  - `where: { isActive: true }`
  - `orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]`

- `getCategoryBySlug(slug)`  
  - `where: { slug, isActive: true }`

- `getProducts({ categorySlug? })`  
  - `where: { isActive: true, ...(category filter) }`
  - `orderBy: [{ name: 'asc' }]`

- `getProductBySlug(slug)`  
  - `where: { slug, isActive: true }`
  - `include: { category: true, images: true }`
  - Ensure returned images are sorted in a stable way:
    - `isPrimary desc`, then `sortOrder asc`, then `id asc`

Acceptance for M4:
- Functions compile and run on server.
- No client-side Prisma usage.

---

### M5 — Switch pages to DB reads (preserve UI/UX)
Update:

1) `/kategorie`
- Load via `getCategories()`.
- Same layout/texts.

2) `/catalog`
- Load via `getProducts({ categorySlug })`.
- Implement simplest category filter:
  - Query param `?cat=<slug>`
- Keep existing navigation intact; add minimal support for filter.

3) `/product/[slug]`
- Load via `getProductBySlug(slug)`.
- If null => `notFound()`.
- Keep current UI, “Na vyžiadanie”, and images.

Acceptance for M5:
- UI stays the same visually and textually (Slovak).
- Images still load from `public/products/*` with same URL paths.
- Inactive categories/products are not shown; direct access to inactive product slug -> 404.

---

### M6 — Final acceptance + summary output
Final check:
- Storefront reads from DB (not `data/*`).
- `data/*` remains in repo (not removed).

At the end, provide a short summary:
- Models added (with explicit db types).
- How to run migrations and seed (the actual working commands for this repo).
- Which pages now read from DB and how `?cat=` filter works.

---

## Validation and Acceptance (commands + expectations)

1) Start DB
- `docker compose up -d db` (or `docker compose up -d`)

2) Apply migrations
- `npx prisma migrate dev`

3) Seed
- `npm run db:seed` (or `npx prisma db seed` if configured)

4) Run Next dev
- `npm run dev`

Manual checks:
- `/kategorie`: categories list matches previous active set.
- `/catalog`: products list matches previous active set.
- `/catalog?cat=<slug>`: filters correctly.
- `/product/<slug>`: page works, images shown, “Na vyžiadanie” preserved.
- Nonexistent or inactive product slug => 404 via `notFound()`.

---

## Idempotence and Recovery

- Seed is repeatable:
  - upsert by slug for Category/Product
  - delete+recreate images per product
- Seed must fail fast on invalid category mapping (to avoid silent data corruption).
- If migration fails:
  - ensure UUID and Decimal annotations are set explicitly as specified in M1.

---

## Progress (keep updated with timestamps)

- [x] (2026-01-17 20:59) M1 Schema: add models with explicit @db types  
- [x] (2026-01-17 20:59) M2 Migration: create + apply in dev  
- [x] (2026-01-17 20:59) M3 Seed: upsert + delete+recreate images + working entry + docs  
- [x] (2026-01-17 21:00) M4 lib/: server-only read functions + explicit sorting  
- [x] (2026-01-17 21:06) M5 Pages: /kategorie, /catalog, /product/[slug] switched  
- [x] (2026-01-17 21:09) M6 Final validation + summary notes

---

## Decision Log (append entries)

- (2026-01-17) Category filter: use `?cat=<slug>` for minimal UI change.
- (2026-01-17) DB types: use `@db.Decimal(12,2)` for `priceFrom` and `@db.Decimal(4,2)` for `vatRate` to avoid Postgres defaults drift.
- (2026-01-17) IDs: use `String @db.Uuid @default(uuid())` so ids are UUID in Postgres.
- (2026-01-17) Seed images: **delete+recreate** per product (MVP simplicity; no composite unique).

---

## Surprises & Discoveries (append entries)

- (YYYY-MM-DD) Data model mismatch discovered: ...
- (YYYY-MM-DD) product->category mapping field differs from expected: ...
- (2026-01-17) `npm run dev` failed: `.next/dev/lock` exists because another Next dev server is already running.
- (2026-01-17) Prisma Client in `lib/generated/prisma` was stale (schema only had User), so ran `npm run prisma:generate`.

---

## Outcomes & Retrospective (fill at end)

- What shipped: Prisma models + migration, seed from `data/*`, DB-backed catalog pages + server-only read layer.
- What was deferred: None in this scope.
- Follow-ups: Run `npm run dev` after stopping the existing dev server to validate UI manually.
