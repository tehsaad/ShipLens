# Acceptance checklist (section 14)

Each item of `docs/SPEC.md` section 14, with its status and the evidence behind it. Checked
on 26 October 2026.

- **Met:** proven by an automated test that runs in CI, or by a check on the live site.
- **Partly met / Not yet met:** what is missing is stated, with what it needs.

| #   | Item                                                                                             | Status                     | Evidence                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sample data loaded, dashboard shows the values in `sample-data-expected.md`                      | Met                        | `tests/integration/sample-data.test.ts` seeds its own database and asserts every value for 18 October 2026, the last day the sample data covers. The live service loads the sample data at start. On other dates, the date-dependent figures move on, as the document explains.                                                                      |
| 2   | Weekly report cycle: draft, submit, return, resubmit, approve, lock; every step in the audit log | Met                        | `e2e/report-cycle.spec.ts` runs the cycle in the browser and checks the lock (the week's entry is read-only, and a new entry is refused). It then checks each step, with its actor, in the Super Admin audit log. Service-level checks: `tests/integration/reports.test.ts`.                                                                         |
| 3   | No role can act outside its permissions; automated tests prove it                                | Met                        | `tests/unit/permissions.test.ts` (the matrix); IDOR and scope tests in `tests/integration/*`. `e2e/access.spec.ts` checks real 403 and 404 responses for each role, and a replayed Approve form shows that the server refuses Super Admin.                                                                                                           |
| 4   | Live Render link works with all five role logins                                                 | Met                        | 26 October 2026: on <https://shiplens.onrender.com>, a script signed in as Super Admin, Finance Reviewer, Content Editor, HR Lead and Branch Lead (`lead.kar001`). Each reached `/admin`.                                                                                                                                                            |
| 5   | CI passes on `main`                                                                              | Met                        | The CI workflow (`.github/workflows/ci.yml`) runs on every push to `main`. It passed on the Phase 6 merge (`9f60729`), and the Deploy workflow ran after it. The Phase 7 merge runs the same checks.                                                                                                                                                 |
| 6   | Coverage at least 60% on backend                                                                 | Met                        | `vitest.config.mts` fails the run below 60% of lines over `lib/`, server actions and route handlers. Measured: **67.5%** of lines (`npm run test:coverage`). CI runs it on every push.                                                                                                                                                               |
| 7   | 25+ commits over at least 7 distinct days; 3 merged pull requests                                | **Not yet met** (days)     | Commits: 82 on `main` before Phase 7, plus the Phase 7 commits. Merged pull requests: #2–#6 and #11–#13, which is 8 (#1 is not counted, decision 12). Distinct commit days: 21, 22, 23, 24 and 26 October, which is **5**. Commits are never backdated, so 2 more days of real work are needed.                                                      |
| 8   | Public site: 7 pages in `en` and `ur`; RTL works for `ur`                                        | Met                        | Home, About, Programs, Branches, Events, Get Involved and Contact (plus Privacy and Terms) in both languages. `e2e/accessibility.spec.ts` loads and checks each one in both languages and themes. Urdu pages render as `<html lang="ur" dir="rtl">` (`app/[locale]/layout.tsx`). `tests/unit/messages.test.ts` checks that both message files match. |
| 9   | Volunteer form validates fully; applications create members with IDs                             | Met                        | The same Zod schema runs in the form and the server action (`tests/unit/messages.test.ts`, `tests/unit/validation.test.ts`). `tests/integration/applications.test.ts`: accepting creates a member with a database `MEM-######` code in one transaction, and concurrent decisions cannot both succeed.                                                |
| 10  | Collections lock after 7 days in UI and database                                                 | Met                        | `tests/integration/database-rules.test.ts` and `collection-rules.test.ts` exercise the PostgreSQL triggers directly and through the service. The UI shows why an entry is locked. The approved-week lock is also checked in the browser (`e2e/report-cycle.spec.ts`).                                                                                |
| 11  | CSV and PDF exports work and are audited                                                         | Met                        | `tests/integration/exports.test.ts` and `pdf-exports.test.ts` cover scope, refusals and audit entries. `tests/unit/csv.test.ts` and `pdf.test.ts` cover the files. The E2E cycle downloads the report PDF and finds its `report.export` audit entry.                                                                                                 |
| 12  | Content manager: drafts stay hidden until published                                              | Met                        | `tests/integration/content.test.ts`: drafts are never listed publicly, and edits to a published entry wait as a pending draft until republished.                                                                                                                                                                                                     |
| 13  | Lighthouse 90+ on key pages                                                                      | **Partly met** (see below) | English Home, Programs and Branches: performance 97–99, accessibility 100, best practices 100. Urdu versions: performance 74–87.                                                                                                                                                                                                                     |
| 14  | Docs folder complete; README and AI-USAGE.md present                                             | Met                        | Section 13 documents: `docs/architecture/` (ADRs 0001–0010), `docs/api/`, `docs/permissions.md` (generated, drift-tested), `docs/handover.md`, `docs/sample-data-expected.md`, `docs/demo-script.md`, `README.md`, `AI-USAGE.md`, `LICENSE`.                                                                                                         |
| 15  | Walkthrough video of 5 minutes or less                                                           | **Not yet met** (owner)    | The script is ready in `docs/demo-script.md`. The video has to be recorded by the project owner.                                                                                                                                                                                                                                                     |

## Lighthouse (item 13)

Section 9 asks for 90+ on mobile for Home, Programs and Branches.

**How it was measured:**

- Lighthouse 13.5.0 with the mobile preset and simulated throttling.
- Run against the production build (`node .next/standalone/server.js`), on 26 October 2026.

| Page           | Performance | Accessibility | Best practices | SEO\* |
| -------------- | ----------- | ------------- | -------------- | ----- |
| `/en`          | 97          | 100           | 100            | 91    |
| `/en/programs` | 99          | 100           | 100            | 91    |
| `/en/branches` | 98          | 100           | 100            | 91    |
| `/ur`          | 87          | 100           | 100            | 91    |
| `/ur/programs` | 74          | 100           | 100            | 91    |
| `/ur/branches` | 86          | 100           | 100            | 91    |

\* **SEO locally:** the page's canonical link names the production address. Lighthouse
reports that as pointing elsewhere when the page is served from `127.0.0.1`; the other SEO
checks pass. On the live domain the canonical link matches the page.

**Before Phase 7:**

- English performance was 66–86.
- Every page preloaded the 230 KB Urdu font and the admin font.
- SEO was 82, because canonical and hreflang links were relative.

Those are fixed.

**Why Urdu pages are lower:**

- **Font size.** Urdu pages must download the Noto Nastaliq Urdu font, about 230 KB, which
  dominates the throttled mobile profile.
- **Layout shift.** When the font swaps in, the width of right-aligned Urdu headings changes,
  which Lighthouse counts as layout shift (0.23 on Programs).

**Options for the owner:**

1. A lighter Naskh face for Urdu body text. This is faster, but less traditional for Urdu.
2. `font-display: optional`. There is no shift, but a first visit on a slow connection keeps
   the fallback face until the next page load. Measured: layout shift 0, performance 82–85.
3. A Nastaliq file subset to the characters the site uses. This needs care to keep its
   ligatures.

## Delivery requirements (section 12)

| Requirement                                               | Status                 | Evidence                                                                                                                                                                                                  |
| --------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-stage Dockerfile, non-root, health check, < 300 MB  | Met                    | `Dockerfile`. CI builds the image, checks its size (213 MB) and starts it against an empty database.                                                                                                      |
| docker-compose for local development                      | Met                    | `docker-compose.yml`                                                                                                                                                                                      |
| CI on every push and pull request                         | Met                    | `.github/workflows/ci.yml`: install, audit, lint, typecheck, Prisma validate, migrations, tests with coverage, Playwright, build, Docker build                                                            |
| Deploy on push to `main` after CI, via Render deploy hook | **Partly met** (owner) | `.github/workflows/deploy.yml` runs after CI on `main`. The repository secret `RENDER_DEPLOY_HOOK_URL` still has to be added; until then, Render's own "deploy after checks pass" setting deploys `main`. |
| Environment variables in Render, never committed          | Met                    | `render.yaml` declares them without values; `.env` files are git-ignored                                                                                                                                  |
| Migrations at container start                             | Met                    | `scripts/docker-entrypoint.sh`, `scripts/migrate.mjs`                                                                                                                                                     |
| Public repository, MIT licence                            | Met                    | The repository is public; `LICENSE`                                                                                                                                                                       |
| Branch protection on `main` requiring CI                  | **To confirm** (owner) | A repository setting only the owner can change: Settings → Branches → require the "Lint, typecheck, test and build" check                                                                                 |

## What is left, and who does it

1. **Owner: record the walkthrough video** from `docs/demo-script.md` (item 15).
2. **Owner: add the deploy hook secret.** Copy the URL from Render → shiplens → Settings →
   Deploy Hook into GitHub → Settings → Secrets and variables → Actions as
   `RENDER_DEPLOY_HOOK_URL`. Then one deploy through the hook is confirmed, and Render's own
   auto-deploy is turned off.
3. **Owner: turn on branch protection** for `main`, requiring the CI check.
4. **Two more days with commits** (item 7). Real work on later days, for example the deploy
   switch-over, completes it.
5. **Owner: decide on the Urdu font trade-off** (item 13), and on the stack deviations in ADR
   0009 and ADR 0010.
