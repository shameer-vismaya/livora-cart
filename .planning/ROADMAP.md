# ROADMAP — Livora Cart

> Full-platform build, sequenced spine-first. Depth: Comprehensive. Execution: Parallel where safe.
> 11 phases. Each lands a vertical slice with verifiable success criteria mapped to REQ-IDs.
> Date: 2026-06-16. Next: `/gsd:plan-phase 1`.

```
Spine first ───────────────────────────────────► Differentiators ──────► Launch
P1 Infra → P2 Identity → P3 Store+Catalog → P4 Search → P5 CHECKOUT SPINE
                                                            ↓
                              P6 Finance → P7 Fulfilment → P8 Exchange/Warehouse
                                                            ↓
                              P9 Engagement → P10 Analytics → P11 Hardening+Launch
```

---

## Phase 1 — Platform Foundation & Docker Deploy Chassis  *(re-scoped 2026-06-16)*
**Goal:** A deployable, observable skeleton other phases plug into — runnable locally and on a single Ubuntu host via Docker Compose.
**Scope (re-scoped):** Nx monorepo + shared libs (`contracts`, `config`, `observability`); **Docker + Docker Compose** for the full local stack (Postgres, Redis, Kafka + Schema Registry, Debezium, OpenSearch, Keycloak, Kong, MinIO); reference NestJS service end-to-end through Kong with Keycloak JWT + outbox→Debezium→Kafka + idempotent consumer/DLQ; lightweight observability (OTel→Prometheus/Grafana/Tempo); **a script to provision an Ubuntu host with Docker and deploy the stack.**
**Deferred to a later dedicated phase (was in this phase):** Kubernetes/EKS, Helm, Argo CD/GitOps, Terraform cloud provisioning, and CI/CD **DevSecOps** security-scan gates (SAST/DAST/dependency/container/IaC). *Per owner request 2026-06-16.*
**Requirements:** NFR-PERF-03 (partial), NFR-OBS-01/02 (partial), NFR-MNT-01/02, NFR-CON-01 (outbox pattern).
**Parallel:** monorepo scaffold ∥ Docker Compose infra → reference service ∥ observability → deploy script.
**Success:**
- [ ] `docker compose up` brings the full stack healthy locally.
- [ ] Reference service routes through Kong, validates a Keycloak JWT, emits an end-to-end trace.
- [ ] Outbox→Debezium→Kafka demonstrated with idempotent consumer + DLQ.
- [ ] `deploy.sh` provisions a clean Ubuntu host with Docker and brings the stack up to a passing health check.

> **Later phase — Cloud & DevSecOps** (insert before/within Phase 11): migrate Compose → Kubernetes (EKS) + Helm + Argo CD, Terraform AWS ap-south-1, and CI/CD with SAST/dep/container/IaC/DAST gates. Tracked so it isn't lost.

## Phase 2 — Identity, Users & Access Control
**Goal:** Every actor can authenticate and is correctly authorized.
**Scope:** Identity Service (Keycloak realms/clients), MSG91 OTP, social login, guest checkout, refresh rotation/MFA; User Service (profiles, addresses w/ geocoding, KYC refs, prefs); RBAC roles + ABAC store-scoping middleware.
**Requirements:** REQ-IAM-01..09, REQ-USR-01..04, NFR-SEC-01.
**Depends on:** P1.
**Parallel:** Identity Service ∥ User Service (contract-first).
**Success:**
- [ ] All roles register/login (email, OTP, social, guest) and receive correctly-scoped JWTs.
- [ ] MFA enforced for admin/store-owner; ABAC blocks cross-store staff access (contract test).

## Phase 3 — Store Onboarding, Catalog & Admin Governance
**Goal:** Stores onboard (admin-approved) and publish a catalog; multi-tenancy is enforced.
**Scope:** Store Service (onboarding, KYC/GSTIN/bank, branding, hours, delivery zones, tenant registry + RLS); Catalog Service (products, variants, attributes, taxonomy, GST/HSN pricing, S3 media, outbox events); Admin Portal v1 (store approve/suspend, product moderation, taxonomy, user/role mgmt).
**Requirements:** REQ-STR-01..08, REQ-CAT-01..08, REQ-ADM-01..04, REQ-USR-03, NFR-SEC-02, NFR-MNT-03.
**Depends on:** P2.
**Parallel:** Store Service ∥ Catalog Service ∥ Admin Portal (against mocked contracts).
**Success:**
- [ ] Store applies → admin approves → store publishes products; RLS proven to isolate tenants.
- [ ] Catalog changes emit outbox events ready for search indexing.

