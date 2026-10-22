# Branch-to-Head-Office Management Platform

A web platform that will connect volunteer branches to head office and run the organisation's
public website, replacing spreadsheet and WhatsApp reporting with approved, auditable records.
The full product specification is in [`docs/SPEC.md`](docs/SPEC.md), with approved decisions in
[`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md).

## Status

**Phase 0 (foundation) only.** The repository contains the project tooling, the database
connection and a health endpoint. No application features (login, roles, branches, members,
collections, reports, public pages) are implemented yet.

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
npm run dev               # http://localhost:3000
```

### Environment variables

| Variable            | Used by          | Description                                             |
| ------------------- | ---------------- | ------------------------------------------------------- |
| `DATABASE_URL`      | App, Prisma      | PostgreSQL connection string                            |
| `POSTGRES_USER`     | `docker compose` | Database user for the local container                   |
| `POSTGRES_PASSWORD` | `docker compose` | Database password for the local container               |
| `POSTGRES_DB`       | `docker compose` | Database name for the local container                   |
| `POSTGRES_PORT`     | `docker compose` | Host port for PostgreSQL, bound to `127.0.0.1` (`5432`) |
| `APP_PORT`          | `docker compose` | Host port for the optional app container (`3000`)       |

`.env.example` contains placeholders only. Never commit `.env`. The server validates
`DATABASE_URL` when it first connects.

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

| Script                 | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Generate the Prisma client and start the dev server |
| `npm run build`        | Generate the Prisma client and build for production |
| `npm run start`        | Start the production server after a build           |
| `npm run lint`         | ESLint (fails on warnings)                          |
| `npm run lint:fix`     | ESLint with automatic fixes                         |
| `npm run typecheck`    | Generate route types and run `tsc --noEmit`         |
| `npm run format`       | Format files with Prettier                          |
| `npm run format:check` | Check formatting                                    |
| `npm run db:validate`  | Validate the Prisma schema                          |
| `npm run db:generate`  | Generate the Prisma client                          |
| `npm run db:format`    | Format the Prisma schema                            |
| `npm run db:migrate`   | Create and apply a migration in development         |
| `npm run db:deploy`    | Apply pending migrations                            |
| `npm run db:studio`    | Open Prisma Studio                                  |
| `npm run db:up`        | Start the PostgreSQL container                      |
| `npm run db:down`      | Stop the Docker Compose services                    |

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
docker run --rm -p 3000:3000 -e DATABASE_URL="postgresql://..." shiplens
```

The image is a multi-stage build of the Next.js standalone output and runs as a non-root user.

## History

This repository first held a static bilingual (English and Urdu) volunteer landing page, added
in pull request #1. It is preserved, with its Git history, in
[`docs/design/landing-reference/`](docs/design/landing-reference/) as a design reference.

## License

[MIT](LICENSE)
