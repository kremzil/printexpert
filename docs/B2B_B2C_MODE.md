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

**Cookie**
- `proxy.ts` — установка cookie при `?mode=` (30 дней) + редирект на URL без query.
- `app/api/audience/route.ts` — API для интерактивного переключателя.

**UI**
- `app/page.tsx` — экран выбора режима при первом визите.
- `app/layout.tsx` — аудитория‑зависимые header/footer в `<Suspense>`.
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

## Что ещё нужно (план)
1) Lead/Order endpoints с серверным пересчётом цены.
2) Аналитика событий с `audience`/`source`.
3) Правила фильтрации ассортимента под B2B/B2C (если нужно скрывать товары).

