-- Row-Level Security for catalog tenant tables (defense-in-depth beneath the
-- application-level storeId scoping). Policy is permissive when the tenant GUC
-- is unset (so non-tenant paths/admin tooling are unaffected) and enforces
-- store_id match when `app.current_store` is set; '*' is the admin sentinel.
-- Idempotent.

ALTER TABLE product ENABLE ROW LEVEL SECURITY;
ALTER TABLE product FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON product;
CREATE POLICY tenant_isolation ON product
  USING (
    current_setting('app.current_store', true) IS NULL
    OR current_setting('app.current_store', true) = ''
    OR current_setting('app.current_store', true) = '*'
    OR store_id = current_setting('app.current_store', true)
  );

ALTER TABLE product_variant ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON product_variant;
CREATE POLICY tenant_isolation ON product_variant
  USING (
    current_setting('app.current_store', true) IS NULL
    OR current_setting('app.current_store', true) = ''
    OR current_setting('app.current_store', true) = '*'
    OR store_id = current_setting('app.current_store', true)
  );
