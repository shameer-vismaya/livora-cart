-- Livora Cart — Postgres bootstrap for CDC (Debezium) and per-service schemas.
-- Runs once on first container start (docker-entrypoint-initdb.d).

-- wal_level=logical is set via the container command flags; this enforces the
-- replication identity defaults and provisions the Debezium replication role.

-- Replication role used by Debezium to read the WAL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_setting('custom.repl_user', true)) THEN
    -- fallback handled below; see explicit create
    NULL;
  END IF;
END$$;

-- Create the Debezium replication user (idempotent).
-- Values come from POSTGRES_REPL_USER / POSTGRES_REPL_PASSWORD env at init time.
\set repl_user `echo "$POSTGRES_REPL_USER"`
\set repl_password `echo "$POSTGRES_REPL_PASSWORD"`

SELECT format('CREATE ROLE %I WITH REPLICATION LOGIN PASSWORD %L', :'repl_user', :'repl_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'repl_user')
\gexec

-- Allow the replication user to read the public schema (outbox tables live here per service DB).
GRANT USAGE ON SCHEMA public TO :"repl_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO :"repl_user";

-- A dedicated publication for outbox CDC (services add their outbox tables to it,
-- or Debezium manages it when publication.autocreate.mode=filtered).
-- Created empty here; the platform-reference connector (Plan 03) configures specifics.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'livora_outbox') THEN
    EXECUTE 'CREATE PUBLICATION livora_outbox';
  END IF;
END$$;
