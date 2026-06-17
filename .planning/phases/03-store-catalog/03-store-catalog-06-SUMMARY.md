---
phase: 03-store-catalog
plan: 06
subsystem: catalog-service
tags: [rls, multi-tenancy, postgres, defense-in-depth]
requires: [03-store-catalog-04]
provides: [rls-policies, tenant-context]
affects: [security]
key-files:
  created: [apps/catalog-service/prisma/rls/enable-rls.sql]
  modified: [apps/catalog-service/src/prisma/prisma.service.ts, apps/catalog-service/src/product/product.service.ts, deploy/deploy.sh]
completed: 2026-06-17
status: complete
verified: local (build/test green); RLS enforcement host-verified at Plan 07
---

# Phase 3 Plan 06: Multi-Tenancy RLS Hardening

Postgres RLS as defense-in-depth beneath the (tested) app-level tenant scoping.

## What was built
- `enable-rls.sql`: `ENABLE`+`FORCE ROW LEVEL SECURITY` on `product`/`product_variant`; policy enforces `store_id = current_setting('app.current_store')` with a `'*'` admin sentinel.
- `PrismaService.withTenant(storeId, fn)`: tx-scoped `set_config('app.current_store', storeId, true)` (pooling-safe); wired into product read paths.
- `deploy.sh` applies the SQL after catalog db push.

## Key decision — permissive-when-unset
RLS policy ALLOWS when the GUC is unset/empty (not just when set). Rationale: no local Postgres (Docker is host-only) to validate strict deny-when-unset across every query path, and a missed `withTenant` under strict mode would silently empty the catalog on the host (expensive to debug remotely). So: **app-level storeId scoping remains the primary, tested control**; RLS enforces on wired paths and is a backstop. Tightening to deny-when-unset (with full withTenant coverage) is a host-verified follow-up.

## Verification
Build/test green. RLS enforcement (raw cross-tenant query blocked when GUC set) verified on host at Plan 07.

## Deviations
- Store-service RLS deferred (store rows are owner-keyed, not store-GUC-keyed; app-level ownership enforced). Documented; revisit if needed.
