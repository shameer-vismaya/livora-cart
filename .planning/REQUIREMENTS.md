# REQUIREMENTS — Livora Cart

> Multi-vendor commerce marketplace, Indian market. Scope: **Full platform build** (sequenced by ROADMAP.md).
> Status: v1 baseline. Date: 2026-06-16.
> Traceability: REQ-IDs are referenced by PLAN.md files per phase. NFRs anchor the architecture.

**Legend** — Priority: **P0** (spine, must work), **P1** (v1 must), **P2** (v1 should / fast-follow), **V2** (deferred).

---

## Core Value (the validation oracle)
> A customer discovers a nearby store, orders, pays, and receives goods — while the store fulfills and the platform correctly splits the money. Every requirement below must support or not break this loop.

---

## 1. Identity & Access (Identity Service + Keycloak)
| ID | Requirement | Priority |
|---|---|---|
| REQ-IAM-01 | Email/password registration & login via Keycloak (OAuth2/OIDC, JWT) | P0 |
| REQ-IAM-02 | Mobile OTP auth via MSG91 (DLT-compliant templates) | P0 |
| REQ-IAM-03 | Social login (Google; Apple for iOS readiness) | P1 |
| REQ-IAM-04 | Guest checkout with post-order account conversion | P1 |
| REQ-IAM-05 | MFA (TOTP) for admin & store-owner accounts (mandatory), optional for customers | P1 |
| REQ-IAM-06 | RBAC roles: customer, store_owner, store_staff{cashier,inventory_mgr,store_mgr}, admin, driver | P0 |
| REQ-IAM-07 | ABAC store-scoping: staff actions restricted to their store(s) | P1 |
| REQ-IAM-08 | Refresh-token rotation, short-lived access tokens, audience/issuer validation | P0 |
| REQ-IAM-09 | Account recovery (email/OTP), password policy, brute-force lockout | P1 |

## 2. User & Profile (User Service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-USR-01 | Customer profile (name, contacts, preferences) | P0 |
| REQ-USR-02 | Multiple delivery addresses with geocoded lat/lon | P0 |
| REQ-USR-03 | KYC reference store for store owners (GSTIN, PAN, bank) | P1 |
| REQ-USR-04 | Notification preferences (push/SMS/WhatsApp/email opt-in) | P1 |
| REQ-USR-05 | DPDP-compliant consent, data export & deletion request | P2 |

## 3. Store Management (Store Service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-STR-01 | Store onboarding application (profile, KYC, GSTIN, bank/payout) | P0 |
| REQ-STR-02 | Admin approval/rejection workflow with status tracking | P0 |
| REQ-STR-03 | Store profile & branding (logo, banner, description) | P1 |
| REQ-STR-04 | Operating hours affecting availability | P1 |
| REQ-STR-05 | Delivery zones / radius (drives nearby-store matching) | P0 |
| REQ-STR-06 | Pickup configuration | P2 |
| REQ-STR-07 | Store suspend/reactivate by admin | P1 |
| REQ-STR-08 | Tenant registry + RLS tenant context per store | P0 |

## 4. Catalog (Catalog Service — Product + Categories merged)
| ID | Requirement | Priority |
|---|---|---|
| REQ-CAT-01 | Product CRUD with images (S3 presigned upload + CDN) | P0 |
| REQ-CAT-02 | Variants (size/color/etc.) and attributes | P0 |
| REQ-CAT-03 | Platform taxonomy (categories) + store category mapping | P0 |
| REQ-CAT-04 | Pricing with MRP, discount, GST-inclusive/exclusive, HSN code | P0 |
| REQ-CAT-05 | Product approval/moderation queue (admin) | P1 |
| REQ-CAT-06 | Bulk product import (CSV) | P2 |
| REQ-CAT-07 | Brand management | P2 |
| REQ-CAT-08 | Publish events via outbox→CDC for search indexing | P0 |

## 5. Search & Discovery (Search Service + OpenSearch)
| ID | Requirement | Priority |
|---|---|---|
| REQ-SRCH-01 | Product full-text search (typo-tolerant) | P0 |
| REQ-SRCH-02 | Store search | P1 |
| REQ-SRCH-03 | Faceted filters: category, price, distance, availability, rating | P0 |
| REQ-SRCH-04 | Sort: relevance, price, distance, rating, newest | P1 |
| REQ-SRCH-05 | Geo "nearby stores" via geo_distance + distance_feature boost | P0 |
| REQ-SRCH-06 | Honor store delivery radius (exclude undeliverable stores) | P0 |
| REQ-SRCH-07 | CDC-fed index, alias-based zero-downtime rebuild, OOS de-ranking | P0 |
| REQ-SRCH-08 | Admin merchandising (boost/pin) | V2 |

