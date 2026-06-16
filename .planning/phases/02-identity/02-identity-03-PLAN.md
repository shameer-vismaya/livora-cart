---
phase: 02-identity
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/identity-service/project.json
  - apps/identity-service/tsconfig.app.json
  - apps/identity-service/tsconfig.json
  - apps/identity-service/tsconfig.spec.json
  - apps/identity-service/jest.config.ts
  - apps/identity-service/Dockerfile
  - apps/identity-service/prisma/schema.prisma
  - apps/identity-service/src/main.ts
  - apps/identity-service/src/app.module.ts
  - apps/identity-service/src/config.ts
  - apps/identity-service/src/prisma/prisma.service.ts
  - apps/identity-service/src/health/health.controller.ts
  - apps/identity-service/src/keycloak/keycloak-admin.service.ts
  - apps/identity-service/src/registration/registration.controller.ts
  - apps/identity-service/src/registration/registration.service.ts
  - apps/identity-service/src/outbox/outbox.service.ts
  - docker-compose.yml
  - docker-compose.prod.yml
  - infra/kong/kong.yml
  - infra/keycloak/livora-realm.json
  - deploy/deploy.sh
  - Makefile
autonomous: true
user_setup:
  - service: keycloak-admin
    why: "Identity Service calls the Keycloak Admin API via a confidential service-account client to create users + assign roles."
    env_vars:
      - name: KEYCLOAK_ADMIN_CLIENT_ID
        source: "Realm 'livora' client (e.g. identity-admin) — created via realm import in this plan"
      - name: KEYCLOAK_ADMIN_CLIENT_SECRET
        source: "Keycloak admin console -> client identity-admin -> Credentials (or set in realm import for dev)"
must_haves:
  truths:
    - "POST /auth/register (email,password) creates a Keycloak user with role customer and returns 201"
    - "Registration emits a UserRegistered event via the transactional outbox"
    - "identity-service is reachable through Kong at /identity/* and is healthy in the stack"
  artifacts:
    - "apps/identity-service cloned from the platform-reference template"
    - "KeycloakAdminService (client-credentials token + user create + role assign)"
    - "identity-admin confidential client in the realm import"
  key_links:
    - "KeycloakAdminService -> Keycloak Admin REST (service-account token)"
    - "registration writes user-create result + outbox event in flow; UserRegistered -> Kafka"
    - "deploy.sh runs db push + connector for identity-service too"
---

<objective>
Stand up the Identity Service by cloning the proven reference template, integrate the Keycloak Admin API, and implement email/password registration that provisions a Keycloak user and announces `UserRegistered`.

Purpose: The authn front door (REQ-IAM-01/06). Keycloak is the IdP; Identity orchestrates user provisioning + events the rest of the platform reacts to.
Output: `apps/identity-service` (health, Kong-routed, healthy) with `/auth/register` + Keycloak Admin + `UserRegistered` outbox event.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/research/STACK.md
@.planning/phases/02-identity/CONTEXT.md
@apps/platform-reference   # the template to clone (outbox/otel/Dockerfile/health/prisma)
@infra/keycloak/livora-realm.json
@deploy/deploy.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold identity-service from the reference template + wire into infra</name>
  <files>apps/identity-service/project.json, apps/identity-service/tsconfig.app.json, apps/identity-service/tsconfig.json, apps/identity-service/tsconfig.spec.json, apps/identity-service/jest.config.ts, apps/identity-service/Dockerfile, apps/identity-service/prisma/schema.prisma, apps/identity-service/src/main.ts, apps/identity-service/src/app.module.ts, apps/identity-service/src/config.ts, apps/identity-service/src/prisma/prisma.service.ts, apps/identity-service/src/health/health.controller.ts, apps/identity-service/src/outbox/outbox.service.ts, docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, deploy/deploy.sh, Makefile</files>
  <action>Clone `apps/platform-reference` structure into `apps/identity-service` (NestJS, @nx/js:tsc, same tsconfig/jest/Dockerfile patterns INCLUDING: keep node_modules, apk add openssl libc6-compat curl, copy dist/libs/* incl. @livora/auth into node_modules, CMD node src/main.js). Prisma schema: own DB `identity` with `outbox`, `processed_events`, `idempotency_records` (reuse the reference shapes) + an `identity_user` table (id, keycloakId, email, phone, status, createdAt). config.ts via @livora/config with KEYCLOAK_URL/REALM, KEYCLOAK_ADMIN_CLIENT_ID/SECRET, DATABASE_URL, KAFKA_BROKERS, REDIS_URL (redis://redis:6379 — provisioned now so Plan 04's OTP store needs no further compose edit). Add the service to docker-compose.yml (build, env incl. its own DATABASE_URL to a NEW `identity` database, OTLP, depends_on healthy) and docker-compose.prod.yml (restart, ports !reset []). Add a Kong route `/identity` -> identity-service:3000. Update deploy.sh to db push + register a Debezium outbox connector for identity-service (parameterize the existing connector step or add a second connector json). Add Makefile note. Use a SEPARATE Postgres database per service — add identity DB creation (e.g. an init step or `CREATE DATABASE identity` via psql in deploy, owned by livora).</action>
  <verify>`pnpm nx build identity-service` + `pnpm nx test identity-service` pass; `docker compose config` (host) renders; `bash -n deploy/deploy.sh`.</verify>
  <done>identity-service builds, is defined in compose (+prod) with its own DB, Kong routes /identity, deploy handles its db push + CDC.</done>
</task>

<task type="auto">
  <name>Task 2: Keycloak Admin client + email/password registration + UserRegistered event</name>
  <files>apps/identity-service/src/keycloak/keycloak-admin.service.ts, apps/identity-service/src/registration/registration.controller.ts, apps/identity-service/src/registration/registration.service.ts, apps/identity-service/src/app.module.ts, infra/keycloak/livora-realm.json</files>
  <action>Add a confidential `identity-admin` client (service accounts enabled, realm-management roles manage-users + view-users) to `infra/keycloak/livora-realm.json` (with a dev secret). Implement `KeycloakAdminService`: obtain a service-account token via client_credentials against the realm token endpoint, cache it (refresh on expiry), and expose `createUser({email,password,firstName,lastName})` -> POST admin `/users`, then assign realm role `customer` (GET role, POST role-mapping). Implement `RegistrationService.registerEmail(dto)`: validate input (class-validator), call KeycloakAdminService.createUser, persist an `identity_user` row + emit `UserRegistered` (eventId, payload {keycloakId,email,phone:null}) via OutboxService in ONE transaction, return 201 {userId}. `RegistrationController` POST `/auth/register` (public). Handle duplicate email (409). Add a unit test for RegistrationService with KeycloakAdminService mocked.</action>
  <verify>`pnpm nx test identity-service` passes (registration unit test with mocked KC admin). Host (Plan 07): `POST /identity/auth/register` returns 201 and the user appears in Keycloak; `UserRegistered` lands on Kafka.</verify>
  <done>Email registration creates a Keycloak user (role customer), persists identity_user, emits UserRegistered transactionally; duplicates -> 409.</done>
</task>

</tasks>

<verification>
- identity-service builds/tests green; defined in compose+prod with its own DB + Kong route.
- Registration unit-tested with mocked Keycloak Admin; deploy.sh provisions its DB + CDC.
</verification>

<success_criteria>
- [ ] identity-service scaffolded from template, healthy in stack, /identity routed
- [ ] KeycloakAdminService creates users + assigns roles
- [ ] /auth/register works + emits UserRegistered via outbox
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-03-SUMMARY.md` (service layout, KC admin client name/secret location, UserRegistered event schema, host verification steps).
</output>
