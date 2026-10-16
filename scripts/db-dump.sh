#!/usr/bin/env bash
# Snapshots the development database (the Docker Postgres from docker-compose.yml) into
# db-dumps/<date-time>.sql, so a `db:reset` or a bad migration costs nothing: `bun run db:restore`
# loads the newest snapshot back. The folder is git-ignored. An argument names the file instead.
# The dump is written under a .part name and renamed once pg_dump has finished, so a failed dump
# never sits in the folder as the newest snapshot.
set -e
cd "$(dirname "$0")/.."
file="${1:-db-dumps/$(date +%Y-%m-%d_%H-%M-%S).sql}"
mkdir -p "$(dirname "$file")"
trap 'rm -f "$file.part"' EXIT
docker compose up -d --wait >/dev/null
docker compose exec -T db pg_dump -U app -d app --clean --if-exists > "$file.part"
mv "$file.part" "$file"
echo "Dumped the dev database to $file ($(du -h "$file" | cut -f1))"
