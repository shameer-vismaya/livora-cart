---
phase: 03-store-catalog
plan: 04
type: execute
wave: 3
depends_on: [03]
files_modified:
  - apps/catalog-service/prisma/schema.prisma
  - apps/catalog-service/src/product/product.controller.ts
  - apps/catalog-service/src/product/product.service.ts
  - apps/catalog-service/src/product/dto.ts
  - apps/catalog-service/src/pricing/gst.ts
  - apps/catalog-service/src/tenant/tenant.util.ts
  - apps/catalog-service/src/app.module.ts
autonomous: true
must_haves:
  truths:
    - "An approved store owner can create/list/update/delete products scoped to THEIR store"
    - "Products carry variants + GST/HSN pricing (CGST/SGST/IGST computed correctly)"
    - "A store owner cannot read or modify another store's products (app-level tenant scoping)"
  artifacts:
    - "product + product_variant tables (storeId tenant column)"
    - "ProductService with mandatory storeId scoping + @StoreScope routes"
    - "GST pricing helper (HSN, inclusive/exclusive, intra/inter-state split)"
  key_links:
    - "every product query filtered by storeId derived from @StoreScope/owner; admin bypass"
    - "product.categoryId/brandId reference catalog taxonomy; price stored in paise"
---

<objective>
Add the product catalog: products, variants, and GST/HSN pricing — strictly tenant-scoped to the owning store.

Purpose: REQ-CAT-01/02/04, NFR-SEC-02 (tenant isolation, app layer). The core sellable inventory of a store.
Output: product/variant CRUD scoped per store + a correct GST pricing helper.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/research/ARCHITECTURE.md   # tenancy
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/03-store-catalog/03-store-catalog-03-SUMMARY.md
@libs/auth/src/lib/store-scope.guard.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Product + variant schema and GST/HSN pricing helper</name>
  <files>apps/catalog-service/prisma/schema.prisma, apps/catalog-service/src/pricing/gst.ts</files>
  <action>Extend Prisma schema: `product` (id, storeId [tenant], categoryId, brandId nullable, title, description, hsnCode, status default 'draft', taxInclusive bool, gstRatePct, createdAt, updatedAt, @@index([storeId])) and `product_variant` (id, productId, sku unique, attributesJson, mrpPaise int, pricePaise int, active, @@index([productId])). All money in **integer paise**. Implement `src/pricing/gst.ts`: pure functions computing GST split from pricePaise + gstRatePct + taxInclusive + placeOfSupply (intra-state → CGST+SGST each half; inter-state → IGST full), returning {basePaise, cgstPaise, sgstPaise, igstPaise, totalPaise} with banker's rounding to paise. Unit-test gst.ts thoroughly (inclusive vs exclusive, intra vs inter-state, rounding).</action>
  <verify>`pnpm nx test catalog-service` passes GST unit tests (rounding + splits correct). `prisma validate` / build clean.</verify>
  <done>Product/variant schema with storeId tenant column; GST helper correct + unit-tested.</done>
</task>

<task type="auto">
  <name>Task 2: Tenant-scoped product CRUD</name>
  <files>apps/catalog-service/src/product/product.controller.ts, apps/catalog-service/src/product/product.service.ts, apps/catalog-service/src/product/dto.ts, apps/catalog-service/src/tenant/tenant.util.ts, apps/catalog-service/src/app.module.ts</files>
  <action>Implement `tenant.util.ts`: `resolveStoreId(user, requestedStoreId)` — admin may pass any storeId; store_owner/staff must have it in `user.storeIds` (else ForbiddenException). `ProductService`: ALL methods take a storeId and ALWAYS filter by it (create/list/get/update/delete); never a query without storeId (the core isolation invariant). `ProductController` routes under `/stores/:storeId/products` guarded `KeycloakJwtGuard + RolesGuard + StoreScopeGuard` with `@Roles('store_owner','store_staff','admin')` + `@StoreScope({param:'storeId'})` so a caller can only act within a store in their `stores` claim (admin bypass). Methods manage variants too. Validate: categoryId exists, gstRatePct in {0,5,12,18,28}, prices > 0. Unit-test ProductService scoping (store A cannot fetch store B's product) + resolveStoreId (owner allowed/denied, admin bypass).</action>
  <verify>`pnpm nx test catalog-service` passes scoping specs (cross-store denied). Host (Plan 07): owner of store A creates/lists products under /stores/A/products; using store B's id -> 403.</verify>
  <done>Products/variants CRUD strictly scoped by storeId; cross-store access denied; admin bypass.</done>
</task>

</tasks>

<verification>
- catalog tests green incl. GST + tenant-scoping.
- Every product query carries storeId; @StoreScope enforces membership.
</verification>

<success_criteria>
- [ ] product/variant schema (paise, storeId, HSN/GST)
- [ ] GST helper correct (inclusive/exclusive, intra/inter-state, rounding)
- [ ] tenant-scoped CRUD; cross-store 403; admin bypass
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-04-SUMMARY.md` (product model, GST helper API, tenant-scoping approach, host steps).
</output>
