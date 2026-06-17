# Phase 3 — Store Onboarding, Catalog & Admin Governance (CONTEXT)

> Goal-backward analysis. Stores onboard (admin-approved) and publish a catalog; multi-tenancy is enforced. Services clone the proven template + use `@livora/auth` (RBAC `@Roles`, ABAC `@StoreScope`). KYC refs (Phase 2 user-service) gate onboarding.

## Phase Goal (outcome)
**A store owner can apply for a store, get admin-approved, and publish a catalog (products with variants, GST/HSN pricing, images) — with strict tenant isolation — while admins govern stores, products, categories and brands.**

## Observable Truths (must be TRUE)
1. A `store_owner` submits a store application → store is `pending`.
2. An `admin` approves it → store `approved` and a `StoreApproved` event is emitted; admin can suspend/reject.
3. An approved store owner manages their store profile (branding, hours, delivery zones).
4. The owner creates products (variants, GST/HSN pricing) **scoped to their store**; uploads images via presigned URL to object storage.
5. An `admin` moderates products (approve/reject) and manages the category taxonomy + brands.
6. **Tenant isolation:** store A's owner CANNOT read/modify store B's store or products (app-level scoping + Postgres RLS).
7. Product changes emit events (`ProductPublished`/`ProductUpdated`) for Phase 4 search.

## Required Artifacts
- `apps/store-service` (own `stores` DB): store application, onboarding state machine, profile/branding/hours/delivery-zones, admin governance, tenant registry; emits store events.
- `apps/catalog-service` (own `catalog` DB): categories/taxonomy, brands, products, variants, attributes, GST/HSN pricing, media (S3/MinIO presigned), product moderation; emits product events.
- Postgres **RLS** policies + Prisma tenant-context middleware on tenant-scoped tables.
- Admin-scoped endpoints (`@Roles('admin')`); store-scoped endpoints (`@StoreScope`).
- `deploy/smoke-test-store.sh`; compose + kong + deploy wiring (DB-per-service, connectors).

## Key Links (most likely to break)
- `@StoreScope` ABAC: owner's `stores` JWT claim ↔ requested storeId (store-staff scoping). **Note:** the `stores` claim must be populated in the token — see Plan 02 (map store ownership into a Keycloak claim, or resolve store membership server-side from store-service).
- Store approval (`StoreApproved`) → catalog publishability / search later.
- Tenant isolation: every catalog query filtered by storeId (app) + RLS (DB) — defense in depth.
- Presigned upload ↔ MinIO/S3 bucket + CORS.
- Product event (outbox → Debezium → Kafka `livora.catalog.events`) for Phase 4.

## Plans & Waves
| Plan | Title | Wave | Depends | compose/kong |
|---|---|---|---|---|
| 01 | Store Service scaffold + onboarding + tenant registry | 1 | — | yes |
| 02 | Store admin governance + profile/zones + store claim | 2 | 01 | no |
| 03 | Catalog Service scaffold + taxonomy/brands + admin | 2 | — | yes |
| 04 | Products + variants + GST/HSN pricing + tenant scoping | 3 | 03 | no |
| 05 | Product media (presigned) + moderation + ProductPublished | 4 | 04 | no |
| 06 | Multi-tenancy RLS hardening + isolation tests | 5 | 02,04 | no |
| 07 | Integration: store→catalog flow + smoke-test + host verify | 6 | all | no |

> compose/kong/deploy edits serialized by wave (01 W1, 03 W2). 02∥03 parallel (disjoint). Service code disjoint elsewhere.

## Key decision — the `stores` claim for ABAC
`@StoreScope` reads `req.user.storeIds` from a JWT `stores` claim. Options (decide in Plan 02): (a) a Keycloak protocol mapper that maps a user attribute `stores` into the token (identity/store-service maintains the attribute on approval), or (b) resolve store membership server-side (a guard variant that calls store-service / a shared claim). **Plan 02 picks (a): on StoreApproved, store-service sets the owner's Keycloak `stores` attribute via the Admin API + a token mapper includes it.** Keeps the guard stateless.

## Discovery (Level 1-2)
- Postgres RLS + Prisma (session GUC via tx-scoped `SET LOCAL`) — known pattern; verify on host.
- S3/MinIO presigned PUT (`@aws-sdk/client-s3` + `s3-request-presigner`) against MinIO endpoint + bucket creation in deploy.
- Keycloak protocol mapper for the `stores` attribute claim.
No separate research agents; approaches specified inline, host-verified.

## Deployment reminder
Windows dev (no Docker) → build/test locally, host-verify via `git pull` + `deploy.sh`. New services → compose + prod + kong + deploy DB/connector loops. Realm/mapper changes need a fresh Keycloak (`up -d --force-recreate keycloak`).