## Phase 4 — Search & Location Discovery
**Goal:** Customers find products and nearby deliverable stores.
**Scope:** Search Service + OpenSearch; Debezium CDC catalog/inventory/store→index; product/store search, facets, sort; geo_point + geo_distance "nearby stores"; delivery-radius exclusion; alias-based rebuild; OOS de-ranking.
**Requirements:** REQ-SRCH-01..07, REQ-STR-05, NFR-PERF-02.
**Depends on:** P3.
**Success:**
- [ ] Search returns relevant, in-stock products with working facets; p95 < 300ms.
- [ ] "Nearby stores" respects distance + delivery radius; catalog edit reflects in search < few seconds.

## Phase 5 — Checkout Spine: Cart + Inventory + Order SAGA + Payment ⭐ (P0)
**Goal:** The core value loop — order, reserve, pay, confirm — bulletproof.
**Scope:** Cart Service (Redis cart, multi-store, coupon preview, checkout revalidation); Inventory Service (DB reservations FOR UPDATE SKIP LOCKED, TTL holds + sweeper, oversell guard, location-aware); Order Service (idempotent create, orchestrated SAGA, compensations, timeout sweeper, per-store split, lifecycle); Payment Service (Razorpay UPI/cards, COD, webhook-driven capture/refund, idempotent, wallet-pay stub).
**Requirements:** REQ-CRT-01..06, REQ-INV-01..03/07/09, REQ-ORD-01..05/07/11, REQ-PAY-01..05/07, NFR-CON-01/02, NFR-AVL-02/03.
**Depends on:** P4 (catalog/inventory data, search to find items).
**Parallel:** Inventory ∥ Payment ∥ Cart can build against Order contract; Order SAGA integrates them.
**Success:**
- [ ] Happy path: discover→cart→checkout→pay (UPI test)→CONFIRMED with stock committed.
- [ ] Failure paths: payment fail releases reservation; commit fail triggers refund — verified with Testcontainers + chaos.
- [ ] No oversell under concurrent-checkout load test; all writes idempotent.

## Phase 6 — Finance: Ledger, Commission, Tax, Settlement & Reconciliation ⭐ (P0)
**Goal:** Money splits correctly and reconciles to zero, every day.
**Scope:** Ledger Service (append-only double-entry, paise, triple wallets, balance projections); commission engine (versioned, snapshot per order); GST engine (CGST/SGST/IGST, HSN, place-of-supply, invoice + IRN); settlement engine (T+1/T+2 cycles); RazorpayX payouts (state machine, KYC/limit aware); refund as compensating journal; daily three-way reconciliation → exceptions queue; COD remittance recon; financial audit trail; Admin finance ops.
**Requirements:** REQ-FIN-01..12, REQ-PAY-03 (wallet), REQ-ADM-05, NFR-CON-02/03, NFR-SEC-05/07.
**Depends on:** P5 (orders/payments produce the events the ledger consumes).
**Success:**
- [ ] Each order produces balanced journal entries (commission + GST + store payable + platform).
- [ ] Settlement cycle pays a store via RazorpayX (sandbox); reconciliation job reconciles to zero or raises an exception.
- [ ] Golden-ledger + property-based money tests pass; refund reverses cleanly.

## Phase 7 — Fulfilment, Logistics & Real-Time Tracking
**Goal:** Orders move from accepted to delivered, visibly.
**Scope:** Order lifecycle extensions (accept/reject SLA, pack, dispatch, deliver, cancel, returns); Logistics Service (delivery assignment, driver management, tracking ingestion); Realtime Gateway (WebSocket + Redis Pub/Sub) for order/delivery tracking; Notification Service (FCM/MSG91/SES fan-out with SMS fallback).
**Requirements:** REQ-ORD-06/09/10, REQ-LOG-01..03, REQ-NOT-01..03, NFR-AVL-01.
**Depends on:** P5 (orders), P6 (driver earnings ledger optional).
**Parallel:** Logistics ∥ Notification ∥ Realtime Gateway.
**Success:**
- [ ] Store accepts → assigns driver → customer sees live status; delivered closes the order.
- [ ] Critical events notify via push with SMS fallback; cancellation/return flows work.

