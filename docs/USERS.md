# Пользователи и аутентификация (NextAuth v5)

Документ описывает фактическую реализацию пользователей и сессий.

---

## 1) Модель данных (Prisma)
Файл: `prisma/schema.prisma`

### User
- `id` (cuid)
- `email` (unique, required)
- `name` (nullable)
- `passwordHash` (nullable, scrypt)
- `role` (USER/ADMIN)
- связи: `addresses` (UserAddress), `companyProfile` (CompanyProfile)
- связи: `accounts`, `sessions` (NextAuth), `verificationTokens` (NextAuth)

### CompanyProfile
Профиль компании для B2B пользователя (1:1).
- `userId` (unique)
- `companyName` (required)
- `ico`, `dic`, `icDph` (nullable)

### UserAddress
Сохранённые адреса пользователя (1:N).
- `label`
- `street`, `apt`, `city`, `zipCode`, `country`
- `isDefault`

### Account / Session / VerificationToken
Таблицы для NextAuth (PrismaAdapter).

Примечание: сессии в приложении настроены как JWT (`session.strategy = "jwt"`), поэтому таблица `Session` обычно не используется на каждый запрос, но остаётся частью схемы адаптера.

### RateLimitEntry
Таблица для rate limiting (PostgreSQL/Prisma).

---

## 2) Сессии
Источник истины — **NextAuth**:
- В серверных компонентах/route handlers: `auth()` из `@/auth`
- В клиенте: `useSession()`, `signIn()`, `signOut()` из `next-auth/react`
- Стратегия: JWT (`auth.ts`)

Legacy cookie `session` (кастомная сессия) больше не используется.

---

## 3) Magic link (email)
Провайдер: Nodemailer (NextAuth).

UI вызывает:
- `signIn("nodemailer", { email, redirect: false, callbackUrl: "/account" })`

Rate limit:
- применяется на NextAuth endpoint `POST /api/auth/signin/nodemailer`
- реализация: `app/api/auth/[...nextauth]/route.ts`

---

## 4) Логин по паролю
Провайдер: Credentials (NextAuth).

- пароль проверяется через `scrypt` (`lib/auth.ts`)
- `signIn("credentials", { email, password, redirect: false })`

Rate limit:
- применяется на NextAuth endpoint `POST /api/auth/callback/credentials`
- реализация: `app/api/auth/[...nextauth]/route.ts`

---

## 5) Установка пароля
Route handler: `POST /api/account/set-password` (`app/api/account/set-password/route.ts`)

Условия:
- нужна активная NextAuth-сессия (`auth()`)
- пароль сохраняется в `User.passwordHash` (scrypt)

---

## 6) Выход
UI использует `signOut()` из `next-auth/react`.

---

## 7) Примечания
- Старые route handlers (`/api/auth/login`, `/api/auth/logout`, `/api/auth/password`, `/api/auth/magic`, `/auth/magic`) удалены, чтобы не было двух параллельных систем сессий.

---

## 8) Личный кабинет (Account)
Маршруты:
- `/account` — главная страница кабинета
- `/account/orders` — список заказов пользователя
- `/account/orders/[orderId]` — детали заказа
- `/account/addresses` — управление адресами
- `/account/saved-carts` — сохранённые корзины (B2B)
- `/account/settings` — настройки профиля

### Компоненты:
- `account-sidebar.tsx` — боковое меню навигации
- `account-tabs.tsx` — табы для мобильной версии
- `account-panel.tsx` — панель быстрых действий

### Сохранённые корзины (SavedCart)
Функционал для B2B клиентов — сохранение корзины для повторных заказов.

**Модели:**
- `SavedCart` — именованная сохранённая корзина
- `SavedCartItem` — товары в сохранённой корзине

**API:**
- `GET /api/saved-carts` — список корзин пользователя
- `POST /api/saved-carts` — сохранить текущую корзину
- `PATCH /api/saved-carts/[savedCartId]` — переименовать
- `DELETE /api/saved-carts/[savedCartId]` — удалить
- `POST /api/saved-carts/[savedCartId]/load` — загрузить в активную корзину

---

## 9) Управление пользователями (Admin)
Маршрут: `/admin/users`

**Возможности:**
- Список всех пользователей
- Просмотр: email, имя, роль, дата регистрации
- Смена роли: USER ↔ ADMIN

**Защита:**
- Требует роль ADMIN
- Нельзя менять собственную роль
