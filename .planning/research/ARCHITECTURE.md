# Livora Cart — Architecture Patterns & Recommendations

> Multi-vendor commerce marketplace. Flutter clients + NestJS/TypeScript microservices, PostgreSQL-per-service, Kafka, Redis, OpenSearch, Keycloak, Kubernetes. Indian market.
> Target scale: 100k users, 10k daily orders (~peak 5–10x during sales), 1k stores.
> Status: Architecture baseline. Author: Enterprise Architecture. Date: 2026-06-16.

---

## 0. Executive Summary — Top Decisions

1. **Orchestrated SAGA** for the order lifecycle (a dedicated Order/Checkout orchestrator), **choreography** for downstream side-effects (notifications, analytics, search reindex). Don't try to do the whole flow with choreography — debuggability dies at scale.
2. **Transactional Outbox + Debezium CDC** is the *only* sanctioned way to publish domain events. No service writes to its DB and publishes to Kafka in two separate steps.
3. **Idempotency everywhere**: client-supplied idempotency keys at write APIs + an `inbox` / `processed_events` table on every consumer. Kafka is at-least-once; the application makes it effectively-once.
4. **Inventory uses authoritative DB reservations (Postgres `SELECT … FOR UPDATE SKIP LOCKED`), not Redis counters**, as the source of truth. Redis is a read-cache/fast-reject layer only. This mirrors the 2025–2026 industry correction (Shopify moved reservations off Redis back to the RDBMS).
5. **Finance is a double-entry, append-only, event-sourced ledger.** Money is never a mutable column. Balances are projections. Settlement and wallets are derived from immutable journal entries with a daily reconciliation loop.
6. **Multi-tenancy = shared-schema + tenant_id + Postgres Row-Level Security (RLS)** for 1,000 stores; promote top-tier/“enterprise” stores to dedicated schemas only by exception (hybrid).
7. **API layer = REST + a thin BFF per client tier behind an edge gateway**, with **GraphQL federation deferred** until BFF sprawl actually appears. Gateway owns authN (Keycloak/JWT), rate-limiting, routing; BFF owns aggregation/shaping.
8. **Search/geo via OpenSearch fed by CDC** (Debezium → Kafka → indexer), with `geo_point` + `geo_distance` for “nearby stores.” Postgres stays the source of truth; OpenSearch is a disposable, rebuildable projection.

---

## 1. Service Decomposition / Bounded Contexts

### Principle
One service per bounded context with its **own PostgreSQL database** (no shared DB, no cross-service joins). Decompose by business capability, not by entity. Merge contexts that change together and share invariants; keep separate anything with a different consistency requirement, scaling profile, or failure domain.

### Recommended service map

| Domain | Service | Verdict | Rationale |
|---|---|---|---|
| Identity / AuthN | **Keycloak** (managed, not a custom service) | Separate (off-the-shelf) | OIDC/JWT, social login, OTP for Indian market. Don't build auth. |
| User / Profile | **User Service** | Separate | Profile, addresses, preferences, KYC refs. Distinct from auth identity. |
| Store / Vendor | **Store Service** | Separate | Onboarding, store profile, KYC/GST, tenancy registry, payout config. |
| Product / Catalog | **Catalog Service** | **Merge Product + Catalog** | Product, variants, categories, attributes, media, pricing rules. One context. |
| Inventory | **Inventory Service** | Separate (critical) | Different consistency + write-contention profile than catalog. Must be standalone. |
| Cart | **Cart Service** | Separate but lightweight | High-churn, ephemeral, Redis-backed. Can be a thin service. |
| Order | **Order Service** (hosts the SAGA orchestrator) | Separate (core) | The heart of the system. Owns order state machine. |
| Payment | **Payment Service** | Separate (critical, PCI/regulatory) | Razorpay/UPI/PG integration, gateway abstraction. Isolated failure + compliance domain. |
| Settlement / Finance | **Ledger/Finance Service** | Separate (must stay separate) | Double-entry ledger, payouts, commissions, refunds, wallets. Hard correctness boundary. |
| Warehouse | **Warehouse Service** | Separate | Platform warehouse stock, bins/locations, GRN, store↔warehouse exchange. |
| Logistics | **Logistics Service** | Separate (3PL integration) | Shipment, courier allocation, tracking ingestion (Delhivery/Shadowfax/etc.). |
| Notification | **Notification Service** | Separate | SMS/WhatsApp/push/email fan-out. Pure consumer of events. |
| Search | **Search Service** | Separate | Owns OpenSearch indexing + query API. CDC consumer. |
| Recommendation | **Recommendation Service** | Separate (can start as module) | ML-served, async; can begin life inside Analytics, split when it earns it. |
| Analytics | **Analytics Service** | Separate (sink) | Event lake / warehouse feed. Never on the request hot path. |
| Promotion / Loyalty | **Promotion Service** | **Merge Promotion + Loyalty** | Coupons, campaigns, points, tiers. Shared rules engine. |
| Review / Rating | **Review Service** | Separate but small | Moderation, ratings rollups. Low coupling. |
| Chat | **Chat Service** | Separate | Buyer↔store messaging. Pairs with the realtime gateway. |

