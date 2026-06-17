---
phase: 03-store-catalog
plan: 05
type: execute
wave: 4
depends_on: [04]
files_modified:
  - apps/catalog-service/src/media/media.controller.ts
  - apps/catalog-service/src/media/s3.service.ts
  - apps/catalog-service/src/product/product.service.ts
  - apps/catalog-service/src/admin/product-moderation.controller.ts
  - apps/catalog-service/src/admin/product-moderation.service.ts
  - apps/catalog-service/src/config.ts
  - apps/catalog-service/src/app.module.ts
  - docker-compose.yml
  - deploy/deploy.sh
autonomous: true
user_setup:
  - service: object-storage
    why: "Product images stored in S3-compatible storage (MinIO local; S3 prod)."
    env_vars:
      - name: S3_ENDPOINT
        source: "http://minio:9000 (local) / S3 endpoint (prod)"
      - name: S3_BUCKET
        source: "livora-catalog (created by deploy)"
      - name: S3_ACCESS_KEY
        source: "MinIO root user / S3 access key"
      - name: S3_SECRET_KEY
        source: "MinIO root password / S3 secret key"
must_haves:
  truths:
    - "A store owner gets a presigned URL and uploads a product image to object storage"
    - "An admin can approve/reject a product; approval emits ProductPublished"
    - "Product create/update/publish emit catalog events (for Phase 4 search)"
  artifacts:
    - "S3Service (presigned PUT) + media endpoint"
    - "product moderation (admin) + ProductPublished/ProductUpdated events"
    - "livora-catalog bucket created on deploy"
  key_links:
    - "presigned PUT -> MinIO/S3 bucket; returned key saved on the product/variant"
    - "moderation approve -> status 'published' + ProductPublished via outbox -> livora.catalog.events"
---

<objective>
Let owners upload product images (presigned), let admins moderate products, and emit the product events Phase 4 search will consume.

Purpose: REQ-CAT-01 (images), REQ-CAT-05 (moderation), REQ-CAT-08 (events). Completes the catalog vertical.
Output: presigned media upload + admin moderation + ProductPublished events + the object-storage bucket.
</objective>

<context>
@.planning/research/STACK.md   # S3/MinIO
@.planning/phases/03-store-catalog/CONTEXT.md
@.planning/phases/03-store-catalog/03-store-catalog-04-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Presigned media upload (S3/MinIO) + bucket provisioning</name>
  <files>apps/catalog-service/src/media/media.controller.ts, apps/catalog-service/src/media/s3.service.ts, apps/catalog-service/src/config.ts, apps/catalog-service/src/product/product.service.ts, apps/catalog-service/src/app.module.ts, docker-compose.yml, deploy/deploy.sh</files>
  <action>Add `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. `S3Service` configured from env (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, forcePathStyle true for MinIO): `presignPut(key, contentType)` returns a presigned PUT URL (short expiry) + the object key; `publicUrl(key)`. `MediaController` (`KeycloakJwtGuard + @StoreScope`): `POST /stores/:storeId/products/:productId/media/presign` {contentType} -> {uploadUrl, key, publicUrl}; a follow-up `PUT` saves the key onto the product/variant (ProductService.addImage). Add S3_* env to catalog-service in compose (MinIO creds). In deploy.sh, create the `livora-catalog` bucket (mc or aws-cli one-shot, or a small `docker run` against MinIO) idempotently. Unit-test S3Service key/URL building with a mocked presigner.</action>
  <verify>`pnpm nx test catalog-service` passes. Host (Plan 07): presign returns a URL; uploading to it stores the object; product image key persisted.</verify>
  <done>Owners get presigned URLs and attach uploaded images; bucket auto-created.</done>
</task>

<task type="auto">
  <name>Task 2: Product moderation + ProductPublished/ProductUpdated events</name>
  <files>apps/catalog-service/src/admin/product-moderation.controller.ts, apps/catalog-service/src/admin/product-moderation.service.ts, apps/catalog-service/src/product/product.service.ts, apps/catalog-service/src/app.module.ts</files>
  <action>`ProductModerationService` (admin): `listForReview()`, `approve(productId)` -> status 'published' + emit `product.published` (payload {productId, storeId, title, categoryId, pricePaise, status}) via outbox; `reject(productId, reason)` -> status 'rejected' + `product.rejected`. `ProductModerationController` (`KeycloakJwtGuard + @Roles('admin')`): GET /admin/products?status=pending, POST /admin/products/:id/approve|reject. Also: when an owner submits a product for review (ProductService.submitForReview -> status 'pending'), and on any published-product update emit `product.updated`. All events via outbox -> Debezium -> `livora.catalog.events`. Unit-test moderation transitions + event emission (mocked).</action>
  <verify>`pnpm nx test catalog-service` passes moderation specs. Host: owner submits product -> pending; admin approves -> published + ProductPublished on livora.catalog.events.</verify>
  <done>Admin moderates products; publish/update/reject emit catalog events for downstream search.</done>
</task>

</tasks>

<verification>
- catalog tests green; presigned upload + moderation + events.
- ProductPublished lands on livora.catalog.events (outbox/CDC).
</verification>

<success_criteria>
- [ ] presigned media upload to MinIO/S3 + bucket auto-created
- [ ] admin product moderation (approve/reject)
- [ ] ProductPublished/Updated/Rejected events via outbox
</success_criteria>

<output>
Create `.planning/phases/03-store-catalog/03-store-catalog-05-SUMMARY.md` (media flow, moderation, event schemas, bucket setup, host steps).
</output>
