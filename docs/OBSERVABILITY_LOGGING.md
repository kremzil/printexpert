# Observability и structured logging

Дата: 2026-02-19
Статус: внедрено (phase 1 + mechanical rollout)

## Цели
- Единый structured logging для backend/API.
- Мониторинг и алерты по:
  - `5xx` ошибкам;
  - auth-событиям;
  - нарушениям `CSRF/Origin`;
  - всплескам `rate_limit_denied`.
- Корреляция запросов через `requestId`.
- Минимизация утечек чувствительных данных (redaction + `ipHash` вместо raw IP).

## Что реализовано
- Логгер: `pino` (`lib/observability/logger.ts`).
- Taxonomy событий: `lib/observability/events.ts`.
- Утилиты request context: `lib/request-utils.ts`.
  - `getClientIp()`
  - `hashValue()`
  - `getClientIpHash()`
  - `getRequestIdOrCreate()`
  - `REQUEST_ID_HEADER = x-request-id`
- Обёртка API-хендлеров: `withObservedRoute(routeId, handler)` в `lib/observability/with-observed-route.ts`.
- Глобальный серверный перехват ошибок: `instrumentation.ts` (`onRequestError`).
- Client-side blind spot закрыт:
  - `app/global-error.tsx`
  - `POST /api/client-error` (`app/api/client-error/route.ts`)
- `proxy.ts`:
  - structured security logs для `security.origin_blocked` и `security.csrf_blocked`;
  - проставление `x-request-id` в ответы proxy.
- Coverage API:
  - route files: `48`
  - wrapped handlers: `58`

## Event taxonomy
- `http.request.completed`
- `security.origin_blocked`
- `security.csrf_blocked`
- `security.rate_limit_denied`
- `auth.login_attempt`
- `auth.login_failed`
- `auth.login_success`
- `server.unhandled_error`
- `client.unhandled_error`

Дополнительно в Stripe webhook используются прикладные события (`stripe.webhook.*`).

## Request ID и `/api/auth/*`
- `proxy.ts` исключает `/api/auth/*` из matcher.
- Для этого `withObservedRoute` всегда генерирует fallback `requestId`, если заголовок отсутствует.
- Итог: для auth-событий тоже есть корреляция.

## Политика приватности логов
- В логи пишется `ipHash`, не raw IP.
- Hash детерминированный (с солью `LOG_IP_HASH_SALT`).
- Redaction в `pino`:
  - `authorization`, `cookie`, `set-cookie`,
  - токены/секреты/пароли и смежные поля.

## Конфигурация ENV
- `LOG_LEVEL` (default: `info`)
- `LOG_PRETTY` (default: `true` вне production, в production `false`)
- `OBS_SERVICE_NAME`
- `OBS_ENV`
- `LOG_IP_HASH_SALT`

См. шаблоны:
- `.env.example`
- `.env.production.example`

## Инфраструктура мониторинга
`docker-compose.prod.yml` расширен сервисами:
- `loki`
- `promtail`
- `grafana`

Для `web` зафиксирован logging driver:
- `json-file`
- rotation: `max-size=10m`, `max-file=5`

Provisioning:
- `ops/loki/loki-config.yml`
- `ops/promtail/promtail-config.yml`
- `ops/grafana/provisioning/datasources/loki.yaml`
- `ops/grafana/provisioning/alerting/contact-points.yaml`
- `ops/grafana/provisioning/alerting/policies.yaml`
- `ops/grafana/provisioning/alerting/rules.yaml`

## Alert rules (баланс)
- `5xx`:
  - warning: `> 5 / 5m`
  - critical: `> 15 / 5m`
- `auth.login_failed`:
  - warning: `> 10 / 10m`
  - critical: `> 25 / 10m`
- `security.csrf_blocked + security.origin_blocked`:
  - warning: `> 10 / 10m`
  - critical: `> 30 / 10m`
- `security.rate_limit_denied`:
  - warning: `> 20 / 10m`
  - critical: `> 50 / 10m`

Канал уведомлений: Email (Grafana contact point `email-default`).

## Проверка после деплоя
1. Поднять стек `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build`.
2. Проверить доступность:
   - app: `:3000`
   - grafana: `:3001`
   - loki: `:3100`
3. В Grafana проверить datasource `Loki` и наличие логов контейнера `shop-web`.
4. Прогнать smoke-события (`5xx`, `csrf/origin`, `auth failed`, `rate-limit`) и проверить алерты.

## Ограничения
- `next build` в текущем локальном окружении может падать с системной ошибкой `spawn EPERM` (ограничение окружения), при этом `lint` и `typecheck` проходят.
- Sentry не подключался в этой итерации намеренно (чтобы не расширять scope и зависимости).
