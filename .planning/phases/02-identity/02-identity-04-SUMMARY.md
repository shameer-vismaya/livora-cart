---
phase: 02-identity
plan: 04
subsystem: identity-service
tags: [otp, msg91, token-exchange, guest, social-login, mfa, redis]
requires: [02-identity-03]
provides: [otp-login, guest-token, token-exchange]
affects: [user-service, checkout]
tech-stack:
  added: [ioredis]
  patterns: [otp-redis-ttl-lockout, keycloak-token-exchange]
key-files:
  created:
    - apps/identity-service/src/otp/* (service, controller, msg91 client, redis provider)
    - apps/identity-service/src/token/token.service.ts
    - apps/identity-service/src/guest/guest.controller.ts
  modified:
    - apps/identity-service/src/app.module.ts
    - docker-compose.yml (keycloak token-exchange feature)
    - infra/keycloak/livora-realm.json (google IdP stub)
completed: 2026-06-16
status: complete
verified: local (lint + 5 tests + build green); host at Plan 07
---

# Phase 2 Plan 04: OTP + Token Issuance + Guest + Social/MFA

Passwordless mobile OTP (MSG91), Keycloak token issuance via token-exchange, guest checkout tokens, and social/MFA configuration.

## What was built
- **OTP:** `Msg91Client` (dev logs the code; real MSG91 call in prod with keys). `OtpService` — Redis-backed, 6-digit, sha256(phone:code), 5-min TTL, 5-attempt lockout; unit-tested (correct/wrong/none/lockout). `/auth/otp/request` (202), `/auth/otp/verify` (200 → tokens).
- **Token issuance (the hard part):** `TokenService.issueForVerifiedPhone` — find-or-create the KC user, then **Keycloak token-exchange** (identity-admin impersonates the user) → a standard realm access token the `@livora/auth` guard already accepts. Compose enables `--features=token-exchange,admin-fine-grained-authz`.
- **Guest:** `/auth/guest` provisions an ephemeral guest user (role customer) and returns a token.
- **Social/MFA:** Google IdP stub in realm import (real creds via admin console); TOTP available by default.

## Decisions
- **token-exchange over custom direct-grant** — yields a normal realm token (no second issuer/guard change). Chosen mechanism documented per Plan 04.
- OTP store in Redis (TTL + lockout) — no DB table needed.

## ⚠️ Host verification (Plan 07) + setup
- Keycloak token-exchange impersonation requires granting the `identity-admin` client impersonation permission (admin-fine-grained-authz) — set in the admin console on first host run if token-exchange returns 403; document the exact toggle during host verify.
- MSG91/Google creds optional (dev-stub works): set `MSG91_*` and Google client id/secret for real SMS/social.
- Verify: `/auth/otp/request` logs/sends a code; `/auth/otp/verify` returns a token that works on a protected route; `/auth/guest` returns a usable token.
