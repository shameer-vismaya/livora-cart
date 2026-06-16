---
phase: 02-identity
plan: 06
type: execute
wave: 4
depends_on: [05]
files_modified:
  - apps/user-service/prisma/schema.prisma
  - apps/user-service/src/address/address.controller.ts
  - apps/user-service/src/address/address.service.ts
  - apps/user-service/src/geocoding/geocoding.provider.ts
  - apps/user-service/src/geocoding/google-geocoding.provider.ts
  - apps/user-service/src/kyc/kyc.controller.ts
  - apps/user-service/src/kyc/kyc.service.ts
  - apps/user-service/src/prefs/prefs.controller.ts
  - apps/user-service/src/prefs/prefs.service.ts
  - apps/user-service/src/app.module.ts
autonomous: true
user_setup:
  - service: geocoding
    why: "Geocode addresses to lat/lon for location-based store discovery (Phase 4)."
    env_vars:
      - name: GEOCODING_PROVIDER
        source: "google | mappls (default google)"
      - name: GEOCODING_API_KEY
        source: "Google Maps Platform (Geocoding API) or Mappls API key"
must_haves:
  truths:
    - "An authenticated user can CRUD their delivery addresses, each geocoded to lat/lon on save"
    - "Store owners can store KYC references (GSTIN, PAN, bank) on their profile"
    - "A user can read/update notification preferences (push/SMS/WhatsApp/email opt-in)"
  artifacts:
    - "address_table + AddressService/Controller with geocoding"
    - "GeocodingProvider interface + Google implementation (Mappls-swappable)"
    - "KYC + notification-preferences endpoints"
  key_links:
    - "address save -> GeocodingProvider.geocode(address) -> lat/lon persisted"
    - "all endpoints self-scoped via @CurrentUser; KYC limited to store_owner via @Roles"
---

<objective>
Round out the user data model: geocoded addresses (feeding Phase 4 location discovery), store-owner KYC references, and notification preferences (REQ-USR-02/03/04).

Purpose: Addresses with lat/lon are the input to "nearby stores"; KYC refs gate store onboarding; prefs drive notifications.
Output: address CRUD + geocoding, KYC refs, notification prefs on the User Service.
</objective>

<context>
@.planning/REQUIREMENTS.md
@.planning/research/STACK.md   # geocoding provider choice
@.planning/phases/02-identity/CONTEXT.md
@.planning/phases/02-identity/02-identity-05-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Addresses + geocoding provider</name>
  <files>apps/user-service/prisma/schema.prisma, apps/user-service/src/address/address.controller.ts, apps/user-service/src/address/address.service.ts, apps/user-service/src/geocoding/geocoding.provider.ts, apps/user-service/src/geocoding/google-geocoding.provider.ts, apps/user-service/src/app.module.ts</files>
  <action>Add `user_address` to the Prisma schema (id, profileId FK, label, line1, line2, city, state, pincode, country default 'IN', lat, lon, isDefault, createdAt). Define `GeocodingProvider` interface `{ geocode(addr): Promise<{lat:number;lon:number}> }` and a `GoogleGeocodingProvider` (Google Geocoding API via config key; in dev or when no key, return a stubbed lat/lon and log). Provide the provider via a token so Mappls can be swapped. `AddressService` (self-scoped by CurrentUser's profile): create/list/update/delete; on create/update call geocode and persist lat/lon; enforce single default. `AddressController` guarded by KeycloakJwtGuard, routes under `/address`. Unit-test AddressService with a fake GeocodingProvider (geocode called, default toggling, ownership).</action>
  <verify>`pnpm nx test user-service` passes address specs; build clean. Host: create an address -> lat/lon populated.</verify>
  <done>Address CRUD works, self-scoped, each address geocoded; provider swappable.</done>
</task>

<task type="auto">
  <name>Task 2: KYC references (store owners) + notification preferences</name>
  <files>apps/user-service/prisma/schema.prisma, apps/user-service/src/kyc/kyc.controller.ts, apps/user-service/src/kyc/kyc.service.ts, apps/user-service/src/prefs/prefs.controller.ts, apps/user-service/src/prefs/prefs.service.ts, apps/user-service/src/app.module.ts</files>
  <action>Add `kyc_reference` (id, profileId, gstin, pan, bankAccount, ifsc, status default 'pending', createdAt) and `notification_pref` (profileId PK, push, sms, whatsapp, email — booleans, default true) to the schema. `KycService`/`KycController`: upsert + get the caller's KYC; guard with `@Roles('store_owner')` (from @livora/auth) so only store owners manage KYC; validate GSTIN/PAN formats (regex). `PrefsService`/`PrefsController`: `GET/PUT /prefs/me` self-scoped. Store sensitive KYC fields with care (do not log; mask in responses). Unit-test KYC validation + role restriction and prefs upsert.</action>
  <verify>`pnpm nx test user-service` passes KYC/prefs specs; build clean. Host: store_owner can upsert KYC, customer is 403; prefs round-trip.</verify>
  <done>KYC refs (store_owner-only, validated, masked) + notification prefs round-trip; unit-tested.</done>
</task>

</tasks>

<verification>
- user-service builds/tests green with addresses (geocoded), KYC, prefs.
- Role-restriction on KYC; self-scoping throughout.
</verification>

<success_criteria>
- [ ] Address CRUD + geocoding (provider-swappable)
- [ ] KYC refs (store_owner-only, validated, masked)
- [ ] Notification preferences
</success_criteria>

<output>
Create `.planning/phases/02-identity/02-identity-06-SUMMARY.md` (address/KYC/prefs APIs, geocoding provider config, host verification steps).
</output>
