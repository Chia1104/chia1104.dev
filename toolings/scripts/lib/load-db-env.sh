#!/usr/bin/env bash
# Shared connection resolution for dump/restore scripts.
# Sourced, not executed.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.global}"

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    key="${line%%=*}"
    value="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    [[ -n "${!key+x}" ]] && continue
    if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "$key=$value"
  done < "$file"
}

load_env_file "$ENV_FILE"

DATABASE_URL="${DATABASE_URL:-${LOCAL_DATABASE_URL:-}}"
if [[ -z "$DATABASE_URL" && -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" && -n "${POSTGRES_DB:-}" ]]; then
  DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-localhost}:${POSTGRES_PORT:-5434}/${POSTGRES_DB}"
fi
if [[ -z "$DATABASE_URL" ]]; then
  printf 'Error: set DATABASE_URL or LOCAL_DATABASE_URL, or POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB.\n' >&2
  exit 1
fi