## Phase 8 — Inventory Exchange & Warehouse Redistribution ⭐ (Differentiator)
**Goal:** Stores sell excess stock to the platform warehouse; platform redistributes.
**Scope:** Warehouse Service (central stock, bins/nodes, GRN); exchange workflow (store submit → admin review/accept/reject → negotiate); two-phase transfer (in_transit→received) with compensation; stock movement (event-sourced, location-aware); purchase orders; distribution orders (redistribute to same/other stores via demand+geo policy); batch tracking; barcode/QR.
**Requirements:** REQ-WH-01..12, REQ-INV-04..08, NFR-CON-01/02.
**Depends on:** P5/P7 (inventory + logistics for physical movement).
**Success:**
- [ ] Store submits excess → admin negotiates/accepts → goods received (GRN) with two-phase integrity (no phantom stock).
- [ ] Distribution order redistributes to another store; movement fully auditable; discrepancy raises a break.

## Phase 9 — Engagement: Promotions, Loyalty, Reviews, Chat, Disputes
**Goal:** Retention and trust features.
**Scope:** Promotion Service (coupons platform/store, campaigns, loyalty points); Review Service (verified-purchase reviews, moderation, rollups, Q&A); Chat Service (customer↔store realtime + offline push); dispute/grievance workflow.
**Requirements:** REQ-PROMO-01..03, REQ-REV-01..03, REQ-CHAT-01, REQ-DISP-01, REQ-CRT-03/05, REQ-ADM-06.
**Depends on:** P5 (orders for verified purchase, coupon application), P7 (realtime, notifications).
**Parallel:** Promotion ∥ Review ∥ Chat.
**Success:**
- [ ] Coupon applies at checkout; loyalty earns/burns; verified-purchase review posts and rolls up.
- [ ] Customer↔store chat delivers live + offline push; dispute can be raised and tracked.

## Phase 10 — Analytics, Dashboards & Recommendations
**Goal:** Operators see the business; customers get relevant suggestions.
**Scope:** Analytics Service (event lake/warehouse feed off Kafka); marketplace/revenue/sales/operational dashboards; heuristic Recommendation Service (recently-viewed, popular-nearby).
**Requirements:** REQ-ANA-01..04, REQ-REC-01.
**Depends on:** P5–P8 (event streams).
**Parallel:** Analytics ∥ Recommendation.
**Success:**
- [ ] Dashboards show GMV, orders, commission, payouts, fulfilment SLAs from real events.
- [ ] Recommendations surface relevant nearby/popular products; nothing runs on the request hot path.

## Phase 11 — Hardening, Scale, Compliance & Launch
**Goal:** Production-ready at target scale, compliant, and live.
**Scope:** Load/soak testing to 100k users / 10k daily orders / peak 3–5×; HPA tuning (CPU + Kafka lag); cache stampede + hot-key hardening; chaos/resilience drills (SAGA, circuit breakers, DLQ replay); security review (RLS isolation, JWT/RBAC/ABAC, secrets, WAF, pen-test); RBI localization + DPDP + GST compliance audit; DR drill (ap-south-2, RPO/RTO); SLO/error-budget + alerting finalize; canary rollout of the 4 critical services; go-live runbook.
**Requirements:** NFR-PERF-01..04, NFR-AVL-01..04, NFR-CON-03, NFR-SEC-01..07, NFR-OBS-02.
**Depends on:** all prior phases.
**Success:**
- [ ] Spine sustains target + peak load within p95 SLOs; reconciliation green; DR drill meets RPO/RTO.
- [ ] Security & compliance audits pass; canary + rollback verified; **launch (Android + Web).**

---

## Parallelization Map (high level)
- **Sequential gates:** P1→P2→P3→P4→P5→P6 (each builds on the prior's data/contracts; the spine must be proven before finance).
- **Parallelizable within phase:** services with separate DBs build concurrently against shared Avro contracts (noted per phase).
- **Post-spine parallel tracks:** after P6, P7 / P8 / P9 / P10 can progress with significant overlap (different bounded contexts), converging at P11.

## Milestones
- **M1 — Transactional MVP** (end P6): real order with correct money. *Internal/closed beta candidate.*
- **M2 — Operable Marketplace** (end P7): orders fulfilled & tracked end-to-end.
- **M3 — Differentiated Platform** (end P8): inventory exchange live.
- **M4 — Launch-Ready** (end P11): scaled, compliant, GA.

## Open Decisions to resolve in-phase
- P4/storefront: Flutter Web vs add Next.js (SEO). 
- P5/P6: Razorpay vs PayU primary PSP.
- P7: WebSocket vs MQTT for driver location.
- P10: managed vs custom recommendation.
