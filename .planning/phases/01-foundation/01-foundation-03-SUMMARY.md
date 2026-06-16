---
phase: 01-foundation
plan: 03
subsystem: reference-service
tags: [nestjs, prisma, kafka, keycloak, outbox, idempotency, dlq]
requires: [plan-01, plan-02]
provides: [reference-service-template, outbox-pattern, idempotent-consumer, jwt-guard]
affects: [all-future-services]
tech-stack:
  added: ["@nestjs/*@10", "@prisma/client@5", kafkajs@2, jose@5]
  patterns: [transactional-outbox, inbox-dedup, idempotency-key, jwks-jwt-guard, dlq]
key-files:
  created:
    - apps/platform-reference/src/main.ts
    - apps/platform-reference/src/app.module.ts
    - apps/platform-reference/src/auth/keycloak-jwt.guard.ts
    - apps/platform-reference/src/auth/auth.helpers.ts
    - apps/platform-reference/src/outbox/outbox.service.ts
    - apps/platform-reference/src/demo/demo.controller.ts
    - apps/platform-reference/src/consumer/event.consumer.ts
    - apps/platform-reference/prisma/schema.prisma
    - apps/platform-reference/Dockerfile
    - infra/debezium/outbox-connector.json
  modified: [libs/*/package.json, package.json]
completed: 2026-06-16
status: complete
verified: local (lint+test+build green; runtime e2e on host)
---

# Phase 1 Plan 03: Reference NestJS Service Summary

The copyable template encoding Livora's non-negotiable patterns: Kong-fronted Keycloak JWT auth, the transactional outbox → Debezium → Kafka path, and idempotent consumption with inbox dedup + DLQ.

## What was built
- **Service shell** — NestJS (tsc build), `@livora/config` env validation, `PrismaService`, shutdown hooks, telemetry hook (no-op until Plan 04).
- **Auth** — `KeycloakJwtGuard` verifies RS256 via `jose` `createRemoteJWKSet` against the realm certs, checks issuer + audience, attaches `req.user`. Pure `auth.helpers` unit-tested (4 tests).
- **Health** — public `/health`, `/health/live`, `/health/ready` (DB ping).
- **Outbox** — `OutboxService.publishWithin(tx, event)` writes aggregate + event in ONE Prisma transaction (no dual-write). `POST /demo/echo` requires `Idempotency-Key` and replays the stored response on retry.
- **Consumer** — `EventConsumer` (KafkaJS) applies each event and records `processed_events(eventId)` in the same transaction (effectively-once); retries then routes poison messages to `*.DLQ`.
- **CDC** — Debezium `EventRouter` outbox connector → topic `livora.demo.events`.
- **Dockerfile** — multi-stage, prod-pruned, non-root.

## Verification (local, real)
- `nx run-many -t lint test build` ✓ across all 4 projects.
- Prisma client generated ✓; service compiles ✓; 4 auth unit tests pass.
- Runtime e2e (Kong 401/200, outbox→Kafka, dedup, DLQ) deferred to the Ubuntu host.

## Decisions Made
- **Prisma models instead of separate `*.entity.ts` files** (plan listed entity files) — Prisma schema is the single source of truth; cleaner. Deviation, intentional.
- **Plain health controller** rather than terminus indicators — fewer moving parts, same probes.
- **Lib `package.json` added** so `@nx/js:tsc` remaps `@livora/*` to built dist during app build (canonical Nx buildable-lib fix).

## Deviations from Plan
- **[Rule 3 - Blocking] App build failed (TS6059 rootDir) importing lib sources.** Fix: added `package.json` to each lib so Nx remaps to dist. Commit e9ae7a0.
- **Dockerfile CMD = `node src/main.js`** — `@nx/js:tsc` keeps the `src/` prefix in output. Adjusted.
- Entity files → Prisma models (above).

## ⚠️ To verify on host
- `curl /reference/demo/echo` → 401; with Keycloak token → 200/202.
- `POST /demo/echo` → outbox row → Debezium → `livora.demo.events` → consumer logs "applied event"; replay = no-op; poison → DLQ.
- Kong RS256 public key injected from realm JWKS by `deploy.sh`.