## 6. Cart (Cart Service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-CRT-01 | Add/update/remove items; Redis-backed active cart | P0 |
| REQ-CRT-02 | Multi-store cart with per-store split at checkout | P0 |
| REQ-CRT-03 | Wishlist | P1 |
| REQ-CRT-04 | Product comparison | P2 |
| REQ-CRT-05 | Apply coupon / loyalty preview | P1 |
| REQ-CRT-06 | Price/availability revalidation at checkout | P0 |

## 7. Inventory (Inventory Service — hard boundary)
| ID | Requirement | Priority |
|---|---|---|
| REQ-INV-01 | Authoritative stock with DB reservations (`FOR UPDATE SKIP LOCKED`) | P0 |
| REQ-INV-02 | TTL holds with sweeper auto-release on expiry/payment-fail | P0 |
| REQ-INV-03 | Oversell prevention (non-negative constraint) | P0 |
| REQ-INV-04 | Low-stock alerts & reorder levels | P1 |
| REQ-INV-05 | Batch management (lot tracking) | P1 |
| REQ-INV-06 | Expiry management with FEFO allocation | P1 |
| REQ-INV-07 | Location-aware stock (store-owned vs warehouse-node) | P0 |
| REQ-INV-08 | Barcode/QR support | P2 |
| REQ-INV-09 | Redis availability read-cache (truth stays in DB) | P1 |

## 8. Order (Order Service — SAGA orchestrator, hard boundary)
| ID | Requirement | Priority |
|---|---|---|
| REQ-ORD-01 | Order creation with idempotency key; PENDING→CONFIRMED state machine | P0 |
| REQ-ORD-02 | Orchestrated SAGA: reserve inventory → authorize payment → commit → record sale | P0 |
| REQ-ORD-03 | Idempotent compensations (release inventory / refund) + timeout sweeper | P0 |
| REQ-ORD-04 | Per-store order splitting from multi-store cart | P0 |
| REQ-ORD-05 | Order lifecycle states (placed/accepted/packed/dispatched/delivered/cancelled/returned) | P0 |
| REQ-ORD-06 | Real-time order tracking (via Realtime Gateway) | P1 |
| REQ-ORD-07 | Order history & details | P0 |
| REQ-ORD-08 | Reorder | P2 |
| REQ-ORD-09 | Cancellation (pre-dispatch) | P1 |
| REQ-ORD-10 | Returns workflow with window + reason | P1 |
| REQ-ORD-11 | Store accept/reject with SLA timer | P0 |

## 9. Payment (Payment Service — hard boundary)
| ID | Requirement | Priority |
|---|---|---|
| REQ-PAY-01 | Razorpay integration: UPI, cards, netbanking, wallets | P0 |
| REQ-PAY-02 | COD support with cash lifecycle (collected→remitted→reconciled) | P0 |
| REQ-PAY-03 | In-app wallet payment (ledger-backed) | P1 |
| REQ-PAY-04 | Webhook-driven capture/refund (never trust sync response) | P0 |
| REQ-PAY-05 | Idempotent authorize/capture (no double charge) | P0 |
| REQ-PAY-06 | Pluggable PSP abstraction (PayU/Cashfree swappable) | P2 |
| REQ-PAY-07 | Refund initiation linked to original txn + PG refund id | P0 |

