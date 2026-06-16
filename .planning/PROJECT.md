# PROJECT: Livora Cart

> Production-grade, multi-vendor commerce marketplace connecting customers, store owners, and a platform operator — with a unique store↔platform inventory-exchange and central warehouse redistribution engine.

**Status:** Initializing
**Created:** 2026-06-16
**Owner:** apps.access@vismayacorp.com

---

## 1. One-Line Vision

A location-aware, multi-store marketplace where customers buy from nearby stores, store owners run their full retail operation, and the platform operator governs the ecosystem — including a differentiated capability to **absorb stores' excess inventory into a central warehouse and redistribute it across the network.**

## 2. The One Thing That Must Work

**A customer can discover a nearby store, place an order, pay, and receive it — while the store fulfills it and the platform correctly splits the money (commission, settlement, payout).**

Everything else (warehouse exchange, AI recommendations, advanced logistics) is built on top of this transactional spine. If the order→payment→settlement loop is not bulletproof, nothing else matters.

## 3. Who It's For

| Actor | What they get |
|---|---|
| **Customer** | Discover nearby stores by GPS/distance, browse & search products, cart/wishlist/compare, checkout (UPI/COD/wallet/card), track orders, returns/refunds, reviews, chat with store, loyalty points. |
| **Store Owner** | Onboard a store, manage catalog/variants/pricing/promotions, inventory (stock, batches, expiry, reorder), accept/process/deliver orders, staff with RBAC, reports & settlements. |
| **Platform Owner (Admin)** | Govern stores (approve/suspend/onboard), moderate products, manage users/roles, run campaigns/loyalty, operate the finance engine (commission/settlement/reconciliation/wallets), and the warehouse inventory exchange. |
| **Store Staff** | Scoped access — Cashier, Inventory Manager, Store Manager. |
| **Delivery Driver** | Assigned deliveries, status updates, tracking. |

## 4. Differentiators (what makes Livora Cart not just another marketplace)

1. **Store→Platform Inventory Exchange** — stores submit excess inventory (product, qty, price); admin reviews/accepts/rejects/negotiates; platform absorbs into central warehouse.
2. **Platform Redistribution** — warehouse redistributes inventory back to the originating store or to *other* stores via purchase/distribution orders, with full stock-movement tracking.
3. **Location-first discovery** — nearby stores by GPS, delivery radius, pickup options.
4. **Accounting-ready finance core** — double-entry wallet ledger across customer/store/platform wallets, commission & settlement engines, tax (GST), reconciliation, payouts.

## 5. Scope Decision: FULL PLATFORM BUILD

All bounded contexts are in scope. Sequencing is handled by the roadmap (the order→payment→settlement spine lands first; exchange/warehouse/logistics/AI layer on after the spine is proven). Two deliberate scope refinements:

- **Payments: integrate, don't build.** Use a PSP (Razorpay-first for India, pluggable interface). We build the internal **wallet ledger, commission, and settlement engines** — never a payment processor.
- **Logistics: build core, defer optimization.** Driver management, delivery assignment, and tracking are in v1. **Route optimization is a fast-follow**, not a v1 blocker.

## 6. Surfaces (clients)

| Surface | Audience | Tech |
|---|---|---|
| Customer App | Customers | Flutter (Android, iOS-ready) |
| Customer Web | Customers | Flutter Web (storefront) |
| Store Owner Portal | Store owners & staff | Flutter Web |
| Admin Portal | Platform operators | Flutter Web |

> Open question carried forward: if public-storefront SEO/discoverability proves critical, add a thin **Next.js** storefront in front of the catalog/search APIs. Decision deferred to the storefront phase.

## 7. Technology Decisions (locked)

### Frontend
- **Flutter** — single Dart codebase for Android, iOS-ready, Web, and all portals. Chosen for one-team velocity and pixel-consistent UX across the customer app + three portals.

### Backend
- **NestJS + TypeScript microservices**, one bounded context per service.
- **PostgreSQL** — database-per-service (no shared DB).
- **Redis** — caching, sessions, rate-limit counters, distributed locks.
- **OpenSearch** — product & store search, faceted filtering, geo-search.
- **Apache Kafka** — event backbone (chosen over RabbitMQ: settlement, inventory movement, and analytics need a durable, replayable event log + event sourcing for the finance ledger).
- **S3-compatible object storage** (MinIO in-cluster / cloud S3) — product images, documents.
- **API Gateway** — Kong or Envoy at the edge; **GraphQL gateway (Apollo Federation)** for client-facing aggregation over REST microservices.

### Identity & Security
- **Keycloak** as the IdP — OAuth2, OpenID Connect, JWT, MFA.
- Mobile OTP via **MSG91** (India), social login, email, guest checkout.
- **RBAC + ABAC**, per-service authorization, rate limiting, WAF, audit logs, encryption at rest/in transit, secrets management (Vault / sealed secrets).

### Platform / DevSecOps
- **Docker** + **Kubernetes**, cloud-native, GitOps-ready.
- CI/CD with security scanning (SAST/DAST/dependency/container/IaC) baked in — DevSecOps from day one.
- Observability: OpenTelemetry → Prometheus/Grafana + centralized logging + distributed tracing.

## 8. Market & Compliance Context (India)

- **Payments:** Razorpay/PayU + **UPI**, cards, netbanking, COD, in-app wallet.
- **OTP/SMS:** MSG91 (DLT-compliant sender IDs/templates).
- **Tax:** **GST** engine (CGST/SGST/IGST), HSN codes, tax-inclusive/exclusive pricing.
- **Currency:** INR.
- **Data:** RBI payment-data localization; DPDP Act (data protection) considerations.

## 9. Scale Targets (NFR anchors)

| Target | Value |
|---|---|
| Registered users | 100,000 |
| Daily orders | 10,000 (peak ~3–5× during campaigns) |
| Stores | 1,000 |

Architecture must be horizontally scalable to these with headroom; design for an order of magnitude growth.

## 10. Microservices (bounded contexts)

Identity, User, Store, Product (catalog), Inventory, Order, Cart, Payment, Settlement/Finance, Warehouse (exchange + redistribution), Logistics, Notification, Search, Recommendation (AI), Analytics, Promotion/Loyalty, Review/Rating, Chat. (Service boundaries finalized in the architecture phase.)

## 11. Deliverables Requested by Owner

Product Vision · Functional Requirements · Non-Functional Requirements · User Stories · Use Cases · UI Wireframes · Microservices Architecture (+ service-interaction diagram) · Database Schema (ERD, indexes, partitioning) · API Specifications (REST + OpenAPI + GraphQL gateway) · Deployment Architecture · Security Design. These map onto the roadmap phases.

## 12. Working Preferences

- **Mode:** YOLO (auto-approve, surface only material decisions)
- **Depth:** Comprehensive (8–12 phases, 5–10 plans each)
- **Execution:** Parallel where safe
- **Research:** Domain research first

## 13. Open Questions (to resolve during planning)

1. Public storefront: Flutter Web vs. add Next.js for SEO? (defer to storefront phase)
2. PSP: Razorpay vs PayU as primary (pluggable either way) — confirm at payment phase.
3. Cloud target: which provider/region for RBI localization (AWS Mumbai / Azure India / GCP Mumbai)?
4. Real-time delivery tracking transport (WebSocket vs MQTT) for driver location.
5. Recommendation engine: build vs. managed (e.g., OpenSearch learning-to-rank vs. dedicated).
