# Livora Cart — Pitfalls, Risks & Failure Modes

> What kills marketplaces like this. Each row: Pitfall | Impact | Mitigation.
> Date: 2026-06-16. Pairs with ARCHITECTURE.md (patterns) and STACK.md (tools).

---

## 1. Finance / Money (highest stakes)
| Pitfall | Impact | Mitigation |
|---|---|---|
| Mutable balance columns (`UPDATE wallet SET balance=...`) | Lost updates, unauditable money, impossible recon | **Append-only double-entry ledger**; balance = SUM(journal lines) projection (ARCH §3) |
| Double-spend in wallet under concurrency | Negative balances, fraud | Serializable txn or `SELECT FOR UPDATE` on account; idempotency keys; invariant: no negative unless overdraft account |
| Lost settlement events (dual-write) | Stores underpaid, trust destroyed | **Outbox + CDC** only; never write DB + publish Kafka separately (ARCH §2) |
| Rounding / GST split errors | Paise drift, compliance failure, recon breaks | Integer minor-units (paise), banker's rounding, GST computed once at order time and stored, never recomputed |
| Refund / chargeback not reconciled | Money leaks, double refunds | Refund = compensating journal; idempotent; linked to original txn + PG refund id |
| Commission miscalculation (rule changes) | Revenue loss / overcharge disputes | Versioned commission rules; snapshot rule applied per order; replayable |
| Payout failures (RazorpayX KYC/limits) | Stuck store money | Payout state machine with retries + ops break-queue; pre-validate KYC/limits |
| No three-way reconciliation | Silent drift goes undetected for months | **Daily ledger ↔ PG report ↔ bank** recon job → exceptions queue (ARCH §3) |

## 2. Inventory
| Pitfall | Impact | Mitigation |
|---|---|---|
| Oversell under concurrency (Redis counters) | Cancellations, angry customers | **DB reservations** (`FOR UPDATE SKIP LOCKED`), Redis read-cache only (ARCH §4) |
| Reservation leaks (holds never released) | Phantom out-of-stock | TTL holds + sweeper auto-release on expiry/payment-fail |
| Exchange/redistribution creates phantom/duplicate stock | Inventory integrity loss | **Two-phase transfer** (in_transit → GRN), compensation on qty mismatch, location-aware ledgering (ARCH §4, App B) |
| Batch/expiry tracking errors | Selling expired goods (pharma/grocery liability) | FEFO allocation; batch-level stock; expiry blocks sale |
| Stock out of sync with search | Buyers order unavailable items | CDC to OpenSearch; de-rank/hide OOS within seconds (ARCH §5) |

## 3. Distributed Systems
| Pitfall | Impact | Mitigation |
|---|---|---|
| SAGA partial failure (paid but no stock) | Customer charged, no goods | Orchestrated SAGA with explicit idempotent compensations + timeout sweeper (ARCH §2) |
| Dual-write problem | Lost/inconsistent events | Transactional outbox everywhere |
| Kafka duplicate / out-of-order | Double-applied effects | Partition by aggregate id (ordering) + inbox dedup (effectively-once) |
| Eventual-consistency UX traps | "Order placed" but stock/ledger lags → confusing UI | Explicit pending states; suspense account bridges money gap; never show false certainty |
| Idempotency gaps on retries | Double charge / double order | Client `Idempotency-Key` on all writes; stored response replay |

## 4. Microservices Over-Engineering
| Pitfall | Impact | Mitigation |
|---|---|---|
| Premature decomposition (18+ services day 1) | Distributed monolith, ops drag | Start ~14–16 coarse services; merge Product+Catalog, Promotion+Loyalty (ARCH §1) |
| Shared DB across services | Hidden coupling, can't evolve | DB-per-service, no cross-service joins — enforced |
| Chatty sync calls | Latency, cascading failure | gRPC + caching; prefer events; circuit breakers/bulkheads (ARCH §10) |
| Distributed transactions via 2PC | Locks, fragility | SAGA + compensation instead |

## 5. India-Specific
| Pitfall | Impact | Mitigation |
|---|---|---|
| Razorpay UPI timeouts / pending state | Order stuck, double pay | Rely on webhooks + reconciliation, not sync response; idempotent capture |
| COD reconciliation gap | Cash collected ≠ remitted ≠ settled | Model COD cash lifecycle: collected→remitted→reconciled→settled with break queue |
| MSG91 DLT/template rejection | OTP not delivered → no signups | Pre-register DLT templates; fallback voice OTP; monitor delivery rate |
| GST invoicing non-compliance | Legal/penalty risk | GST engine + e-invoicing/IRN above threshold; place-of-supply rules; immutable invoices |
| RBI data localization breach | Regulatory shutdown | Payment/PII data in-India (AWS ap-south); no cross-border payment data |
| RazorpayX payout KYC/limits | Settlement blocked | KYC gating at store onboarding; limit-aware payout scheduler |

