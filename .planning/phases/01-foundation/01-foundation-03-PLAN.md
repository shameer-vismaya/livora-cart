---
phase: 01-foundation
plan: 03
type: execute
wave: 2
depends_on: [01, 02]
files_modified:
  - apps/platform-reference/src/main.ts
  - apps/platform-reference/src/app.module.ts
  - apps/platform-reference/src/health/health.controller.ts
  - apps/platform-reference/src/auth/keycloak-jwt.guard.ts
  - apps/platform-reference/src/auth/jwks.provider.ts
  - apps/platform-reference/src/outbox/outbox.entity.ts
  - apps/platform-reference/src/outbox/outbox.service.ts
  - apps/platform-reference/src/demo/demo.controller.ts
  - apps/platform-reference/src/consumer/event.consumer.ts
  - apps/platform-reference/src/consumer/inbox.entity.ts
  - apps/platform-reference/prisma/schema.prisma
  - apps/platform-reference/Dockerfile
  - infra/debezium/outbox-connector.json
  - apps/platform-reference/project.json
autonomous: true
user_setup: []
must_haves:
  truths:
    - "Kong-routed endpoint rejects no/invalid JWT (401) and accepts a valid Keycloak JWT (200)"
    - "A demo write inserts an outbox row; Debezium streams it to Kafka; a consumer applies it exactly once"
    - "Re-delivering the same event is a no-op (inbox dedup); poison messages go to a DLQ"
  artifacts:
    - "apps/platform-reference NestJS service"
    - "Keycloak JWT guard validating against realm JWKS"
    - "outbox table + Debezium outbox connector + idempotent Kafka consumer with inbox + DLQ"
    - "Dockerfile (multi-stage) for the service"
  key_links:
    - "guard -> Keycloak JWKS (kid match) -> 401/200"
    - "demo write + outbox insert in ONE transaction -> no dual-write"
    - "Debezium outbox connector -> Kafka topic -> consumer"
    - "inbox processed_events row -> duplicate = no-op"
---

<objective>
Build the reference NestJS service that proves the cross-cutting patterns every Livora service will reuse: gateway-fronted auth, the transactional outbox → Debezium → Kafka path, and idempotent consumption with a DLQ.

Purpose: A working, copyable template encoding the non-negotiable patterns from research/ARCHITECTURE.md §2 (outbox + idempotency). Future service generators clone this shape.
Output: `apps/platform-reference` running in Compose, reachable through Kong with Keycloak JWT, demonstrating outbox/CDC/idempotent-consumer/DLQ.
</objective>

<context>
@.planning/research/ARCHITECTURE.md
@.planning/research/STACK.md
@.planning/phases/01-foundation/CONTEXT.md
@.planning/phases/01-foundation/01-foundation-02-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: NestJS reference service — health, Keycloak JWT guard, Dockerized, Kong-routed</name>
  <files>apps/platform-reference/src/main.ts, apps/platform-reference/src/app.module.ts, apps/platform-reference/src/health/health.controller.ts, apps/platform-reference/src/auth/keycloak-jwt.guard.ts, apps/platform-reference/src/auth/jwks.provider.ts, apps/platform-reference/Dockerfile, apps/platform-reference/project.json</files>
  <action>Generate a NestJS app `platform-reference` via `nx g @nx/nest:app`. Add `@nestjs/terminus` health controller (`GET /health` checks Postgres + Kafka reachability; `GET /health/live` + `/health/ready`). Implement `KeycloakJwtGuard`: validate Bearer JWT using `jose` `createRemoteJWKSet` against `${KEYCLOAK_URL}/realms/livora/protocol/openid-connect/certs`, verify issuer + audience, attach `req.user` (sub, roles from realm_access). Use `@livora/config` (zod) to load env. Add a multi-stage Dockerfile (node:20-alpine builder → distroless/alpine runtime, non-root user, only built dist + prod deps). Add the service to docker-compose.yml (depends_on infra healthy) and confirm the Kong route from Plan 02 points to it. Protect `/demo/*` with the guard; leave `/health*` public.</action>
  <verify>`make up` then: `curl -s -o /dev/null -w '%{http_code}' localhost:$KONG_PROXY/reference/demo/echo` → 401; obtain a token via Keycloak password grant for the test user and repeat with `Authorization: Bearer` → 200; `curl localhost:$KONG_PROXY/reference/health` → 200.</verify>
  <done>Service runs in Compose, health is green, Kong routes to it, guard enforces Keycloak JWT (401 without, 200 with).</done>
</task>

<task type="auto">
  <name>Task 2: Transactional outbox → Debezium → Kafka with idempotent consumer + DLQ</name>
  <files>apps/platform-reference/prisma/schema.prisma, apps/platform-reference/src/outbox/outbox.entity.ts, apps/platform-reference/src/outbox/outbox.service.ts, apps/platform-reference/src/demo/demo.controller.ts, apps/platform-reference/src/consumer/event.consumer.ts, apps/platform-reference/src/consumer/inbox.entity.ts, infra/debezium/outbox-connector.json</files>
  <action>Define Prisma schema with `demo_aggregate`, `outbox` (id, aggregate_type, aggregate_id, event_type, payload jsonb, created_at), and `processed_events` (event_id pk, processed_at) tables; run `prisma migrate`. Implement `OutboxService.publishWithin(tx, event)` that inserts the aggregate change AND the outbox row in ONE Prisma transaction (no dual-write). Add `POST /demo/echo` that writes a demo aggregate + outbox event transactionally and returns 202 with the eventId; require a client `Idempotency-Key` header (store+replay). Author infra/debezium/outbox-connector.json (Debezium Postgres connector, `table.include.list` = public.outbox, `transforms=outbox` using EventRouter SMT → topic `livora.demo.events`). Implement a KafkaJS consumer (`event.consumer.ts`) that, per message, applies the effect and records `processed_events(event_id)` in the same transaction — duplicate event_id = no-op; on handler exception after N retries, produce to `livora.demo.events.DLQ`. Register the Debezium connector via the Makefile `seed` target (curl to Connect REST).</action>
  <verify>Hit `/demo/echo` once → exactly one log line "applied event X" + one row in processed_events; replay the same Kafka offset (or re-post with same Idempotency-Key) → no second apply; publish a malformed event → it lands on `*.DLQ`. Confirm via `docker exec livora-kafka kafka-console-consumer` on the topic + DLQ.</verify>
  <done>Outbox write streams through Debezium to Kafka, consumer applies exactly once (dedup proven), poison message routed to DLQ.</done>
</task>

</tasks>

<verification>
- End-to-end: client → Kong (JWT) → service → Postgres outbox → Debezium → Kafka → idempotent consumer.
- Duplicate delivery is a no-op; poison messages isolated in DLQ.
- Service has a multi-stage non-root Dockerfile and is part of the Compose stack.
</verification>

<success_criteria>
- [ ] Kong + Keycloak JWT enforced (401/200)
- [ ] Outbox→Debezium→Kafka working
- [ ] Idempotent consumer (inbox dedup) + DLQ proven
- [ ] Dockerized, runs in Compose
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-foundation-03-SUMMARY.md` documenting the outbox/consumer pattern, topic names, the Debezium connector config, and how future services should reuse this template.
</output>
