---
phase: 03-store-catalog
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/store-service/src/admin/store-admin.controller.ts
  - apps/store-service/src/admin/store-admin.service.ts
  - apps/store-service/src/store/store-profile.controller.ts
  - apps/store-service/src/store/store.service.ts
  - apps/store-service/src/keycloak/keycloak-admin.service.ts
  - apps/store-service/src/app.module.ts
  - infra/keycloak/livora-realm.json
autonomous: true
must_haves:
  truths:
    - "An admin can list pending stores and approve/reject/suspend them"
    - "On approval, a StoreApproved event is emitted and the owner gains a 'stores' claim covering that store"
    - "An approved owner can update store profile, hours, and delivery zones (own store only)"
  artifacts:
    - "admin governance endpoints (@Roles('admin'))"
    - "store profile/hours/zones management (owner-scoped)"
    - "owner 'stores' Keycloak attribute + token mapper (powers @StoreScope)"
  key_links:
    - "approve -> status 'approved' + StoreApproved event + set owner Keycloak attribute stores += storeId"
    - "realm protocol mapper maps user attribute 'stores' into the access token (claim read by @StoreScope)"
---

<objective>
Add admin store governance (approve/reject/suspend) and store-owner profile management, and wire the `stores` token claim that powers ABAC store-scoping for the rest of the platform.

Purpose: REQ-STR-02/03/04/05/07, REQ-ADM-01. Approval gates a store going live; the `stores` claim lets `@StoreScope` enforce store-staff/owner boundaries (Phase 3+).
Output: admin governance + owner profile/zone management + the `stores` claim mechanism.
</objective>

<context>
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/03-store-catalog/03-store-catalog-01-SUMMARY.md
@apps/identity-service/src/keycloak/keycloak-admin.service.ts   # KC admin client pattern to reuse
@libs/auth/src/lib/store-scope.guard.ts   # consumes the stores claim
</context>

<tasks>

<task type="auto">
  <name>Task 1: Admin store governance (approve/reject/suspend) + StoreApproved + owner stores claim</name>
  <files>apps/store-service/src/admin/store-admin.controller.ts, apps/store-service/src/admin/store-admin.service.ts, apps/store-service/src/keycloak/keycloak-admin.service.ts, apps/store-service/src/store/store.service.ts, apps/store-service/src/app.module.ts, infra/keycloak/livora-realm.json</files>
  <action>Add a `KeycloakAdminService` to store-service (copy identity-service's: client-credentials via a confidential client — reuse `identity-admin` or add `store-admin`; needs manage-users + view-realm to set user attributes). Implement `StoreAdminService`: `listPending()`, `approve(storeId)`, `reject(storeId, reason)`, `suspend(storeId)`. `approve` (in a transaction): set store.status='approved', emit `store.approved` (payload {storeId, ownerKeycloakId}) via outbox, AND append storeId to the owner's Keycloak user attribute `stores` (GET user attrs, add, PUT). `suspend`/`reject` emit `store.suspended`/`store.rejected`. `StoreAdminController` guarded `KeycloakJwtGuard + @Roles('admin')`: GET /admin/stores?status=pending, POST /admin/stores/:id/approve|reject|suspend. In `livora-realm.json`: add a **User Attribute protocol mapper** named `stores` (multivalued) on the `livora-web`/`livora-store-portal` clients (or a shared client scope) so the `stores` attribute is included as a `stores` claim in tokens. Unit-test StoreAdminService.approve (status + event + attribute call mocked).</action>
  <verify>`pnpm nx test store-service` passes. Host (Plan 07): admin approves a pending store -> approved + StoreApproved; the owner's next token contains `stores:[storeId]`.</verify>
  <done>Admin approves/rejects/suspends; approval emits StoreApproved + grants the owner a stores claim.</done>
</task>

<task type="auto">
  <name>Task 2: Store-owner profile, hours & delivery zones (owner-scoped)</name>
  <files>apps/store-service/src/store/store-profile.controller.ts, apps/store-service/src/store/store.service.ts, apps/store-service/src/app.module.ts</files>
  <action>Extend `StoreService` with owner-scoped mutations (verify the store's ownerKeycloakId == CurrentUser.sub, else 403): `updateProfile(storeId, {description,logoUrl,bannerUrl})`, `setHours(storeId, hours[])`, `setDeliveryZones(storeId, zones[])`. `StoreProfileController` (`KeycloakJwtGuard + @Roles('store_owner')`): `PUT /stores/:id/profile`, `PUT /stores/:id/hours`, `PUT /stores/:id/zones`. (Delivery zones feed Phase 4 nearby-store search.) Validate inputs; reject edits on non-approved stores where appropriate. Unit-test ownership enforcement (owner vs non-owner).</action>
  <verify>`pnpm nx test store-service` passes ownership specs. Host: owner updates profile/hours/zones on their store; another owner gets 403.</verify>
  <done>Owners manage their store's profile/hours/zones; cross-owner edits blocked.</done>
</task>

</tasks>

<verification>
- store-service tests green; admin governance + owner profile/zones enforced.
- StoreApproved event + owner stores claim wired (realm mapper).
</verification>

<success_criteria>
- [ ] admin approve/reject/suspend (@Roles admin) + StoreApproved
- [ ] owner gains `stores` claim on approval (realm mapper + KC attribute)
- [ ] owner-scoped profile/hours/zones; cross-owner 403
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-02-SUMMARY.md` (governance flow, the stores-claim mechanism + realm mapper, host steps incl. fresh-Keycloak note).
</output>