### Merge / split decisions (decisive)
- **Merge** Product+Catalog → *Catalog Service*. **Merge** Promotion+Loyalty → *Promotion Service*. Optionally fold Recommendation inside Analytics initially.
- **Must stay separate (non-negotiable):** Inventory, Order, Payment, Ledger/Finance. These are the four hard consistency/compliance boundaries.
- **Cart and Review** can be thin services (or co-located on shared infra) but keep their own data.
- **Realtime Gateway** (WebSocket) is infrastructure, not a bounded context — it fronts Chat + order tracking (see §7).

> Net: ~14–16 deployable services at launch, not 18. Start coarser; split when a context proves it needs independent scaling or ownership.

---

## 2. Distributed Transactions — SAGA, Outbox, Idempotency

### Decision: Orchestration for the order flow, choreography for side-effects
- **Orchestrated SAGA** for `order → payment → inventory → settlement`. The **Order Service hosts a Checkout Orchestrator** (a persisted state machine). It issues commands and awaits reply events. Central authority = clear flow, easy debugging, explicit compensations — essential for a money-moving, multi-step transaction.
- **Choreography** for fan-out side-effects that don't need coordination: notifications, analytics ingestion, search reindex, recommendation signals. They subscribe to `OrderConfirmed`/`OrderShipped` and react. This reduces coupling where coordination has no value.

### Why not pure choreography
For 4+ coordinated steps with compensation, choreography produces emergent, undebuggable workflows and circular event dependencies. Reserve it for linear, low-step side-effects.

### Compensations (must be idempotent + commutative-safe)
- Payment captured but inventory commit fails → **refund/void** compensation.
- Inventory reserved but payment fails → **release reservation** compensation.
- Each step: `do` + `compensate`, both keyed by saga ID and idempotency key.
- Persist saga state; add a **timeout/recovery sweeper** for stuck sagas (no step is allowed to hang forever).

### Transactional Outbox (mandatory)
Every state change + its outgoing event are written in **one local DB transaction** to an `outbox` table. A relay publishes to Kafka.
- **Preferred relay: Debezium CDC** tails the Postgres WAL and emits outbox rows to Kafka — no dual-write, no app-level poller race.
- Producer config: `enable.idempotence=true`, `acks=all`; **partition key = aggregate id** (e.g., orderId) for per-aggregate ordering.

### Idempotency & exactly-once (effectively-once)
Kafka delivery is **at-least-once**; we engineer *effectively-once* via:
1. **Idempotency keys on write APIs** — client sends `Idempotency-Key`; service stores result keyed by it and replays the stored response on retry.
2. **Inbox / `processed_events` table** on every consumer — record `(event_id)` after successful apply, inside the same transaction as the state change; duplicates become no-ops.
3. **Deterministic event IDs** (aggregate id + version) so dedup is trivial.
4. **Dead Letter Queue (DLQ)** per consumer for poison messages, with replay tooling.

> Rule: "Exactly-once" is *outbox (no lost events) + idempotent consumers (no double-applied events) + DLQ (poison isolation)*. Don't rely on Kafka EOS transactions across the DB boundary.

---

## 3. Finance Correctness — Ledger, Event Sourcing, Reconciliation

