# Livora Cart — Infrastructure (Docker Compose)

The full local platform stack. One command: `make up` (after `cp .env.example .env`).

## Services & default ports

| Service | Container | Port(s) | Purpose |
|---|---|---|---|
| PostgreSQL 16 | livora-postgres | 5432 | Per-service DB; `wal_level=logical` for CDC |
| Redis 7 | livora-redis | 6379 | Cache, sessions, pub/sub |
| Kafka (KRaft) | livora-kafka | 9092 | Event backbone |
| Schema Registry | livora-schema-registry | 8081 | Avro/JSON schemas |
| Debezium Connect | livora-connect | 8083 | Outbox → Kafka CDC |
| OpenSearch 2.15 | livora-opensearch | 9200 | Product + geo search |
| OpenSearch Dashboards | livora-opensearch-dashboards | 5601 | Search UI |
| Keycloak 24 | livora-keycloak | 8080 | OAuth2/OIDC/JWT/MFA |
| Kong 3.7 (DB-less) | livora-kong | 8000 (proxy), 8001 (admin) | API gateway |
| MinIO | livora-minio | 9000 (api), 9001 (console) | S3-compatible storage |

> Observability (otel-collector, prometheus, grafana, tempo) and the
> `platform-reference` app are added by Plans 04 and 03.

## Default credentials (DEV ONLY — change for prod via deploy/.env.production)

- Postgres: `livora` / `livora_dev_pw`, db `livora`
- Keycloak admin: `admin` / `admin_dev_pw`; realm `livora`
- Keycloak test users: `testcustomer/test_pw` (customer), `testadmin/admin_pw` (admin)
- MinIO: `livora` / `livora_dev_pw`

## Keycloak realm

`infra/keycloak/livora-realm.json` is imported on boot (`--import-realm`). It
defines realm roles (customer, store_owner, store_staff, admin, driver), three
public OIDC clients (livora-web, livora-store-portal, livora-admin-portal) with
direct-access-grants enabled for password-grant testing, and two test users.

## CDC

`infra/postgres/init/00-logical.sql` enables logical replication and creates the
Debezium role + `livora_outbox` publication. The outbox connector is registered
via `make seed` (script in `deploy/register-connector.sh`, authored in Plan 03/05).

## Notes

- Security plugins are disabled on OpenSearch/Keycloak-dev for local convenience —
  re-enabled in the later Cloud/DevSecOps phase.
- This Compose stack is the interim deployment target (single Ubuntu host) until
  the Kubernetes migration.
