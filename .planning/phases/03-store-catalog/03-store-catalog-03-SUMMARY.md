---
phase: 03-store-catalog
plan: 03
subsystem: catalog-service
tags: [catalog, taxonomy, categories, brands]
requires: [02-identity-01]
provides: [catalog-service, category-taxonomy, brands]
affects: [03-store-catalog-04, 05]
key-files:
  created:
    - apps/catalog-service/** (service)
    - apps/catalog-service/src/category/*, src/brand/*
    - infra/debezium/catalog-outbox-connector.json
  modified: [docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, deploy/deploy.sh]
completed: 2026-06-17
status: complete
verified: local (lint+test+build green); host at Plan 07
---

# Phase 3 Plan 03: Catalog Service + Taxonomy + Brands

catalog-service cloned from the template (own `catalog` DB) with the platform category tree + brands.

## What was built
- `apps/catalog-service`: Category (self-referential tree, materialized `path`) + Brand; outbox/inbox.
- Admin CRUD (`@Roles('admin')`); public `GET /catalog/categories`, `GET /catalog/brands`.
- Wired into compose(+prod), Kong `/catalog`, `catalog-outbox` connector → `livora.catalog.events`, deploy DB loops (`catalog`); depends on MinIO (Plan 05 media).

## Verification
`nx run-many -t lint test build -p catalog-service` green (category tree path specs). Host at Plan 07.

## Deviations
None — standard template clone.