### Decision: Append-only double-entry ledger; balances are projections
- Every money movement = **≥2 entries (debit + credit)** that **sum to zero**. Entries are **immutable, append-only journal lines**. Never UPDATE a balance column.
- **Accounts** model the world: per-buyer wallet, per-store payable, platform commission, gateway-clearing/suspense, GST/tax payable, refunds. Money only moves *between* accounts.
- **Balance = SUM(journal lines)**, materialized into a **balance projection** (snapshot + incremental) for fast reads. The projection is rebuildable from the journal — the journal is the truth.

### Event sourcing for wallets & settlement
- Wallet/settlement state is **event-sourced**: model money as a **state machine over append-only events** (`FundsHeld`, `FundsCaptured`, `PayoutInitiated`, `PayoutSettled`, `RefundIssued`).
- Explicit **invariants** (no negative wallet unless overdraft account exists), **idempotency boundaries** (each event id applied once), and **replay** for audit/forensics.
- A **gateway-clearing/suspense account** absorbs the asynchronous gap between "PG says captured" and "money in our settlement account" — this is the eventual-consistency boundary.

### Eventual-consistency boundaries (be explicit)
- Order can be "Confirmed" before the ledger fully settles store payouts. The buyer-facing truth (order status) and the financial truth (settled payout) are **deliberately decoupled** with the suspense account bridging them.
- Settlement to stores runs on a **batch settlement cycle** (e.g., T+1/T+2 per Indian PG norms), not synchronously per order.

### Reconciliation (daily, non-negotiable)
- **Three-way reconciliation:** internal ledger ↔ payment gateway settlement reports ↔ bank statements.
- Automated job flags mismatches into a **break/exceptions queue** for ops; nothing auto-heals money silently.
- Ledger entries carry **external references** (PG txn id, UTR/bank ref) to make recon mechanical.

---

## 4. Inventory Consistency

### Decision: Authoritative DB reservations; Redis as a fast-reject cache only
The 2025–2026 industry correction (e.g., Shopify) is decisive: **Redis counters alone cause oversell/undersell** when the "reserve" and "claim/commit" steps span failures. The **RDBMS is the reservation source of truth**.

- **Reservation at checkout** = a row in `inventory_reservations` created with `SELECT … FOR UPDATE SKIP LOCKED` (or atomic conditional `UPDATE … WHERE available >= qty`) against the Inventory DB. Short **TTL hold** (e.g., 10–15 min) with a sweeper that auto-releases expired holds.
- **Oversell prevention:** decrement-with-guard is atomic in the DB transaction; `available` can never go below zero (DB constraint).
- **Redis role:** cache of `available` for instant UI/"add to cart" fast-reject and to shed load — but the binding reservation is always the DB write. Redis is allowed to be slightly stale.
- **State model:** `available → reserved (hold) → committed (on payment capture) → fulfilled` with explicit release on hold expiry or payment failure (the SAGA compensation in §2).

### Store → Platform Warehouse exchange + redistribution (event-driven workflow)
Modeled as an **event-driven, long-running workflow** (SAGA) across Store, Warehouse, Logistics, and Inventory:
1. `StockTransferRequested` (store offers stock to platform warehouse, or warehouse pulls).
2. Warehouse issues an inbound **ASN/expectation**; Logistics arranges pickup → `ShipmentDispatched`.
3. On arrival: Warehouse `GoodsReceived` (GRN) → emits `WarehouseStockIncreased`; the store's owned stock is decremented (`StoreStockDecremented`) — a **two-phase transfer with compensation** if GRN quantity ≠ dispatched.
4. **Redistribution:** Warehouse runs a placement/redistribution policy (demand + geo signals from Analytics/Search) → emits `RedistributionPlanned` → Logistics moves stock between warehouse nodes → Inventory projections updated per location.
5. Inventory is **location-aware** (store-owned vs warehouse-node), so "nearby availability" (§5) can be computed.

All transitions are outbox-published events; quantities reconciled via the same idempotency/inbox discipline as money.

---

## 5. Search & Geo — OpenSearch + CDC

