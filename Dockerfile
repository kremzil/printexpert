# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# ВАЖНО: не запускать scripts (postinstall), т.к. prisma/schema.prisma еще не скопирован
RUN \
  if [ -f package-lock.json ]; then npm ci --ignore-scripts; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile --ignore-scripts; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile --ignore-scripts; \
  else npm i --ignore-scripts; fi

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# теперь схема есть -> можно генерить клиент
RUN npx prisma generate

RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "server.js"]
