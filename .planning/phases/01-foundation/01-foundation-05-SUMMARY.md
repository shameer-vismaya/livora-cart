---
phase: 01-foundation
plan: 05
subsystem: deployment
tags: [docker, ubuntu, deploy, compose, provisioning]
requires: [plan-02, plan-03, plan-04]
provides: [ubuntu-provisioning, deploy-script, healthcheck, prod-compose]
affects: [operations]
tech-stack:
  added: []
  patterns: [single-host-compose-deploy, idempotent-provisioning, remote-rsync-ssh-deploy]
key-files:
  created:
    - deploy/provision-ubuntu.sh
    - deploy/deploy.sh
    - deploy/healthcheck.sh
    - deploy/register-connector.sh
    - deploy/.env.production.example
    - deploy/README.md
    - docker-compose.prod.yml
  modified: [infra/kong/kong.yml, .gitignore]
completed: 2026-06-16
status: tasks-1-2-complete; task-3-checkpoint-pending
verified: static (bash -n + compose YAML); host run = open checkpoint
---

# Phase 1 Plan 05: Ubuntu Docker Deploy Summary

The owner's headline ask: deploy the codebase to an Ubuntu host with Docker. Idempotent provisioning + a deploy script that builds, starts, migrates, registers CDC, and health-checks the full stack — locally on the host or remotely over SSH.

## What was built
- **provision-ubuntu.sh** — idempotent: installs Docker Engine + Compose plugin (official APT repo), enables the service, adds the user to the `docker` group, sets `vm.max_map_count` (OpenSearch), Docker log rotation, and a basic `ufw` allowing SSH + the Kong proxy. Safe to re-run.
- **deploy.sh** — `pull → build → up -d → prisma migrate deploy → register-connector → healthcheck`. `--remote` rsyncs the repo to `$DEPLOY_HOST`, provisions, and deploys over SSH.
- **healthcheck.sh** — polls Kong, Keycloak, OpenSearch, Schema Registry, Connect, Prometheus, Grafana, platform-reference, MinIO with a timeout; non-zero exit on any failure + `compose ps`.
- **register-connector.sh** — idempotent Debezium connector upsert (`PUT /config`, `envsubst` for credentials).
- **docker-compose.prod.yml** — restart policies + admin/infra ports bound to `127.0.0.1` (Kong proxy is the only public port).
- **deploy/README.md** — full runbook (local + remote), token fetch, verify, rollback.

## Verification (static, here)
- `bash -n` clean on all four scripts.
- `docker-compose.prod.yml` YAML valid (incl. the `!reset` Compose merge tags).
- shellcheck not available locally → run it in CI / on host (noted).

## Decisions Made
- **JWT enforced at the service, not Kong** — removed Kong's `jwt` plugin + RS256 public-key placeholder. The `KeycloakJwtGuard` already does full JWKS verification, so this avoids a brittle key-injection step on every deploy. Edge JWT (Kong `openid-connect`) is a later hardening item (documented in deploy/README).
- **Single-host Compose** is the interim target; K8s/GitOps deferred.

## Deviations from Plan
- Kong JWT simplification (above) — also slightly changes Plan 03's "Kong returns 401" expectation: the 401 is now returned by the service one hop later. E2E behavior (no token → 401) is unchanged.
- `.gitignore` updated to track `deploy/.env.production.example`.

## ⚠️ OPEN CHECKPOINT — Task 3 (human-verify on a real Ubuntu host)
Not yet executed (no Docker locally). To complete:
1. On an Ubuntu 22.04/24.04 host: `bash deploy/provision-ubuntu.sh`
2. `cp deploy/.env.production.example deploy/.env.production` and fill secrets + `KAFKA_CLUSTER_ID`
3. `ENV_FILE=deploy/.env.production bash deploy/deploy.sh`
4. Confirm: `docker compose ... ps` all healthy; `curl <host>:8000/reference/health` → 200; authed `/reference/demo/echo` → 202; one trace in Grafana/Tempo; outbox→Kafka→consumer dedup→DLQ.
