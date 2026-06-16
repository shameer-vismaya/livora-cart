---
phase: 01-foundation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - docker-compose.yml
  - docker-compose.override.yml
  - .env.example
  - infra/postgres/init/00-logical.sql
  - infra/keycloak/realm-export.json
  - infra/kong/kong.yml
  - infra/debezium/connect-config.env
  - infra/opensearch/opensearch.yml
  - infra/README.md
  - Makefile
autonomous: true
user_setup: []
must_haves:
  truths:
    - "docker compose up -d brings all infra services to healthy"
    - "Postgres runs with wal_level=logical (CDC-ready)"
    - "Keycloak imports a 'livora' realm on boot"
    - "Kong loads declarative config and exposes a proxy + admin port"
  artifacts:
    - "docker-compose.yml with Postgres, Redis, Kafka(+Schema Registry, Zookeeper or KRaft), Debezium Connect, OpenSearch(+Dashboards), Keycloak, Kong, MinIO"
    - "infra/* config: kong.yml, realm-export.json, postgres logical init"
    - ".env.example documenting all variables"
  key_links:
    - "Postgres wal_level=logical -> Debezium can read WAL"
    - "Kong declarative kong.yml -> services/routes load on boot"
    - "Keycloak realm-export -> realm present without manual setup"
    - "compose healthchecks -> dependent services wait for healthy"
---

<objective>
Define the complete local infrastructure stack as Docker Compose so the entire platform runs with one command — the same stack the Ubuntu deploy script (Plan 05) will run.

Purpose: Reproducible, one-command infra for every engineer and for single-host deployment (interim before Kubernetes; see ROADMAP deferred note).
Output: `docker-compose.yml` + `infra/` config bringing up Postgres, Redis, Kafka + Schema Registry, Debezium, OpenSearch, Keycloak, Kong, MinIO — all healthy.
</objective>

<context>
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@.planning/phases/01-foundation/CONTEXT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Compose for data + eventing stores (Postgres, Redis, Kafka, Schema Registry, Debezium, OpenSearch, MinIO)</name>
  <files>docker-compose.yml, .env.example, infra/postgres/init/00-logical.sql, infra/opensearch/opensearch.yml, infra/debezium/connect-config.env</files>
  <action>Author docker-compose.yml (Compose spec, no obsolete `version:` key) with pinned image tags: postgres:16, redis:7, confluentinc/cp-kafka (KRaft mode, single broker) + confluentinc/cp-schema-registry, debezium/connect:2.x, opensearchproject/opensearch:2.x (+ opensearch-dashboards), minio/minio. Each service: container_name prefixed `livora-`, a named volume for persistence, a shared `livora-net` bridge network, and a **healthcheck** (pg_isready; redis-ping; kafka-topics list; schema-registry /subjects; OpenSearch /_cluster/health; MinIO /minio/health/ready). Mount infra/postgres/init/00-logical.sql to set `wal_level=logical`, `max_wal_senders`, `max_replication_slots` and create app/replication roles. All credentials/ports come from `.env` with sane defaults in `.env.example`. Set OpenSearch single-node, security demo disabled for local (note: re-enable later). Do NOT expose admin ports publicly in defaults.</action>
  <verify>`docker compose up -d postgres redis kafka schema-registry connect opensearch minio` → `docker compose ps` shows all `healthy`; `docker exec livora-postgres psql -U $POSTGRES_USER -c 'show wal_level;'` returns `logical`.</verify>
  <done>All data/eventing services reach healthy; Postgres is in logical-WAL mode.</done>
</task>

<task type="auto">
  <name>Task 2: Compose for gateway + identity + bootstrap config (Kong, Keycloak, declarative configs, Makefile)</name>
  <files>docker-compose.yml, docker-compose.override.yml, infra/kong/kong.yml, infra/keycloak/realm-export.json, infra/README.md, Makefile</files>
  <action>Extend docker-compose.yml with: kong:3.x in **DB-less declarative mode** mounting infra/kong/kong.yml (define an example service+route to the future platform-reference upstream and enable the `jwt`/`openid-connect` plugin pointed at Keycloak JWKS), and keycloak:24 (start-dev) importing infra/keycloak/realm-export.json on boot (realm `livora` with clients for web/app/admin BFFs, roles customer/store_owner/store_staff/admin/driver, and a test user). Add healthchecks (Kong /status, Keycloak /health/ready). Create docker-compose.override.yml for dev-only conveniences (port exposure, source mounts). Author a Makefile with targets: `up`, `down`, `logs`, `ps`, `reset` (down -v), `seed` (apply debezium connector via curl to Connect REST — referencing the connector json authored in Plan 03/05). Document the stack, ports, and default creds in infra/README.md.</action>
  <verify>`make up` → `docker compose ps` all healthy; `curl localhost:$KONG_PROXY/` reachable; `curl localhost:$KEYCLOAK_PORT/realms/livora/.well-known/openid-configuration` returns JSON.</verify>
  <done>Kong serves declarative config; Keycloak exposes the `livora` realm OIDC discovery doc; `make up/down` manage the full stack.</done>
</task>

</tasks>

<verification>
- `make up` brings the entire stack to healthy in a clean checkout.
- Postgres logical WAL on; Keycloak realm present; Kong declarative config loaded.
- `.env.example` documents every variable; no secrets committed.
</verification>

<success_criteria>
- [ ] One command starts all infra healthy
- [ ] CDC-ready Postgres + realm-imported Keycloak + declarative Kong
- [ ] Makefile lifecycle targets work
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-02-SUMMARY.md` listing image tags/versions, exposed ports, default credentials location, and the realm/client names created.
</output>
