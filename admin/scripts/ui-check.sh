#!/usr/bin/env bash
# Builds the panel and drives it in a real DOM against a throwaway content
# server. Used as the phase gate for every UI change.
set -euo pipefail

PORT="${ADMIN_TEST_PORT:-8795}"
cd "$(dirname "$0")/.."

SMOKE_ENTRY=scripts/appEntry.tsx SMOKE_OUT=app.js \
  npx vite build --config vite.smoke.config.ts >/dev/null

# A server left behind by an interrupted run would answer with the wrong
# working directory, so the port is cleared first.
if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  lsof -ti tcp:"$PORT" | xargs kill 2>/dev/null || true
  while lsof -ti tcp:"$PORT" >/dev/null 2>&1; do sleep 0.3; done
fi

# The check releases a version, so it runs against a throwaway database and a
# throwaway admin directory — never the operator's own. Content comes from the
# committed tree through the server's own importer, pruned to version 1.0.0 of
# every course: the live database accumulates real releases and drafts, while
# the check needs the canonical world it was written against.
workdir="$(mktemp -d)"

# The signs catalogue is still edited in place on disk, and the check saves a
# sign — so it gets a copy of the tree, never the operator's own. Courses are
# read from the committed tree but land in the throwaway database.
mkdir -p "$workdir/content"
cp -R ../server/content/signs "$workdir/content/signs"

# Parsed competitor courses are build output, not working state, so the
# throwaway directory gets a copy of them.
if [ -d ../server/content-admin/competitors ]; then
  cp -R ../server/content-admin/competitors "$workdir/competitors"
fi

# The panel generates courses now, and a generated document carries its artwork
# inline — so the picture library has to be in the asset store before the server
# opens the database (PGlite takes one writer at a time).
(cd ../server && DATABASE_URL="pglite://$workdir/db" \
  npx tsx scripts/upload-skeleton-assets.ts >/dev/null)

(cd ../server && NODE_ENV=development PORT="$PORT" \
  DATABASE_URL="pglite://$workdir/db" UI_CHECK_VERSIONS=1.0.0 \
  STAGING_KEY=ui-check-staging-key \
  CONTENT_DIR="$workdir/content" UI_CHECK_IMPORT_FROM=../server/content \
  ADMIN_DIR="$workdir" \
  npx tsx src/index.ts >/tmp/admin-ui-check.log 2>&1) &
server=$!
trap 'kill $server 2>/dev/null || true; rm -rf "$workdir"' EXIT

until curl -sf "localhost:$PORT/health" >/dev/null 2>&1; do sleep 0.5; done

ADMIN_TEST_PORT="$PORT" node scripts/ui-check.mjs
