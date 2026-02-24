# Deploy checklist (VPS / DigitalOcean Droplet)

## Prereqs
- Docker + Docker Compose installed
- Node.js + npm installed (for host-side migration script)
- Repo cloned on server
- `.env.production` created from `.env.production.example`

Required in `.env.production`:
- `POSTGRES_PASSWORD`
- `DATABASE_URL` (host `db`, for app container)
- `DIRECT_URL` (host `127.0.0.1`, for migration script from VPS shell)
- `AUTH_SECRET`
- `NEXT_PUBLIC_SITE_URL`

## From DEV to VPS deploy
1) Make sure Prisma migrations are created locally and committed:
```bash
npm run prisma:migrate:dev
```
2) Push changes to remote (code + `prisma/migrations`).
3) On VPS, pull latest changes:
```bash
git pull
```
4) Install dependencies for migration utilities (once after pull/update):
```bash
npm install
```
5) Build and start services:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
6) Apply production migrations from host:
```bash
npm run db:migrate:prod:deploy
```
7) Optional status check:
```bash
npm run db:migrate:prod:status
```

## Smoke check
- Health:
```bash
curl -sS http://127.0.0.1:3000/api/health
```
Expected: JSON with `"ok": true`.

- Auth session endpoint:
```bash
curl -sS http://127.0.0.1:3000/api/auth/session
```
Expected for anonymous request: `null` (HTTP 200).

## Notes
- Do not use `prisma migrate dev` on VPS.
- Migrations are executed via host script (`scripts/db/migrate-prod.mjs`) using `.env.production`.
- Do not rely on `docker compose exec web npx prisma ...` in runtime container.
- Postgres is exposed only on loopback (`127.0.0.1:5432`) for host-side migrations.
