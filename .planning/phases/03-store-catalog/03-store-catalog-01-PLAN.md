---
phase: 03-store-catalog
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/store-service/** (new service from template)
  - apps/store-service/prisma/schema.prisma
  - apps/store-service/src/store/store.controller.ts
  - apps/store-service/src/store/store.service.ts
  - apps/store-service/src/outbox/outbox.service.ts
  - docker-compose.yml
  - docker-compose.prod.yml
  - infra/kong/kong.yml
  - infra/debezium/store-outbox-connector.json
  - deploy/deploy.sh
autonomous: true
must_haves:
  truths:
    - "A store_owner can submit a store application (POST /stores) -> store in 'pending'"
    - "The owner can GET their own store(s); store-service is healthy + Kong-routed at /stores"
    - "A store application emits a StoreSubmitted event via the transactional outbox"
  artifacts:
    - "apps/store-service cloned from template (own 'stores' DB, per-service Prisma client)"
    - "Store model + onboarding state machine (draft/pending/approved/rejected/suspended)"
    - "store Debezium connector -> topic livora.store.events"
  key_links:
    - "POST /stores guarded by @Roles('store_owner'); store.ownerKeycloakId = CurrentUser.sub"
    - "store write + outbox event in one transaction"
    - "deploy.sh: stores DB create + db push + publication + connector"
---

<objective>
Stand up the Store Service and the store onboarding application flow — the entry point for vendors joining the marketplace.

Purpose: REQ-STR-01/08. Stores are tenants; this creates the tenant registry and the application a store owner submits for admin approval (Plan 02).
Output: `apps/store-service` (Kong-routed, healthy) with store application + StoreSubmitted event.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/02-identity/02-identity-03-SUMMARY.md   # service template + per-service Prisma + deploy loops
@apps/identity-service   # closest template (Keycloak-adjacent service)
@apps/user-service/src/consumer/user-registered.consumer.ts   # consumer pattern (if needed)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold store-service from the template + wire into infra</name>
  <files>apps/store-service/project.json, apps/store-service/tsconfig*.json, apps/store-service/jest.config.ts, apps/store-service/Dockerfile, apps/store-service/prisma/schema.prisma, apps/store-service/src/main.ts, apps/store-service/src/telemetry.bootstrap.ts, apps/store-service/src/app.module.ts, apps/store-service/src/config.ts, apps/store-service/src/prisma/prisma.service.ts, apps/store-service/src/health/health.controller.ts, apps/store-service/src/metrics/metrics.controller.ts, apps/store-service/src/outbox/outbox.service.ts, docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, infra/debezium/store-outbox-connector.json, deploy/deploy.sh</files>
  <action>Clone the identity-service shape EXACTLY (NestJS @nx/js:tsc; per-service Prisma client `output=../src/generated/prisma`; Dockerfile builds ALL libs `nx run-many -t build -p contracts config observability auth` + copies dist/libs/* incl. auth + copies `src/generated/prisma` explicitly + apk openssl/libc6-compat/curl; jest transform `.ts` only). Prisma schema (own `stores` DB): `outbox`, `processed_events`, `idempotency_records` (reuse shapes) + `store` (id, ownerKeycloakId, name, slug unique, description, logoUrl, bannerUrl, status default 'draft', gstin, createdAt, updatedAt) + `store_hours` (storeId, day, openTime, closeTime) + `delivery_zone` (id, storeId, pincode/polygon, radiusKm). Add to docker-compose.yml + prod (own `stores` DATABASE_URL, ports !reset [] in prod, OTLP, healthcheck). Kong route `/stores` -> store-service:3000. Create infra/debezium/store-outbox-connector.json (name `store-outbox`, slot `store_outbox`, dbname `stores`, static topic `livora.store.events`, same EventRouter/header config as identity-outbox-connector.json). Update deploy.sh: add `store-service:stores` to DB_SERVICES and `stores` to OUTBOX_DBS.</action>
  <verify>`pnpm nx build store-service` + `pnpm nx test store-service` pass; `bash -n deploy/deploy.sh`; compose + kong + connector JSON validate.</verify>
  <done>store-service builds, in compose(+prod) with own DB + Kong /stores + store connector; deploy provisions it.</done>
</task>

<task type="auto">
  <name>Task 2: Store application flow + StoreSubmitted event</name>
  <files>apps/store-service/src/store/store.controller.ts, apps/store-service/src/store/store.service.ts, apps/store-service/src/store/dto.ts, apps/store-service/src/app.module.ts</files>
  <action>Implement `StoreService`: `apply(ownerKeycloakId, dto)` -> create a `store` (status 'pending', generate unique slug from name) + emit `store.submitted` (payload {storeId, ownerKeycloakId, name}) via OutboxService in one transaction; `listMine(ownerKeycloakId)`; `getMine(ownerKeycloakId, storeId)` (404 if not owner's). `StoreController` (guarded `KeycloakJwtGuard` + `@Roles('store_owner')` from @livora/auth): `POST /stores` (apply), `GET /stores/me` (list mine), `GET /stores/me/:id`. Validate dto (name, description, gstin optional). Unit-test StoreService.apply (creates pending store + emits event) with prisma/outbox mocked.</action>
  <verify>`pnpm nx test store-service` passes apply/list specs. Host (Plan 07): POST /stores -> 201 pending; GET /stores/me returns it.</verify>
  <done>store_owner submits an application (pending) that emits StoreSubmitted; owner lists/gets only their stores.</done>
</task>

</tasks>

<verification>
- store-service builds/tests green; wired into compose+prod+kong+deploy.
- Application creates a pending store + StoreSubmitted via outbox; owner-scoped reads.
</verification>

<success_criteria>
- [ ] store-service scaffolded, healthy, /stores routed, own DB + connector
- [ ] POST /stores (store_owner) -> pending store + StoreSubmitted event
- [ ] owner-scoped GET /stores/me
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-01-SUMMARY.md` (store model, application flow, event schema, host steps).
</output>
