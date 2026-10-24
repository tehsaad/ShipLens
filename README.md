# Branch-to-Head-Office Management Platform

A web platform that will connect volunteer branches to head office and run the organisation's
public website, replacing spreadsheet and WhatsApp reporting with approved, auditable records.
The full product specification is in [`docs/SPEC.md`](docs/SPEC.md), with approved decisions in
[`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md).

## Status

**Phases 0 to 5.** Implemented so far, live at <https://shiplens.onrender.com>:

- Project tooling, Docker and CI, the health endpoint, and deployment on Render
- The full data model, plus database rules enforced in PostgreSQL: the 7-day collection lock,
  approved-week checks, correction limits, an append-only audit log and a restricted app role
- Staff sign-in with a lockout after failed attempts and a forced first-login password change
- The role permission matrix, the audit service, and the sample-data seed
- Admin screens for branches, users, applications, members, teams, collections, weekly
  reports (with the review cycle), the dashboard, content, events, contact messages and the
  audit log
- The bilingual public site (English and Urdu, right-to-left) with the volunteer and contact
  forms
- CSV and PDF exports scoped by role and audited, security headers with a content security
  policy, rate limits and structured logs (see [`docs/security.md`](docs/security.md))

The end-to-end and accessibility tests, the coverage gate and the remaining documentation come
in later phases (see [`docs/IMPLEMENTATION-CHECKLIST.md`](docs/IMPLEMENTATION-CHECKLIST.md)).

## Stack

Next.js (App Router) with strict TypeScript, Tailwind CSS v4, shadcn/ui, Prisma ORM with
PostgreSQL 16, ESLint, Prettier, Husky, lint-staged and commitlint. See `docs/SPEC.md`
section 2 for the full stack.

## Prerequisites

- Node.js 24 (see `.nvmrc`) and npm
- Docker with Docker Compose, for the local PostgreSQL database

## Local setup

```bash
npm ci
cp .env.example .env      # then replace the placeholder values
docker compose up -d      # starts PostgreSQL 16 (service "db")
npm run db:deploy         # apply migrations
npm run db:seed           # load sample data and demo logins (docs/handover.md)
npm run dev               # http://localhost:3000, staff sign-in at /admin/login
```

### Environment variables

| Variable                   | Used by          | Description                                             |
| -------------------------- | ---------------- | ------------------------------------------------------- |
| `DATABASE_URL`             | App, Prisma      | PostgreSQL connection string                            |
| `DATABASE_MIGRATION_URL`   | Prisma           | Optional owner connection for migrations (see handover) |
| `AUTH_SECRET`              | App              | Session signing key, at least 32 random characters      |
| `AUTH_TRUST_HOST`          | App              | `true` behind a trusted reverse proxy                   |
| `TRUSTED_CLIENT_IP_HEADER` | App              | Header the proxy sets to the client IP (see security)   |
| `TEST_DATABASE_URL`        | Tests            | Disposable database; its name must end in `_test`       |
| `SEED_DEMO_PASSWORD`       | Seed             | Password for every demo login (12+ characters)          |
| `POSTGRES_USER`            | `docker compose` | Database user for the local container                   |
| `POSTGRES_PASSWORD`        | `docker compose` | Database password for the local container               |
| `POSTGRES_DB`              | `docker compose` | Database name for the local container                   |
| `POSTGRES_PORT`            | `docker compose` | Host port for PostgreSQL, bound to `127.0.0.1` (`5432`) |
| `APP_PORT`                 | `docker compose` | Host port for the optional app container (`3000`)       |

`.env.example` contains placeholders only. Never commit `.env`. The server validates
`DATABASE_URL` and `AUTH_SECRET` at startup and exits if either is missing or invalid.

### Database

```bash
docker compose up -d           # start PostgreSQL (data persists in a named volume)
docker compose ps              # "healthy" once pg_isready succeeds
docker compose down            # stop; add -v to also delete the data volume
```

To run the production image together with the database:

```bash
docker compose --profile app up --build
```

## Scripts

| Script                     | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | Generate the Prisma client and start the dev server |
| `npm run build`            | Generate the Prisma client and build for production |
| `npm run start`            | Start the production server after a build           |
| `npm run lint`             | ESLint (fails on warnings)                          |
| `npm run lint:fix`         | ESLint with automatic fixes                         |
| `npm run typecheck`        | Generate route types and run `tsc --noEmit`         |
| `npm run format`           | Format files with Prettier                          |
| `npm run format:check`     | Check formatting                                    |
| `npm run test`             | Run unit and integration tests                      |
| `npm run test:unit`        | Unit tests only                                     |
| `npm run test:integration` | Integration tests against `TEST_DATABASE_URL`       |
| `npm run db:seed`          | Load the sample data (safe to re-run)               |
| `npm run db:validate`      | Validate the Prisma schema                          |
| `npm run db:generate`      | Generate the Prisma client                          |
| `npm run db:format`        | Format the Prisma schema                            |
| `npm run db:migrate`       | Create and apply a migration in development         |
| `npm run db:deploy`        | Apply pending migrations                            |
| `npm run db:studio`        | Open Prisma Studio                                  |
| `npm run db:up`            | Start the PostgreSQL container                      |
| `npm run db:down`          | Stop the Docker Compose services                    |

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/). A pre-commit
hook lints and formats staged files.

## Health endpoint

`GET /api/health` checks the database with a real query (bounded to three seconds) and is never
cached.

| Database  | Status | Body                                   |
| --------- | ------ | -------------------------------------- |
| Reachable | `200`  | `{"status":"ok","database":"up"}`      |
| Down      | `503`  | `{"status":"error","database":"down"}` |

```bash
curl -i http://localhost:3000/api/health
```

The Docker image uses the same endpoint for its container health check.

## Docker

```bash
docker build -t shiplens .
docker run --rm -p 3000:3000 -e DATABASE_URL="postgresql://..." -e AUTH_SECRET="..." -e AUTH_TRUST_HOST=true shiplens
```

The image is a multi-stage build of the Next.js standalone output and runs as a non-root user.

On every start the container:

1. Applies pending migrations from `prisma/migrations` (`scripts/migrate.mjs`). The Prisma CLI
   would add about 250 MB to the image, so the runner applies the same files with `pg` and
   records them in Prisma's `_prisma_migrations` table with Prisma's checksums;
   `prisma migrate status` reads the result normally. It holds an advisory lock, runs each
   migration in a transaction, and stops on an edited or failed migration.
2. Loads the section 10 sample data when `SEED_DEMO_PASSWORD` is set (bundled
   `prisma/seed.ts`; it only creates missing rows).
3. Starts the server. If step 1 or 2 fails, the container exits instead of serving.

## Deployment (Render)

`render.yaml` is a [Render Blueprint](https://render.com/docs/blueprint-spec) for a Docker web
service (`shiplens`) and a managed PostgreSQL 16 database (`shiplens-db`), both in Singapore on
free plans. No secrets are stored in the file: `DATABASE_URL` comes from the database, and
`AUTH_SECRET` is generated by Render.

1. In the Render dashboard, choose **New → Blueprint** and connect `tehsaad/ShipLens`.
2. Select the branch to deploy (the current feature branch until the phases are merged, then
   `main`).
3. Enter a value for `SEED_DEMO_PASSWORD` (at least 12 characters) when Render asks; it is the
   password of every demo login in [docs/handover.md](docs/handover.md).
4. Review the two resources and plans, then **Apply**. Render builds the `Dockerfile`; on start
   the container applies migrations and loads the sample data, and Render waits for
   `GET /api/health` to return 200.
5. Check: `curl -i https://<service>.onrender.com/api/health` returns
   `{"status":"ok","database":"up"}`, then sign in at `/admin/login` with each demo login.

Notes:

- New commits deploy only after the GitHub checks pass (`autoDeployTrigger: checksPass`).
- The database accepts no connections from the internet, only from Render services.
- Free web services sleep when idle, so the first request after a pause is slow, and Render
  limits how long a free database is kept. Check Render's current free-tier terms, or change
  the plans before applying.
- Migrations run when the container starts (section 12), before the server accepts requests.
- The app connects as the database owner on Render. The migration still creates the
  restricted `shiplens_app` role when it is allowed to (see docs/handover.md); the database
  triggers protect the audit log and collection rules either way.

## History

This repository first held a static bilingual (English and Urdu) volunteer landing page, added
in pull request #1. It is preserved, with its Git history, in
[`docs/design/landing-reference/`](docs/design/landing-reference/) as a design reference.

## License

[MIT](LICENSE)
