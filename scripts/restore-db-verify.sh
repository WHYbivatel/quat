#!/usr/bin/env bash
# Restore a dump into a separate database and verify migrate + SELECT 1.
# Usage: ./scripts/restore-db-verify.sh path/to.dump [target_db_name]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DUMP="${1:?dump path required}"
TARGET_DB="${2:-quathub_restore_verify}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL required}"

PG_URL="${DATABASE_URL%%\?*}"
BASE_URL="${PG_URL%/*}"
TARGET_URL="${BASE_URL}/${TARGET_DB}"
TARGET_PRISMA="${TARGET_URL}?schema=public"

psql "${BASE_URL}/postgres" -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${TARGET_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
psql "${BASE_URL}/postgres" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";"
psql "${BASE_URL}/postgres" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${TARGET_DB}\";"

pg_restore --no-owner --no-acl --dbname="$TARGET_URL" "$DUMP"
DATABASE_URL="$TARGET_PRISMA" pnpm exec prisma migrate status
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -c "SELECT COUNT(*) AS orgs FROM organizations;"
echo "restore verify OK → $TARGET_DB"