## 6. Search / Geo
| Pitfall | Impact | Mitigation |
|---|---|---|
| Stale catalog in OpenSearch | Wrong price/availability shown | CDC pipeline + index aliases for zero-downtime rebuild |
| Geo-query performance at scale | Slow "nearby" | geo_point + geo_distance, proper sharding, distance_feature boost not hard sort |
| CDC lag spikes | Search drifts from truth | Monitor Debezium lag; alert; reconcile/rebuild job |

## 7. Security
| Pitfall | Impact | Mitigation |
|---|---|---|
| Cross-tenant data leak (store A sees store B) | Breach, trust loss | Postgres **RLS** + tenant_id from JWT claim (ARCH §8); contract tests for isolation |
| JWT/OIDC misconfig (alg none, long TTL) | Token forgery | Keycloak hardening, short-lived access + refresh rotation, audience checks |
| RBAC/ABAC gaps (staff over-privileged) | Internal fraud | Least-privilege roles; ABAC on store scope; review |
| PII/payment data mishandling | Compliance breach | Tokenize at PG; encrypt at rest; never log card/PII; field-level encryption for KYC |
| Missing audit logs for money/governance | Can't investigate fraud | Immutable audit trail for all financial + admin actions |

## 8. Scale / Performance
| Pitfall | Impact | Mitigation |
|---|---|---|
| Hot stores / flash-sale SKUs | Shard hotspots, p99 spikes | L1+L2 cache, key replication, rate-limit, queue-based admission |
| Campaign spikes (3–5×) | Outage during peak revenue | HPA on Kafka lag + CPU, load tests, surge capacity, graceful degradation |
| N+1 in GraphQL/BFF | Latency explosion | DataLoader batching; defer federation (ARCH §6) |
| Cache stampede | DB overload on expiry | TTL jitter + singleflight + serve-stale (ARCH §9) |
| DB connection exhaustion | Cascading 500s | PgBouncer transaction pooling; per-service limits |

## 9. Mobile
| Pitfall | Impact | Mitigation |
|---|---|---|
| Flutter Web portal heavy load | Slow admin/store UX | Lazy routes, deferred loading, CanvasKit tuning; consider Next.js if SEO needed |
| Offline/sync conflicts | Cart/data divergence | drift local store + last-write-wins / server-authoritative cart on sync |
| Push unreliability (FCM) | Missed order alerts | FCM + SMS/WhatsApp fallback for critical events; delivery receipts |
| App-store payment policy | Rejection (digital goods) | Physical goods → external PG allowed; keep compliant |

## 10. Delivery / Process
| Pitfall | Impact | Mitigation |
|---|---|---|
| Scope creep (full platform) | Never ships | Roadmap sequences the order→payment→settlement spine FIRST; differentiators after spine proven |
| Underbuilt money spine | Rework, trust loss | Treat Inventory/Order/Payment/Ledger as the 4 hard boundaries; integration tests with real infra (Testcontainers) |
| Inadequate money testing | Production financial bugs | Property-based + golden ledger tests; chaos on SAGA; reconciliation as a test oracle |

---

## Top 10 Risks to Actively Manage
1. **Money correctness** — double-entry ledger + outbox + idempotency or money will leak. (Finance)
2. **Oversell** — DB-authoritative reservations, not Redis counters. (Inventory)
3. **SAGA partial failure** — paid-but-no-stock; compensations + timeout sweeper. (Distributed)
4. **Reconciliation** — daily three-way recon is non-negotiable; without it drift is invisible. (Finance)
5. **Exchange flow integrity** — two-phase transfer or phantom stock. (Inventory/Warehouse)
6. **Cross-tenant leakage** — RLS + tenant_id from JWT; isolation contract tests. (Security)
7. **Razorpay/UPI async + COD recon** — webhook-driven, never trust sync; model COD cash lifecycle. (India)
8. **GST/e-invoicing compliance** — legal exposure; build the tax engine right early. (India/Finance)
9. **Campaign-spike resilience** — HPA, load tests, degradation; peak = revenue + risk. (Scale)
10. **Scope discipline** — ship the transactional spine before differentiators; don't build the distributed monolith. (Process)
