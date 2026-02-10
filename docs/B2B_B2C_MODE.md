# B2B_B2C_MODE.md

Документация по двойному режиму (B2B/B2C) в проекте Printexpert Next.

---

## Цель
Дать единый каталог и единый расчёт цены, но разные представления для B2B/B2C без дублей URL и SEO‑проблем.

---

## Ключевые определения
**AudienceContext**:
- `audience`: `b2b | b2c`
- `source`: `query | cookie | account | default`
- `expiresAt` (опционально)
- `locale/country` (опционально, на будущее)

---

## Определение режима (приоритеты)
1) Query `?mode=b2b|b2c`
2) Account preference (если появится авторизация)
3) Cookie `audience=b2b|b2c`
4) Default `b2c`

Правило: `query` всегда побеждает `cookie`.

---

## Где это реализовано
**Контекст аудитории**
- `lib/audience-shared.ts` — типы, константы, парсер.
- `lib/audience-context.ts` — серверный resolver.

## Видимость товаров по режимам
- Добавлены поля в модель `Product`: `showInB2b` и `showInB2c` (по умолчанию `true`).
- Админская карточка товара содержит чекбоксы `showInB2b` / `showInB2c` — можно скрыть товар в одном из режимов.
- Логика показа: витрина (`/catalog`) и страница товара (`/product/[slug]`) учитывают эти флаги для текущей аудитории. При попытке открыть страницу товара, скрытого для текущей аудитории, возвращается 404.

**Cookie**
- `proxy.ts` — установка cookie при `?mode=` (30 дней) + редирект на URL без query.
- `app/api/audience/route.ts` — API для интерактивного переключателя.

**UI**
- `app/(site)/page.tsx` — экран выбора режима при первом визите.
- `app/(site)/layout.tsx` — аудитория‑зависимые header/footer в `<Suspense>`.
- `components/audience-mode-switch.tsx` — интерактивный переключатель в хедере.

**Server Pricing**
- `app/api/price/route.ts` — серверный пересчёт цены.
- `lib/pricing.ts` — единый расчёт `net/vat/gross`.

---

## Как правильно делать контент
**Общий контент**
— Рисуем без `resolveAudienceContext()`, можно кешировать.

**Аудитория‑зависимый контент**
— Отдельные небольшие server components, вызывающие `resolveAudienceContext()`.  
— Обязательно оборачивать в `<Suspense>`, чтобы не блокировать весь рендер.

Пример паттерна:
```tsx
<HomeCommon />
<Suspense fallback={null}>
  <HomeAudience />
</Suspense>
```

---

## Правила для SEO
- Canonical без `mode`.
- URL страницы единственный, режим — персонализация.

Текущее состояние:
- `app/catalog/page.tsx` — canonical `/catalog`.
- `app/product/[slug]/page.tsx` — canonical `/product/[slug]`.

---

## Переключение режима
**Через URL**
- `/ ?mode=b2b` или `/ ?mode=b2c`
- Proxy выставит cookie и редиректит на URL без `mode`.

**Через переключатель в хедере**
- Клиент вызывает `/api/audience` и делает `router.refresh()`.

---

## Top produkty на главной странице
- Отдельная конфигурация блока «Top produkty pre online tlač» для B2B и B2C режимов.
- Товары автоматически фильтруются по `showInB2b`/`showInB2c` в зависимости от текущей аудитории.
- Ручной выбор товаров (настраивается в `/admin/top-products`).
- Данные хранятся в `TopProducts` таблице с полями `audience`, `mode` (MANUAL), `productIds[]`.
- API endpoint `/api/top-products?audience={b2b|b2c}&count=8` возвращает товары с изображениями.

## B2B-специфичный функционал
- **Сохранённые корзины (SavedCart):** B2B клиенты могут сохранять корзины для повторных заказов
- **Cenová ponuka (PDF):** Генерация предварительного расчёта цены из корзины
  - API: `GET /api/cart/quote`
  - Кнопка в корзине для B2B пользователей
  - Подробная таблица с конфигурацией каждого товара
- Цены отображаются bez DPH по умолчанию

## Что ещё нужно (план)
1) [x] Lead/Order endpoints с серверным пересчётом цены — реализовано
2) [ ] Аналитика событий с `audience`/`source`
3) [ ] Дополнительные правила фильтрации ассортимента под B2B/B2C (если потребуется)
4) [ ] Ручное изменение порядка товаров в Top produkty (drag-and-drop)
