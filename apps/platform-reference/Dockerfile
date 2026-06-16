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

# Prune dev dependencies for a lean runtime.
RUN pnpm prune --prod

# ---------- runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user.
RUN addgroup -S livora && adduser -S livora -G livora

COPY --from=builder /repo/node_modules ./node_modules
COPY --from=builder /repo/dist/apps/platform-reference ./
COPY --from=builder /repo/apps/platform-reference/prisma ./prisma

USER livora
EXPOSE 3000
# tsc keeps the src/ prefix in the output tree.
CMD ["node", "src/main.js"]