### Decision: OpenSearch is a rebuildable projection fed by Debezium CDC
- **Pipeline:** Postgres (Catalog/Inventory/Store) → **Debezium WAL CDC** → Kafka → **Search Service indexer** → OpenSearch. Sub-second propagation, zero added query load on primaries, and the index is fully **rebuildable from source** (treat it as disposable).
- **Indexing strategy:**
  - **Product index** denormalized for query: title, brand, category path, attributes, price, store, ratings rollup, and `in_stock`/availability flags joined in by the indexer.
  - **Use aliases** (`products_v{n}` behind alias `products`) for zero-downtime reindex/rebuild.
  - Language/analyzer config for Indian-market search (English + transliteration tolerance; add Indic analyzers as needed).
- **Geo "nearby stores":**
  - Store docs carry a **`geo_point`** (lat/lon, geocoded at onboarding).
  - **`geo_distance` filter** for "stores within N km of user" + **`distance_feature`** query in a `bool.should` to **boost nearer results** without hard-filtering.
  - Combine product relevance + distance boost so "nearby + relevant" ranks well. Use `arc` distance (accuracy); `plane` only for tiny radii if perf demands.
- **Availability freshness:** inventory changes flow through CDC too, so search can de-rank/hide out-of-stock items within seconds.

---

## 6. API Layer

### Decision: Edge gateway + thin BFF per client tier; REST first, federation later
- **Edge API Gateway** responsibilities (cross-cutting only): TLS termination, **JWT validation against Keycloak**, coarse rate-limiting/throttling, routing, request id / trace propagation, WAF. *No business logic.*
- **BFF per client tier** (Flutter customer app, Flutter store/seller app, internal ops) — each owns **aggregation, response shaping, and orchestration of multiple backend calls** for that client. Each frontend team owns its BFF.
- **Backend services expose REST** (NestJS controllers) internally; BFFs aggregate. This is simpler to operate than federation and matches current (2025) guidance to **defer GraphQL federation until BFF sprawl is real**.
- **GraphQL Federation = planned evolution, not launch:** when BFFs start duplicating models across 3+ clients, introduce a federated supergraph (each domain owns a subgraph). Re-evaluate at ~year 2 / multiple client surfaces.
- **API versioning:** URI versioning (`/v1`) at the gateway/BFF edge; internal service contracts versioned via **event schema registry** (Avro/JSON schema, backward-compatible evolution). Never break a consumer; additive changes only, deprecate with a window.

---

## 7. Real-Time — Tracking, Chat, Presence

### Decision: Dedicated WebSocket gateway, horizontally scaled via Redis Pub/Sub
- **Realtime Gateway** (NestJS WebSocket gateway) is a stateless, horizontally scalable fleet. Clients connect over WSS through the edge.
- **Fan-out across nodes via Redis Pub/Sub** (or Redis Streams): a message/event published on any node reaches clients connected to any other node. This is the standard 2025 pattern for multi-instance WebSocket scaling.
- **Presence:** a Redis-backed registry maps `user → node/connection` with TTL heartbeats; used for online/offline status and message routing. Expire on missed heartbeat.
- **Order/delivery tracking:** Logistics emits tracking events → Kafka → Realtime Gateway consumes → pushes to subscribed clients (subscribed by `orderId` room). Buyers also get push via Notification Service when offline.
- **Store chat:** Chat Service persists messages (its own DB) + publishes to Redis Pub/Sub for live delivery; offline → Notification Service (push/WhatsApp). Rooms keyed by conversation id.

---

## 8. Multi-Tenancy (1,000 stores)

### Decision: Shared-schema + `tenant_id` + Postgres Row-Level Security; hybrid for VIP stores
- **Default: shared schema, `tenant_id` (store_id) column on tenant-scoped tables, enforced by Postgres RLS.** RLS guarantees isolation **at the DB layer** so a buggy query cannot leak across stores. This is the recommended approach beyond ~100 tenants for cost/ops efficiency, and 1,000 stores fits comfortably.
- **Tenant context** flows from JWT (Keycloak claim) → set as a session/`SET app.tenant_id` variable that RLS policies read.
- **Hybrid escalation:** promote large/enterprise/regulated stores to a **dedicated schema** (or DB) on demand — keep the option, use it by exception only. Don't pre-shard 1,000 ways.
- **Index discipline:** every tenant-scoped query is `tenant_id`-leading-indexed to avoid the "noisy neighbor" / large-table scan problem of shared schemas.
- Note: this tenancy model applies *within* each service's DB (e.g., Catalog, Store). Cross-service isolation is already handled by DB-per-service.