## 10. Finance / Ledger & Settlement (Ledger Service — hard boundary)
| ID | Requirement | Priority |
|---|---|---|
| REQ-FIN-01 | Append-only double-entry ledger (paise minor-units) | P0 |
| REQ-FIN-02 | Triple wallets: customer, store, platform; balances as projections | P0 |
| REQ-FIN-03 | Commission engine (versioned per-category/store rules, snapshot per order) | P0 |
| REQ-FIN-04 | GST tax engine (CGST/SGST/IGST, HSN, place-of-supply), computed once & stored | P0 |
| REQ-FIN-05 | GST invoice generation; e-invoicing/IRN above threshold | P1 |
| REQ-FIN-06 | Settlement engine with T+1/T+2 cycles (daily/weekly/monthly configurable) | P0 |
| REQ-FIN-07 | Store payouts via RazorpayX (state machine, retries, KYC/limit aware) | P0 |
| REQ-FIN-08 | Revenue sharing rules | P1 |
| REQ-FIN-09 | Daily three-way reconciliation (ledger↔PG↔bank) → exceptions queue | P0 |
| REQ-FIN-10 | Refund management as compensating journal entries | P0 |
| REQ-FIN-11 | Immutable financial audit trail | P0 |
| REQ-FIN-12 | COD remittance reconciliation | P1 |

## 11. Warehouse & Inventory Exchange (Warehouse Service) ⭐
| ID | Requirement | Priority |
|---|---|---|
| REQ-WH-01 | Store submits excess inventory (product, qty, price) | P1 |
| REQ-WH-02 | Admin review: accept/reject | P1 |
| REQ-WH-03 | Price negotiation (offer/counter-offer) | P1 |
| REQ-WH-04 | Central warehouse stock (bins/locations/nodes) | P1 |
| REQ-WH-05 | Receiving/GRN as two-phase transfer (in_transit→received) with compensation | P1 |
| REQ-WH-06 | Dispatch & inter-warehouse transfers | P1 |
| REQ-WH-07 | Stock movement tracking (auditable, location-aware, event-sourced) | P1 |
| REQ-WH-08 | Purchase orders | P1 |
| REQ-WH-09 | Distribution orders: redistribute to same/other stores (demand+geo policy) | P1 |
| REQ-WH-10 | Batch tracking through exchange | P1 |
| REQ-WH-11 | Barcode/QR for receiving/dispatch | P2 |
| REQ-WH-12 | Multiple warehouses (model for N, start with 1 node) | P2 |

## 12. Logistics (Logistics Service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-LOG-01 | Delivery assignment (driver or 3PL) | P1 |
| REQ-LOG-02 | Delivery tracking (real-time status + location) | P1 |
| REQ-LOG-03 | Driver management (onboarding, status, earnings) | P1 |
| REQ-LOG-04 | 3PL integration (Delhivery/Shadowfax, pluggable) | P2 |
| REQ-LOG-05 | Reverse logistics (return pickup) | P2 |
| REQ-LOG-06 | Route optimization | V2 |

## 13. Promotion & Loyalty (Promotion Service — merged)
| ID | Requirement | Priority |
|---|---|---|
| REQ-PROMO-01 | Coupons / promo codes (platform & store-level) | P1 |
| REQ-PROMO-02 | Campaigns / banners | P2 |
| REQ-PROMO-03 | Loyalty points (earn/burn) | P2 |
| REQ-PROMO-04 | Loyalty tiers / program config | V2 |

## 14. Reviews & Engagement (Review Service + Chat Service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-REV-01 | Reviews & ratings (verified-purchase) with moderation | P1 |
| REQ-REV-02 | Rating rollups on products/stores | P1 |
| REQ-REV-03 | Product Q&A | P2 |
| REQ-CHAT-01 | Customer↔store chat (realtime + offline push) | P2 |
| REQ-DISP-01 | Dispute / grievance workflow | P2 |

## 15. Notifications (Notification Service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-NOT-01 | Push (FCM), SMS/WhatsApp (MSG91), email (SES) fan-out from events | P0 |
| REQ-NOT-02 | Critical order/payment events with SMS fallback when push fails | P1 |
| REQ-NOT-03 | Templated, preference-aware delivery | P1 |

## 16. Analytics & Recommendation (Analytics Service; Recommendation)
| ID | Requirement | Priority |
|---|---|---|
| REQ-ANA-01 | Marketplace dashboard (GMV, orders, active stores) | P1 |
| REQ-ANA-02 | Revenue dashboard (commission, payouts, settlements) | P1 |
| REQ-ANA-03 | Sales & operational dashboards (SLA, fulfilment) | P2 |
| REQ-ANA-04 | Event lake / warehouse feed (never on hot path) | P1 |
| REQ-REC-01 | Product recommendations (start heuristic, ML later) | P2 |

