---
phase: 02-identity
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/platform-reference/src/app.module.ts
  - apps/platform-reference/src/demo/demo.controller.ts
  - apps/platform-reference/src/auth/keycloak-jwt.guard.ts
  - apps/platform-reference/src/auth/jwks.provider.ts
  - apps/platform-reference/src/auth/auth.helpers.ts
  - apps/platform-reference/Dockerfile
  - deploy/smoke-test.sh
  - Makefile
autonomous: true
must_haves:
  truths:
    - "platform-reference uses @livora/auth (its local auth/ copies are removed) and still behaves identically (401 without token, 202 with)"
    - "deploy/smoke-test.sh proves token -> protected POST -> consumer applied, exiting non-zero on failure"
  artifacts:
    - "platform-reference importing guard/CurrentUser from @livora/auth"
    - "deploy/smoke-test.sh"
  key_links:
    - "Dockerfile copies dist/libs/auth into node_modules/@livora/auth (runtime resolution)"
    - "smoke-test obtains a Keycloak token via Kong /realms and asserts 202 + applied-event log"
---

<objective>
Prove `@livora/auth` works by adopting it in the already-proven reference service (regression guard), and add an automated post-deploy smoke test so future deploys self-verify the spine.

Purpose: Validate the shared lib against a known-good service before new services depend on it; institutionalize the manual host checks we ran in Phase 1.
Output: platform-reference refactored to @livora/auth; `deploy/smoke-test.sh`.
</objective>

<context>
@.planning/phases/02-identity/CONTEXT.md
@.planning/phases/02-identity/02-identity-01-SUMMARY.md
@apps/platform-reference/Dockerfile
@deploy/deploy.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: Refactor platform-reference to use @livora/auth</name>
  <files>apps/platform-reference/src/app.module.ts, apps/platform-reference/src/demo/demo.controller.ts, apps/platform-reference/src/auth/keycloak-jwt.guard.ts, apps/platform-reference/src/auth/jwks.provider.ts, apps/platform-reference/src/auth/auth.helpers.ts, apps/platform-reference/Dockerfile</files>
  <action>Replace the service-local auth with `@livora/auth`: delete `src/auth/*` files; update `app.module.ts` and `demo.controller.ts` to import `KeycloakJwtGuard`, `JwksProvider`, `@CurrentUser` from `@livora/auth`. Provide `JwksProvider`/`KeycloakJwtGuard` in the module (or expose an `AuthModule` from the lib and import it — preferred). Update the Dockerfile runtime stage to also copy the built auth lib: `COPY --from=builder /repo/dist/libs/auth ./node_modules/@livora/auth` (same pattern as contracts/config/observability). Behavior must be unchanged.</action>
  <verify>`pnpm nx build platform-reference` + `pnpm nx test platform-reference` pass; grep shows no remaining local `src/auth` imports; the demo controller imports from `@livora/auth`.</verify>
  <done>Reference compiles using @livora/auth; no local auth copies; Dockerfile copies the auth lib for runtime.</done>
</task>

<task type="auto">
  <name>Task 2: deploy/smoke-test.sh — automated post-deploy verification</name>
  <files>deploy/smoke-test.sh, Makefile</files>
  <action>Write `deploy/smoke-test.sh` (bash, `set -euo pipefail`, sources ENV_FILE for ports) that: (1) GET Kong `/reference/health` expects 200; (2) fetch a token from Kong `/realms/livora/.../token` (password grant, testcustomer); (3) POST `/reference/demo/echo` with `Authorization: Bearer` + a unique `Idempotency-Key` expecting HTTP 202; (4) assert no-token returns 401; (5) sleep, then assert `docker logs livora-platform-reference` contains `applied event` for the returned eventId. Print clear PASS/FAIL per check; exit non-zero on any failure. Add a Makefile target `smoke` -> `bash deploy/smoke-test.sh`. (Optional) call it at the end of `deploy.sh` after healthcheck.</action>
  <verify>`bash -n deploy/smoke-test.sh` clean; on the Ubuntu host after deploy, `make smoke` exits 0 (host check at integration, Plan 07).</verify>
  <done>smoke-test.sh exists, lints clean, asserts the full spine, returns proper exit code; `make smoke` wired.</done>
</task>

</tasks>

<verification>
- `pnpm nx run-many -t lint test build` green after refactor.
- smoke-test.sh syntax-clean and complete.
</verification>

<success_criteria>
- [ ] platform-reference on @livora/auth, behavior unchanged
- [ ] Dockerfile copies auth lib for runtime
- [ ] deploy/smoke-test.sh + make smoke
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-02-SUMMARY.md` (refactor notes + smoke-test usage). Flag host re-verification (run `make smoke`) for Plan 07.
</output>
