# Livora Cart — Technology Stack Recommendations

> Multi-vendor commerce marketplace. Flutter clients + NestJS/TypeScript microservices on Kubernetes. Indian market. Target: 100k users, 10k daily orders, 1k stores.
> Status: Stack baseline. Date: 2026-06-16.

---

## 0. Executive Summary — Locked Decisions

1. **Monorepo with Nx** for all NestJS services + shared libs; Flutter apps in a separate melos-managed mono.
2. **Kafka** as the event backbone (Confluent/MSK), **Avro + Schema Registry** for contracts; **gRPC** for sync internal calls, **REST** at the edge.
3. **Prisma** as the primary ORM (DX, migrations, type-safety); raw SQL / Kysely for the finance ledger hot paths. **PgBouncer** for pooling.
4. **Flutter + Riverpod + go_router**; `dio` + `retrofit` for APIs; `google_maps_flutter` + `geolocator` for geo.
5. **Razorpay** (payments + UPI) + **RazorpayX** (payouts/settlement); **MSG91** (DLT OTP/SMS/WhatsApp); **FCM** for push.
6. **Keycloak** as IdP (OAuth2/OIDC/JWT/MFA) — don't build auth.
7. **Kong** API gateway at the edge; GraphQL federation deferred (per ARCHITECTURE.md §6).
8. **AWS Mumbai (ap-south-1)** — best managed-service breadth for RBI localization (MSK, RDS/Aurora Postgres, OpenSearch Service, EKS, S3, ElastiCache).

---

## 1. Backend — NestJS Microservices

| Area | Decision | Rationale | Alternatives |
|---|---|---|---|
| **Repo strategy** | **Nx monorepo** for services + shared libs (`@livora/contracts`, `@livora/auth`, `@livora/observability`) | One toolchain, affected-only builds/tests/CI, shared DTO + event schema packages, atomic cross-service changes | Polyrepo (more isolation, more friction) |
| **Sync transport** | **gRPC** for internal request/reply (Inventory check, Payment authorize) | Typed, fast, HTTP/2; NestJS first-class support | REST internal (simpler, slower, untyped) |
| **Async transport** | **Kafka** (see ARCHITECTURE.md §2) | Durable, replayable, partitioned ordering, event sourcing | NATS JetStream (lighter, less ecosystem); RabbitMQ (no replay log) |
| **Schema/contracts** | **Avro + Confluent Schema Registry** (backward-compatible evolution) | Enforced compatibility, compact, codegen to TS | Protobuf (also fine); JSON Schema (looser) |
| **Config/secrets** | `@nestjs/config` + **HashiCorp Vault** (or AWS Secrets Manager) via CSI driver | No secrets in env/images; rotation; audit | Sealed Secrets (simpler, weaker rotation) |
| **Validation** | `class-validator` + `class-transformer`; **Zod** at BFF edges | Runtime safety on all inputs | — |
| **Testing** | Jest (unit), Testcontainers (integration: real PG/Kafka/Redis), Pact (contract tests) | Money flows demand real-infra integration tests | — |

## 2. Data Layer

| Area | Decision | Rationale |
|---|---|---|
| **DB** | **PostgreSQL 16**, database-per-service; **Aurora PostgreSQL** in prod | Mature, RLS for tenancy, JSONB for flexible attrs, strong consistency for money |
| **ORM** | **Prisma** default; **Kysely / raw SQL** for ledger + inventory hot paths | Prisma DX & migrations; raw SQL where `SELECT … FOR UPDATE SKIP LOCKED` and precise control matter |
| **Pooling** | **PgBouncer** (transaction mode) | Prevent connection exhaustion at 14–16 services × replicas |
| **Cache** | **Redis 7** (ElastiCache) — see ARCHITECTURE.md §9 | Cart, sessions, rate-limit, availability cache, pub/sub for realtime |
| **Search** | **OpenSearch 2.x** fed by **Debezium CDC** | Product + geo search; rebuildable projection |
| **Object storage** | **S3** (prod) / **MinIO** (local/dev) behind a storage abstraction | Product media, GST invoices, KYC docs; presigned uploads + CDN (CloudFront) |
| **Migrations** | Prisma Migrate per service, gated in CI, forward-only in prod | Safe schema evolution |

## 3. Frontend — Flutter

| Area | Decision | Rationale | Alternatives |
|---|---|---|---|
| **State mgmt** | **Riverpod 2** | Compile-safe, testable, no BuildContext coupling, scales to large portals | Bloc (more boilerplate, great for strict event modeling) |
| **Routing** | **go_router** | Declarative, deep-link & web-URL friendly (needed for portals) | auto_route |
| **Networking** | **dio** + **retrofit** + interceptors (auth/refresh/retry) | Typed clients, token refresh, idempotency-key header injection | chopper |
| **Maps/geo** | **google_maps_flutter** + **geolocator** + **geocoding** | "Nearby stores", delivery radius, driver tracking; Mappls (MapMyIndia) as India-optimized alternative | Mappls SDK |
| **Local/offline** | **drift** (SQLite) + **flutter_secure_storage** | Cart/catalog offline cache, secure token store | hive |
| **Realtime** | `web_socket_channel` to the Realtime Gateway | Live order/delivery tracking + chat | — |
| **Push** | **firebase_messaging (FCM)** | Cross-platform push | — |
| **Monorepo** | **melos** | Manage customer app, store portal, admin portal, shared design system + API client | — |
| **Web** | Flutter Web (CanvasKit) for portals; **revisit Next.js** only if public-storefront SEO becomes critical (PROJECT.md open Q) | App-style portals fine on Flutter Web | Next.js storefront |

