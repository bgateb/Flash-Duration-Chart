#!/usr/bin/env bash
# First-run VPS setup for flashduration.
#
# Run this once, after:
#   - the GitHub repo exists (private)
#   - you've added a deploy key to the repo (this script generates and prints it)
#   - .env.local is filled in on the VPS (this script creates the stub)
#
# Usage (from apps/flashduration/ on your Mac):
#   FLASHDURATION_REPO=git@github.com:<you>/<repo>.git ./scripts/first-run-setup.sh
#
# The script is idempotent — rerun it as many times as needed.

set -euo pipefail

REMOTE_HOST="${FLASHDURATION_HOST:-vps}"
REMOTE_DIR="${FLASHDURATION_DIR:-/home/bgatebvps/flashduration.bgateb.com}"
REPO_URL="${FLASHDURATION_REPO:-}"
REMOTE_BRANCH="${FLASHDURATION_BRANCH:-main}"
PM2_APP_NAME="${FLASHDURATION_PM2_NAME:-flashduration}"

if [[ -z "$REPO_URL" ]]; then
  echo "Set FLASHDURATION_REPO to your GitHub repo SSH URL, e.g.:" >&2
  echo "  FLASHDURATION_REPO=git@github.com:bgateb/flashduration.git $0" >&2
  exit 1
fi

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
bold "→ first-run setup on $REMOTE_HOST:$REMOTE_DIR ← $REPO_URL"

ssh "$REMOTE_HOST" bash -s -- "$REMOTE_DIR" "$REMOTE_BRANCH" "$REPO_URL" "$PM2_APP_NAME" <<'REMOTE'
set -euo pipefail
REMOTE_DIR="$1"; REMOTE_BRANCH="$2"; REPO_URL="$3"; PM2_APP_NAME="$4"

# Git must never read stdin — any prompt would silently eat the rest of this
# heredoc (ssh and git both default to inheriting parent stdin).
export GIT_TERMINAL_PROMPT=0

export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

# ─── 1. Ensure SSH deploy key for GitHub ───────────────────────────────────
KEY_FILE="$HOME/.ssh/github_flashduration_deploy"
if [[ ! -f "$KEY_FILE" ]]; then
  echo "→ generating SSH deploy key at $KEY_FILE"
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
  ssh-keygen -t ed25519 -C "flashduration-deploy@vps" -f "$KEY_FILE" -N ""
fi

# Register the key for github.com via ~/.ssh/config
if ! grep -q "Host github-flashduration" "$HOME/.ssh/config" 2>/dev/null; then
  echo "→ adding github-flashduration host to ~/.ssh/config"
  cat >> "$HOME/.ssh/config" <<SSHCFG

Host github-flashduration
  HostName github.com
  User git
  IdentityFile $KEY_FILE
  IdentitiesOnly yes
SSHCFG
  chmod 600 "$HOME/.ssh/config"
fi

# Rewrite the repo URL to use that host alias
REMOTE_URL="$(echo "$REPO_URL" | sed -E 's|git@github\.com:|git@github-flashduration:|')"

# Trust github.com's host key once (multiple types so the client picks any)
if ! ssh-keygen -F github.com >/dev/null 2>&1; then
  ssh-keyscan -t ed25519,rsa,ecdsa github.com 2>/dev/null >> "$HOME/.ssh/known_hosts" || true
fi

# ─── 2. Verify GitHub access, bail with instructions if missing ────────────
# Use 'ssh -G' to prove the host block resolves; then test auth by attempting
# a harmless git command — it exits 0 when auth+access work, non-zero otherwise.
AUTH_OUT="$(ssh -n -o StrictHostKeyChecking=accept-new -T github-flashduration 2>&1 || true)"
if ! echo "$AUTH_OUT" | grep -q "successfully authenticated"; then
  echo ""
  echo "── ssh debug output ──"
  echo "$AUTH_OUT"
  echo "──────────────────────"
  echo ""
  REPO_OWNER_NAME="$(echo "$REPO_URL" | sed -E 's|.*github\.com[:/](.+)\.git$|\1|')"
  echo "✗ This key is not yet authorized on the GitHub repo."
  echo ""
  echo "  Copy the PUBLIC key below and add it as a Deploy Key on the repo:"
  echo "    https://github.com/${REPO_OWNER_NAME}/settings/keys/new"
  echo "    (Read-only is enough — do NOT check 'Allow write access')"
  echo ""
  echo "  ─── PUBLIC KEY ────────────────────────────────────────────────"
  cat "${KEY_FILE}.pub"
  echo "  ───────────────────────────────────────────────────────────────"
  echo ""
  echo "  Then re-run this setup script."
  exit 1
