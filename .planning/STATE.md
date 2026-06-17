# STATE — Livora Cart

> Project memory. Updated as work progresses. Source of truth for "where are we?".

## Snapshot
- **Project:** Livora Cart — multi-vendor commerce marketplace (India)
- **Phase:** **Phase 2 COMPLETE & HOST-VERIFIED** (7/7 plans). Phase 1 also complete. → ready for **Phase 3**.
- **Mode:** YOLO · **Depth:** Comprehensive · **Execution:** Parallel
- **Last updated:** 2026-06-17
- **Progress:** Phase 2 of 11 done · `██░░░░░░░░░` ~18%
- **Deploy:** GitHub `shameer-vismaya/livora-cart` → Ubuntu host via `deploy/deploy.sh` (Docker Compose). Phase 1 verified end-to-end 2026-06-16.

## Phase 2 Status (build-only; host verification pending)
| Plan | Status | Local |
|---|---|---|
| 01 @livora/auth (JWT+RBAC+ABAC) | ✅ | 11 tests |
| 02 reference→auth + smoke-test.sh | ✅ | green |
| 03 identity scaffold+register+KC admin | ✅ | green |
| 04 identity OTP(MSG91)+token-exchange+guest | ✅ | green |
| 05 user-service+profile+UserRegistered consumer | ✅ | green |
| 06 addresses/geocoding+KYC+prefs | ✅ | green |
| 07 RBAC admin route + identity smoke test | ✅ host-verified | green |

**CHECKPOINT CLOSED (2026-06-17):** `make smoke` (Phase 1 spine) + `bash deploy/smoke-test-identity.sh` (register→login→profile→address→RBAC) both green on host.
**New infra patterns this phase:** per-service Prisma client output (apps/*/src/generated/prisma, copied explicitly in Dockerfile since gitignored); DB-per-service (livora/identity/users); deploy.sh loops services for db-create/db-push/publication/connector + `kong reload`; Keycloak token-exchange for OTP login; @livora/auth shared (RBAC/ABAC).
**Host gotchas fixed (see Plan 07 summary):** build all libs per Dockerfile; copy generated Prisma client; Kong directory-mount; identity-admin view-realm; password via reset-password; disable VERIFY_PROFILE (KC24 name requirement); smoke email '+'; OTel SDK wired.

### Pending host setup for REAL integrations (work in dev-stub today)
- `KEYCLOAK_ADMIN_CLIENT_SECRET` (prod), `MSG91_*` (real OTP SMS), `GEOCODING_API_KEY` (real lat/lon), Google IdP client id/secret. token-exchange impersonation perm if `/auth/otp/verify` or `/auth/guest` 403 on host.

## Phase 1 Execution Status (build-now / verify-on-host)
| Plan | Status | Local verification |
|---|---|---|
| 01 monorepo + libs | ✅ done | lint+test+build green (7 tests) |
| 02 docker-compose infra | ✅ authored | YAML/JSON validated |
| 03 reference service | ✅ done | lint+test+build green (4 tests) |
| 04 observability | ✅ done | OTel SDK compiles; configs valid |
| 05 ubuntu deploy | ✅ done + host-verified | full stack healthy; e2e proven |

**CHECKPOINT CLOSED (2026-06-16):** `deploy.sh` ran on the Ubuntu host; all 15 services healthy; end-to-end proven:
Kong → Keycloak JWT → service → Postgres transactional outbox → Debezium CDC → Kafka → idempotent consumer (`applied event …`), with idempotency-key replay and OTel observability.

### Host-run fixes folded into the repo (build-only → runtime gaps)
- Prod compose publishes ONLY Kong proxy (8000); all infra internal (host port conflicts).
- Keycloak realms routed via Kong `/realms/*`; UIs via SSH tunnel.
- Dockerfile: keep node_modules (Prisma engine/CLI) + `apk add openssl libc6-compat curl`; copy built `@livora/*` libs into `node_modules` (runtime resolution).
- `prisma db push` as root (no migration files this phase).
- Quoted `OPENSEARCH_JAVA_OPTS`; container healthcheck uses curl (added).
- Kafka topics pre-created in consumer; `unhandledRejection` guard.
- JWT audience check optional (Keycloak tokens carry no `aud`).
- Debezium: publication `FOR ALL TABLES`, static topic `livora.demo.events`, `expand.json.payload`, eventId emitted as Kafka header; consumer reads header.

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
**`/gsd-plan-phase 3`** — Store Onboarding, Catalog & Admin Governance. Services inherit the proven template + @livora/auth (RBAC/ABAC, incl. @StoreScope ready for store-staff). KYC refs (Phase 2) gate store onboarding.

## Changelog
- 2026-06-16: Project initialized — context, research, requirements, roadmap, state created.
- 2026-06-16: Phase 1 re-scoped (Docker/Ubuntu, defer K8s/DevSecOps) and planned (5 plans).
- 2026-06-16: Phase 1 executed build-only — monorepo+libs, compose infra, reference service (outbox/Kafka/JWT), observability, ubuntu deploy scripts. All local checks green.
- 2026-06-16: Phase 1 VERIFIED ON HOST — deployed to Ubuntu via Docker Compose; ~10 runtime/config fixes; full transactional spine proven end-to-end. Checkpoint closed. Phase 1 DONE.
- 2026-06-17: Phase 2 (Identity, Users & Access) built (7 plans) + VERIFIED ON HOST — @livora/auth (RBAC/ABAC), identity-service (register/OTP/token-exchange/guest), user-service (profile/addresses/KYC/prefs), inter-service UserRegistered event. ~8 host bring-up fixes. Phase 2 DONE.
