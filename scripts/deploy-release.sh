#!/usr/bin/env bash
# Release deploy for VPS (not in-place git pull as the primary model).
# Usage:
#   APP_ROOT=/var/www/quat.esl.kz REPO=... BRANCH=main ./scripts/deploy-release.sh
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/quat.esl.kz}"
RELEASES="${APP_ROOT}/releases"
SHARED="${APP_ROOT}/shared"
REPO="${REPO:-https://github.com/WHYbivatel/quat.git}"
BRANCH="${BRANCH:-main}"
SERVICE="${SERVICE:-quat.esl.kz}"
KEEP="${KEEP:-5}"

ts="$(date -u +%Y%m%d%H%M%S)"
sha="$(git ls-remote "$REPO" "refs/heads/$BRANCH" | awk '{print substr($1,1,12)}')"
rel="${RELEASES}/${ts}-${sha}"
deployment_id="${sha}-${ts}"

mkdir -p "$RELEASES" "$SHARED"
git clone --depth 1 --branch "$BRANCH" "$REPO" "$rel"
cd "$rel"

ln -sfn "$SHARED/.env" .env
export GIT_SHA="$(git rev-parse HEAD)"
export DEPLOYMENT_ID="$deployment_id"
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile
pnpm exec prisma migrate deploy
pnpm build

# Point current symlink only after ready
ln -sfn "$rel" "${APP_ROOT}/current"
# If systemd WorkingDirectory is APP_ROOT (legacy), sync or point service to current
if [[ -f /etc/systemd/system/${SERVICE}.service ]]; then
  systemctl restart "$SERVICE"
fi

# Health: expect DEPLOYMENT_ID
for i in $(seq 1 30); do
  body="$(curl -fsS http://127.0.0.1:35305/api/health/ready || true)"
  if echo "$body" | grep -q "$deployment_id"; then
    echo "ready: $deployment_id"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "healthcheck failed; rollback symlink manually to previous release" >&2
    exit 1
  fi
  sleep 2
done

# Prune old releases
ls -1dt "$RELEASES"/* | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "deployed $deployment_id"
