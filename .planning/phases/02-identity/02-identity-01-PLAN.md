---
phase: 02-identity
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - libs/auth/project.json
  - libs/auth/package.json
  - libs/auth/tsconfig.json
  - libs/auth/tsconfig.lib.json
  - libs/auth/tsconfig.spec.json
  - libs/auth/jest.config.ts
  - libs/auth/src/index.ts
  - libs/auth/src/lib/auth.helpers.ts
  - libs/auth/src/lib/jwks.provider.ts
  - libs/auth/src/lib/keycloak-jwt.guard.ts
  - libs/auth/src/lib/roles.decorator.ts
  - libs/auth/src/lib/roles.guard.ts
  - libs/auth/src/lib/store-scope.decorator.ts
  - libs/auth/src/lib/store-scope.guard.ts
  - libs/auth/src/lib/current-user.decorator.ts
  - tsconfig.base.json
autonomous: true
must_haves:
  truths:
    - "@livora/auth exports a Keycloak JWT guard, RBAC roles guard+decorator, ABAC store-scope guard+decorator, and a CurrentUser decorator"
    - "RolesGuard returns 403 when the token lacks a required realm role"
    - "StoreScopeGuard denies access when the user's storeId claim does not match the requested store"
  artifacts:
    - "libs/auth built lib (@livora/auth) with unit tests"
    - "tsconfig.base path alias @livora/auth -> libs/auth/src/index.ts"
  key_links:
    - "RolesGuard reads realm roles from req.user (set by KeycloakJwtGuard)"
    - "StoreScopeGuard reads store scope from JWT claim + request param"
    - "lib package.json main -> compiled ./src/index.js (runtime resolution, per Phase 1 fix)"
---

<objective>
Create the shared `@livora/auth` library so every Livora service reuses ONE authn/authz implementation — extracted and generalized from the Phase-1-proven `platform-reference` guard, plus RBAC and ABAC.

Purpose: DRY auth. No service copy-pastes the JWT guard. RBAC (`@Roles`) and ABAC (`@StoreScope`) become one-line decorators (NFR-SEC-01, REQ-IAM-06/07).
Output: `libs/auth` exporting guard, role/store-scope guards + decorators, `@CurrentUser`, and helpers — unit-tested.
</objective>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/02-identity/CONTEXT.md
@apps/platform-reference/src/auth/keycloak-jwt.guard.ts
@apps/platform-reference/src/auth/jwks.provider.ts
@apps/platform-reference/src/auth/auth.helpers.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Generate libs/auth and move guard + helpers + JWKS into it</name>
  <files>libs/auth/project.json, libs/auth/package.json, libs/auth/tsconfig.json, libs/auth/tsconfig.lib.json, libs/auth/tsconfig.spec.json, libs/auth/jest.config.ts, libs/auth/src/index.ts, libs/auth/src/lib/auth.helpers.ts, libs/auth/src/lib/jwks.provider.ts, libs/auth/src/lib/keycloak-jwt.guard.ts, libs/auth/src/lib/current-user.decorator.ts, tsconfig.base.json</files>
  <action>Create a buildable lib mirroring the structure of `libs/config` (classic `@nx/js:tsc` targets; package.json `main`/`types` -> `./src/index.js`/`./src/index.d.ts` per the Phase-1 runtime-resolution fix; tsconfig.lib + spec + jest like the other libs). Move `auth.helpers.ts`, `jwks.provider.ts`, `keycloak-jwt.guard.ts` here from platform-reference, generalizing: the guard/provider read config from injected values or `process.env` via `@livora/config` (do NOT hardcode service names). Keep the audience-optional behavior proven in Phase 1 (enforce issuer+signature; enforce aud only when configured). Add `@CurrentUser()` param decorator returning `req.user` (the `AuthUser`). Add `@livora/auth` to tsconfig.base paths. Depends on `@nestjs/common`, `jose`, `@livora/config` (already installed).</action>
  <verify>`pnpm nx build auth` and `pnpm nx test auth` pass; `node -e "require('@livora/auth')"` style resolution works after build (dist/libs/auth/src/index.js exists).</verify>
  <done>@livora/auth builds + tests green; exports KeycloakJwtGuard, JwksProvider, AuthUser, CurrentUser, helpers.</done>
</task>

<task type="auto">
  <name>Task 2: Add RBAC (Roles) and ABAC (StoreScope) guards + decorators with tests</name>
  <files>libs/auth/src/lib/roles.decorator.ts, libs/auth/src/lib/roles.guard.ts, libs/auth/src/lib/store-scope.decorator.ts, libs/auth/src/lib/store-scope.guard.ts, libs/auth/src/index.ts</files>
  <action>Implement RBAC: `@Roles(...roles: string[])` sets metadata; `RolesGuard` (uses `Reflector`) reads `req.user.roles` (realm roles set by KeycloakJwtGuard) and returns true only if the user has at least one required role, else throws `ForbiddenException` (403). Implement ABAC: `@StoreScope({ param: 'storeId' })` + `StoreScopeGuard` that allows `admin` unconditionally, and for `store_owner`/`store_staff` requires the user's store claim (`req.user` store id(s), read from a JWT claim e.g. `stores`) to include the `storeId` route param; else 403. Export all from index. Add unit tests covering: role allow/deny, store-scope allow (matching), deny (mismatch), admin bypass. Use pure/mocked ExecutionContext (no live Keycloak).</action>
  <verify>`pnpm nx test auth` passes including new RBAC/ABAC specs (allow + 403 deny cases).</verify>
  <done>RolesGuard 403s on missing role; StoreScopeGuard enforces store match with admin bypass; all unit-tested.</done>
</task>

</tasks>

<verification>
- `pnpm nx run-many -t lint test build` green (auth lib included).
- @livora/auth resolvable via path alias; package.json main -> compiled JS.
</verification>

<success_criteria>
- [ ] @livora/auth lib builds + tests green
- [ ] JWT guard, RBAC RolesGuard+@Roles, ABAC StoreScopeGuard+@StoreScope, @CurrentUser exported
- [ ] Path alias + runtime-resolvable package.json
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-01-SUMMARY.md` documenting the @livora/auth public API and how services apply `@Roles`/`@StoreScope`.
</output>
