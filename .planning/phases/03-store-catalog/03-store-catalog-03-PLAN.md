---
phase: 03-store-catalog
plan: 03
type: execute
wave: 2
depends_on: []
files_modified:
  - apps/catalog-service/** (new service from template)
  - apps/catalog-service/prisma/schema.prisma
  - apps/catalog-service/src/category/category.controller.ts
  - apps/catalog-service/src/category/category.service.ts
  - apps/catalog-service/src/brand/brand.controller.ts
  - apps/catalog-service/src/brand/brand.service.ts
  - docker-compose.yml
  - docker-compose.prod.yml
  - infra/kong/kong.yml
  - infra/debezium/catalog-outbox-connector.json
  - deploy/deploy.sh
autonomous: true
must_haves:
  truths:
    - "catalog-service is healthy + Kong-routed at /catalog with its own 'catalog' DB"
    - "An admin can create/list/update the category taxonomy (tree) and brands"
    - "Categories are publicly readable; mutations require @Roles('admin')"
  artifacts:
    - "apps/catalog-service cloned from template"
    - "category (self-referential tree) + brand models + admin CRUD"
    - "catalog Debezium connector -> topic livora.catalog.events"
  key_links:
    - "category mutations guarded @Roles('admin'); public GET for browse"
    - "deploy.sh: catalog DB + db push + publication + connector"
---

<objective>
Stand up the Catalog Service and the platform-governed taxonomy (categories) + brands that products attach to.

Purpose: REQ-CAT-03/07, REQ-ADM-04. The category tree + brands are platform-owned (admin-governed); products (Plan 04) reference them.
Output: `apps/catalog-service` (Kong-routed, healthy) + admin taxonomy/brand CRUD + public browse.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/02-identity/02-identity-03-SUMMARY.md   # template + deploy loops
@apps/identity-service   # template to clone
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold catalog-service from the template + wire into infra</name>
  <files>apps/catalog-service/project.json, apps/catalog-service/tsconfig*.json, apps/catalog-service/jest.config.ts, apps/catalog-service/Dockerfile, apps/catalog-service/prisma/schema.prisma, apps/catalog-service/src/main.ts, apps/catalog-service/src/telemetry.bootstrap.ts, apps/catalog-service/src/app.module.ts, apps/catalog-service/src/config.ts, apps/catalog-service/src/prisma/prisma.service.ts, apps/catalog-service/src/health/health.controller.ts, apps/catalog-service/src/metrics/metrics.controller.ts, apps/catalog-service/src/outbox/outbox.service.ts, docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, infra/debezium/catalog-outbox-connector.json, deploy/deploy.sh</files>
  <action>Clone the identity-service shape (per-service Prisma client; Dockerfile builds all libs + copies generated client; etc.). Prisma schema (own `catalog` DB): `outbox`, `processed_events`, `idempotency_records` + `category` (id, parentId nullable self-relation, name, slug unique, path, sortOrder, active) + `brand` (id, name, slug unique, logoUrl, active). (Product/variant tables come in Plan 04.) Add to compose(+prod) (`catalog` DATABASE_URL, OTLP, healthcheck, ports !reset [] prod). Kong route `/catalog` -> catalog-service:3000. Create infra/debezium/catalog-outbox-connector.json (name `catalog-outbox`, slot `catalog_outbox`, dbname `catalog`, static topic `livora.catalog.events`, same header/EventRouter config). deploy.sh: add `catalog-service:catalog` to DB_SERVICES + `catalog` to OUTBOX_DBS.</action>
  <verify>`pnpm nx build catalog-service` + `pnpm nx test catalog-service` pass; deploy/compose/kong/connector validate.</verify>
  <done>catalog-service builds, in compose(+prod) with own DB + Kong /catalog + connector; deploy provisions it.</done>
</task>

<task type="auto">
  <name>Task 2: Category taxonomy (tree) + brands with admin CRUD</name>
  <files>apps/catalog-service/src/category/category.controller.ts, apps/catalog-service/src/category/category.service.ts, apps/catalog-service/src/brand/brand.controller.ts, apps/catalog-service/src/brand/brand.service.ts, apps/catalog-service/src/app.module.ts</files>
  <action>Implement `CategoryService`: create (with parentId → compute materialized `path`/slug), list (as tree or flat), update, deactivate. `BrandService`: CRUD. Controllers: public `GET /categories`, `GET /brands` (browse, no guard); mutations `POST/PUT/DELETE` guarded `KeycloakJwtGuard + @Roles('admin')`. Validate slug uniqueness; prevent cyclic parent. Unit-test category tree creation (path computed, parent link) + admin-only mutation guard wiring.</action>
  <verify>`pnpm nx test catalog-service` passes. Host (Plan 07): admin creates categories/brands; public GET lists them; non-admin mutation -> 403.</verify>
  <done>Admin manages category tree + brands; public browse; mutations admin-only.</done>
</task>

</tasks>

<verification>
- catalog-service builds/tests green; wired into infra.
- Admin taxonomy/brand CRUD; public browse; RBAC enforced.
</verification>

<success_criteria>
- [ ] catalog-service scaffolded, healthy, /catalog routed, own DB + connector
- [ ] category tree + brands; admin CRUD; public GET
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-03-SUMMARY.md` (catalog layout, taxonomy model, topic name, host steps).
</output>
