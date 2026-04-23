#!/usr/bin/env bash
# Deploy flashduration to the VPS.
#
# Usage (from apps/flashduration/):
#   ./scripts/deploy.sh              # push current branch and deploy
#   ./scripts/deploy.sh --skip-push  # skip git push (already pushed)
#
# Assumes:
#   - SSH alias `vps` is defined in ~/.ssh/config and authenticates
#   - first-run-setup.sh has been run at least once (repo cloned, .env.local
#     present, dependencies installed, pm2 process registered)

set -euo pipefail

REMOTE_HOST="${FLASHDURATION_HOST:-vps}"
REMOTE_DIR="${FLASHDURATION_DIR:-/home/bgatebvps/flashduration.bgateb.com}"
REMOTE_BRANCH="${FLASHDURATION_BRANCH:-main}"
PM2_APP_NAME="${FLASHDURATION_PM2_NAME:-flashduration}"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
dim()  { printf "\033[2m%s\033[0m\n" "$*"; }

if [[ "${1:-}" != "--skip-push" ]]; then
  bold "→ pushing $REMOTE_BRANCH to origin"
  git push origin "$REMOTE_BRANCH"
else
  dim "→ skipping push (--skip-push)"
fi

bold "→ deploying to $REMOTE_HOST:$REMOTE_DIR"
ssh "$REMOTE_HOST" bash -s -- "$REMOTE_DIR" "$REMOTE_BRANCH" "$PM2_APP_NAME" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"; REMOTE_BRANCH="$2"; PM2_APP_NAME="$3"

# Prevent git from ever reading stdin — any prompt would eat the heredoc.
export GIT_TERMINAL_PROMPT=0

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

cd "$REMOTE_DIR"

echo "→ git fetch && reset to origin/$REMOTE_BRANCH"
git fetch --prune origin </dev/null
git reset --hard "origin/$REMOTE_BRANCH" </dev/null

echo "→ npm ci (production + dev for build)"
npm ci --no-audit --no-fund </dev/null

echo "→ next build"
NODE_ENV=production npm run build </dev/null

echo "→ pm2 reload"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1 </dev/null; then
  pm2 reload "$PM2_APP_NAME" --update-env </dev/null
else
  pm2 start ecosystem.config.cjs </dev/null
  pm2 save </dev/null
fi

echo "✓ deploy complete"
REMOTE

bold "✓ done"
