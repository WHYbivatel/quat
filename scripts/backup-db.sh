#!/usr/bin/env bash
# Create a Postgres dump for QuatHub.
# Usage: ./scripts/backup-db.sh [outfile]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi
: "${DATABASE_URL:?DATABASE_URL required}"
# pg_dump rejects Prisma-specific ?schema=
PG_URL="${DATABASE_URL%%\?*}"
OUT="${1:-./.data/backups/quathub-$(date -u +%Y%m%dT%H%M%SZ).dump}"
mkdir -p "$(dirname "$OUT")"
pg_dump --format=custom --no-owner --no-acl "$PG_URL" --file="$OUT"
echo "backup written: $OUT"
