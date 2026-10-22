# Branch-to-Head-Office Management Platform: Product Specification

## 1. Purpose
One secure web platform that connects volunteer branches to head office and runs the
organisation's public website. It replaces scattered Excel sheets and WhatsApp reporting
with approved, auditable records. No online payments. Languages: English (en) and Urdu
(ur, right-to-left). Timezone for all business dates: Asia/Karachi.

## 2. Stack (fixed; do not change without an ADR in docs/architecture/)
- Next.js App Router, TypeScript (strict), server components and server actions
- PostgreSQL 16 with Prisma ORM and versioned migrations
- Auth.js v5 (credentials provider), Argon2id password hashing
- Zod for all input validation, shared between forms and server actions
- Tailwind CSS v4, shadcn/ui, React Hook Form, TanStack Table, Recharts
- next-intl for en/ur routing and messages
- PDF: @react-pdf/renderer. CSV: built in, RFC 4180 escaping.
- Tests: Vitest (unit, integration, coverage), Playwright (role and workflow tests)
- Quality: ESLint, Prettier, Husky, lint-staged, commitlint
- Delivery: multi-stage Dockerfile (standalone output), docker-compose for local Postgres,
  GitHub Actions, Render web service plus managed PostgreSQL

## 3. Roles (exactly five; each user has exactly one role)
- SUPER_ADMIN: all data and settings; manages users, branches, roles
- FINANCE_REVIEWER: reads all branches' collections and reports; approves or returns
  weekly reports; marks collections as routed to the main account; exports finance data.
  Cannot edit collections or members. Cannot publish content.
- CONTENT_EDITOR: creates, edits and publishes site content and events. No access to
  members, applications, collections or reports.
- BRANCH_LEAD: scoped to exactly one branch (branchId on the user). Manages that branch's
  members and collections; drafts, submits and resubmits that branch's weekly report.
  Cannot see other branches. Cannot approve reports.
- HR_LEAD: views and decides volunteer applications for all branches; creates members from
  accepted applications; changes member status. No finance or report access.
- PUBLIC (no login): reads published content and active branches; submits the volunteer
  application and the contact form.

## 4. Permission model
- One file, lib/permissions.ts, defines a matrix of Action x Role. Every action is named
  (for example branch.create, collection.edit, report.approve, member.read).
- Every server action and route handler calls can(user, action, resource) before doing work.
  Checks run on the server. UI hiding is never the only control.
- Branch scope: for BRANCH_LEAD, any resource with a branchId not equal to the user's branchId
  returns 404 (not 403), to avoid revealing that it exists.
