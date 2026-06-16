# Research Synthesis — Livora Cart

> Distilled from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md. Date: 2026-06-16.
> This drives REQUIREMENTS.md and ROADMAP.md.

## The Spine (build first, get bulletproof)
**Discover → Cart → Checkout → Pay → Order → Fulfil → Settle.** Four hard-boundary services own correctness: **Inventory, Order, Payment, Ledger/Finance**. The order lifecycle is an **orchestrated SAGA**; everything money/stock uses **outbox + CDC + idempotency + inbox dedup** for effectively-once semantics.

## Non-negotiable correctness rules
- Money = **append-only double-entry ledger**; balances are projections; **daily three-way reconciliation**.
- Stock = **DB-authoritative reservations** (`FOR UPDATE SKIP LOCKED`, TTL holds); Redis is cache-only.
- Inventory exchange = **two-phase transfer** (in_transit → GRN) with compensation; location-aware.
- Tenant isolation = **Postgres RLS + tenant_id from JWT**.

## Stack (locked)
Flutter (Riverpod/go_router) · NestJS+TS on Nx · Postgres-per-service (Prisma+Kysely, PgBouncer) · Kafka (MSK)+Avro · Redis · OpenSearch via Debezium CDC · Keycloak · Kong gateway (GraphQL federation deferred) · S3/MinIO · EKS+Argo CD+Terraform · OpenTelemetry · **AWS ap-south-1 (Mumbai)** for RBI localization.

## India integrations
Razorpay + RazorpayX (payments/payouts/UPI) · MSG91 (DLT OTP) · GST engine + e-invoicing/IRN · Google Maps/Mappls · FCM.

## Service count
~14–16 services at launch (not 18). Merge **Product+Catalog**, **Promotion+Loyalty**; optionally fold Recommendation into Analytics initially. Must stay separate: **Inventory, Order, Payment, Ledger**.

## Gaps to fold into requirements (beyond owner's spec)
GST e-invoicing/IRN · COD cash-lifecycle reconciliation · return SLA + reverse logistics · dispute/grievance workflow · multi-store cart split · money/governance audit trail · ONDC-mappable contracts (design-aware).

## Top risks (manage actively)
Money correctness · oversell · SAGA partial failure · reconciliation · exchange integrity · cross-tenant leakage · Razorpay async + COD recon · GST compliance · campaign-spike resilience · scope discipline (spine before differentiators).
