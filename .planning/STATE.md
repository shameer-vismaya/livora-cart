# STATE — Livora Cart

> Project memory. Updated as work progresses. Source of truth for "where are we?".

## Snapshot
- **Project:** Livora Cart — multi-vendor commerce marketplace (India)
- **Phase:** **Phase 1 EXECUTED** (build-only) — 5/5 plans authored & committed; 1 open host checkpoint
- **Mode:** YOLO · **Depth:** Comprehensive · **Execution:** Parallel
- **Last updated:** 2026-06-16
- **Progress:** Phase 1 of 11 · `█░░░░░░░░░░` ~9%

## Phase 1 Execution Status (build-now / verify-on-host)
| Plan | Status | Local verification |
|---|---|---|
| 01 monorepo + libs | ✅ done | lint+test+build green (7 tests) |
| 02 docker-compose infra | ✅ authored | YAML/JSON validated |
| 03 reference service | ✅ done | lint+test+build green (4 tests) |
| 04 observability | ✅ done | OTel SDK compiles; configs valid |
| 05 ubuntu deploy | ⚠️ tasks 1-2 done | bash -n + compose valid |

**OPEN CHECKPOINT:** Plan 05 Task 3 — run `deploy.sh` on a real Ubuntu host to verify the stack end-to-end (Docker not available locally). See `phases/01-foundation/01-foundation-05-SUMMARY.md`.
**Build env note:** Node v22 + pnpm 9 present; **Docker NOT installed locally** → Plans 02–05 runtime-verified on the Ubuntu host per owner decision.

## Scope Adjustments (owner directives)
- **2026-06-16:** Phase 1 re-scoped — **drop DevSecOps for now**; deliver a **Docker Compose stack + Ubuntu Docker deploy script** instead. Kubernetes/EKS, Helm, Argo CD/GitOps, Terraform, and CI/CD security-scan gates **deferred to a later "Cloud & DevSecOps" phase** (tracked in ROADMAP Phase 1 note).

## Key Decisions (locked)
- Frontend: **Flutter** (Android, iOS-ready, Web, portals) — Riverpod + go_router.
- Backend: **NestJS + TypeScript microservices** (Nx monorepo), ~14–16 services.
- Data: **Postgres-per-service** (Prisma + Kysely, PgBouncer), **Redis**, **OpenSearch** via Debezium CDC.
- Eventing: **Kafka (MSK)** + Avro Schema Registry; **outbox + CDC + idempotency/inbox** = effectively-once.
- Order flow: **orchestrated SAGA** (Order Service) + choreographed side-effects.
- Money: **append-only double-entry ledger**, balances as projections, **daily 3-way reconciliation**.
- Inventory: **DB-authoritative reservations** (FOR UPDATE SKIP LOCKED), Redis cache-only.
- Tenancy: **Postgres RLS + tenant_id** from JWT.
- Identity: **Keycloak** (OAuth2/OIDC/JWT/MFA) + ABAC.
- Edge: **Kong** gateway + per-client BFF; **GraphQL federation deferred**.
- Market: **India** — Razorpay/RazorpayX, MSG91 (DLT OTP), GST engine, UPI/COD, INR.
- Cloud: **AWS ap-south-1 (Mumbai)**, ap-south-2 DR (RBI localization).
- Scope: **full platform**; payments integrate-via-PSP; logistics core (route optimization = V2).

## Differentiators
1. Store→Platform inventory exchange + warehouse redistribution (Phase 8).
2. Location-first discovery (nearby stores by geo + delivery radius).
3. Accounting-ready triple-wallet ledger.
4. Batch/expiry-aware inventory.

## The 4 Hard Boundaries (correctness-critical)
**Inventory · Order · Payment · Ledger/Finance** — proven in Phases 5–6 before differentiators.

## Artifacts
- [x] PROJECT.md · config.json
- [x] research/ (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY)
- [x] REQUIREMENTS.md (REQ-IDs + NFRs)
- [x] ROADMAP.md (11 phases, 4 milestones)
- [x] STATE.md
- [ ] Phase plans (PLAN.md per phase) — start with Phase 1

## Roadmap At-a-Glance
1. Platform Foundation & DevSecOps → 2. Identity & Users → 3. Store+Catalog+Admin → 4. Search & Geo → **5. Checkout Spine ⭐** → **6. Finance ⭐** → 7. Fulfilment & Logistics → **8. Inventory Exchange ⭐** → 9. Engagement → 10. Analytics → 11. Hardening & Launch.

**Milestones:** M1 Transactional MVP (P6) · M2 Operable Marketplace (P7) · M3 Differentiated Platform (P8) · M4 Launch-Ready (P11).

## Open Questions
1. Public storefront: Flutter Web vs Next.js (SEO) — decide at P4.
2. Primary PSP: Razorpay vs PayU — decide at P5/P6.
3. Driver-location transport: WebSocket vs MQTT — decide at P7.
4. Recommendation: managed (OpenSearch LTR) vs custom — decide at P10.

## Top Risks (active)
Money correctness · oversell · SAGA partial failure · reconciliation · exchange integrity · cross-tenant leakage · Razorpay async + COD recon · GST compliance · campaign-spike resilience · scope discipline.

## Next Action
1. **Verify Phase 1 on an Ubuntu host** (open checkpoint) — `bash deploy/provision-ubuntu.sh` then `bash deploy/deploy.sh`.
2. Then `/gsd-plan-phase 2` (Identity, Users & Access Control).

## Changelog
- 2026-06-16: Project initialized — context, research, requirements, roadmap, state created.
- 2026-06-16: Phase 1 re-scoped (Docker/Ubuntu, defer K8s/DevSecOps) and planned (5 plans).
- 2026-06-16: Phase 1 executed build-only — monorepo+libs, compose infra, reference service (outbox/Kafka/JWT), observability, ubuntu deploy scripts. All local checks green; host verification pending.
