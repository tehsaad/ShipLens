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
  against a fresh database here, and CI builds the image and starts it against an empty
  database (size checked against 300 MB)
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
- [x] Each screen checked once by hand in a browser against the seeded data (a throwaway
      script; the Playwright suite in the repository is Phase 6)

## Phase 3: Reporting and dashboard

- [x] Weekly report state machine (`lib/rules/report.ts`): draft, submit, return with a
      comment, resubmit, approve; APPROVED terminal and locked
- [x] Draft created when the Branch Lead first opens a week; live totals while DRAFT or
      RETURNED, read in one snapshot; frozen into `totalsSnapshot` on submission
- [x] Optimistic locking on `version`; stale requests and concurrent reviews fail with a
      conflict (integration tests)
- [x] Every transition audited with actor, from-state, to-state, comment and version; the
      report page shows the history from the audit log
- [x] Report screens: week picker, list with filters, totals, notes, submit, review, the
      week's collections
- [x] Dashboard KPIs with the section 7.2 definitions, scoped per role
- [x] 12-month collection line chart and new-member bar chart (Recharts)
- [x] Unrouted list (oldest first, linked) and the overdue-report indicator (decision 9)
- [x] `docs/sample-data-expected.md`, asserted by `tests/integration/sample-data.test.ts` on a
      separately seeded database
- [x] Report cycle and dashboard checked once by hand in a browser for each role

## Phase 4: Public site and content

- [x] next-intl routing under `/en` and `/ur`; every public string and the admin navigation
      labels in `messages/en.json` and `messages/ur.json`; unit test for matching keys,
      placeholders and translated form errors
- [x] Urdu: `dir="rtl"`, logical CSS properties, Noto Nastaliq Urdu, numbers isolated as
      left-to-right inside Urdu text
- [x] Header with language switcher and light/dark theme toggle (no flash on load); footer with
      Privacy and Terms
- [x] Seven pages in both languages: Home, About, Programs, Branches (city filter), Events
      (upcoming/past and branch filters), Get Involved, Contact
- [x] Volunteer application and contact forms: React Hook Form with the same Zod schema as the
      server action, field-level errors in both languages, honeypot, work without JavaScript
- [x] English fallback with a notice when the Urdu version of an entry is missing
- [x] Public pages cached with five-minute revalidation and refreshed on publish (section 9);
      the image still builds without a database
- [x] Content manager: list, create, edit, Markdown preview, publish, unpublish; edits to a
      published entry wait as a pending draft (migration `content_drafts`); slugs unique per
      type and language
- [x] Markdown rendered without raw HTML and sanitised with an allow-list
- [x] Events with English and optional Urdu titles (decision 6); contact messages for Super
      Admin
- [x] Failed admin forms keep what the user typed (React resets forms after an action)
- [x] Integration tests for content, events and contact messages; public pages and forms checked
      once by hand in a browser in both languages

## Phase 5: Exports and hardening

- [x] CSV exports (section 7.3) for collections, members, applications and weekly reports with
      the list's current filters, and the dashboard's full unrouted list. RFC 4180 with a
      UTF-8 BOM, formula-injection guard, a 10,000-row ceiling
- [x] PDFs generated on the server: the approved weekly report (cover, frozen totals,
      collections, review history) and a monthly branch summary
- [x] Every export respects the role's scope (the list and its export share one query
      builder) and writes an EXPORT audit entry with filters and row count; integration tests
      for scope, refusals and audit entries
- [x] Audit log viewer for Super Admin (section 7.2): filters by actor, entity, action and
      date; read-only
- [x] Security headers on every response; a static CSP for the cached public site and a
      per-request nonce CSP for the admin area; no violations in Chromium on the production
      build
- [x] Rate limits: sign-in 10 per 15 minutes, application and contact forms 5 per hour, per
      IP; in-process (single instance)
- [x] Structured JSON logs with request IDs, including every server error (`onRequestError`),
      without messages, stacks or personal data
- [x] `npm audit` in CI (fails on production dependencies), Dependabot for npm, Actions and
      Docker
- [x] OWASP checklist: `docs/security.md`
- [ ] Check on the live service whether Render passes a client-supplied `X-Forwarded-For`
      through (needs the deployment; procedure in `docs/security.md`)

## Phase 6: Testing and deployment

- [ ] Coverage threshold, Playwright, axe, deploy workflow (deployment needs explicit approval)

## Phase 7: Documentation and submission

- [ ] Section 13 documents and the section 14 acceptance checklist

## Notes

- Auth.js v5 (required by section 2) is only published as a beta; `next-auth@5.0.0-beta.32` is
  pinned.
- Admin screens other than the navigation stay in English (section 7.4 names public strings
  and admin navigation labels only).
- Database checks ran against PostgreSQL 16.14 (embedded) locally, and the Docker image has
  not been built here (no Docker access).

- `GET /api/health` uses the constant query `SELECT 1` through Prisma's tagged-template
  `$queryRaw`. It takes no input, so it carries no injection risk, but it is raw SQL outside
  migrations, which section 8 (A03) otherwise rules out. It is the only such query.
