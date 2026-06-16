---
phase: 02-identity
plan: 02
subsystem: reference-service
tags: [refactor, auth, smoke-test, deploy]
requires: [02-identity-01]
provides: [smoke-test, reference-on-shared-auth]
affects: [all-services, deploy]
key-files:
  created: [deploy/smoke-test.sh]
  modified:
    - apps/platform-reference/src/app.module.ts
    - apps/platform-reference/src/demo/demo.controller.ts
    - apps/platform-reference/Dockerfile
    - Makefile
  removed:
    - apps/platform-reference/src/auth/*
completed: 2026-06-16
status: complete
verified: local (lint+test+build green); host smoke at Plan 07
---

# Phase 2 Plan 02: Reference on @livora/auth + Smoke Test

Refactored the proven reference service onto the shared `@livora/auth` (regression guard for the lib) and added an automated post-deploy smoke test.

## What changed
- `app.module.ts` imports `AuthModule` from `@livora/auth`; removed local `JwksProvider`/`KeycloakJwtGuard` providers.
- `demo.controller.ts` imports `KeycloakJwtGuard` from `@livora/auth`.
- Deleted `apps/platform-reference/src/auth/*` (now in the lib).
- Dockerfile copies `dist/libs/auth` into `node_modules/@livora/auth` (runtime).
- `deploy/smoke-test.sh` + `make smoke`: health → token → 401 (no token) → 202 (authorized POST) → consumer applied (polls logs).

## Verification
`nx run-many -t lint test build -p platform-reference` green; no remaining local auth imports. Host smoke run happens in Plan 07 (`make smoke`).

## Deviations
None.