## 17. Admin Governance (Admin Portal — cross-service)
| ID | Requirement | Priority |
|---|---|---|
| REQ-ADM-01 | Store governance (create/approve/suspend/onboard) | P0 |
| REQ-ADM-02 | Product moderation | P1 |
| REQ-ADM-03 | User & role management | P0 |
| REQ-ADM-04 | Category/brand/taxonomy management | P1 |
| REQ-ADM-05 | Finance ops (commission rules, settlement, reconciliation queue) | P0 |
| REQ-ADM-06 | Campaign/loyalty management | P2 |
| REQ-ADM-07 | Governance audit trail | P1 |

---

## Non-Functional Requirements

### Performance & Scale
| ID | Requirement |
|---|---|
| NFR-PERF-01 | Support 100k registered users, 1k stores, 10k daily orders, peak 3–5×. |
| NFR-PERF-02 | Search & catalog reads p95 < 300ms; checkout API p95 < 800ms. |
| NFR-PERF-03 | Horizontal scale via K8s HPA (CPU + Kafka lag); stateless services. |
| NFR-PERF-04 | Cache strategy with stampede protection (jitter + singleflight). |

### Availability & Resilience
| ID | Requirement |
|---|---|
| NFR-AVL-01 | 99.9% availability target for the order/payment spine. |
| NFR-AVL-02 | Circuit breakers, retries-with-backoff, bulkheads, timeouts on all deps. |
| NFR-AVL-03 | DLQ + replay for poison events; SAGA timeout recovery. |
| NFR-AVL-04 | Multi-AZ; ap-south-2 DR; RPO ≤ 5min, RTO ≤ 1hr for spine. |

### Consistency & Correctness
| ID | Requirement |
|---|---|
| NFR-CON-01 | Effectively-once processing (outbox + idempotency + inbox dedup). |
| NFR-CON-02 | No oversell; no money lost or double-applied (ledger invariants enforced). |
| NFR-CON-03 | Daily reconciliation must reconcile to zero or raise an exception. |

### Security & Compliance
| ID | Requirement |
|---|---|
| NFR-SEC-01 | OAuth2/OIDC/JWT/MFA; RBAC + ABAC enforced per service. |
| NFR-SEC-02 | Multi-tenant isolation via Postgres RLS; isolation contract tests. |
| NFR-SEC-03 | Encryption in transit (TLS/mTLS) and at rest; field-level for KYC/PII. |
| NFR-SEC-04 | Secrets in Vault/Secrets Manager; rotation; no secrets in images. |
| NFR-SEC-05 | API rate limiting + WAF at edge; audit logging for money & governance. |
| NFR-SEC-06 | RBI data localization (payment/PII in-India); DPDP consent/data-subject rights. |
| NFR-SEC-07 | GST compliance (invoicing, IRN, place-of-supply). |

### Observability & DevSecOps
| ID | Requirement |
|---|---|
| NFR-OBS-01 | OpenTelemetry tracing end-to-end (one trace per order SAGA). |
| NFR-OBS-02 | Metrics (Prometheus/Grafana), logs (Loki/ELK), SLO error budgets. |
| NFR-DEV-01 | CI/CD with SAST, dependency, container, IaC scan, DAST gates. |
| NFR-DEV-02 | GitOps (Argo CD); canary for the 4 critical services; Testcontainers integration tests. |

### Maintainability
| ID | Requirement |
|---|---|
| NFR-MNT-01 | DB-per-service; no shared DB; no cross-service joins. |
| NFR-MNT-02 | Event contracts via Avro Schema Registry, backward-compatible evolution. |
| NFR-MNT-03 | ~14–16 services; merge Product+Catalog, Promotion+Loyalty. |

---

## Out of Scope (v1) / Deferred (V2)
- Route optimization (LOG-06) — manual/assignment-based delivery in v1.
- ONDC live interoperability — design contracts to be mappable, integrate later.
- ML-based recommendations — heuristic first.
- Loyalty tiers, admin merchandising controls, multi-warehouse (N nodes), CSV bulk tooling polish.
- iOS app store release — codebase kept iOS-ready; launch Android + Web first.

## Open Questions (carried from PROJECT.md)
1. Public storefront SEO: Flutter Web vs Next.js — decide at storefront phase.
2. Primary PSP: Razorpay vs PayU — confirm at payment phase.
3. Real-time transport for driver location (WebSocket vs MQTT).
4. Recommendation: managed (OpenSearch LTR) vs custom.