- docs/permissions.md contains the human-readable table, generated from the same matrix.
- Tests: a full role x action matrix test, plus IDOR tests (a branch lead requesting another
  branch's collection, member, or report IDs).

## 5. Data model (PostgreSQL via Prisma)
All tables have id (UUID), createdAt, updatedAt. Money is Decimal(14,2) in PKR.

- User: email (unique, lowercased), name, passwordHash, role (enum), branchId (nullable,
  required when role is BRANCH_LEAD), isActive, failedLoginCount, lockedUntil, locale.
- Branch: code (unique, format BR-<CITY3>-<NNN>, auto-generated), name, city,
  status (FORMING | ACTIVE | PAUSED | CLOSED), leadUserId (nullable), openedAt.
- Team: name, branchId. Unique (branchId, name).
- Application: fullName, email, phone, preferredBranchId, skills (text), availability
  (enum: WEEKDAYS | WEEKENDS | FLEXIBLE), motivation (min 50 chars), consentGiven (must be true),
  status (NEW | ACCEPTED | DECLINED), decidedById, decidedAt, declineReason (internal),
  memberId (nullable, unique). Stores no CNIC or other national ID.
- Member: memberCode (unique, format MEM-<6-digit sequence>, auto-generated), fullName,
  email, phone, branchId, status (ACTIVE | INACTIVE | ON_LEAVE), joinedAt, applicationId (unique).
- MemberTeam: memberId, teamId, roleInTeam (free text). Unique (memberId, teamId).
- Collection: branchId, amount (Decimal, > 0), collectedOn (date), purpose (enum: GENERAL |
  EVENT | DONATION | OTHER), description, enteredById, lockedAt (equals createdAt + 7 days,
  set on insert), routedAt (nullable), routedById (nullable), routingReference (nullable).
- WeeklyReport: branchId, weekStart (Monday, Asia/Karachi), status (DRAFT | SUBMITTED |
  RETURNED | APPROVED), totalsSnapshot (JSON: collectionsTotal, collectionsCount,
  newMembers, activeMembers), leadNotes, submittedAt, submittedById, reviewedAt,
  reviewedById, reviewComment, approvedAt, version (integer, for optimistic locking).
  Unique (branchId, weekStart).
- ContentEntry: type (PAGE | PROGRAM | ANNOUNCEMENT), slug, locale (en | ur), title, body
  (Markdown, sanitised on render), status (DRAFT | PUBLISHED), publishedAt, updatedById.
  Unique (type, slug, locale).
- Event: title (per locale via ContentEntry-style rows or separate localised fields),
  startsAt, endsAt, location, branchId (nullable), status (DRAFT | PUBLISHED).
- ContactMessage: name, email, message, receivedAt, handledById (nullable), handledAt.
- AuditLog: actorId (nullable for public), actorRole, action (string), entityType,
  entityId, branchId (nullable), before (JSON, nullable), after (JSON, nullable),
  ipAddress, userAgent, createdAt. Append-only: the database role used by the app has
  no UPDATE or DELETE privilege on this table.

## 6. Business rules

### 6.1 Branch codes and lifecycle
- Code: BR-<first 3 letters of city, uppercase>-<NNN>, where NNN is the next number for
  that city, assigned inside a transaction. Retry on unique-constraint conflict.
- Status: FORMING -> ACTIVE -> PAUSED <-> ACTIVE; ACTIVE or PAUSED -> CLOSED (terminal).
  Only SUPER_ADMIN changes status. A CLOSED branch accepts no new members or collections.
- Only ACTIVE branches appear on the public Branches page.

### 6.2 Application workflow
- Public submission creates an Application with status NEW. Duplicate email for an open
  application (NEW) is rejected with a generic message.
- HR_LEAD accepts or declines. Decline requires an internal reason.
- Accept runs in one transaction: create Member (auto memberCode, branch = preferredBranchId
  or HR's chosen branch), link the application, set status ACCEPTED, write audit entries.
- Applicants receive no login. Member records are for internal use only.

### 6.3 Collections and the 7-day lock
- BRANCH_LEAD creates collections for their branch only. Amount must be greater than zero
  and collectedOn cannot be in the future.
- A collection is editable only while now < lockedAt AND its week's report is not APPROVED.
- Enforced in two places: the service layer returns a clear error, and a PostgreSQL trigger
  rejects updates to locked rows. The trigger allows updates that only set routedAt,
  routedById and routingReference, which FINANCE_REVIEWER uses.
- Deletion is not allowed for any role. Corrections are made by a new collection entry
  plus a note, not by deleting.
- Unrouted collection = routedAt IS NULL.

### 6.4 Weekly report workflow
- States: DRAFT -> SUBMITTED (BRANCH_LEAD submits) -> APPROVED (FINANCE_REVIEWER approves)
  or RETURNED (FINANCE_REVIEWER returns with a required comment) -> SUBMITTED (BRANCH_LEAD
  resubmits). APPROVED is terminal and locked.
- Draft creation: a report row for a branch and week is created when the branch lead first
  opens that week. Totals are computed from that branch's collections and members in the
  week, and recomputed while DRAFT or RETURNED.
- On SUBMITTED, totals are frozen into totalsSnapshot.
- On APPROVED, approvedAt is set and the report and its week's collections become read-only.
- Every transition is audited with actor, from-state, to-state, comment, and version.
- Transitions use optimistic locking (version). A stale request fails with a conflict message.

## 7. Features and screens

### 7.1 Public site (7 pages, each in en and ur)
- Home: mission, call to action, programs preview, active branch count, latest events.
- About: mission, vision, history (editable content).
- Programs: published PROGRAM entries.
- Branches: list of ACTIVE branches with code, city, and contact email. Filter by city.
- Events: upcoming and past published events, filterable.
- Get Involved: explanation of the process and the volunteer application form.
- Contact: contact form.
- Volunteer application form (React Hook Form + Zod, same schema on server):
  full name (2-80 chars), email, phone (Pakistani format, e.g. +92 or 03xx), preferred
  branch (ACTIVE only), skills (max 500), availability (enum), motivation (50-1000 chars),
  consent checkbox (required). Honeypot field plus rate limit (5 per hour per IP).
  Clear, field-level error messages in both languages.
- Shared: header with language switcher (en / اردو), theme toggle (light and dark),
  footer with Privacy and Terms pages (static content).

### 7.2 Admin area (/admin, login required)
- Login page with lockout after 5 failed attempts (15-minute lock), generic error messages,
  session rotation on login, sessions expire after 8 hours of inactivity.
- Users (SUPER_ADMIN): create user, assign role and branch, deactivate. Cannot deactivate
  themselves. Password is set by the admin and must be changed on first login.
- Branches (SUPER_ADMIN): create branch (generates code), edit, change status.
- Applications (HR_LEAD): filterable list (status, branch, date), detail view, accept, decline.
- Members (HR_LEAD read and status change; BRANCH_LEAD read and edit own branch; SUPER_ADMIN all):
  search by name, code, email, phone; filters by branch, team, status, joined date; paging;
  team assignments. Export allowed per role.
- Teams (BRANCH_LEAD for own branch): create, edit, assign members.
- Collections (BRANCH_LEAD own branch; FINANCE_REVIEWER read all; SUPER_ADMIN read all):
  entry form with lock indicator, list with filters (date range, purpose, routed or not),
  finance routing action.
- Weekly reports (BRANCH_LEAD own branch; FINANCE_REVIEWER all): week picker, draft view,
  submit, review screen with approve or return, history of transitions from audit log.
- Dashboard (SUPER_ADMIN and FINANCE_REVIEWER; HR_LEAD sees member and application KPIs only;
  BRANCH_LEAD sees own branch KPIs only):
  KPIs with exact definitions:
  - Collections this month: sum and count of collections dated in the current month (PKR)
  - Active branches: count of branches with status ACTIVE
  - Active members: count of members with status ACTIVE
  - Reports awaiting review: count of SUBMITTED reports, with the oldest submittedAt
  - Unrouted collections: count and sum where routedAt IS NULL
  - Pending applications: count with status NEW
  Trends: 12-month line chart of collection totals per month, and 12-month bar chart of
  new members per month. Unrouted list: table of unrouted collections, oldest first,
  with branch code, amount, date, and a link to the collection.
- Content manager (CONTENT_EDITOR, SUPER_ADMIN): list, create, edit, preview, publish, unpublish.
  Edits to a published entry save as DRAFT until republished. Slugs are unique per type and locale.
- Audit log viewer (SUPER_ADMIN): filter by actor, entity, action, date. Read-only.

### 7.3 Exports
- CSV: collections, members, applications, weekly reports, dashboard unrouted list. Each
  export respects the requesting role's scope and writes an EXPORT audit entry.
- PDF: approved weekly report (cover details, totals, collection table, review history)
  and a monthly branch summary. Generated on the server.

### 7.4 Bilingual support
- Every public string and admin navigation label comes from messages/en.json and
  messages/ur.json. A test checks that both files have the same keys.
- Urdu uses dir="rtl" on the html element, logical CSS properties (ms-, me-, start-, end-),
  and a font suited to Urdu script.
- Content entries exist per locale. If the Urdu version of a page is missing, show the English
  version with a notice.

## 8. Security requirements (OWASP Top 10 mapping)
- A01 Broken access control: central permission checks, branch scoping, IDOR tests, 404 for
  out-of-scope IDs.
- A02 Cryptographic failures: Argon2id passwords, HTTPS only, secure and httpOnly cookies,
  secrets only from environment variables, validated at boot with Zod.
- A03 Injection: Prisma parameterised queries only, Zod validation on every input, no raw SQL
  except in migrations.
- A04 Insecure design: state machines enforced on the server, lock rules enforced in the database.
- A05 Security misconfiguration: strict security headers (CSP, HSTS, X-Content-Type-Options,
  Referrer-Policy, frame-ancestors none), no stack traces to users, production build only.
- A06 Vulnerable components: npm audit in CI, Dependabot enabled.
- A07 Authentication failures: lockout, rate limiting on login, session rotation, password
  minimum 12 characters, no password hints.
- A08 Integrity failures: CI-gated deploys on main only, lockfile committed, pinned base images.
- A09 Logging failures: audit log for every write and export; structured logs with request ID;
  no secrets or passwords in logs.
- A10 SSRF: the app makes no outbound requests driven by user input.
- XSS: React escaping everywhere; Markdown rendered through a sanitiser with an allow-list.
- CSRF: SameSite=Lax cookies, Next.js server action origin checks, and a CSRF token on
  any non-action POST route.
- Rate limiting: login, application form, contact form (in-process limiter, documented as
  single-instance).
- Data minimisation: no national ID is collected. Applicant data is visible only to HR_LEAD
  and SUPER_ADMIN.

## 9. Non-functional requirements
- Lighthouse 90+ (mobile) on Home, Programs and Branches.
- Public pages statically generated or cached with revalidation.
- Dashboard queries use indexes on (branchId, collectedOn), (routedAt), (status, submittedAt).
- Health endpoint GET /api/health returns 200 with database status, and 503 if the DB is down.
- Seed script is idempotent (safe to re-run).

## 10. Sample data and expected dashboard values
- seed/ creates: 1 SUPER_ADMIN, 1 FINANCE_REVIEWER, 1 CONTENT_EDITOR, 1 HR_LEAD, 1 BRANCH_LEAD
  per branch, 6 branches (4 ACTIVE, 1 FORMING, 1 PAUSED), 40 members across teams, 20 applications
  (mixed statuses), 120 collections across the last 12 months, 8 weekly reports in mixed states,
  6 published content entries, 2 events, 1 contact message.
- The seed uses fixed values and fixed dates so the results are deterministic.
- docs/sample-data-expected.md lists the exact expected dashboard values for those seed numbers
  (for example, total unrouted amount, active member count, reports awaiting review). An
  integration test asserts each of them. This is an acceptance requirement.
- Demo logins: one per role, documented in docs/handover.md with a warning to rotate passwords
  before real use.

## 11. Testing requirements
- Unit (Vitest): permission matrix, state machines (branch, application, report), lock logic,
  branch code and member code generation, dashboard calculations, CSV escaping.
- Integration (Vitest against a test database): accept-application transaction, report
  transitions including optimistic lock conflict, trigger that blocks locked collection edits.
- Coverage: at least 60% line coverage on backend code (lib/, server actions, route handlers),
  enforced in vitest.config. CI fails below the threshold.
- End-to-end (Playwright): one test per role that proves blocked actions return 403 or 404,
  and the full report cycle: draft, submit, return, resubmit, approve, then locked, with the
  audit entries visible to SUPER_ADMIN.
- Accessibility: axe checks on the public pages in CI.

## 12. Delivery requirements
- Dockerfile: multi-stage, non-root user, healthcheck pointing at /api/health, image under 300 MB.
- docker-compose.yml: app plus PostgreSQL for local development.
- GitHub Actions workflows:
  - ci.yml on every push and pull request: install, lint, typecheck, prisma validate,
    migrate test database, test with coverage, Playwright, build, docker build, npm audit.
  - Deploy on push to main after CI passes, via Render deploy hook.
- Render: web service and managed PostgreSQL, environment variables set in Render (never
  committed). Migrations run at container start.
- Repository: public, MIT licence, branch protection on main requiring CI.

## 13. Documentation deliverables (docs/ folder and root)
- docs/architecture/: ADRs for stack, auth, permission model, audit design, lock design,
  report state machine, i18n approach, deployment.
- docs/api/: route and server action list with inputs, outputs, and permissions.
- docs/permissions.md: role x action table generated from lib/permissions.ts.
- docs/handover.md: setup, environment variables, seed, demo logins, deployment, runbook,
  known limitations (single-instance rate limiter).
- docs/sample-data-expected.md: dashboard expected values.
- docs/demo-script.md: outline for the walkthrough video (5 minutes max).
- README.md: what it is, screenshots, local setup, tests, deployment link.
- AI-USAGE.md: which tools were used, for what, and what was reviewed or changed by a human.
- LICENSE: MIT.

## 14. Acceptance checklist (all must pass)
- [ ] Sample data loaded, dashboard shows the values in docs/sample-data-expected.md
- [ ] Weekly report cycle: draft, submit, return, resubmit, approve, lock; every step in audit log
- [ ] No role can act outside its permissions; automated tests prove it
- [ ] Live Render link works with all five role logins
- [ ] CI passes on main
- [ ] Coverage at least 60% on backend
- [ ] 25+ commits over at least 7 distinct days; 3 merged pull requests
- [ ] Public site: 7 pages in en and ur; RTL works for ur
- [ ] Volunteer form validates fully; applications create members with IDs
- [ ] Collections lock after 7 days in UI and database
- [ ] CSV and PDF exports work and are audited
- [ ] Content manager: drafts stay hidden until published
- [ ] Lighthouse 90+ on key pages
- [ ] Docs folder complete; README and AI-USAGE.md present
- [ ] Walkthrough video of 5 minutes or less

## 15. Surprise twist
Expect a late change request. Keep modules loosely coupled: services in lib/services/, UI
does not contain business rules, and every rule has a test. Budget half a day for the change.

## Amendments (approved after the original specification)

### A1. Collection correction entries (2026-10-22, see docs/OPEN-QUESTIONS.md, decision 7a)

Overrides "amount (Decimal, > 0)" in section 5 and "Amount must be greater than zero" in
section 6.3, for correction entries only.

- Collection gains correctsCollectionId (nullable, references the original collection in
  the same branch) and correctionNote (the reason; required when correctsCollectionId is set).
- A normal entry (correctsCollectionId is null) must have amount > 0.
- A correction entry may have a positive or negative amount, never zero.
- The original amount plus the sum of its corrections must never be below zero.
- Enforced in the service layer and in PostgreSQL. Every correction is written to the
  audit log. Deletion remains forbidden for all roles.
