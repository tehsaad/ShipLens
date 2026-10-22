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
- [~] Multi-stage `Dockerfile` (non-root user, health check, pinned base image). Build steps
  verified in a clean clone; `docker build` itself not yet run (no Docker access)
- [~] `.github/workflows/ci.yml` (validate, generate, format, lint, typecheck, build). Schema
  validated and every step passes in a clean clone; not yet run on GitHub (not pushed)
- [x] README, MIT LICENSE kept

## Phase 1: Data and access

- [ ] Full Prisma schema from section 5, plus decisions 4, 5, 6 and 7 / amendment A1
- [ ] Migrations, enums, 7-day lock trigger (with decision 8 insert check and A1 rules)
- [ ] AuditLog append-only privileges
- [ ] Idempotent seed (section 10; decisions 5a and 11)
- [ ] Auth.js credentials login, Argon2id, lockout, session rotation, forced password change
- [ ] `lib/permissions.ts` matrix (decisions 2 and 3) and audit service
- [ ] Permission matrix test and lock-trigger integration test

## Phase 2: Branches and members

- [ ] Branch codes and lifecycle, application form and review, members, teams, collections

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

- `GET /api/health` uses the constant query `SELECT 1` through Prisma's tagged-template
  `$queryRaw`. It takes no input, so it carries no injection risk, but it is raw SQL outside
  migrations, which section 8 (A03) otherwise rules out. It is the only such query.
