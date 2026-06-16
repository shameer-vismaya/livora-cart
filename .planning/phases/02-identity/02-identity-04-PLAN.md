---
phase: 02-identity
plan: 04
type: execute
wave: 3
depends_on: [03]
files_modified:
  - apps/identity-service/src/otp/otp.controller.ts
  - apps/identity-service/src/otp/otp.service.ts
  - apps/identity-service/src/otp/msg91.client.ts
  - apps/identity-service/src/token/token.service.ts
  - apps/identity-service/src/guest/guest.controller.ts
  - apps/identity-service/src/app.module.ts
  - apps/identity-service/prisma/schema.prisma
  - infra/keycloak/livora-realm.json
autonomous: true
user_setup:
  - service: msg91
    why: "Send mobile OTP SMS (India, DLT-compliant)."
    env_vars:
      - name: MSG91_AUTH_KEY
        source: "MSG91 dashboard -> API keys"
      - name: MSG91_SENDER_ID
        source: "MSG91 DLT-approved sender id"
      - name: MSG91_OTP_TEMPLATE_ID
        source: "MSG91 DLT-approved OTP template id"
must_haves:
  truths:
    - "POST /auth/otp/request sends an OTP via MSG91 to a phone number"
    - "POST /auth/otp/verify with a valid OTP returns a valid Keycloak access token for that user (creating the user on first login)"
    - "POST /auth/guest returns a short-lived guest token usable for guest checkout"
    - "Wrong/expired OTP is rejected; OTP attempts are rate-limited"
  artifacts:
    - "OtpService (generate, hash+store with TTL, verify, attempt-limit)"
    - "Msg91Client (send OTP SMS)"
    - "TokenService (issue Keycloak token for a verified user)"
    - "guest client + guest token issuance"
  key_links:
    - "OTP verify -> ensure Keycloak user exists -> issue token (Keycloak token-exchange / direct grant)"
    - "OTP store TTL + attempt counter (Redis) prevents brute force"
---

<objective>
Add passwordless mobile OTP login (MSG91), guest checkout tokens, and social/MFA configuration — completing the customer authentication options (REQ-IAM-02/03/04/05).

Purpose: India-first auth (OTP is the dominant flow). Guest checkout removes signup friction.
Output: `/auth/otp/request`, `/auth/otp/verify`, `/auth/guest`, social login (Keycloak) + MFA enrollment wired.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/research/STACK.md   # MSG91, DLT, token-exchange notes
@.planning/phases/02-identity/CONTEXT.md
@.planning/phases/02-identity/02-identity-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: OTP request/verify via MSG91 with secure storage + rate limiting</name>
  <files>apps/identity-service/src/otp/otp.controller.ts, apps/identity-service/src/otp/otp.service.ts, apps/identity-service/src/otp/msg91.client.ts, apps/identity-service/prisma/schema.prisma, apps/identity-service/src/app.module.ts</files>
  <action>Implement `Msg91Client.sendOtp(phone, code)` (HTTP to MSG91 OTP/flow API using MSG91_AUTH_KEY/SENDER_ID/TEMPLATE_ID from config; in NODE_ENV!=production, log the code instead of sending for dev). Implement `OtpService`: generate 6-digit code, store `hash(code)` keyed by phone in **Redis** with TTL (e.g. 5 min) + an attempt counter (max 5) and a resend cooldown; `requestOtp(phone)` -> store + send; `verifyOtp(phone, code)` -> compare hash, enforce attempts/TTL, on success delete the key and return the verified phone. Use the `REDIS_URL` env already provided to identity-service (set in Plan 03's compose env) + a redis client (ioredis). `OtpController`: `POST /auth/otp/request` {phone}, `POST /auth/otp/verify` {phone, code}. Unit-test OtpService with a fake Redis + fake Msg91Client (valid, wrong, expired, too-many-attempts).</action>
  <verify>`pnpm nx test identity-service` passes OTP specs; `bash -n`/build clean. Host: request logs/sends a code; verify with correct code succeeds, wrong code 400.</verify>
  <done>OTP request sends via MSG91 (or logs in dev); verify enforces correctness, TTL, and attempt limit.</done>
</task>

<task type="auto">
  <name>Task 2: Issue Keycloak token on OTP verify + guest token + social/MFA config</name>
  <files>apps/identity-service/src/token/token.service.ts, apps/identity-service/src/otp/otp.controller.ts, apps/identity-service/src/guest/guest.controller.ts, apps/identity-service/src/app.module.ts, infra/keycloak/livora-realm.json</files>
  <action>Implement `TokenService.issueForVerifiedPhone(phone)`: ensure a Keycloak user exists for the phone (find-or-create via KeycloakAdminService, role customer, attribute phone, mark phone_verified), then mint a Keycloak access token for that user. DISCOVERY (Level 2 — pick the working approach on host): preferred is **Keycloak token-exchange** (enable feature; identity-admin service account exchanges a subject token / impersonates the user) producing a standard realm token the existing @livora/auth guard already validates; fallback is a custom direct-grant. Document the chosen mechanism. Wire `/auth/otp/verify` to return {access_token, refresh_token, expires_in} on success. Implement `/auth/guest` issuing a short-lived token for an ephemeral guest principal (role `customer` or a dedicated `guest` role, minimal scope; clearly time-boxed). In `livora-realm.json`: add a Google identity provider stub (configurable client id/secret via env; document that real creds are user_setup) and ensure TOTP is available; note MFA is REQUIRED for admin/store_owner (realm/role browser-flow requirement or required-action) — configure required action for those roles.</action>
  <verify>`pnpm nx build identity-service` passes. Host (Plan 07): OTP verify returns a token that `@livora/auth` accepts on a protected route; `/auth/guest` returns a usable token; Google IdP visible on the login page; admin login prompts TOTP setup.</verify>
  <done>OTP verify yields a guard-valid Keycloak token (user auto-provisioned); guest token works; social + MFA configured.</done>
</task>

</tasks>

<verification>
- identity-service builds/tests green; OTP unit-tested.
- Token issuance mechanism documented; guest + social + MFA configured.
</verification>

<success_criteria>
- [ ] OTP request/verify via MSG91 with TTL + attempt limiting
- [ ] OTP verify -> valid Keycloak token (auto-provisioned user)
- [ ] Guest checkout token; Google social login; MFA for admin/store_owner
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-04-SUMMARY.md` — OTP flow, the token-issuance mechanism chosen (token-exchange vs fallback) + why, guest token scope/TTL, social/MFA config, host verification steps.
</output>
