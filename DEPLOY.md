# Deploy checklist (VPS)

## Prereqs
- Docker + Docker Compose installed
- Repo cloned on server
- `.env.production` created (based on `.env.production.example`)

## From DEV to VPS deploy
1) Make sure all Prisma migrations are created locally and committed:
```bash
npm run prisma:migrate:dev
```
2) Push changes to the remote repo (code + `prisma/migrations`).
3) On VPS, pull latest changes:
```bash
git pull
```
4) Rebuild and start services:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
5) Apply production migrations inside the `web` container:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
```
6) (Optional) Seed initial catalog data:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma db seed
```

## Start DB
```bash
npm run prod:up
```

## Apply migrations
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma migrate deploy
```

## Seed (optional)
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec web npx prisma db seed
```

## Smoke check
- GET `/api/health` should return `{"ok":true}`

---

## Notes
- На VPS использовать только `migrate deploy`, не `migrate dev`.
- Сиды берут данные из `data/*` и перезаписывают изображения для каждого продукта.
