# Figma: перенос UI и текущие изменения

Документ фиксирует, что уже перенесено из Figma в проект, и как дальше правильно продолжать перенос.

## Что уже перенесено

### UI-kit и визуальные токены
- Обновлены CSS-переменные темы в `app/globals.css`:
  - B2B/B2C палитры, акценты, фоновые и текстовые цвета.
  - Сохранён наш фон (сетка + градиент).
- Переработаны базовые компоненты shadcn/ui под новый стиль:
  - `components/ui/button.tsx`
  - `components/ui/badge.tsx`
  - `components/ui/card.tsx`
  - `components/ui/tabs.tsx`
  - `components/ui/accordion.tsx`
  - `components/ui/input.tsx`
  - `components/ui/textarea.tsx`
  - `components/ui/switch.tsx`

### Хедер
- Сохранили текущий хедер.
- Переключатель режимов B2B/B2C обновлён на новый UI:
  - `components/audience-mode-switch.tsx`

### Страница товара (полный перенос из Figma)
- Новая структура страницы и блоков:
  - Галерея, конфигуратор, загрузка файлов, табы, правая колонка, доверительные блоки.
- Реальный конфигуратор с калькуляцией цены и действиями корзины:
  - `components/print/use-wp-configurator.ts`
  - `components/print/real-configurator-panel.tsx`
- Новые вспомогательные компоненты страницы:
  - `components/print/configurator-option.tsx`
  - `components/print/quantity-selector.tsx`
  - `components/print/file-upload.tsx`
  - `components/print/trust-block.tsx`
  - `components/print/price-display.tsx`
  - `components/print/related-product-card.tsx`

### Связанные товары
- Подключены реальные товары из каталога по категории.
- Исключается текущий товар, выводится до 3 карточек.
- Источник: `getProducts` (сервер) + передача в клиент.

### Файл загрузки
- Загрузка файлов перенесена в блок «Nahrajte podklady».
- Файл сохраняется в `window.__pendingOrderUpload` до оформления заказа.

### Маркировка статичных блоков
- Визуальный бейдж «Statická ukážka» добавляется для секций, где ещё нет реальных данных.

### Изменения на уровне страницы
- Серверная часть:
  - `app/product/[slug]/page.tsx` получает:
    - `calculatorData` из `getWpCalculatorData` (если есть `wpProductId`)
    - `relatedProducts` из каталога
- Клиентская часть:
  - `app/product/[slug]/product-page-client.tsx`:
    - Рендерит реальный конфигуратор при наличии `calculatorData`
    - Иначе показывает статичный фолбэк с «Statická ukážka»

## Как дальше делать перенос из Figma

### 1) Подготовка
- Всегда начинайте с проверки существующих компонентов и токенов.
- Если есть похожий компонент — править его, а не создавать новый.
- Тексты в UI — только на словацком.

### 2) UI-kit
- Сверить цвета/типографику/радиусы с Figma.
- Править токены в `app/globals.css`.
- Обновлять/добавлять shadcn/ui компоненты в `components/ui/*`.

### 3) Страница/секция
- Начинать со статичной верстки (Server Components, без "use client").
- Только при необходимости интерактивности добавлять "use client".
- Компоненты уровня страницы складывать в `components/print/*`.

### 4) Данные
- Для каталога использовать серверные функции в `lib/catalog.ts`.
- Для цен и конфигуратора — `lib/wp-calculator.ts` и `/api/price`.
- Для корзины — `/api/cart/add` и `lib/cart.ts`.

### 5) Статичные элементы
- Если данных ещё нет, оставлять статичную копию из Figma, но помечать бейджем:
  - Компонент `StaticBadge` в `app/product/[slug]/product-page-client.tsx`.

### 6) Проверка
- Сверить визуал с Figma на странице `/product/[slug]`.
- Проверить:
  - расчет цены
  - добавление в корзину
  - загрузку файлов
  - связанные товары

## Мини-чеклист для новых переносов
- [ ] Токены обновлены в `app/globals.css`
- [ ] Базовые компоненты shadcn/ui переиспользованы
- [ ] Нет лишнего "use client"
- [ ] Статичные блоки помечены «Statická ukážka»
- [ ] Реальные данные подключены, где уже доступны
- [ ] Тексты на словацком

Если нужно, можно расширить документ отдельным разделом под каждую страницу/сцену Figma.
