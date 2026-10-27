# ADR 0001: Technology stack

- **Status:** Accepted
- **Recorded:** 26 October 2026 (decided in Phase 0, 21 October 2026)

## Context

`docs/SPEC.md` section 2 fixes the stack and asks for an ADR before any part of it changes.
The platform is a single web application. It serves a cached bilingual public site and a
role-based admin area, and it keeps financial records that must stay consistent.

## Decision

The stack follows section 2 except where ADR 0009 (PDFs) and ADR 0010 (tables) record a
deviation. The versions in use:

| Concern              | Choice                                                                             |
| -------------------- | ---------------------------------------------------------------------------------- |
| Runtime              | Node.js 24 (`.nvmrc`, Docker base image pinned to an exact release)                |
| Framework            | Next.js 16 App Router: server components, server actions, `proxy.ts`               |
| Language             | TypeScript 5.9 in strict mode                                                      |
| Database             | PostgreSQL 16, Prisma 7 (`@prisma/adapter-pg`), versioned SQL migrations           |
| Authentication       | Auth.js v5 credentials provider, Argon2id (`@node-rs/argon2`); see ADR 0002        |
| Validation           | Zod 4, one schema per form shared by the browser and the server action             |
| UI                   | Tailwind CSS v4, shadcn/ui, React Hook Form (public forms), Recharts (dashboard)   |
| Internationalisation | next-intl 4 (`/en`, `/ur`); see ADR 0007                                           |
| Exports              | CSV built in (RFC 4180, `lib/csv.ts`); PDF with PDFKit (ADR 0009)                  |
| Tests                | Vitest 5 (unit, integration, coverage), Playwright with axe-core (end-to-end)      |
| Quality              | ESLint, Prettier, Husky, lint-staged, commitlint                                   |
| Delivery             | Multi-stage Dockerfile (standalone output), docker-compose, GitHub Actions, Render |

Every dependency is pinned to an exact version in `package.json`, and the lockfile is
committed. Dependabot proposes updates weekly, each one only after the release is a week old.

## Consequences

- **One deployable.** The public site, admin area, exports and health check are one Next.js
  service, so there is one image, one deploy and one log stream.
- **One rulebook.** Business rules live in `lib/services` and `lib/rules`. Pages, server actions
  and route handlers are thin, and the same rules are checked again in PostgreSQL (ADR 0004,
  ADR 0005).
- **Pinned beta.** Auth.js v5 is only published as a beta (`5.0.0-beta.32`), so it is pinned
  and its upgrades are reviewed by hand.
- **Breaking changes in Next.js 16.** Next.js 16 differs from earlier versions: `proxy.ts`
  replaces `middleware.ts`, and `authInterrupts` provides `forbidden()`. The documentation that
  matches the installed version is in `node_modules/next/dist/docs/`.

## References

`package.json`, `.nvmrc`, `Dockerfile`, `.github/dependabot.yml`, `docs/SPEC.md` section 2.
