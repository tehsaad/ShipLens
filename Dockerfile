# syntax=docker/dockerfile:1

# Multi-stage build for the Next.js standalone server.
# Base image is pinned to an exact Node.js and Alpine release.
ARG NODE_IMAGE=node:24.19.0-alpine3.23

# ---- deps: install locked dependencies --------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# Lifecycle scripts are skipped (no Git hooks in the image); the Prisma client
# is generated explicitly in the build stage.
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---- builder: generate the Prisma client and build the app ------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV HUSKY=0 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build && npm run build:seed

# ---- runner: minimal runtime image, non-root user ---------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs \
    && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Start-up tasks: migrations (plain `pg`, no Prisma CLI) and the bundled seed script. Both
# resolve `pg` and Argon2 from the standalone node_modules copied above.
COPY --from=builder --chown=nextjs:nodejs /app/prisma/migrations ./prisma/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/build/seed.mjs ./scripts/seed.mjs
COPY --from=builder --chown=nextjs:nodejs --chmod=755 /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["./scripts/docker-entrypoint.sh"]
