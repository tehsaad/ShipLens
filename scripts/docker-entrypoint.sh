#!/bin/sh
# Container start (docs/SPEC.md section 12): apply migrations, optionally load the sample
# data, then hand the process over to the Next.js server. Any failure stops the container,
# so a deploy with a broken migration never starts serving.
set -eu

node scripts/migrate.mjs prisma/migrations

# Section 10 demo data. The seed only creates missing rows, so it is safe on every start.
# Leave SEED_DEMO_PASSWORD unset to skip it (for example once demo accounts are retired).
if [ -n "${SEED_DEMO_PASSWORD:-}" ]; then
  node scripts/seed.mjs
fi

exec node server.js
