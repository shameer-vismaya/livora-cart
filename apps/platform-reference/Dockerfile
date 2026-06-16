# Multi-stage build for the platform-reference NestJS service.
# Built from the repo root: docker build -f apps/platform-reference/Dockerfile .

# ---------- builder ----------
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# Generate Prisma client + compile the service.
RUN pnpm prisma generate --schema apps/platform-reference/prisma/schema.prisma \
  && pnpm nx build platform-reference --skip-nx-cache

# NOTE: we intentionally keep the full node_modules (no prune) so the runtime
# image retains the Prisma query engine + the prisma CLI (used for db push).

# ---------- runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Prisma's query engine needs openssl on Alpine; libc6-compat for glibc shims.
RUN apk add --no-cache openssl libc6-compat

# Non-root user.
RUN addgroup -S livora && adduser -S livora -G livora

COPY --from=builder /repo/node_modules ./node_modules
# Place the compiled workspace libs where node resolves them at runtime
# (they are tsconfig path-aliases at build time, real packages at runtime).
COPY --from=builder /repo/dist/libs/contracts ./node_modules/@livora/contracts
COPY --from=builder /repo/dist/libs/config ./node_modules/@livora/config
COPY --from=builder /repo/dist/libs/observability ./node_modules/@livora/observability
COPY --from=builder /repo/dist/apps/platform-reference ./
COPY --from=builder /repo/apps/platform-reference/prisma ./prisma

USER livora
EXPOSE 3000
# tsc keeps the src/ prefix in the output tree.
CMD ["node", "src/main.js"]
