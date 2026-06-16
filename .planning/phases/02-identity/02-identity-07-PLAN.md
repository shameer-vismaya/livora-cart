---
phase: 02-identity
plan: 07
type: execute
wave: 5
depends_on: [03, 04, 05, 06]
files_modified:
  - apps/identity-service/src/registration/registration.controller.ts
  - apps/user-service/src/profile/profile.controller.ts
  - deploy/smoke-test-identity.sh
  - Makefile
  - apps/identity-service/src/admin/admin.controller.ts
autonomous: false
must_haves:
  truths:
    - "An admin-only endpoint rejects a customer token (403) and accepts an admin token (200) — RBAC proven live"
    - "A full identity flow works on the host: register -> login (OTP and/or password) -> profile auto-created -> GET /users/profile/me -> manage address/prefs"
    - "smoke-test-identity.sh asserts the whole flow and exits non-zero on failure"
  artifacts:
    - "RBAC applied (@Roles) on a representative admin route"
    - "deploy/smoke-test-identity.sh"
  key_links:
    - "@livora/auth RolesGuard enforced across services with real Keycloak tokens"
    - "end-to-end identity+user flow through Kong"
---

<objective>
Tie Phase 2 together: prove RBAC end-to-end with real tokens, add an identity smoke test, and verify the whole authentication + profile flow on the Ubuntu host.

Purpose: Confirm the authn/authz foundation actually works across services before Phase 3 builds on it.
Output: live RBAC enforcement, `deploy/smoke-test-identity.sh`, and a host-verified Phase 2.
</objective>

<context>
@.planning/phases/02-identity/CONTEXT.md
@.planning/phases/02-identity/02-identity-03-SUMMARY.md
@.planning/phases/02-identity/02-identity-04-SUMMARY.md
@.planning/phases/02-identity/02-identity-05-SUMMARY.md
@.planning/phases/02-identity/02-identity-06-SUMMARY.md
@deploy/smoke-test.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: Apply RBAC on a representative admin route + identity smoke test</name>
  <files>apps/identity-service/src/admin/admin.controller.ts, apps/identity-service/src/registration/registration.controller.ts, deploy/smoke-test-identity.sh, Makefile</files>
  <action>Add an admin-scoped endpoint to demonstrate/verify RBAC: `GET /identity/admin/users` guarded by `KeycloakJwtGuard` + `@Roles('admin')` (from @livora/auth) listing recent identity_user rows (admin-only). Ensure `@Roles`/`RolesGuard` are correctly registered (APP_GUARD or per-route). Write `deploy/smoke-test-identity.sh` (`set -euo pipefail`, sources ENV_FILE): (a) register a unique email user via `/identity/auth/register` -> 201; (b) password-login via Kong `/realms/livora/.../token` -> token; (c) `GET /users/profile/me` -> 200 with matching email (profile auto-created from UserRegistered; poll up to ~20s for eventual consistency); (d) create an address -> 200 with lat/lon; (e) admin token -> `GET /identity/admin/users` 200, customer token -> 403; (f) OTP request in dev returns/logs a code and verify -> token (if test phone configured, else skip with a logged note). Print PASS/FAIL per step; exit non-zero on failure. Add Makefile target `smoke-identity`.</action>
  <verify>`pnpm nx build identity-service` passes; `bash -n deploy/smoke-test-identity.sh` clean. (Live assertions run in Task 2 on the host.)</verify>
  <done>Admin route enforces @Roles('admin'); smoke-test-identity.sh authored + wired; builds clean.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 2: Host verification of the full Phase 2 flow</name>
  <action>On the Ubuntu host: `git pull` then `ENV_FILE=deploy/.env.production bash deploy/deploy.sh` (set MSG91_*, KEYCLOAK_ADMIN_CLIENT_SECRET, GEOCODING_API_KEY in deploy/.env.production first; OTP/social/geocoding work in dev-stub mode without real keys). Then run `make smoke` (Phase 1 spine) and `make smoke-identity` (Phase 2 flow).</action>
  <verify>Both smoke scripts exit 0: register -> login -> profile auto-created -> address geocoded -> RBAC 200/403 all pass; identity-service + user-service show (healthy) in `docker compose ps`.</verify>
  <done>Phase 2 verified end-to-end on the host; both smoke tests green.</done>
</task>

</tasks>

<verification>
- RBAC proven live (admin 200 / customer 403).
- Full register->login->profile->address flow passes on host; smoke tests green.
</verification>

<success_criteria>
- [ ] @Roles enforced live across services
- [ ] smoke-test-identity.sh covers the full flow
- [ ] Host-verified: identity + user services healthy and functional
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-07-SUMMARY.md` and update `.planning/STATE.md` (Phase 2 complete + host-verified, decisions, any deferrals).
</output>
