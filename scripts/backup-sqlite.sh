#!/usr/bin/env bash
# Daily SQLite backup for Supermanager Balaguer.
# Copies data/supermanager.db → data/backups/supermanager-YYYYMMDD.db and
# prunes backups older than RETENTION_DAYS (default 14).
set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/ebernat/supermanager}"
DATA_DIR="${DATA_DIR:-$APP_ROOT/data}"
DB_PATH="${DB_PATH:-$DATA_DIR/supermanager.db}"
BACKUP_DIR="${BACKUP_DIR:-$DATA_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
LOG_PATH="${SQLITE_BACKUP_LOG:-/var/log/supermanager-db-backup.log}"

mkdir -p "$BACKUP_DIR"
stamp="$(date -u +%Y%m%d)"
dest="$BACKUP_DIR/supermanager-${stamp}.db"

{
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] start backup → $dest"
  if [[ ! -f "$DB_PATH" ]]; then
    echo "ERROR: missing database $DB_PATH" >&2
    exit 1
  fi
  # Prefer sqlite3 online backup when available (safe with WAL).
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$dest'"
  else
    cp -a "$DB_PATH" "$dest"
    # Best-effort WAL companion copy (ignore if absent).
    [[ -f "${DB_PATH}-wal" ]] && cp -a "${DB_PATH}-wal" "${dest}-wal" || true
    [[ -f "${DB_PATH}-shm" ]] && cp -a "${DB_PATH}-shm" "${dest}-shm" || true
  fi
  chmod 600 "$dest" 2>/dev/null || true
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'supermanager-*.db' -mtime +"${RETENTION_DAYS}" -print -delete
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ok size=$(wc -c < "$dest") retention=${RETENTION_DAYS}d"
} >>"$LOG_PATH" 2>&1
