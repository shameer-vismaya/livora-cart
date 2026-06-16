---
phase: 02-identity
plan: 05
type: execute
wave: 3
depends_on: [01]
files_modified:
  - apps/user-service/project.json
  - apps/user-service/tsconfig.app.json
  - apps/user-service/tsconfig.json
  - apps/user-service/tsconfig.spec.json
  - apps/user-service/jest.config.ts
  - apps/user-service/Dockerfile
  - apps/user-service/prisma/schema.prisma
  - apps/user-service/src/main.ts
  - apps/user-service/src/app.module.ts
  - apps/user-service/src/config.ts
  - apps/user-service/src/prisma/prisma.service.ts
  - apps/user-service/src/health/health.controller.ts
  - apps/user-service/src/profile/profile.controller.ts
  - apps/user-service/src/profile/profile.service.ts
  - apps/user-service/src/consumer/user-registered.consumer.ts
  - docker-compose.yml
  - docker-compose.prod.yml
  - infra/kong/kong.yml
  - deploy/deploy.sh
autonomous: true
must_haves:
  truths:
    - "user-service is healthy in the stack and routed via Kong at /users/*"
    - "A UserRegistered event (from Identity) creates a user profile row exactly once (inbox dedup)"
    - "An authenticated user can GET and PUT their own profile (CurrentUser-scoped)"
  artifacts:
    - "apps/user-service cloned from the template"
    - "ProfileService + ProfileController (self-scoped)"
    - "UserRegisteredConsumer (idempotent)"
  key_links:
    - "Kafka UserRegistered -> consumer -> profile upsert (processed_events dedup)"
    - "JWT sub (CurrentUser) -> profile ownership; users can only read/write their own profile"
---

<objective>
Stand up the User Service (clone the template), create profiles automatically from `UserRegistered`, and let authenticated users manage their own profile.

Purpose: The user data home (REQ-USR-01), decoupled from auth identity; first consumer of an inter-service event.
Output: `apps/user-service` with profile CRUD (self-scoped) + idempotent `UserRegistered` consumer.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/phases/02-identity/CONTEXT.md
@.planning/phases/02-identity/02-identity-01-SUMMARY.md   # @livora/auth usage
@apps/platform-reference   # template (incl. idempotent consumer pattern)
@apps/identity-service/src/registration/registration.service.ts   # UserRegistered schema
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold user-service from the template + wire into infra</name>
  <files>apps/user-service/project.json, apps/user-service/tsconfig.app.json, apps/user-service/tsconfig.json, apps/user-service/tsconfig.spec.json, apps/user-service/jest.config.ts, apps/user-service/Dockerfile, apps/user-service/prisma/schema.prisma, apps/user-service/src/main.ts, apps/user-service/src/app.module.ts, apps/user-service/src/config.ts, apps/user-service/src/prisma/prisma.service.ts, apps/user-service/src/health/health.controller.ts, docker-compose.yml, docker-compose.prod.yml, infra/kong/kong.yml, deploy/deploy.sh</files>
  <action>Clone the reference template into `apps/user-service` (same NestJS/tsc/Dockerfile/health/otel patterns; Dockerfile copies @livora/* incl. auth into node_modules). Prisma schema: own DB `users` with `processed_events` (inbox) + `user_profile` (id, keycloakId unique, email, phone, firstName, lastName, createdAt, updatedAt). Add to docker-compose.yml + docker-compose.prod.yml (own `users` DATABASE_URL, OTLP, restart, ports !reset []). Kong route `/users` -> user-service:3000. Update deploy.sh: create `users` database + db push for user-service (no outbox/connector needed yet unless it emits events — it only consumes here, so just db push + a consumer; ensure the users DB exists).</action>
  <verify>`pnpm nx build user-service` + `pnpm nx test user-service` pass; compose config renders; `bash -n deploy/deploy.sh`.</verify>
  <done>user-service builds, healthy in compose (+prod) with its own DB, routed at /users via Kong, deploy provisions its DB.</done>
</task>

<task type="auto">
  <name>Task 2: Profile self-service + idempotent UserRegistered consumer</name>
  <files>apps/user-service/src/profile/profile.controller.ts, apps/user-service/src/profile/profile.service.ts, apps/user-service/src/consumer/user-registered.consumer.ts, apps/user-service/src/app.module.ts</files>
  <action>Implement `UserRegisteredConsumer` (KafkaJS, subscribe `livora.demo.events`? NO — subscribe to the identity topic, e.g. `livora.identity.events` or the dedicated UserRegistered topic produced by identity's connector; coordinate the topic name with Plan 03's connector). Apply idempotently: on `UserRegistered`, upsert `user_profile` (by keycloakId) and record eventId in `processed_events` in one transaction (effectively-once). Implement `ProfileService` + `ProfileController` guarded by `KeycloakJwtGuard` (from @livora/auth): `GET /profile/me` and `PUT /profile/me` operate on the profile whose keycloakId == `@CurrentUser().sub` (users can only access their own). Return 404 if no profile yet. Unit-test ProfileService (self-scoping) and the consumer (dedup) with mocks.</action>
  <verify>`pnpm nx test user-service` passes (profile + consumer specs). Host (Plan 07): registering via Identity creates a profile; `GET /users/profile/me` with that user's token returns it; another user's token cannot read it.</verify>
  <done>UserRegistered creates a profile once; users GET/PUT only their own profile; consumer dedups.</done>
</task>

</tasks>

<verification>
- user-service builds/tests green; in compose+prod with own DB + Kong route.
- Consumer idempotent; profile endpoints self-scoped via @livora/auth.
</verification>

<success_criteria>
- [ ] user-service scaffolded, healthy, /users routed
- [ ] UserRegistered -> profile (idempotent)
- [ ] GET/PUT /profile/me self-scoped
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-05-SUMMARY.md` (service layout, the UserRegistered topic name, profile API, host verification steps).
</output>
