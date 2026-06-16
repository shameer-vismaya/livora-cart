# Livora Cart — Deployment (Docker on Ubuntu)

Interim deployment story: run the full stack on a single Ubuntu host with Docker
Compose. Kubernetes/EKS + GitOps + DevSecOps CI/CD is a later phase.

## Prerequisites

- An Ubuntu **22.04 or 24.04** host (cloud VM, local VM, or WSL2 Ubuntu).
- ~8 GB RAM recommended (Kafka + OpenSearch + Keycloak + the rest).
- SSH access with a sudo-capable user (for `--remote`).

## 1. Configure

```bash
cp deploy/.env.production.example deploy/.env.production
# edit deploy/.env.production — set strong passwords + KAFKA_CLUSTER_ID
# generate a cluster id:
docker run --rm confluentinc/cp-kafka:7.6.1 kafka-storage random-uuid
```

## 2A. Deploy ON the host (you're SSH'd into the Ubuntu box)

```bash
# one-time host setup (installs Docker + Compose, host tuning)
bash deploy/provision-ubuntu.sh
#   if it added you to the docker group:  newgrp docker   (or re-login)

# build + start + migrate + register CDC + health-check
ENV_FILE=deploy/.env.production bash deploy/deploy.sh
```

## 2B. Deploy from your machine TO the host (remote)

```bash
# set DEPLOY_HOST / DEPLOY_USER / DEPLOY_PATH in deploy/.env.production, then:
ENV_FILE=deploy/.env.production bash deploy/deploy.sh --remote
```

This rsyncs the repo to `$DEPLOY_PATH` on `$DEPLOY_HOST`, runs
`provision-ubuntu.sh`, then `deploy.sh` over SSH.

## Make targets

```bash
make provision      # bash deploy/provision-ubuntu.sh
make deploy         # bash deploy/deploy.sh
make deploy-remote  # bash deploy/deploy.sh --remote
make health         # bash deploy/healthcheck.sh
```

## Verify

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps   # all healthy
curl http://<host>:8000/reference/health                              # 200 via Kong
# get a token, then:
curl -H "Authorization: Bearer <token>" http://<host>:8000/reference/demo/echo  # 200
```

Get a test token (direct grant):

```bash
curl -s -X POST \
  http://<host>:8080/realms/livora/protocol/openid-connect/token \
  -d grant_type=password -d client_id=livora-web \
  -d username=testcustomer -d password=test_pw | jq -r .access_token
```

## What gets deployed

The full `docker-compose.yml` + `docker-compose.prod.yml` overlay: Postgres,
Redis, Kafka, Schema Registry, Debezium, OpenSearch (+Dashboards), Keycloak,
Kong, MinIO, the platform-reference service, and the observability stack
(OTel Collector, Prometheus, Tempo, Grafana). In prod, admin/infra ports bind to
`127.0.0.1` only — reach them via SSH tunnel; the Kong proxy (`:8000`) is the
public entrypoint.

## Rollback

```bash
# stop (keep data)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
# redeploy a previous git revision
git checkout <previous-sha> && ENV_FILE=deploy/.env.production bash deploy/deploy.sh
# full wipe (DESTRUCTIVE — deletes volumes)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## Notes / later hardening (Cloud & DevSecOps phase)

- Front Keycloak + Grafana behind the reverse proxy / TLS (currently localhost-bound).
- Move secrets to Vault/SSM; enable OpenSearch + Keycloak security plugins.
- Add the Kong `openid-connect` plugin for edge JWT validation (today the service
  enforces JWT via `KeycloakJwtGuard`).
- Migrate Compose → Kubernetes + Argo CD; add SAST/DAST/dependency/IaC CI gates.
