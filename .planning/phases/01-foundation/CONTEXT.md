# Phase 1 — Platform Foundation & Docker Deploy Chassis (CONTEXT)

> Goal-backward analysis driving the plans in this folder. Re-scoped per owner: Docker Compose + Ubuntu deploy now; Kubernetes/DevSecOps later.

## Phase Goal (outcome, not task)
**A new engineer can clone the repo, run one command to bring the whole platform stack up locally, and run one script to deploy that same stack onto a fresh Ubuntu host with Docker — with a reference service proving the cross-cutting patterns (gateway auth, eventing, tracing) every future service will reuse.**

## Observable Truths (must be TRUE)
1. `docker compose up -d` brings Postgres, Redis, Kafka+Schema Registry, Debezium, OpenSearch, Keycloak, Kong, MinIO to **healthy**.
2. A reference NestJS service responds on a Kong-routed URL and **rejects requests without a valid Keycloak JWT** / accepts with one.
3. A write to the reference service produces a row in an **outbox** table, which **Debezium streams to Kafka**, which an **idempotent consumer** applies once (duplicate delivery is a no-op), with a **DLQ** for poison messages.
4. A request flowing client→Kong→service emits a **single distributed trace** visible in Grafana/Tempo, plus service metrics in Prometheus.
5. Running `deploy/deploy.sh` against a **fresh Ubuntu host** installs Docker, pulls/builds images, starts the stack, and a **health check passes**.
6. Secrets/config come from **`.env`** (not hardcoded); `.env.example` documents every variable.

## Required Artifacts (what must EXIST)
- `nx.json`, `package.json`, `tsconfig.base.json`, workspace tooling (eslint/prettier/jest).
- Shared libs: `libs/contracts`, `libs/config`, `libs/observability`.
- `docker-compose.yml` (+ `docker-compose.override.yml` for dev) defining all infra services with healthchecks, named volumes, a shared network.
- `infra/keycloak/realm-export.json`, `infra/kong/kong.yml` (declarative), `infra/debezium/connector-*.json`.
- `apps/platform-reference` NestJS service: health module, Keycloak JWT guard, Postgres + outbox, Kafka consumer w/ inbox dedup + DLQ, OTel instrumentation, `Dockerfile`.
- `infra/observability/` : OTel Collector config, Prometheus config, Grafana datasources/dashboards, Tempo config (added to compose).
- `deploy/provision-ubuntu.sh`, `deploy/deploy.sh`, `deploy/.env.production.example`, `Makefile`, `deploy/README.md`.

## Key Links (most likely to break)
- Kong route → service upstream (if broken: 404 at gateway).
- Kong/JWT plugin → Keycloak JWKS (if broken: all requests 401 or all pass).
- Debezium connector → Postgres WAL (`wal_level=logical`) → Kafka topic (if broken: outbox never streams).
- Consumer inbox dedup (if broken: double-applied events).
- OTel context propagation Kong→service→Kafka headers (if broken: fragmented traces).
- Deploy script Docker install on Ubuntu (apt repo + compose plugin) (if broken: deploy fails on clean host).

## Plans & Waves
| Plan | Title | Wave | Depends |
|---|---|---|---|
| 01 | Nx monorepo + shared libs scaffold | 1 | — |
| 02 | Docker Compose local infra stack | 1 | — |
| 03 | Reference NestJS service (Kong + Keycloak + outbox/Kafka) | 2 | 01, 02 |
| 04 | Observability baseline (OTel/Prometheus/Grafana/Tempo) | 3 | 01, 02, 03 |
| 05 | Ubuntu Docker deploy script | 4 | 02, 03, 04 |

> Waves serialized where plans share `docker-compose.yml` / `Makefile` / `libs/observability` (file-ownership rule). Real parallelism this phase = 01 ∥ 02 in Wave 1; the rest of foundation is inherently sequential bootstrap.

## Explicitly Deferred (later "Cloud & DevSecOps" phase)
Kubernetes/EKS, Helm, Argo CD/GitOps, Terraform AWS ap-south-1, CI/CD security gates (SAST/DAST/dependency/container/IaC), production secrets manager (Vault). Phase 1 uses `.env` + Compose as the interim.

## Discovery
Level 0–1 — all established patterns (Nx, NestJS, Docker Compose, Keycloak, Debezium) already specified in `.planning/research/STACK.md` and `ARCHITECTURE.md`. No new DISCOVERY.md required.