fi

# ─── 3. Clone (or pull) the repo into the target dir ───────────────────────
# All git commands redirect stdin from /dev/null so they can't accidentally
# drain the outer heredoc.
if [[ -d "$REMOTE_DIR/.git" ]]; then
  echo "→ repo already cloned, pulling"
  cd "$REMOTE_DIR"
  git remote set-url origin "$REMOTE_URL" </dev/null
  git fetch --prune origin </dev/null
  git reset --hard "origin/$REMOTE_BRANCH" </dev/null
else
  echo "→ cloning into $REMOTE_DIR"
  # If the target is the subdomain docroot it may contain only favicons.
  # Move them aside so git clone can use the dir.
  if [[ -d "$REMOTE_DIR" ]] && [[ -n "$(ls -A "$REMOTE_DIR" 2>/dev/null)" ]]; then
    echo "  (target not empty — moving existing files to $REMOTE_DIR/.pre-clone-backup/)"
    mkdir -p "$REMOTE_DIR/.pre-clone-backup"
    find "$REMOTE_DIR" -mindepth 1 -maxdepth 1 \
        ! -name ".pre-clone-backup" \
        -exec mv -t "$REMOTE_DIR/.pre-clone-backup/" {} +
  fi
  mkdir -p "$REMOTE_DIR"
  git clone --branch "$REMOTE_BRANCH" "$REMOTE_URL" "$REMOTE_DIR.tmp.$$" </dev/null
  mv "$REMOTE_DIR.tmp.$$"/.git "$REMOTE_DIR/.git"
  mv "$REMOTE_DIR.tmp.$$"/* "$REMOTE_DIR"/ 2>/dev/null || true
  mv "$REMOTE_DIR.tmp.$$"/.[!.]* "$REMOTE_DIR"/ 2>/dev/null || true
  rmdir "$REMOTE_DIR.tmp.$$" 2>/dev/null || true
  cd "$REMOTE_DIR"
fi

# ─── 4. Ensure .env.local exists ───────────────────────────────────────────
if [[ ! -f .env.local ]]; then
  echo "→ creating .env.local stub (edit this, then re-run the setup)"
  cp .env.local.example .env.local
  chmod 600 .env.local
  echo ""
  echo "✗ .env.local needs to be filled in before we can start the app:"
  echo "    $REMOTE_DIR/.env.local"
  echo "  Fill in MYSQL_* (your DreamHost MySQL DB), ADMIN_PASSWORD, SESSION_SECRET."
  echo "  Then re-run this setup."
  exit 1
fi

# ─── 5. Drop in the Apache .htaccess proxy rules ───────────────────────────
if [[ ! -f .htaccess ]]; then
  echo "→ installing .htaccess (proxies / → 127.0.0.1:3000 + blocks sensitive files)"
  cp vps/htaccess.example .htaccess
fi

# ─── 6. Install deps, build ────────────────────────────────────────────────
echo "→ npm ci"
npm ci --no-audit --no-fund </dev/null

echo "→ next build"
NODE_ENV=production npm run build </dev/null

# ─── 7. Start (or ensure) pm2 process ──────────────────────────────────────
mkdir -p logs
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1 </dev/null; then
  echo "→ pm2: reloading existing '$PM2_APP_NAME' process"
  pm2 reload "$PM2_APP_NAME" --update-env </dev/null
else
  echo "→ pm2: starting '$PM2_APP_NAME' fresh"
  pm2 start ecosystem.config.cjs </dev/null
  pm2 save </dev/null
  echo ""
  echo "  To make pm2 auto-start on reboot, run once manually on the VPS:"
  echo "    pm2 startup"
  echo "  and follow the sudo command it prints."
fi

echo ""
echo "✓ first-run setup complete"
echo ""
echo "REMINDER — apply the MySQL schema once if you haven't yet:"
echo "  mysql -h \$MYSQL_HOST -u \$MYSQL_USER -p \$MYSQL_DATABASE < $REMOTE_DIR/db/schema.sql"
echo ""
echo "The app should now be reachable at http://127.0.0.1:3000 on the VPS."
echo "For the public subdomain to route to it, either:"
echo "  a) the .htaccess proxy rules we just installed work out of the box, or"
echo "  b) enable 'Proxy Server' for flashduration.bgateb.com in the DreamHost panel,"
echo "     pointing at http://127.0.0.1:3000/"
REMOTE

bold "✓ done"
