#!/usr/bin/env bash
set -Eeuo pipefail

# Usage:
#   ./dump-chia-local.sh
#   DATABASE_URL='postgresql://user:password@host:port/database' ./dump-chia-local.sh [output_directory]
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
#   DUMP_PREFIX       Output filename prefix

# shellcheck source=lib/load-db-env.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/load-db-env.sh"

OUTPUT_DIR="${1:-$HOME/Desktop}"
POSTGRES_BIN_DIR="${POSTGRES_BIN_DIR:-/opt/homebrew/opt/postgresql@18/bin}"
DUMP_PREFIX="${DUMP_PREFIX:-chia-local}"

PSQL="$POSTGRES_BIN_DIR/psql"
PG_DUMP="$POSTGRES_BIN_DIR/pg_dump"

for executable in "$PSQL" "$PG_DUMP"; do
  if [[ ! -x "$executable" ]]; then
    printf 'Error: executable not found: %s\n' "$executable" >&2
    exit 1
  fi
done

mkdir -p "$OUTPUT_DIR"

printf 'Checking source database...\n'
DB_INFO="$($PSQL "$DATABASE_URL" --no-password -v ON_ERROR_STOP=1 -Atc \
  "SELECT current_database() || ' (' || pg_size_pretty(pg_database_size(current_database())) || ')';")"
printf 'Source: %s\n' "$DB_INFO"

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
OUTPUT_FILE="$OUTPUT_DIR/$DUMP_PREFIX-$TIMESTAMP.sql"
PARTIAL_FILE="$OUTPUT_FILE.partial"

cleanup() {
  rm -f "$PARTIAL_FILE"
}
trap cleanup EXIT

printf 'Dumping to: %s\n' "$OUTPUT_FILE"
"$PG_DUMP" "$DATABASE_URL" \
  --no-password \
  --exclude-schema=paradedb \
  --exclude-schema=pgivm \
  --exclude-schema=tiger \
  --exclude-schema=topology \
  --file "$PARTIAL_FILE"

if [[ ! -s "$PARTIAL_FILE" ]]; then
  printf 'Error: dump file is empty.\n' >&2
  exit 1
fi

if ! grep -q -- '-- PostgreSQL database dump complete' "$PARTIAL_FILE"; then
  printf 'Error: completion marker is missing from dump.\n' >&2
  exit 1
fi

mv "$PARTIAL_FILE" "$OUTPUT_FILE"
trap - EXIT

FILE_SIZE="$(stat -f '%z' "$OUTPUT_FILE")"
printf 'Dump complete.\n'
printf 'File: %s\n' "$OUTPUT_FILE"
printf 'Size: %s bytes\n' "$FILE_SIZE"
