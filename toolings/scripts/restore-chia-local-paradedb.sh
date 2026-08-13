#!/usr/bin/env bash
set -Eeuo pipefail

# Usage:
#   ./restore-chia-local-paradedb.sh /path/to/dump.sql
#   DATABASE_URL='postgresql://user:password@host:port/database' \
#     ./restore-chia-local-paradedb.sh /path/to/dump.sql
#
# Connection is resolved in this order:
#   1. DATABASE_URL
#   2. LOCAL_DATABASE_URL
#   3. postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB
#
# Optional environment variables:
#   ENV_FILE          dotenv file to load (default: <repo>/.env.global)
#   POSTGRES_HOST     default localhost
#   POSTGRES_PORT     default 5434
#   POSTGRES_BIN_DIR  PostgreSQL bin directory
#
# Safety: restore only proceeds when the target contains zero application-owned
# tables. Tables owned by ParadeDB/PostGIS extensions are allowed.

if [[ $# -ne 1 ]]; then
  printf 'Usage: %s /path/to/dump.sql\n' "$0" >&2
  exit 2
fi

DUMP_FILE="$1"

# shellcheck source=lib/load-db-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/load-db-env.sh"

POSTGRES_BIN_DIR="${POSTGRES_BIN_DIR:-/opt/homebrew/opt/postgresql@18/bin}"
PSQL="$POSTGRES_BIN_DIR/psql"

if [[ ! -x "$PSQL" ]]; then
  printf 'Error: executable not found: %s\n' "$PSQL" >&2
  exit 1
fi

if [[ ! -s "$DUMP_FILE" ]]; then
  printf 'Error: dump file does not exist or is empty: %s\n' "$DUMP_FILE" >&2
  exit 1
fi

if ! grep -q -- '-- PostgreSQL database dump complete' "$DUMP_FILE"; then
  printf 'Error: file does not look like a complete plain-text PostgreSQL dump: %s\n' "$DUMP_FILE" >&2
  exit 1
fi

printf 'Checking target database...\n'
DB_INFO="$($PSQL "$DATABASE_URL" --no-password -v ON_ERROR_STOP=1 -Atc \
  "SELECT current_database() || ' on ' || inet_server_addr() || ':' || inet_server_port();")"
printf 'Target: %s\n' "$DB_INFO"

APPLICATION_TABLES="$($PSQL "$DATABASE_URL" --no-password -v ON_ERROR_STOP=1 -Atc "
WITH tables AS (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
), extension_objects AS (
  SELECT d.objid
  FROM pg_depend d
  WHERE d.deptype = 'e'
    AND d.classid = 'pg_class'::regclass
)
SELECT count(*)
FROM tables t
LEFT JOIN extension_objects e ON e.objid = t.oid
WHERE e.objid IS NULL;")"

if [[ "$APPLICATION_TABLES" != "0" ]]; then
  printf 'Error: target contains %s application-owned table(s). Restore aborted to prevent overwriting or conflicts.\n' "$APPLICATION_TABLES" >&2
  printf 'Use a fresh ParadeDB database, then run this script again.\n' >&2
  exit 1
fi

printf 'Ensuring ParadeDB extensions exist...\n'
"$PSQL" "$DATABASE_URL" --no-password -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS pg_search; CREATE EXTENSION IF NOT EXISTS vector;" \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_search', 'vector') ORDER BY extname;"

printf 'Restoring: %s\n' "$DUMP_FILE"
"$PSQL" "$DATABASE_URL" --no-password -v ON_ERROR_STOP=1 -f "$DUMP_FILE"

printf 'Verifying restore...\n'
"$PSQL" "$DATABASE_URL" --no-password -v ON_ERROR_STOP=1 -P pager=off -c "
WITH tables AS (
  SELECT c.oid
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
), extension_objects AS (
  SELECT d.objid
  FROM pg_depend d
  WHERE d.deptype = 'e'
    AND d.classid = 'pg_class'::regclass
)
SELECT count(*) FILTER (WHERE e.objid IS NULL) AS application_tables,
       count(*) FILTER (WHERE e.objid IS NOT NULL) AS extension_tables
FROM tables t
LEFT JOIN extension_objects e ON e.objid = t.oid;

SELECT count(*) AS invalid_indexes FROM pg_index WHERE NOT indisvalid;
SELECT count(*) AS unvalidated_constraints FROM pg_constraint WHERE NOT convalidated;
"

printf 'Restore complete.\n'
