---
phase: 03-store-catalog
plan: 02
subsystem: store-service
tags: [admin-governance, rbac, abac, stores-claim, keycloak]
requires: [03-store-catalog-01]
provides: [store-approval, stores-claim, store-profile]
affects: [03-store-catalog-04, 06]
key-files:
  created:
    - apps/store-service/src/admin/*
    - apps/store-service/src/store/store-profile.controller.ts
    - apps/store-service/src/keycloak/keycloak-admin.service.ts
  modified: [apps/store-service/src/store/store.service.ts, apps/store-service/src/app.module.ts, infra/keycloak/livora-realm.json]
completed: 2026-06-17
status: complete
verified: local (lint+test+build green); host at Plan 07
---

# Phase 3 Plan 02: Store Governance + Stores Claim

Admin store governance, owner profile/zone management, and the `stores` JWT claim that powers ABAC.

## What was built
- `StoreAdminService` (`@Roles('admin')`): list pending, **approve** (status→approved + `store.approved` event + grant owner `stores` Keycloak attribute), reject/suspend.
- `KeycloakAdminService.addStoreToUser` — appends storeId to the owner's multivalued `stores` attribute.
- Owner-scoped profile/hours/delivery-zones (`assertOwner` → 403 on cross-owner).
- Realm: **`stores` protocol mapper** (oidc-usermodel-attribute) on `livora-web` + `livora-store-portal` → tokens carry `stores` claim read by `@StoreScope`.

## The ABAC mechanism (decision realized)
On approval, store-service sets the owner's KC `stores` attribute; the mapper emits it as a `stores` claim; `@livora/auth` `StoreScopeGuard` reads `req.user.storeIds` from it. Stateless guard. **Owners must re-login after approval to get the claim.**

## Verification
`nx run-many -t lint test build -p store-service` green (approve/404 specs). Host at Plan 07.

## ⚠️ Host note
Realm mapper change → fresh Keycloak (`up -d --force-recreate keycloak`). Owner re-login after approval to receive the `stores` claim.

## Deviations
None.
