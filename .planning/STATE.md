# STATE — Livora Cart

> Project memory. Updated as work progresses. Source of truth for "where are we?".

## Snapshot
- **Project:** Livora Cart — multi-vendor commerce marketplace (India)
- **Phase:** Initialization complete → **ready for Phase 1 (Platform Foundation)**
- **Mode:** YOLO · **Depth:** Comprehensive · **Execution:** Parallel
- **Last updated:** 2026-06-16

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
Run `/gsd:plan-phase 1` to create the detailed Phase 1 plan.

## Changelog
- 2026-06-16: Project initialized — context, research, requirements, roadmap, state created.
