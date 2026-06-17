---
phase: 03-store-catalog
plan: 04
subsystem: catalog-service
tags: [products, variants, gst, hsn, tenant-isolation, abac]
requires: [03-store-catalog-03, 03-store-catalog-02]
provides: [products, gst-helper, tenant-scoped-catalog]
affects: [03-store-catalog-05, 06]
key-files:
  created:
    - apps/catalog-service/src/pricing/gst.ts (+spec)
    - apps/catalog-service/src/tenant/tenant.util.ts
    - apps/catalog-service/src/product/* (service, controller, spec)
  modified: [apps/catalog-service/prisma/schema.prisma, apps/catalog-service/src/app.module.ts]
completed: 2026-06-17
status: complete
verified: local (lint+test+build green); host at Plan 07
---

# Phase 3 Plan 04: Products + GST + Tenant Scoping

Tenant-scoped product catalog with correct GST/HSN pricing.

## What was built
- `product` + `product_variant` (storeId tenant column; money in **integer paise**).
- `gst.ts`: `computeGst(amountPaise, ratePct, taxInclusive, place)` → CGST/SGST (intra) or IGST (inter), inclusive/exclusive, paise rounding with halves summing exactly. 5 unit tests.
- `ProductService`: every method filters by `storeId` (the isolation invariant); variants; submitForReview.
- `/stores/:storeId/products` guarded by `KeycloakJwtGuard + RolesGuard + StoreScopeGuard`; `resolveStoreId` enforces the `stores` claim (admin bypass). Cross-store → 404/403.

## Verification
`nx run-many -t lint test build -p catalog-service` green (GST + tenant-scoping specs). Host isolation at Plan 07.

## Decisions
- App-level tenant scoping is PRIMARY; RLS (Plan 06) is the DB backstop.
- GST rates restricted to {0,5,12,18,28}; money never floats (paise ints).

## Deviations
None.
