# Multi-stage build for user-service. Built from repo root:
#   docker build -f apps/user-service/Dockerfile .
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate --schema apps/user-service/prisma/schema.prisma \
  && pnpm nx build user-service --skip-nx-cache

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat curl
RUN addgroup -S livora && adduser -S livora -G livora
COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/dist/libs/contracts ./node_modules/@livora/contracts
COPY --from=builder /repo/dist/libs/config ./node_modules/@livora/config
COPY --from=builder /repo/dist/libs/observability ./node_modules/@livora/observability
COPY --from=builder /repo/dist/libs/auth ./node_modules/@livora/auth
COPY --from=builder /repo/dist/apps/user-service ./
COPY --from=builder /repo/apps/user-service/prisma ./prisma
USER livora
EXPOSE 3000
CMD ["node", "src/main.js"]
