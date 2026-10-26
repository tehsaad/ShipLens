# Architecture

ShipLens is one Next.js application backed by one PostgreSQL database. It serves:

- **a public site** in English and Urdu, cached and revalidated;
- **an admin area for five staff roles**, rendered on the server per request;
- **exports and a health check**, as route handlers.

Business rules sit in a service layer that every entry point goes through. PostgreSQL then
enforces the rules that matter most a second time.

## System

```mermaid
flowchart LR
  visitor([Public visitor]) --> edge
  staff([Staff: Super Admin, Finance Reviewer,<br/>Content Editor, HR Lead, Branch Lead]) --> edge
  edge[Render edge<br/>Cloudflare, HTTPS] --> proxy

  subgraph app [Next.js app, one container]
    proxy[proxy.ts<br/>locale routing · admin sign-in gate · CSP nonce]
    proxy --> site[Public site /en /ur<br/>static + 5 min revalidation]
    proxy --> admin[Admin pages<br/>server components]
    admin --> actions[Server actions<br/>forms]
    proxy --> routes[Route handlers<br/>CSV, PDF, health]
    site --> services
    actions --> services
    admin --> services
    routes --> services
    subgraph services [lib/services]
      zod[Zod validation] --> authz[authorize / listScope<br/>lib/permissions.ts]
      authz --> rules[Rules<br/>lib/rules]
      rules --> tx[Transaction + recordAudit]
    end
  end

  tx --> prisma[Prisma] --> db[(PostgreSQL 16<br/>triggers · append-only audit log<br/>restricted app role)]
```

## One request

A Branch Lead submits a weekly report:

```mermaid
sequenceDiagram
  participant B as Browser
  participant P as proxy.ts
  participant A as submitReportAction
  participant S as lib/services/reports
  participant D as PostgreSQL
  B->>P: POST /admin/reports/:id (form)
  P->>P: session cookie present? set CSP nonce
  P->>A: request
  A->>A: requireUser (fresh user from the database)
  A->>A: Zod parses id and version
  A->>S: submitReport(ctx, id, version)
  S->>S: authorize report.submit for the report's branch
  S->>S: nextReportStatus(DRAFT → SUBMITTED), week complete?
  S->>D: BEGIN: compute totals, UPDATE … WHERE version = seen
  S->>D: INSERT audit entry (same transaction)
  D-->>S: COMMIT (triggers re-check the rules)
  S-->>A: done
  A-->>B: page refreshes: Submitted · version n+1
```

## Delivery

```mermaid
flowchart LR
  push[Push or pull request] --> ci[CI<br/>audit · lint · types · coverage ≥ 60%<br/>build · Playwright + axe · Docker image]
  ci -->|merged to main, CI green| deploy[Deploy workflow]
  deploy -->|hook with ref = commit| render[Render builds the image]
  render --> start[Container start<br/>migrate · seed missing demo data · serve]
  start --> health{GET /api/health = 200?}
  health -->|yes| live[Traffic switches to the new version]
```

## Decisions

| ADR                                  | Decision                                                            |
| ------------------------------------ | ------------------------------------------------------------------- |
| [0001](0001-stack.md)                | Technology stack                                                    |
| [0002](0002-authentication.md)       | Auth.js credentials, Argon2id, JWT sessions read fresh each request |
| [0003](0003-permission-model.md)     | One permission matrix; 403 outside a role, 404 outside a branch     |
| [0004](0004-audit-design.md)         | Append-only audit log written in the same transaction               |
| [0005](0005-collection-lock.md)      | Collection lock and corrections, enforced in app and database       |
| [0006](0006-report-state-machine.md) | Weekly report state machine with optimistic locking                 |
| [0007](0007-i18n.md)                 | English and Urdu with next-intl, RTL and per-locale fonts           |
| [0008](0008-deployment.md)           | Standalone image, migrations at start, CI-gated deploy hook         |
| [0009](0009-pdf-generation.md)       | PDFKit instead of @react-pdf/renderer (deviation, pending approval) |
| [0010](0010-tables.md)               | Server-rendered tables instead of TanStack Table (deviation)        |

## Where things live

| Path                  | What it holds                                                    |
| --------------------- | ---------------------------------------------------------------- |
| `app/[locale]/`       | Public pages and their two server actions (volunteer, contact)   |
| `app/admin/`          | Admin pages, server actions and the export route handlers        |
| `app/api/`            | Auth.js and the health check                                     |
| `lib/services/`       | One module per area: every read and write, with authorization    |
| `lib/rules/`          | Pure business rules (branch codes, collection lock, report flow) |
| `lib/permissions.ts`  | The role × action matrix                                         |
| `lib/validation/`     | Zod schemas shared by forms and server actions                   |
| `prisma/`             | Schema, migrations (with the triggers) and the sample-data seed  |
| `tests/`, `e2e/`      | Vitest unit and integration tests; Playwright and axe            |
| `docs/api/`           | Every server action and route handler                            |
| `docs/permissions.md` | The matrix as a table, generated from `lib/permissions.ts`       |
