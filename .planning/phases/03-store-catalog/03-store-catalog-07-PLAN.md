---
phase: 03-store-catalog
plan: 07
type: execute
wave: 6
depends_on: [01, 02, 03, 04, 05, 06]
files_modified:
  - deploy/smoke-test-store.sh
  - Makefile
autonomous: false
must_haves:
  truths:
    - "End-to-end on host: store_owner applies -> admin approves -> owner adds product+image -> admin publishes -> product visible"
    - "Tenant isolation holds: store A's owner cannot access store B's products (403)"
    - "smoke-test-store.sh asserts the whole flow and exits non-zero on failure"
  artifacts:
    - "deploy/smoke-test-store.sh"
  key_links:
    - "store approval grants the stores claim -> owner can manage that store's catalog"
    - "ProductPublished on livora.catalog.events (ready for Phase 4 search)"
---

<objective>
Verify the whole store→catalog→governance flow on the Ubuntu host and lock in a repeatable smoke test.

Purpose: Confirm Phase 3 works end-to-end (onboarding, governance, tenant-isolated catalog, media, events) before Phase 4 builds search on it.
Output: `deploy/smoke-test-store.sh` + a host-verified Phase 3.
</objective>

<context>
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/03-store-catalog/03-store-catalog-01-SUMMARY.md
@.planning/phases/03-store-catalog/03-store-catalog-02-SUMMARY.md
@.planning/phases/03-store-catalog/03-store-catalog-04-SUMMARY.md
@.planning/phases/03-store-catalog/03-store-catalog-05-SUMMARY.md
@deploy/smoke-test-identity.sh
</context>

<tasks>

<task type="auto">
  <name>Task 1: smoke-test-store.sh (store → catalog → governance + isolation)</name>
  <files>deploy/smoke-test-store.sh, Makefile</files>
  <action>Write `deploy/smoke-test-store.sh` (`set -uo pipefail`, source ENV_FILE, helper to register+login a user and to fetch the admin token like smoke-test-identity.sh). Flow: (1) register store-owner A (email), login; promote to store_owner — NOTE: registration assigns `customer`; for the test, use the admin token to grant the `store_owner` realm role to A (and B) via Keycloak admin, OR add a test seed store_owner in the realm; pick the simplest that works and document it. (2) A applies for a store -> 201 pending; (3) admin approves -> approved; (4) A re-logs in (to get the `stores` claim) and creates a category (admin) + a product under /stores/A/products -> 201; (5) A requests a media presign -> 200 URL; (6) admin publishes the product -> published; (7) register+login store-owner B, give store_owner role + own store, then B tries GET /stores/A/products -> expect 403 (tenant isolation); (8) verify a ProductPublished message exists on `livora.catalog.events`. Print PASS/FAIL per step; exit non-zero on failure. Add Makefile `smoke-store` target.</action>
  <verify>`bash -n deploy/smoke-test-store.sh` clean. (Live run in Task 2.)</verify>
  <done>smoke-test-store.sh covers onboarding→governance→catalog→media→isolation→event; wired to make.</done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 2: Host verification of Phase 3</name>
  <action>On the Ubuntu host: `git pull`; `ENV_FILE=deploy/.env.production bash deploy/deploy.sh` (provisions stores+catalog DBs, connectors, RLS, MinIO bucket); if the realm changed (stores mapper), `up -d --force-recreate keycloak`. Then run `bash deploy/smoke-test.sh`, `bash deploy/smoke-test-identity.sh`, and `bash deploy/smoke-test-store.sh`.</action>
  <verify>All three smoke scripts exit 0: store onboarding→approval→catalog→media→publish works; tenant isolation 403 holds; ProductPublished on the topic; store-service + catalog-service show (healthy).</verify>
  <done>Phase 3 verified end-to-end on the host; all smoke tests green.</done>
</task>

</tasks>

<verification>
- Full store→catalog flow + admin governance + tenant isolation pass on host.
- Prior phases' smokes still green (no regressions).
</verification>

<success_criteria>
- [ ] smoke-test-store.sh covers the full flow + isolation + event
- [ ] Host-verified: store-service + catalog-service healthy and functional
- [ ] Tenant isolation (403) holds on host
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-07-SUMMARY.md` and update `.planning/STATE.md` (Phase 3 complete + host-verified, decisions, deferrals).
</output>
