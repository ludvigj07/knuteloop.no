#!/usr/bin/env bash
# Pull-deploy av Knuteloop på Hetzner.
#
# Bruk:
#   sudo -u knuteloop /opt/knuteloop/deploy.sh              # deployer main
#   sudo -u knuteloop /opt/knuteloop/deploy.sh release-candidate
#
# Krever:
#   - knuteloop-brukeren har SSH-deploy-key (eller repo er offentlig)
#   - NOPASSWD sudoers-regel for `systemctl restart knuteloop`
#
# Se deploy/README.md for engangs-oppsett.

set -euo pipefail

BRANCH="${1:-main}"
APP_ROOT=/opt/knuteloop
REPO_URL="${KNUTELOOP_REPO:-git@github.com:ingvejohnsen-git/knuteloop.no.git}"
STAMP=$(date +%Y-%m-%d-%H%M%S)
RELEASE="$APP_ROOT/releases/$STAMP"
KEEP_RELEASES=5

if [[ $(whoami) != "knuteloop" ]]; then
	echo "ERROR: Kjør som knuteloop-brukeren:"
	echo "  sudo -u knuteloop $0 $*"
	exit 1
fi

echo "[deploy] branch=$BRANCH  stamp=$STAMP"
echo "[deploy] repo=$REPO_URL"

# 1. Clone ny release
echo "[deploy] Cloning..."
git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$RELEASE"

cd "$RELEASE"
HEAD_SHA=$(git rev-parse --short HEAD)
echo "[deploy] HEAD=$HEAD_SHA"

# 2. Bygg frontend (trenger dev-deps)
echo "[deploy] npm ci (full)..."
npm ci --no-audit --no-fund

echo "[deploy] npm run build..."
npm run build

# 3. Slank til kun prod-deps for runtime
echo "[deploy] Slanker node_modules til prod-deps..."
rm -rf node_modules
npm ci --omit=dev --no-audit --no-fund

# 4. Symlinker til persistent state
echo "[deploy] Symlinker data/ og uploads/..."
mkdir -p backend/data
rmdir backend/uploads 2>/dev/null || true

ln -sf "$APP_ROOT/data/app-db.json"       backend/data/app-db.json
ln -sf "$APP_ROOT/data/auth.sqlite"       backend/data/auth.sqlite
ln -sf "$APP_ROOT/data/auth.sqlite-wal"   backend/data/auth.sqlite-wal
ln -sf "$APP_ROOT/data/auth.sqlite-shm"   backend/data/auth.sqlite-shm
ln -sfn "$APP_ROOT/data/uploads"          backend/uploads

# 5. Infrastruktur-endringer flagges, men byttes ikke ut automatisk
if [[ -f /etc/caddy/Caddyfile ]] && ! diff -q "$RELEASE/deploy/Caddyfile" /etc/caddy/Caddyfile >/dev/null 2>&1; then
	echo "[deploy] WARN: Caddyfile i releasen avviker fra /etc/caddy/Caddyfile."
	echo "         Bytt manuelt om endringen er ønsket:"
	echo "           sudo cp $RELEASE/deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy"
fi
if [[ -f /etc/systemd/system/knuteloop.service ]] && ! diff -q "$RELEASE/deploy/knuteloop.service" /etc/systemd/system/knuteloop.service >/dev/null 2>&1; then
	echo "[deploy] WARN: knuteloop.service i releasen avviker fra /etc/systemd/system/knuteloop.service."
	echo "         Bytt manuelt om endringen er ønsket:"
	echo "           sudo cp $RELEASE/deploy/knuteloop.service /etc/systemd/system/ && sudo systemctl daemon-reload"
fi

# 6. Bytt aktiv release (atomisk via ln -sfn)
echo "[deploy] Bytter current → $STAMP"
ln -sfn "$RELEASE" "$APP_ROOT/current"

# 7. Restart Node (NOPASSWD-regelen dekker kun denne kommandoen)
echo "[deploy] Restarter knuteloop.service..."
sudo systemctl restart knuteloop

# 8. Prune gamle releases (behold KEEP_RELEASES nyeste)
cd "$APP_ROOT/releases"
OLD=$(ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) || true)
if [[ -n "$OLD" ]]; then
	echo "[deploy] Rydder gamle releases:"
	echo "$OLD" | sed 's/^/  /'
	echo "$OLD" | xargs -r rm -rf
fi

# 9. Helsesjekk
echo "[deploy] Helsesjekk..."
sleep 2
if curl -sfo /dev/null http://127.0.0.1:3001/api/health; then
	echo "[deploy] OK — $HEAD_SHA er live."
else
	echo "[deploy] FEIL: /api/health svarer ikke. Sjekk: journalctl -u knuteloop -n 50"
	exit 1
fi
