---
phase: 01-foundation
plan: 02
subsystem: infrastructure
tags: [docker-compose, postgres, kafka, debezium, opensearch, keycloak, kong, minio]
requires: []
provides: [local-infra-stack, cdc-ready-postgres, keycloak-realm, kong-gateway]
affects: [plan-03, plan-04, plan-05, all-future-services]
tech-stack:
  added:
    - postgres@16
    - redis@7
    - confluentinc/cp-kafka@7.6.1
    - debezium/connect@2.7.3
    - opensearchproject/opensearch@2.15
    - quay.io/keycloak/keycloak@24.0
    - kong@3.7
    - minio
  patterns: [compose-stack, logical-wal-cdc, declarative-gateway, realm-as-code]
key-files:
  created:
    - docker-compose.yml
    - docker-compose.override.yml
    - .env.example
    - infra/postgres/init/00-logical.sql
    - infra/kong/kong.yml
    - infra/keycloak/livora-realm.json
    - infra/opensearch/opensearch.yml
    - infra/debezium/connect-config.env
    - infra/README.md
    - Makefile
  modified: [.gitignore, package.json]
completed: 2026-06-16
status: complete
verified: static (YAML+JSON validated locally; runtime verification on Ubuntu host)
---

# Phase 1 Plan 02: Docker Compose Infrastructure Summary

The complete local platform stack as Docker Compose — Postgres (logical WAL), Redis, Kafka (KRaft) + Schema Registry, Debezium Connect, OpenSearch (+Dashboards), Keycloak (realm-imported), Kong (DB-less declarative), MinIO — all with healthchecks, named volumes, and a shared network. One command: `make up`.

## What was built
- **docker-compose.yml** — 10 services, pinned image tags, per-service healthchecks, named volumes, `livora-net`. Kafka in KRaft single-node mode (no Zookeeper). Postgres started with `wal_level=logical` for CDC.
- **infra/postgres/init/00-logical.sql** — Debezium replication role + `livora_outbox` publication, idempotent.
- **infra/kong/kong.yml** — declarative routes: public `/reference/health`, JWT-protected `/reference/*` (RS256 from Keycloak), rate-limiting + correlation-id plugins.
- **infra/keycloak/livora-realm.json** — realm `livora`: 5 roles, 3 public OIDC clients (web/store/admin) with direct-access-grants, 2 test users.
- **Makefile** — up/down/reset/ps/logs/config/seed + deploy passthroughs.
- **.env.example** — every variable documented with dev defaults.

## Verification (static, here)
- All compose + Kong + OpenSearch YAML parsed clean via js-yaml.
- Keycloak realm JSON parsed clean.
- Runtime (`docker compose up` → healthy) deferred to the Ubuntu host (no Docker locally — owner decision).

## Decisions Made
- **Kafka KRaft (no Zookeeper)** — simpler single-node footprint.
- **OpenSearch/Keycloak security disabled for local** — convenience; re-enabled in the Cloud/DevSecOps phase.
- **Kong declarative RS256 public-key placeholder** — `deploy.sh` injects the realm's real JWKS key on the host (the protected route rejects tokens until then). This keeps the committed config valid without embedding a key.

## Deviations from Plan
- **Added js-yaml devDependency** to enable local YAML validation (Rule 3 — needed a way to verify compose without Docker). Tracked.
- `.gitignore` adjusted to track `*.env.example` templates.

## Next Plan Readiness
Ready for Plan 03 (reference service joins this stack) and Plan 04 (observability services). Runtime health of the stack is unverified until the host deploy — flagged as the key thing to confirm in Plan 05's checkpoint.

## ⚠️ To verify on host
- `make up` → all 10 services healthy.
- Keycloak realm import succeeds; OIDC discovery reachable.
- Kong loads declarative config; Postgres `show wal_level` = logical.
