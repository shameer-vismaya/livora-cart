---
phase: 03-store-catalog
plan: 06
type: execute
wave: 5
depends_on: [02, 04]
files_modified:
  - apps/catalog-service/src/prisma/prisma.service.ts
  - apps/catalog-service/src/tenant/tenant.middleware.ts
  - apps/catalog-service/prisma/rls/enable-rls.sql
  - apps/store-service/prisma/rls/enable-rls.sql
  - deploy/deploy.sh
autonomous: true
must_haves:
  truths:
    - "Postgres RLS policies restrict tenant-scoped tables (product, product_variant; store) by a session tenant GUC"
    - "Catalog queries set the tenant context per request so RLS is active (defense-in-depth over app scoping)"
    - "An isolation test proves a query under store A's context cannot read store B's rows"
  artifacts:
    - "enable-rls.sql per service (ALTER TABLE ... ENABLE ROW LEVEL SECURITY + policies)"
    - "Prisma tenant-context (tx-scoped SET LOCAL app.current_store)"
  key_links:
    - "request tenant (from @StoreScope) -> SET LOCAL app.current_store within the query tx -> RLS policy USING (store_id = current_setting)"
    - "deploy.sh applies enable-rls.sql after db push per service"
---

<objective>
Add Postgres Row-Level Security as defense-in-depth beneath the application-level tenant scoping, so a coding mistake cannot leak cross-store data (NFR-SEC-02).

Purpose: The architecture mandates RLS for multi-tenant isolation. App scoping (Plan 04) is primary; RLS is the backstop enforced by the database.
Output: RLS policies + a Prisma tenant-context mechanism + an isolation test.
</objective>

<context>
@.planning/research/ARCHITECTURE.md   # §8 multi-tenancy RLS
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/03-store-catalog/03-store-catalog-04-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: RLS policies + apply on deploy</name>
  <files>apps/catalog-service/prisma/rls/enable-rls.sql, apps/store-service/prisma/rls/enable-rls.sql, deploy/deploy.sh</files>
  <action>Author `enable-rls.sql` for catalog (tables `product`, `product_variant` — note variant has no storeId, scope via product join or add storeId to variant; simplest: add `store_id` to product_variant too OR write the policy as a subquery on product) and for store (`store` table by owner/id). Policies: `ALTER TABLE product ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation ON product USING (store_id = current_setting('app.current_store', true));` plus a bypass for the admin path (either a separate DB role, or app sets `app.current_store='*'` and the policy allows '*'). Use a permissive admin sentinel: `USING (current_setting('app.current_store',true) = '*' OR store_id = current_setting('app.current_store',true))`. Make the SQL idempotent (DROP POLICY IF EXISTS first). In deploy.sh, after `db push` for catalog/store, apply the respective enable-rls.sql via psql (superuser). NOTE: the app DB user must NOT be superuser/owner-bypass for RLS to apply — document that policies use FORCE ROW LEVEL SECURITY so even the table owner is subject to them: `ALTER TABLE product FORCE ROW LEVEL SECURITY;`.</action>
  <verify>`bash -n deploy/deploy.sh`; SQL reviewed. Host (Plan 07): with `app.current_store` set to store A, a raw `SELECT * FROM product` returns only A's rows.</verify>
  <done>RLS enabled + FORCED on tenant tables with an admin sentinel; applied on deploy.</done>
</task>

<task type="auto">
  <name>Task 2: Prisma tenant-context middleware + isolation test</name>
  <files>apps/catalog-service/src/tenant/tenant.middleware.ts, apps/catalog-service/src/prisma/prisma.service.ts, apps/catalog-service/src/tenant/tenant.util.ts</files>
  <action>Add a tenant-context mechanism: a request-scoped value (the resolved storeId or '*') and a `PrismaService.withTenant(storeId, fn)` that runs `fn` inside a transaction beginning with `SET LOCAL app.current_store = $storeId` so RLS sees the GUC (tx-scoped; safe with pooling). Route the ProductService reads/writes through `withTenant` using the storeId resolved by @StoreScope (admin → '*'). Keep the app-level storeId filter too (belt and suspenders). Write an integration-style unit test (Testcontainers Postgres if available, else a focused test) asserting that under tenant A the policy hides B's rows; if Testcontainers isn't wired, write the test to run against a DATABASE_URL when present and skip otherwise, and document host verification.</action>
  <verify>`pnpm nx test catalog-service` passes (RLS test runs against DB when available, else documented skip). Host (Plan 07): cross-tenant raw query blocked by RLS.</verify>
  <done>Catalog queries set tenant GUC per tx; RLS backs app scoping; isolation verified.</done>
</task>

</tasks>

<verification>
- RLS enabled+forced on tenant tables; deploy applies policies.
- Prisma sets app.current_store per tx; isolation test/host check passes.
</verification>

<success_criteria>
- [ ] RLS policies (forced) on product/product_variant/store with admin sentinel
- [ ] Prisma tenant-context (SET LOCAL) wired into catalog reads/writes
- [ ] isolation proven (test/host)
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-06-SUMMARY.md` (RLS policy design, tenant-context mechanism, how to verify isolation on host).
</output>
