---
phase: 02-identity
plan: 06
subsystem: user-service
tags: [address, geocoding, kyc, preferences, rbac]
requires: [02-identity-05]
provides: [addresses, geocoding, kyc, notification-prefs]
affects: [search-nearby, store-onboarding, notifications]
key-files:
  created:
    - apps/user-service/src/geocoding/*
    - apps/user-service/src/address/*
    - apps/user-service/src/kyc/*
    - apps/user-service/src/prefs/*
  modified: [apps/user-service/prisma/schema.prisma, apps/user-service/src/app.module.ts]
completed: 2026-06-16
status: complete
verified: local (lint + 4 tests + build green); host at Plan 07
---

# Phase 2 Plan 06: Addresses (geocoded) + KYC + Preferences

Rounded out user data: geocoded delivery addresses (feeding Phase 4 nearby-store search), store-owner KYC refs (RBAC-gated, masked), and notification preferences.

## What was built
- **Addresses:** `user_address` (lat/lon, single default); `GeocodingProvider` interface + `GoogleGeocodingProvider` (dev stub when no key; Mappls-swappable via DI token). Self-scoped CRUD; geocode on create/update; 6-digit Indian PIN validation. Unit-tested (geocode called, default toggling).
- **KYC:** `kyc_reference`; `@Roles('store_owner')` (RolesGuard) so only store owners manage KYC; GSTIN/PAN/IFSC regex validation; PAN/bank masked in responses.
- **Prefs:** `notification_pref` (push/sms/whatsapp/email); `GET/PUT /prefs/me` self-scoped.

## Verification
`nx run-many -t lint test build -p user-service` green (4 tests). Host CRUD/role checks in Plan 07.

## Deviations
None.

## ⚠️ To verify on host
Address create → lat/lon populated (stub 0,0 without GEOCODING_API_KEY); store_owner can upsert KYC, customer gets 403; prefs round-trip.
