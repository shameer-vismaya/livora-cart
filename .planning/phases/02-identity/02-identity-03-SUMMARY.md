---
phase: 02-identity
plan: 03
subsystem: identity-service
tags: [identity, keycloak-admin, registration, outbox, prisma-per-service]
requires: [02-identity-01]
provides: [identity-service, keycloak-admin, user-registered-event, per-service-prisma-pattern]
affects: [user-service, all-future-services]
tech-stack:
  added: [class-validator, class-transformer]
  patterns: [keycloak-admin-client-credentials, db-per-service, per-service-prisma-client]
key-files:
  created:
    - apps/identity-service/** (service)
    - apps/identity-service/src/keycloak/keycloak-admin.service.ts
    - apps/identity-service/src/registration/*
    - infra/debezium/identity-outbox-connector.json
  modified:
    - docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml
    - infra/keycloak/livora-realm.json (identity-admin client)
    - deploy/deploy.sh (multi-service db/publication/connector loops)
    - apps/platform-reference/** (retrofit per-service Prisma client)
    - .eslintrc.json, .gitignore
completed: 2026-06-16
status: complete
verified: local (6 projects lint+test+build green); host at Plan 07
---

# Phase 2 Plan 03: Identity Service + Email Registration

Identity Service stood up from the proven template, integrated with the Keycloak Admin API, with email/password registration that provisions a Keycloak user and emits `UserRegistered`.

## What was built
- `apps/identity-service` (own `identity` DB): health, outbox, OTel, multi-stage Dockerfile (copies @livora/* incl. auth).
- `KeycloakAdminService`: client-credentials service-account token (cached), `createUser`, `assignRealmRole`, `findUserId`.
- `RegistrationService` + `/auth/register`: creates KC user (role `customer`), persists `identity_user`, emits `user.registered` via outbox in one txn; duplicate → 409.
- Realm import: `identity-admin` confidential client + service-account `realm-management` roles (manage/view/query users).
- Wired into compose (+prod internal-only), Kong `/identity`, identity Debezium connector → topic `livora.user.events`.

## Key infrastructure decision — per-service Prisma client
Multiple services each have their own schema, but Prisma generates ONE global client. Fixed by per-service generator `output = ../src/generated/prisma` + build asset copy + tsc/eslint/jest excludes + gitignore. **Retrofitted platform-reference too** so `nx run-many` builds all services. Every future service uses this pattern.

## Deploy generalization
`deploy.sh` now loops over services: ensure per-service DB → `prisma db push` → ensure publication (FOR ALL TABLES) per outbox DB → register every `infra/debezium/*-connector.json`. Connectors use the Postgres superuser (cross-db, no per-db grants).

## Verification
`nx run-many -t lint test build` green (6 projects); registration unit test (mocked Keycloak Admin) passes deterministically. Host registration + UserRegistered flow verified in Plan 07.

## Deviations
- Per-service Prisma client (Rule 2 — required for multi-schema correctness).
- RegistrationService reads `DEFAULT_CUSTOMER_ROLE` from env directly (not full `loadAppEnv()`) so unit tests don't need a complete environment (Rule 1 — flaky test fix).
- Connectors switched to Postgres superuser (simplifies multi-DB CDC).

## ⚠️ To verify on host
`POST /identity/auth/register` → 201 + Keycloak user created (role customer) + `user.registered` on `livora.user.events`. Needs `identity-admin` client (in realm import; secret overridable via `KEYCLOAK_ADMIN_CLIENT_SECRET`).
