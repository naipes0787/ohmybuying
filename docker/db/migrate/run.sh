#!/usr/bin/env sh
set -eu

# Wait until GoTrue has migrated auth.users (the schema we depend on for FKs).
echo "[migrate] waiting for auth.users to exist..."
until psql "$DATABASE_URL" -tAc \
  "select 1 from information_schema.tables where table_schema='auth' and table_name='users'" \
  | grep -q 1; do
  sleep 1
done
echo "[migrate] auth.users found."

echo "[migrate] applying ohmybuying schema..."
psql "$DATABASE_URL" \
  --set ON_ERROR_STOP=on \
  --single-transaction \
  -f /sql/schema.sql

echo "[migrate] done."