---

## 9. Caching (Redis)

### Decision: Tiered, purpose-specific Redis usage with stampede protection
| Use | Pattern | TTL / notes |
|---|---|---|
| **Catalog reads** (product, listings) | Cache-aside; invalidate on CDC update event | Medium TTL + **randomized jitter** to avoid synchronized expiry |
| **Sessions** | `session:{token}` → {userId, roles, lastSeen} | ~30 min **sliding** TTL |
| **Cart** | Redis as primary store for active carts (`cart:{userId}`) | Long-ish TTL; persist to Cart DB on checkout |
| **Inventory availability** | Read-cache / fast-reject only (truth = DB, §4) | Short TTL; allowed stale |
| **Rate limiting** | Atomic `INCR`/`EXPIRE` or Lua, **fleet-wide** | Enforced centrally, never per-replica |
| **Hot keys** (flash-sale SKUs, homepage) | Local in-process L1 + Redis L2; key replication/sharding | Watch p99 spikes from shard concentration |

### Stampede / thundering-herd protection (mandatory on hot reads)
- **Randomized TTL jitter** so keys don't expire in lockstep.
- **Request coalescing / singleflight** + **distributed lock** so only one rebuild hits the DB per key.
- **Probabilistic early expiration** (refresh-ahead) + **serve-stale-while-revalidate** for the hottest keys.

---

## 10. Observability & Resilience

### Decision: OpenTelemetry everywhere + standard resilience patterns + SLO budgets
- **Tracing:** **OpenTelemetry** (vendor-neutral) across all services; propagate `trace_id` from the gateway through BFF → services → Kafka headers so an order's full SAGA is one trace. Backend: Tempo/Jaeger; metrics Prometheus; logs structured JSON carrying `trace_id`.
- **Resilience patterns** (NestJS interceptors / a resilience lib like `opossum` for circuit breaking):
  - **Circuit breakers** on every outbound dependency (PG, Payment, 3PL, OpenSearch) to stop cascading failure.
  - **Retries** with exponential backoff + jitter for *transient* faults only; never retry non-idempotent calls without an idempotency key (§2).
  - **Bulkheads:** isolate thread/connection pools per dependency so one slow downstream (e.g., a 3PL) can't exhaust the whole service.
  - **Timeouts** on every network call; **DLQ** for poison events.
- **SLOs:** define SLIs/SLOs for the **smallest set of user-visible flows** first — checkout success rate, search latency, payment confirmation latency, order-status freshness. Bucket by criticality (critical/high/low), publish an **error-budget policy** that gates releases.
- **Health & rollout:** K8s liveness/readiness probes, graceful drain on shutdown (finish in-flight saga steps), canary/progressive delivery for the four critical services.

---

## Appendix A — Order Flow (textual service interaction)

**Happy path (orchestrated SAGA, Order Service = orchestrator):**

1. **Client → Gateway → Cart BFF:** user taps "Place Order." Gateway validates JWT (Keycloak), forwards with `Idempotency-Key`.
2. **BFF → Order Service:** `CreateOrder(cartId, idempotencyKey)`. Order Service persists an order in `PENDING`, writes the create + first command to its **outbox** in one transaction. Saga state initialized.
3. **Order → Inventory** (`ReserveInventory` command via Kafka): Inventory atomically reserves stock (DB `FOR UPDATE SKIP LOCKED`, TTL hold), writes `inventory_reservations` + emits `InventoryReserved` (or `InventoryReservationFailed`) via outbox. Consumer dedup via inbox table.
4. **Order → Payment** (`AuthorizePayment` command): Payment calls the gateway (Razorpay/UPI), on success emits `PaymentAuthorized`/`PaymentCaptured`; on failure `PaymentFailed`. Idempotency-Key prevents double charge on retry.
5. **Order Service** (on `PaymentCaptured` + `InventoryReserved`): transitions order to `CONFIRMED`, sends `CommitInventory` (hold → committed) and emits `OrderConfirmed` (outbox).
6. **Order → Ledger/Finance** (`RecordSale`): Ledger writes append-only double-entry journal lines (debit buyer/PG-clearing, credit store-payable + platform-commission + GST), via its own outbox. Balances re-projected. Actual store payout deferred to the batch **settlement cycle** (T+1/T+2), bridged by the suspense account.
7. **Choreographed side-effects** (no coordination): `OrderConfirmed` is consumed by **Notification** (SMS/WhatsApp/push), **Analytics** (event sink), **Search/Recommendation** (signals), and **Logistics** (`ScheduleShipment`).
8. **Fulfilment:** Logistics allocates a 3PL, emits `ShipmentDispatched`/tracking events → **Realtime Gateway** pushes live tracking to the buyer (room = orderId) and Notification handles offline pushes.

