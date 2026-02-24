# DB migrations and data sync runbook

Этот документ фиксирует рабочий процесс для двух разных задач:

1. Изменение **схемы** БД (DDL) через Prisma migrations.
2. Управляемая синхронизация **данных** между локальной и прод БД.

## 1) Что нельзя делать в обычном деплое

- Не использовать `pg_restore --clean --if-exists` для обычной синхронизации.
- Не запускать `prisma migrate dev` на production.
- Не смешивать «схему» и «данные» в одном шаге.

Полный dump/restore оставляем только для backup/disaster recovery.

## 2) Миграции схемы (Prisma)

### 2.1 Локальная разработка

```bash
npx prisma migrate dev --name <migration_name>
```

После этого в коммит должны попасть:

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_<name>/migration.sql`

### 2.2 Проверка/применение на прод

```bash
npm run db:migrate:prod:status
npm run db:migrate:prod:deploy
```

Скрипт `scripts/db/migrate-prod.mjs`:

- грузит env из `.env.production` (или через `--env-file`);
- делает `migrate status`;
- делает `migrate deploy`;
- повторно проверяет `migrate status`;
- при сетевых ошибках (`P1001`, timeout и т.д.) делает retry.

### 2.3 Если конфликт истории миграций

Если SQL уже применялся вручную и `migrate deploy` ругается на историю, нужно reconcile:

```bash
npx prisma migrate resolve --applied <migration_name> --schema prisma/schema.prisma
npm run db:migrate:prod:deploy
```

## 3) Синхронизация данных (local -> prod)

Синхронизация выполняется скриптом `scripts/db/sync-data.mjs` по конфигу:

- `scripts/db/sync-plan.json` - рабочий план.
- `scripts/db/sync-plan.example.json` - пример.

### 3.1 Базовые принципы

- `default deny`: по умолчанию таблицы пропускаются (`defaults.mode = "skip"`).
- Синхронизируются только таблицы, явно перечисленные в `tables`.
- Глобальный default при конфликте: `prod_wins`.
- Защищенные таблицы (`Order*`, `StripeEvent`, `NotificationLog`) не перезаписываются без отдельного подтверждения.

### 3.2 Режимы таблиц

- `mode: "skip"` - не синхронизировать таблицу.
- `mode: "append"` - добавить только отсутствующие записи.
- `mode: "upsert"` + `onConflict: "prod_wins"` - как append (существующие записи не трогаем).
- `mode: "upsert"` + `onConflict: "local_wins"` - существующие записи обновляем локальными значениями.
- `mode: "upsert"` + `onConflict: "error_on_conflict"` - при конфликте ключа скрипт завершится ошибкой.

### 3.3 Запуск

Dry-run (обязателен перед apply):

```bash
npm run db:sync:data:dry
```

Применение:

```bash
npm run db:sync:data:apply
```

Прямой запуск с кастомными env/plan:

```bash
node scripts/db/sync-data.mjs --from-env .env --to-env .env.production --plan scripts/db/sync-plan.json --dry-run
node scripts/db/sync-data.mjs --from-env .env --to-env .env.production --plan scripts/db/sync-plan.json --apply
```

### 3.4 Protected overwrite

Если для protected таблицы включен `local_wins`, нужен явный override:

```bash
node scripts/db/sync-data.mjs \
  --from-env .env \
  --to-env .env.production \
  --plan scripts/db/sync-plan.json \
  --apply \
  --allow-protected-overwrite \
  --confirm-overwrite I_UNDERSTAND_PROD_OVERWRITE
```

Без этих флагов скрипт остановится.

## 4) Чек-лист перед запуском

1. Сделан свежий backup production.
2. Проверен `sync-plan.json`:
- корректные `key` для каждой таблицы;
- `mode`/`onConflict` соответствуют задаче;
- protected таблицы не включены случайно.
3. Для data sync сначала выполнен `dry-run`.
4. Проверены числа в отчете: `toInsert`, `toUpdate`, `conflicts`.

## 5) Чек-лист после запуска

1. `npm run db:migrate:prod:status` показывает no pending migrations.
2. Для data sync проверены выборки по ключам в прод БД.
3. Убедились, что `Order*`/`StripeEvent`/`NotificationLog` не изменялись без explicit override.

## 6) Аварийные сценарии и rollback

- При ошибке миграции:
1. Остановить дальнейшие изменения.
2. Посмотреть текст ошибки `migrate-prod.mjs`.
3. Если нужен reconcile, использовать `migrate resolve`.

- При ошибке data sync:
1. Скрипт завершится с ошибкой и не продолжит следующие таблицы.
2. Использовать backup для восстановления, если изменения уже применены и некорректны.

## 7) Пример рабочего цикла

1. Локально меняем schema + `npx prisma migrate dev`.
2. Коммитим миграции.
3. На прод:
- `npm run db:migrate:prod:deploy`.
4. Если нужно перенести справочники:
- правим `scripts/db/sync-plan.json`;
- `npm run db:sync:data:dry`;
- `npm run db:sync:data:apply`.
