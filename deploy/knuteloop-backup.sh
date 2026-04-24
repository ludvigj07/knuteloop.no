#!/usr/bin/env bash
# Daglig backup av app-db.json og auth.sqlite.
# Kjøres av /etc/cron.d/knuteloop-backup, som knuteloop-bruker.

set -euo pipefail

DATA=/opt/knuteloop/data
BACKUPS=/opt/knuteloop/backups
STAMP=$(date +%Y%m%d-%H%M%S)
RETAIN_DAYS=14

mkdir -p "$BACKUPS"

# app-db.json — rask, små megabyte
cp -p "$DATA/app-db.json" "$BACKUPS/app-db-$STAMP.json"

# auth.sqlite — bruk SQLite's .backup-kommando for trygg hot-copy
# (alternativt sqlite3-cli, men vi har allerede better-sqlite3 via npm)
if command -v sqlite3 >/dev/null 2>&1; then
	sqlite3 "$DATA/auth.sqlite" ".backup '$BACKUPS/auth-$STAMP.sqlite'"
else
	# Fallback: vanlig cp (kan være inkonsistent hvis noen skriver samtidig,
	# men auth-basen skrives sjelden)
	cp -p "$DATA/auth.sqlite" "$BACKUPS/auth-$STAMP.sqlite"
fi

# Rydd opp gamle backups
find "$BACKUPS" -name 'app-db-*.json' -mtime +$RETAIN_DAYS -delete
find "$BACKUPS" -name 'auth-*.sqlite' -mtime +$RETAIN_DAYS -delete

echo "[backup] $STAMP OK"