**Failure / compensation:**
- `PaymentFailed` → Order sends `ReleaseInventory` (hold released) → order `FAILED`. No money moved.
- `CommitInventory` fails after `PaymentCaptured` → Order triggers **refund** compensation in Payment + `RefundIssued` reversing journal in Ledger.
- Stuck saga (no reply within timeout) → recovery sweeper retries the step or fires compensation; poison events land in DLQ.

All commands/events are **idempotent** (idempotency key + inbox dedup) and **published via outbox+CDC** — no lost or double-applied steps.

---

## Appendix B — Inventory-Exchange Flow (textual service interaction)

**Store → Platform Warehouse transfer + redistribution (long-running event-driven SAGA):**

1. **Trigger:** Store offers stock (or Warehouse demand-pulls). Store/Warehouse Service emits `StockTransferRequested(storeId, sku, qty, targetWarehouseNode)` via outbox.
2. **Warehouse Service** creates an inbound expectation (ASN) and emits `InboundExpected`.
3. **Logistics Service** consumes it, arranges pickup, emits `ShipmentDispatched` + tracking; **Inventory** marks the store's stock as `in_transit` (decremented from store-available, not yet warehouse-available) — phase 1 of a **two-phase transfer**.
4. **Warehouse** on arrival performs GRN, emits `GoodsReceived(actualQty)` → `WarehouseStockIncreased(node, sku, actualQty)`. **Inventory** finalizes: `StoreStockDecremented` committed, warehouse-node availability incremented — phase 2.
   - **Compensation:** if `actualQty != dispatchedQty`, emit `TransferDiscrepancy` → ops break-queue; Inventory adjusts to actual (never silently); Ledger may record shrinkage if owned-stock value changes.
5. **Redistribution:** Warehouse runs a placement policy using demand + **geo signals** (from Analytics/Search) → emits `RedistributionPlanned(fromNode, toNode, sku, qty)`.
6. **Logistics** executes inter-node movement (`ShipmentDispatched`/`GoodsReceived` between warehouse nodes); **Inventory** updates **location-aware** availability per node.
7. **Search Service** receives inventory CDC updates → updates per-store / per-node availability + geo, so buyer "nearby in-stock" results reflect the new distribution within seconds.

Every quantity transition is **outbox-published + idempotently consumed (inbox dedup)** and **location-aware**, giving auditable, oversell-safe stock movement across the store↔warehouse↔node topology.

---

## Sources (key references, 2025–2026)

- Saga orchestration vs choreography — Temporal, microservices.io
- Outbox / idempotency / exactly-once with Kafka+Postgres — Medium (Byteforge), JavaCodeGeeks (2025), Lydtech Consulting
- Double-entry ledger / event sourcing / reconciliation — SDK.finance, Formance, Payflux, DEV ("Building Ledger the right way")
- Inventory reservations off Redis → RDBMS (SKIP LOCKED) — Shopify Engineering (2026), Redis tutorials, OneUptime
- Debezium CDC Postgres → OpenSearch — Gunnar Morling (Postgres→OpenSearch), RisingWave, rjha.dev
- OpenSearch geo_distance / distance_feature — OpenSearch docs
- BFF & GraphQL federation (defer-until-sprawl) — The New Stack, Toast Technology, Azure Architecture Center
- PostgreSQL multi-tenancy / RLS — thenile.dev, Picus Security Engineering, dev.to
- WebSocket scaling + presence via Redis Pub/Sub — VideoSDK, Ably, Praeclarum (NestJS+Redis)
- Redis caching / stampede / hot keys / rate limiting — tech-champion.com, OneUptime, DEV
- Resilience + OpenTelemetry + SLOs — arXiv 2512.16959, DZone, Resilience4j/Spring Cloud guides
