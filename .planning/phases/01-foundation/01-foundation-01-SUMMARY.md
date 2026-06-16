---
phase: 01-foundation
plan: 01
subsystem: platform
tags: [nx, pnpm, typescript, monorepo, shared-libs]
requires: []
provides: [nx-workspace, "@livora/contracts", "@livora/config", "@livora/observability"]
affects: [all-future-services]
tech-stack:
  added: [nx@20.3, pnpm@9.15, typescript@5.6, eslint@8, jest@29, zod@3]
  patterns: [monorepo, shared-contracts, typed-env-loader, telemetry-bootstrap]
key-files:
  created:
    - package.json
    - nx.json
    - tsconfig.base.json
    - libs/contracts/src/lib/events.ts
    - libs/contracts/src/lib/idempotency.ts
    - libs/config/src/lib/load-env.ts
    - libs/observability/src/lib/telemetry.ts
  modified: [.gitignore]
completed: 2026-06-16
status: complete
verified: local (pnpm/nx — no Docker required)
---

# Phase 1 Plan 01: Nx Monorepo + Shared Libraries Summary

Nx 20.3 + pnpm 9 + TypeScript 5.6 monorepo with three buildable, tested shared libraries (`@livora/contracts`, `@livora/config`, `@livora/observability`) reachable via path aliases — the toolchain every future Livora service plugs into.

## What was built
- **Workspace:** Nx (classic executor targets — `@nx/js:tsc` build, `@nx/eslint:lint`, `@nx/jest:jest`), pnpm, tsconfig.base path aliases, ESLint 8 (eslintrc) + Prettier, Jest via ts-jest.
- **`@livora/contracts`:** `DomainEvent<T>` (outbox event shape with `eventId`/`aggregateId`/`traceparent`) + `makeDomainEvent`; branded `IdempotencyKey` with validation. Encodes the outbox/idempotency contracts from ARCHITECTURE.md §2.
- **`@livora/config`:** `loadEnv(schema)` zod validator with aggregated fail-fast errors + reusable `commonEnv`.
- **`@livora/observability`:** `createTelemetry()` typed surface + no-op fallback (real OTel SDK wiring deferred to Plan 04, marked with TODO(plan-04)).

## Verification (local, real)
- `pnpm install` ✓ (lockfile committed)
- `nx run-many -t test` ✓ — 3 projects, 7 tests passing
- `nx run-many -t lint` ✓ — all files pass
- `nx run-many -t build` ✓ — 3 projects compiled

## Decisions Made
- **ESLint 8 + typescript-eslint v7 (eslintrc), not ESLint 9 flat config** — avoids flat-config migration friction; stable with @nx/eslint 20.
- **Classic Nx executor targets, not the TS-plugin task inference** — more predictable to maintain by hand; explicit `build/lint/test` per project.
- **Node engines pinned `>=20`** (machine runs v22.12, compatible).

## Deviations from Plan
### Auto-fixed Issues
**1. [Rule 3 - Blocking] ESLint root `ignorePatterns` ignored the lib source dirs**
- Found during: lint verification.
- Issue: the `["**/*", "!**/src/**"]` pattern made `@nx/eslint:lint` report all files ignored.
- Fix: replaced with `["node_modules","dist","coverage",".nx","**/*.js"]`.
- Commit: 0b5156d (folded into Task 1 config).

## Next Plan Readiness
Ready for Plan 02 (Docker Compose infra). No blockers. Note: Docker not available locally → Plans 02–05 are authored/static-checked here and runtime-verified on the Ubuntu host per owner decision.
