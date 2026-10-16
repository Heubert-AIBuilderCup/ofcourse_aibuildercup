#!/usr/bin/env bash
# Loads a snapshot made by db-dump.sh back into the development database: the newest file in
# db-dumps/ or the one given as an argument. Everything in the database is replaced by the
# snapshot, migration history included, so migrations added since the dump run on the next
# `bun run dev`. A table a later migration added that references a dumped one makes the drop
# fail and the whole restore roll back (one transaction, nothing lost): run `db:reset` first in
# that case. Not for the Docker volume's absence: run it after `db:reset` or `db:up`.
set -e
cd "$(dirname "$0")/.."
file="${1:-$(ls -1 db-dumps/*.sql 2>/dev/null | sort | tail -n 1)}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "No snapshot to restore: run \`bun run db:dump\` first, or name a file." >&2
  exit 1
fi
docker compose up -d --wait >/dev/null
docker compose exec -T db psql -U app -d app -q -v ON_ERROR_STOP=1 --single-transaction < "$file" >/dev/null
echo "Restored the dev database from $file"
