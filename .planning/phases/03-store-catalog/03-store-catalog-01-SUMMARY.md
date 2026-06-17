---
phase: 03-store-catalog
plan: 01
subsystem: store-service
tags: [store, onboarding, tenant-registry, outbox]
requires: [02-identity-01]
provides: [store-service, store-application, store.submitted]
affects: [03-store-catalog-02, 04, catalog]
key-files:
  created:
    - apps/store-service/** (service)
    - apps/store-service/src/store/*
    - infra/debezium/store-outbox-connector.json
  modified: [docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, deploy/deploy.sh]
completed: 2026-06-17
status: complete
verified: local (lint+test+build green); host at Plan 07
---

# Phase 3 Plan 01: Store Service + Onboarding

store-service cloned from the proven template (own `stores` DB), with the store application flow.

## What was built
- `apps/store-service`: Store/StoreHours/DeliveryZone models; outbox/inbox/idempotency.
- `POST /stores` (`@Roles('store_owner','admin')`) → pending store (unique slug) + `store.submitted` event in one txn.
- owner-scoped `GET /stores/me`, `GET /stores/me/:id`.
- compose(+prod), Kong `/stores`, `store-outbox` connector → `livora.store.events`, deploy DB loops (`stores`).

## Verification
`nx run-many -t lint test build -p store-service` green (apply + ownership specs). Host flow at Plan 07.

## Deviations
None — followed the established template (per-service Prisma, build-all-libs Dockerfile, copy generated client).
