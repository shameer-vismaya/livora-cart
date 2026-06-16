---
phase: 02-identity
plan: 01
subsystem: shared-auth
tags: [auth, rbac, abac, keycloak, jwt, nestjs]
requires: [phase-1]
provides: ["@livora/auth", KeycloakJwtGuard, RolesGuard, StoreScopeGuard, CurrentUser, AuthModule]
affects: [identity-service, user-service, all-future-services]
tech-stack:
  added: []
  patterns: [shared-auth-lib, rbac-roles-guard, abac-store-scope-guard]
key-files:
  created:
    - libs/auth/src/lib/keycloak-jwt.guard.ts
    - libs/auth/src/lib/jwks.provider.ts
    - libs/auth/src/lib/auth.env.ts
    - libs/auth/src/lib/auth.helpers.ts
    - libs/auth/src/lib/roles.decorator.ts
    - libs/auth/src/lib/roles.guard.ts
    - libs/auth/src/lib/store-scope.decorator.ts
    - libs/auth/src/lib/store-scope.guard.ts
    - libs/auth/src/lib/current-user.decorator.ts
    - libs/auth/src/lib/auth.module.ts
  modified: [tsconfig.base.json]
completed: 2026-06-16
status: complete
verified: local (lint + 11 tests + build green)
---

# Phase 2 Plan 01: @livora/auth Shared Library Summary

One reusable authn/authz library for every Livora service — generalized from the Phase-1-proven reference guard, plus RBAC and ABAC.

## Public API
- `AuthModule` — import into a service's AppModule; provides + exports all guards.
- `KeycloakJwtGuard` — validates Keycloak RS256 JWT (issuer + signature; audience only if `JWT_AUDIENCE` set), attaches `AuthUser` to `req.user`.
- `@Roles(...roles)` + `RolesGuard` — RBAC; 403 unless principal has a required realm role.
- `@StoreScope({param})` + `StoreScopeGuard` — ABAC; admin bypass, else principal's `storeIds` claim must include the route's store id.
- `@CurrentUser()` — inject the `AuthUser`.
- `loadAuthEnv()`, `AuthUser`, helpers (`extractBearerToken`, `extractRealmRoles`, `extractStoreIds`, `toAuthUser`).

## How services apply it
```ts
@UseGuards(KeycloakJwtGuard, RolesGuard)
@Roles('admin')
@Get('admin/things')
list(@CurrentUser() user: AuthUser) { ... }
```
Config via env: `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `JWT_AUDIENCE` (empty by default).

## Verification
`nx run-many -t lint test build -p auth` green — 11 unit tests (helpers, RBAC allow/deny, ABAC match/mismatch/admin-bypass).

## Deviations
- Heredoc mangled a regex backslash in jest.config (fixed via editor) — Rule 3.
- Added `storeIds` to `AuthUser` (from a `stores` JWT claim) to power ABAC — extends the Phase-1 helper.

## Next
Plan 02 refactors platform-reference onto this lib (regression guard) + adds smoke-test.
