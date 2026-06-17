---
phase: 02-identity
plan: 07
subsystem: integration
tags: [rbac, smoke-test, host-verified]
requires: [02-identity-03, 02-identity-04, 02-identity-05, 02-identity-06]
provides: [rbac-live, identity-smoke-test, phase-2-verified]
affects: [phase-3]
key-files:
  created:
    - apps/identity-service/src/admin/admin.controller.ts
    - deploy/smoke-test-identity.sh
  modified: [Makefile]
completed: 2026-06-17
status: complete
verified: host (full identity flow green 2026-06-17)
---

# Phase 2 Plan 07: Integration — RBAC + Smoke Test (host-verified)

Tied Phase 2 together and verified the whole authn/authz foundation on the Ubuntu host.

## What was built
- `GET /identity/admin/users` guarded by `KeycloakJwtGuard + @Roles('admin')` — live RBAC.
- `deploy/smoke-test-identity.sh` (+ `make smoke-identity`): register → login → profile auto-created → address → RBAC.

## Host verification (2026-06-17) — ALL PASSED
```
register → 201
login new user → token
profile auto-created (UserRegistered → Kafka → user-service)
address created (geocoded)
RBAC: customer denied (403) / admin allowed (200)
```

## Host bring-up fixes (build-only → runtime gaps), folded into the repo
1. **Build:** each service Dockerfile builds all libs (`nx run-many build contracts config observability auth`) — `nx build <svc>` alone skips libs the service doesn't import (user-service ∌ contracts) → COPY failed.
2. **Generated Prisma client gitignored** → nx asset-copy skipped it → runtime `Cannot find module '../generated/prisma'`. Each Dockerfile now copies `src/generated/prisma` explicitly.
3. **Kong stale config:** single-file bind mount pins an inode; git-pull replaces the file → routes never load. Mount the **directory** + `kong reload` on deploy.
4. **Keycloak admin RBAC:** `identity-admin` service account needed `view-realm` (role lookup 403'd register).
5. **Password not persisting:** inline credentials on POST /users don't persist → set via `reset-password` endpoint.
6. **`VERIFY_PROFILE` required action:** KC24 requires firstName/lastName by default → email/OTP users (no name) blocked with "Account is not fully set up" (`resolve_required_actions`). Disabled it (correct for email/phone signup).
7. **Smoke email `+`** → form-encodes to space (`user_not_found`) → use `-`.
8. **OTel SDK** fully wired (traces+metrics); `make` added to provisioning.

## Deviations
All of the above were Rule 1-3 auto-fixes (runtime correctness) discovered during host verification.

## Phase 2 = COMPLETE & host-verified. Next: Phase 3 (Store Onboarding, Catalog & Admin Governance).
