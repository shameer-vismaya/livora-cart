---
phase: 03-store-catalog
plan: 05
subsystem: catalog-service
tags: [media, s3, minio, presigned, moderation, events]
requires: [03-store-catalog-04]
provides: [media-upload, product-moderation, product.published]
affects: [phase-4-search]
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
key-files:
  created:
    - apps/catalog-service/src/media/* (s3 service, controller)
    - apps/catalog-service/src/admin/product-moderation.* 
  modified: [apps/catalog-service/src/product/product.service.ts, app.module.ts, deploy/deploy.sh]
completed: 2026-06-17
status: complete
verified: local (lint+test+build green); host at Plan 07
---

# Phase 3 Plan 05: Media + Moderation + Events

Presigned image upload, admin product moderation, and the catalog events Phase 4 search consumes.

## What was built
- `S3Service` (presigned PUT, `forcePathStyle` for MinIO) + `MediaController` `POST /stores/:s/products/:p/media/presign` → {uploadUrl, key, publicUrl}; saves the image url on the product (store-scoped).
- `ProductModerationService` (`@Roles('admin')`): approve → `published` + `product.published`; reject → `product.rejected` (outbox → `livora.catalog.events`).
- `ProductService.addImage`; OutboxService injected.
- `deploy.sh` creates the `livora-catalog` MinIO bucket (one-shot `mc`) with public-download.

## Verification
`nx run-many -t lint test build -p catalog-service` green. Host (presign upload, moderation, ProductPublished on topic) at Plan 07.

## ⚠️ user_setup (dev-stub OK)
`S3_*` default to MinIO creds; prod needs real S3 endpoint/keys. Bucket auto-created on deploy.

## Deviations
None.
