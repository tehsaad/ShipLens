# Implementation Checklist

Tracks delivery against `docs/SPEC.md` and the approved decisions in `docs/OPEN-QUESTIONS.md`.
Each phase is built on its own feature branch and merged through a pull request with green CI.

Legend: `[x]` done and verified locally, `[~]` done but not fully verifiable here, `[ ]` not started.

## Phase 0: Foundation (`feature/phase-0-foundation`)

- [x] Recovered `docs/SPEC.md` committed unchanged (`d6ad7fe`); amendment A1 appended separately
      (`39f1b88`, 15 added lines, lines 1–285 unchanged)
- [x] Approved decisions recorded in `docs/OPEN-QUESTIONS.md`
- [x] Landing page moved to `docs/design/landing-reference/` as a pure rename (decision 1)
- [x] Next.js 16 App Router, strict TypeScript, standalone output
- [x] Tailwind CSS v4 and shadcn/ui (Radix base, RTL enabled); no application screens
- [x] Prisma 7 for PostgreSQL 16 (driver adapter, generated client git-ignored)
- [x] `docker-compose.yml`: PostgreSQL 16 with health check and named volume; optional `app`
      profile (decision 10)
- [x] `.env.example` with placeholders only; `.env` files git-ignored
- [x] ESLint, Prettier (spec and landing reference excluded), Husky, lint-staged, commitlint
- [x] `GET /api/health`: 200 when the database answers, 503 when it does not, bounded to 3 s,
      `Cache-Control: no-store`, generic body, shared Prisma client
- [~] Multi-stage `Dockerfile` (non-root user, health check, pinned base image). The runtime
  contents (standalone server, migrations, bundled seed, entrypoint) were assembled and started
  against a fresh database here; `docker build` itself not yet run (no Docker access)
- [x] `.github/workflows/ci.yml` (validate, generate, format, lint, typecheck, tests, build),
      green on GitHub since run 7
- [x] README, MIT LICENSE kept

## Phase 1: Data and access (`feature/phase-1-data-access`)

- [x] Full Prisma schema from section 5, plus decisions 4, 5, 6 and 7 / amendment A1;
      database-generated `MEM-######` member codes; section 9 indexes
- [x] Migrations with check constraints and triggers: 7-day lock (routing-only updates allowed),
      approved-week inserts (decision 8, Monday/Sunday boundaries and concurrent approval),
      correction limits (A1, including concurrent corrections), closed branches, approved
      report lock, no collection deletion
- [x] Append-only audit log: trigger for every role, plus a `shiplens_app` role with only
      SELECT and INSERT on `audit_logs` (tested as that role)
- [x] Idempotent, deterministic seed (section 10; decisions 5a and 11), tested by seeding twice
- [x] Auth.js credentials login, Argon2id, 5-attempt / 15-minute lockout, generic errors,
      new token on sign-in, 8-hour idle expiry, forced first-login password change enforced on
      the server, account status re-checked on every request
- [x] `lib/permissions.ts` matrix (decisions 2 and 3) and the audit service
- [x] Permission matrix unit test (321 cases) and database-rule integration tests
- [x] Verified end to end on the production standalone build: each of the five demo roles
      signs in over HTTP; the forced password change, deactivation and sign-out work; the
      login and change-password forms work in a browser
- [x] CI runs unit and integration tests against a PostgreSQL 16 service container, green on
      GitHub

## Deployment groundwork (section 12, ahead of Phase 6)

- [x] Migrations run at container start (`scripts/migrate.mjs`, Prisma-compatible history,
      advisory lock); the image stays without the 250 MB Prisma CLI
- [x] Sample data loads at container start when `SEED_DEMO_PASSWORD` is set, so the live link
      has the five demo logins; `render.yaml` asks for the value in the dashboard
- [ ] Render Blueprint applied by the project owner (needs the Render dashboard); deploy hook
      workflow on `main` is Phase 6

## Phase 2: Branches and members

- [x] Branch codes `BR-<CITY3>-<NNN>` generated in a transaction with retry; lifecycle
      FORMING -> ACTIVE <-> PAUSED, ACTIVE/PAUSED -> CLOSED; branch screens (Super Admin)
- [x] User management (section 7.2 Users; no phase listed it, and branch leads need it):
      create with a forced password change, edit, deactivate, reset password
- [x] Public volunteer form (`/get-involved`, English until Phase 4) with the shared Zod schema,
      honeypot and one open application per email; HR list, filters, detail, accept and decline
- [x] Accept runs in one transaction: member with a database `MEM-######` code, both links,
      audit entries; concurrent decisions cannot both succeed (integration test)
- [x] Members: search, filters, paging, decision 3 field split, branch moves (Super Admin)
- [x] Teams: create, rename, add and remove members of the same branch
- [x] Collections: entry, lock indicator, edits only while unlocked, corrections (A1),
      approved-week rejection (decision 8), finance routing, list filters
- [x] Every rule checked in the service layer before the database trigger; every write audited
- [x] Pages answer 403 for a role without access and 404 for another branch's records
- [x] Unit tests (lifecycle, codes, money, collection rules) and integration tests for each
      service, including IDOR checks for members, teams and collections
- [x] Each screen checked in a browser against the seeded data (Playwright script, not yet in CI)

## Phase 3: Reporting and dashboard

- [ ] Weekly report state machine, dashboard KPIs, unrouted list, overdue indicator (decision 9)

## Phase 4: Public site and content

- [ ] Seven public pages in en and ur, content manager, events (decision 6)

## Phase 5: Exports and hardening

- [ ] CSV and PDF exports, rate limiting, security headers, OWASP checklist

## Phase 6: Testing and deployment

- [ ] Coverage threshold, Playwright, axe, deploy workflow (deployment needs explicit approval)

## Phase 7: Documentation and submission

- [ ] Section 13 documents and the section 14 acceptance checklist

## Notes

- Auth.js v5 (required by section 2) is only published as a beta; `next-auth@5.0.0-beta.32` is
  pinned.
- Phase 1 admin screens (sign-in, change password) use English text; moving admin labels into
  `messages/en.json` and `messages/ur.json` (section 7.4) is part of Phase 4.
- Login rate limiting (section 8) is part of Phase 5; the lockout is already in place. The same
  applies to the application form's 5-per-hour limit; it has its honeypot already.
- The public application form uses `useActionState` with server-side Zod errors, like the
  Phase 1 forms. React Hook Form and the Urdu translation arrive with the public site in
  Phase 4, which also moves `/get-involved` to cached rendering.
- Database checks ran against PostgreSQL 16.14 (embedded) locally, and the Docker image has
  not been built here (no Docker access).

- `GET /api/health` uses the constant query `SELECT 1` through Prisma's tagged-template
  `$queryRaw`. It takes no input, so it carries no injection risk, but it is raw SQL outside
  migrations, which section 8 (A03) otherwise rules out. It is the only such query.