## 4. India-Specific Integrations

| Capability | Provider | Notes |
|---|---|---|
| **Payments** | **Razorpay** | UPI, cards, netbanking, wallets, EMI; webhooks for capture/refund; PG abstraction so PayU/Cashfree are swappable |
| **Payouts/Settlement** | **RazorpayX** | Store payouts (IMPS/NEFT/UPI), virtual accounts; KYC + payout limits to respect |
| **OTP/SMS/WhatsApp** | **MSG91** | DLT-registered sender IDs + approved templates (mandatory in India); OTP widget, WhatsApp Business |
| **Tax (GST)** | **In-house GST engine** + optional ClearTax/Masters India API for e-invoicing/IRN | CGST/SGST/IGST split, HSN/SAC codes, place-of-supply rules, GST invoice PDF |
| **Maps** | **Google Maps Platform** (or **Mappls/MapMyIndia** for India accuracy + cost) | Geocoding, distance matrix, places autocomplete |
| **Email** | **AWS SES** (or Postmark) | Transactional email |
| **Interoperability** | **ONDC** (evaluate, not v1-blocking) | India's open commerce network — design catalog/order contracts to be ONDC-mappable later |

## 5. Identity & Security

| Area | Decision | Rationale |
|---|---|---|
| **IdP** | **Keycloak** | OAuth2/OIDC/JWT, social login, MFA/TOTP, realms per role-tier, brute-force protection. Self-hosted = data residency + no per-MAU cost at 100k users | 
| (alt) | Ory (cloud-native, headless) / Auth0 (managed, costly at scale) | — |
| **AuthZ** | RBAC (Keycloak roles) + **ABAC** via per-service policy (Casbin/OPA) | Store-staff scoping (cashier/inventory/manager), tenant isolation |
| **Secrets** | Vault / AWS Secrets Manager + CSI | Rotation, audit |
| **API security** | Kong plugins: JWT, rate-limit, bot/WAF, mTLS internal | Defense in depth |

## 6. API Gateway & Edge

| Area | Decision | Rationale | Alternatives |
|---|---|---|---|
| **Gateway** | **Kong** (OSS/Enterprise) | Rich plugin ecosystem (JWT, rate-limit, WAF, transformations), K8s ingress controller | Envoy/Istio gateway (more control, more ops); APISIX (fast, smaller community) |
| **GraphQL** | **Deferred** — BFF (REST aggregation) first; Apollo Federation later (ARCHITECTURE.md §6) | Avoid premature complexity | — |
| **CDN/WAF** | **CloudFront + AWS WAF** | Static/media + edge security | Cloudflare |

## 7. Platform / DevSecOps

| Area | Decision |
|---|---|
| **Containers** | Docker, distroless/Alpine base, multi-stage builds |
| **Orchestration** | **Kubernetes (EKS)**; Helm charts per service; HPA on CPU + custom (Kafka lag) metrics |
| **GitOps** | **Argo CD**; progressive delivery (Argo Rollouts canary) for the 4 critical services |
| **CI/CD** | GitHub Actions (or GitLab CI): build → test → **SAST (Semgrep/CodeQL)** → **dependency scan (Snyk/Trivy)** → **container scan (Trivy)** → **IaC scan (Checkov)** → **DAST (OWASP ZAP)** on staging |
| **IaC** | **Terraform** (cloud infra) + Helm (workloads) |
| **Observability** | **OpenTelemetry** → Prometheus/Grafana (metrics), Tempo/Jaeger (traces), Loki/ELK (logs); Alertmanager + PagerDuty |
| **Messaging infra** | **Amazon MSK** (managed Kafka) + Schema Registry |

## 8. Cloud & Region (RBI Data Localization)

| Provider | Region | Verdict |
|---|---|---|
| **AWS** | **ap-south-1 (Mumbai)** + ap-south-2 (Hyderabad) | **Recommended** — broadest managed services (MSK, Aurora, OpenSearch Service, EKS, ElastiCache, SES), two India regions for DR, RBI-compliant data residency |
| Azure | Central/South India | Strong alternative; AKS + Azure Database for PostgreSQL |
| GCP | Mumbai/Delhi | GKE excellent; fewer India-region managed options than AWS |

**Decision: AWS ap-south-1 primary, ap-south-2 DR.** Payment/PII data stays in-India per RBI.

---

## Recommended Stack — One-Page Table

| Layer | Choice |
|---|---|
| Mobile/Web | Flutter (Riverpod, go_router, dio, google_maps_flutter), melos monorepo |
| BFF/Edge | Kong gateway, per-client BFF (NestJS) |
| Services | NestJS + TypeScript, Nx monorepo, gRPC (sync) + Kafka (async) |
| Data | PostgreSQL 16 / Aurora (per service), Prisma + Kysely, PgBouncer |
| Cache/Realtime | Redis 7 (ElastiCache), Redis Pub/Sub + WebSocket gateway |
| Search | OpenSearch 2.x via Debezium CDC |
| Messaging | Kafka (MSK) + Avro Schema Registry |
| Storage | S3 / MinIO + CloudFront |
| Identity | Keycloak (OAuth2/OIDC/JWT/MFA) + Casbin/OPA (ABAC) |
| Payments | Razorpay + RazorpayX; MSG91 (OTP); GST engine + ClearTax |
| Platform | Docker, EKS, Helm, Argo CD, Terraform |
| Security | Vault, Kong WAF/rate-limit, mTLS, Trivy/Semgrep/Snyk/ZAP |
| Observability | OpenTelemetry → Prometheus/Grafana/Tempo/Loki |
| Cloud | AWS ap-south-1 (Mumbai), ap-south-2 DR |
