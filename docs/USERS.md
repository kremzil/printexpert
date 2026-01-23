# Пользователи и аутентификация (текущая реализация)

Документ описывает фактическую реализацию пользователей, magic link и сессий.

---

## 1) Модель данных (Prisma)
Файл: `prisma/schema.prisma`

### User
- `id` (cuid)
- `email` (unique, required)
- `name` (nullable)
- `passwordHash` (nullable, хранится как scrypt)
- `createdAt`, `updatedAt`
- связи: `authTokens`, `sessions`

### AuthToken (magic link)
- `id` (cuid)
- `userId` (FK -> User)
- `tokenHash` (unique, sha256)
- `expiresAt`
- `usedAt` (nullable)
- `createdAt`

### Session
- `id` (cuid)
- `userId` (FK -> User)
- `sessionToken` (unique, sha256)
- `expiresAt`
- `createdAt`

---

## 2) Сессии и cookie
Файл: `lib/auth.ts`

- cookie: `session`
- TTL: 30 дней (`SESSION_TTL_DAYS`)
- в cookie хранится **raw** токен, в БД хранится **hash** (sha256)
- cookie: `httpOnly`, `sameSite=lax`, `secure` в проде

---

## 3) Magic link (без пароля)
Route handler: `POST /api/auth/magic` (`app/api/auth/magic/route.ts`)

Флоу:
1) Пользователь вводит email.
2) Если пользователь не найден — создаётся `User`.
3) Генерируется одноразовый токен, в БД сохраняется `tokenHash`.
4) Отправляется письмо со ссылкой `/auth/magic?token=...`.

Параметры:
- TTL magic link: 20 минут (`MAGIC_LINK_TTL_MINUTES`)
- rate limit: 5 запросов / 15 минут на `ip+email` (in-memory Map)

Требуемые env:
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `NEXT_PUBLIC_SITE_URL` (опционально, для формирования URL)

UI-тексты в письме и формах — на словацком.

---

## 4) Подтверждение magic link
Route handler: `GET /auth/magic` (`app/auth/magic/route.ts`)

Флоу:
1) Проверка токена (hash, срок, usedAt).
2) `usedAt` устанавливается.
3) Создаётся `Session`, ставится cookie.
4) Редирект на `/account`.

Некорректный/просроченный токен -> редирект на `/auth`.

---

## 5) Логин по паролю
Route handler: `POST /api/auth/login` (`app/api/auth/login/route.ts`)

Условия:
- Логин доступен только если у `User` есть `passwordHash`.
- Проверка пароля через `scrypt`.
- На успех: создаётся `Session`, ставится cookie.

---

## 6) Установка/смена пароля
Route handler: `POST /api/auth/password` (`app/api/auth/password/route.ts`)

Условия:
- Нужна активная сессия.
- Валидация совпадения паролей.
- `passwordHash` сохраняется как `scrypt`.

---

## 7) Выход
Route handler: `POST /api/auth/logout` (`app/api/auth/logout/route.ts`)

Флоу:
- Удаляется запись `Session` по token hash.
- Cookie очищается.

---

## 8) UI-страницы
### /auth
Файл: `app/auth/page.tsx`
- Magic link форма + классический логин.
- Тексты — на словацком.

### /account
Файл: `app/account/page.tsx` + `app/account/account-panel.tsx`
- Если нет сессии -> редирект на `/auth`.
- Контент: приветствие, email, кнопка выхода.
- Если `passwordHash` отсутствует — показывается форма “Nastaviť heslo”.

### Хедер
Файл: `app/layout.tsx`
- Ссылки: “Registrácia” -> `/auth`, “Môj účet” -> `/account`.

---

## 9) Замечания и ограничения
- Rate limit для magic link хранится в памяти процесса (сброс при рестарте).
- Нет фоновой очистки просроченных токенов/сессий.
- Сессии валидируются по `expiresAt`.
- Реализация рассчитана на Node runtime (Cache Components включены).

---

## 10) Миграции
Если меняется схема Prisma — запускать локально:
```bash
npx prisma migrate dev
```
