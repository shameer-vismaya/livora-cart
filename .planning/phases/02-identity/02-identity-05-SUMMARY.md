---
phase: 02-identity
plan: 05
subsystem: user-service
tags: [user, profile, kafka-consumer, inbox-dedup]
requires: [02-identity-01, 02-identity-03]
provides: [user-service, profile-api, user-registered-consumer]
affects: [02-identity-06, store, order]
key-files:
  created:
    - apps/user-service/** (service)
    - apps/user-service/src/profile/*
    - apps/user-service/src/consumer/user-registered.consumer.ts
  modified: [docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, deploy/deploy.sh]
completed: 2026-06-16
status: complete
verified: local (7 projects test+build green); host at Plan 07
---

# Phase 2 Plan 05: User Service + Profile + UserRegistered Consumer

User Service cloned from the template (own `users` DB), with self-scoped profile endpoints and an idempotent consumer that creates profiles from identity's `UserRegistered` events.

## What was built
- `apps/user-service` (own `users` DB, per-service Prisma client): health, metrics, OTel, Dockerfile (copies @livora/* incl. auth).
- `ProfileService`/`ProfileController`: `GET/PUT /profile/me` guarded by `KeycloakJwtGuard`, scoped to `@CurrentUser().sub` (users only touch their own profile); 404 if absent.
- `UserRegisteredConsumer`: subscribes `livora.user.events`, reads `eventId` from the Kafka header, upserts `user_profile` + records `processed_events` in one transaction (effectively-once); pre-creates the topic.
- Wired into compose (+prod internal-only), Kong `/users`, deploy `DB_SERVICES` (db `users`, db push; no outbox/connector — consumer only).

## Verification
`nx run-many -t test build` green (7 projects); ProfileService unit tests (get/404/upsert). Host flow (register → event → profile) verified in Plan 07.

## Deviations
None.

## ⚠️ To verify on host
Register via identity → `user.registered` on `livora.user.events` → user-service logs `profile upserted` → `GET /users/profile/me` returns it; another user's token cannot read it.
