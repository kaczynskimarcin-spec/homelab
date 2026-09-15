#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

backup_dir="/home/m/backups/postgres"
mkdir -p "$backup_dir"

backup_tmp=$(mktemp "$backup_dir/homelab-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.partial")
backup_final="${backup_tmp%.partial}.dump"

trap 'rm -f -- "$backup_tmp"' EXIT
trap 'echo "BŁĄD: backup PostgreSQL nie został ukończony." >&2' ERR

docker exec homelab-postgres \
  pg_dump -U homelab -d homelab -Fc > "$backup_tmp"

test -s "$backup_tmp"

docker exec -i homelab-postgres \
  pg_restore --list < "$backup_tmp" > /dev/null

mv -- "$backup_tmp" "$backup_final"

echo "OK: zapisano backup $backup_final"
