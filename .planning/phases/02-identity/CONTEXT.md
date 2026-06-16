# Phase 2 — Identity, Users & Access Control (CONTEXT)

> Goal-backward analysis driving the plans here. Every actor can authenticate and is correctly authorized. Services clone the proven `apps/platform-reference` template (outbox/CDC/JWT/OTel/Dockerfile/compose/kong) from Phase 1.

## Phase Goal (outcome)
**A customer can register (email or mobile OTP or social or guest), log in, receive a correctly-scoped Keycloak JWT, and manage their profile + addresses — while every service enforces RBAC (and the ABAC store-scope mechanism exists for Phase 3).**

## Observable Truths (must be TRUE)
1. A new user registers by **email/password** → exists in Keycloak with role `customer` → a User profile row is created.
2. A user logs in by **mobile OTP** (MSG91) → receives a valid Keycloak access token.
3. **Social login** (Google) works via Keycloak; **guest checkout** yields a limited guest token.
4. **MFA (TOTP)** can be enrolled; enforced for `admin`/`store_owner`.
5. A logged-in user can **GET/PUT their profile**, **CRUD addresses** (geocoded lat/lon), set **notification preferences**, and store **KYC refs** (store owners).
6. Protected endpoints enforce **RBAC** (`@Roles`) — e.g. an admin-only route rejects a customer token (403); the **ABAC store-scope** guard exists and is unit-tested (full enforcement in Phase 3).
7. Auth is **DRY**: one shared `@livora/auth` library used by every service (no copy-paste guard).
8. A `deploy/smoke-test.sh` proves register → login → authorized profile call after every deploy.

## Required Artifacts
- `libs/auth` (`@livora/auth`): `KeycloakJwtGuard`, `JwksProvider`, `@Roles()` + `RolesGuard`, `@StoreScope()` + `StoreScopeGuard` (ABAC), `@CurrentUser()` decorator, auth helpers — all unit-tested.
- `apps/identity-service`: Keycloak Admin client; `/auth/register`, `/auth/otp/request`, `/auth/otp/verify`, `/auth/guest`, MFA + social config; emits `UserRegistered` via outbox.
- `apps/user-service`: profile CRUD, addresses (+ geocoding provider), KYC refs, notification prefs; consumes `UserRegistered`.
- `deploy/smoke-test.sh`; compose + kong entries + Makefile targets for the two new services.

## Key Links (most likely to break)
- Identity → Keycloak Admin API (service-account client credentials) — create user + assign role.
- OTP verify → issue Keycloak token (token-exchange / impersonation) — **trickiest; see Plan 04 discovery**.
- `UserRegistered` (Identity outbox → Debezium → Kafka) → User Service consumer creates profile (effectively-once).
- `@livora/auth` guard ↔ Keycloak JWKS (issuer/signature) — reuse the Phase-1-proven config (audience optional).
- Geocoding provider ↔ Google/Mappls API key.

## Plans & Waves
| Plan | Title | Wave | Depends | Touches compose/kong |
|---|---|---|---|---|
| 01 | `@livora/auth` shared lib (JWT + RBAC + ABAC) | 1 | — | no |
| 02 | Refactor reference → @livora/auth + smoke-test.sh | 2 | 01 | no |
| 03 | Identity scaffold + email register + KC Admin + UserRegistered | 2 | 01 | yes |
| 04 | Identity OTP (MSG91) + guest + social/MFA | 3 | 03 | no |
| 05 | User Service scaffold + profile + consume UserRegistered | 3 | 01 | yes |
| 06 | User Service addresses/geocoding + KYC + prefs | 4 | 05 | no |
| 07 | Integration: RBAC enforcement + e2e smoke-test + verify | 5 | 03,04,05,06 | no |

> Compose/kong/Makefile edits serialized by wave (03 in W2, 05 in W3) per the file-ownership rule. Service code is disjoint → real parallelism within waves.

## Discovery (Level 2 — external integrations)
- **Keycloak Admin API + token-exchange** for OTP→token issuance (Plan 04 is the hardest; embed approach, verify on host).
- **MSG91** OTP send (DLT template + sender id) — `user_setup` secrets.
- **Geocoding** (Google Maps / Mappls) — `user_setup` secret.
No separate research agents (avoiding session limits); approaches are specified inline and proven on host during execution.

## Deployment reminder
Windows dev has no Docker → build/test locally, **runtime-verify on the Ubuntu host** via `git pull` + `deploy/deploy.sh`. New services must be added to compose + kong + the deploy DB-push/connector steps.
