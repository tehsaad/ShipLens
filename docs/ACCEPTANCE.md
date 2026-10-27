# Acceptance record

Checked against the ShipLens Challenge #01 participant handbook: its four acceptance criteria
(section 06) and its final checklist (section 07, page 15), in the handbook's own order and
wording. Each line says what proves it. Checked on 27 October 2026, after the deploy of
`bf85481`. [`docs/SPEC.md`](SPEC.md) is the product specification taken from the handbook.

- **Met:** proven by an automated test that runs in CI, or by a check on the live site.
- **Not yet met:** what is missing, and who does it.

## The four acceptance criteria

| #   | Criterion                                   | Status | Evidence                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Correct dashboard values                    | Met    | Loading the sample data is one documented command, `npm run db:seed` ([handover](handover.md#sample-data-and-demo-logins)). `tests/integration/sample-data.test.ts` asserts every value in [`sample-data-expected.md`](sample-data-expected.md) for 18 October 2026, the last day the data covers. |
| 2   | Complete weekly report cycle, fully audited | Met    | `e2e/report-cycle.spec.ts` runs draft, submit, return, resubmit, approve and lock in the browser, then finds each step with its actor in the Super Admin audit log. Service-level checks: `tests/integration/reports.test.ts`.                                                                     |
| 3   | Permissions proven by tests                 | Met    | `tests/unit/permissions.test.ts` tests every role against every action in the table. IDOR and scope tests are in `tests/integration/*`. `e2e/access.spec.ts` checks real 403 and 404 responses for each role and a replayed Approve form refused on the server.                                    |
| 4   | Live and green                              | Met    | <https://shiplens.onrender.com> serves `bf85481`, the merge of pull request #17; CI passed on `main` for that commit.                                                                                                                                                                              |

## Final checklist

| Handbook item                                                                           | Status                    | Evidence                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| All 7 public pages live: Home, About, Programs, Branches, Events, Get Involved, Contact | Met                       | Live in English and Urdu (plus Privacy and Terms). `e2e/accessibility.spec.ts` loads each page in both languages and both themes.                                                                                                    |
| Volunteer form validates every field, on the server too                                 | Met                       | One Zod schema runs in the form and in the server action (`tests/unit/validation.test.ts`); field errors appear in both languages. The form is rate limited and checks duplicates.                                                   |
| 5 roles working, permission table in `docs/`                                            | Met                       | [`docs/permissions.md`](permissions.md), generated from `lib/permissions.ts`; `tests/unit/permissions-doc.test.ts` fails if they drift apart.                                                                                        |
| Branch codes auto-generate; status lifecycle enforced                                   | Met                       | `tests/integration/branches.test.ts`: sequential codes per city, distinct codes for concurrent creations, the Forming → Active → Paused → Closed rules. `tests/unit/branch-rules.test.ts`: codes are never reused.                   |
| Accepting an applicant creates a member with an auto ID                                 | Met                       | `tests/integration/applications.test.ts`: a database `MEM-######` code in the same transaction; two concurrent decisions cannot both succeed.                                                                                        |
| Member search and filters work                                                          | Met                       | `tests/integration/members-teams.test.ts`: search by code, name, email and phone; a Branch Lead sees only their own branch.                                                                                                          |
| Collections lock after 7 days, enforced on the server                                   | Met                       | PostgreSQL triggers, tested directly and through the service in `tests/integration/database-rules.test.ts` and `collection-rules.test.ts`. The test the handbook asks for: "keeps an entry editable on day 6 and locks it on day 8". |
| Weekly report: draft, submit, return, resubmit, approve, locked                         | Met                       | Acceptance criterion 2 above.                                                                                                                                                                                                        |
| Dashboard: KPIs, monthly trends, unrouted collections                                   | Met                       | `tests/integration/sample-data.test.ts`: head-office figures, 12-month trends, and unrouted collections oldest first.                                                                                                                |
| Dashboard shows the expected values with sample data loaded                             | Met                       | Acceptance criterion 1 above.                                                                                                                                                                                                        |
| CSV and PDF export work                                                                 | Met                       | `tests/integration/exports.test.ts` and `pdf-exports.test.ts` (scope, refusals, audit entries); `tests/unit/csv.test.ts` covers formula injection.                                                                                   |
| Content manager: draft and publish                                                      | Met                       | `tests/integration/content.test.ts`: drafts never reach the public site; edits to a published entry wait as a draft until republished.                                                                                               |
| Audit trail records every change                                                        | Met                       | Entries are written in the same transaction as the change and the table is append-only (database rules). `tests/integration/audit-log.test.ts` covers the Super Admin viewer and its filters.                                        |
| English and Urdu, right-to-left layout correct                                          | Met                       | Urdu pages render `<html lang="ur" dir="rtl">`; `tests/unit/messages.test.ts` checks that both message files match; the end-to-end suite runs each page in both languages.                                                           |
| Backend coverage at least 60%                                                           | Met                       | `vitest.config.mts` fails CI below 60% of lines over `lib/`, server actions and route handlers. Measured 67.5% on 26 October 2026.                                                                                                   |
| Permission tests cover every role                                                       | Met                       | Acceptance criterion 3 above.                                                                                                                                                                                                        |
| CI green on `main`                                                                      | Met                       | Acceptance criterion 4 above.                                                                                                                                                                                                        |
| Dockerfile builds; health endpoint returns 200                                          | Met                       | CI builds the multi-stage image (non-root, under 300 MB) and starts it; `GET /api/health` returns 200 after checking the database.                                                                                                   |
| Public repo with MIT licence                                                            | Met                       | The repository is public (checked 27 October 2026); [`LICENSE`](../LICENSE).                                                                                                                                                         |
| At least 25 commits over 7 days, at least 3 merged PRs                                  | **Not yet met** (one day) | 108 commits and 13 merged pull requests (#1–#6, #11–#17). Commits fall on **6** distinct days (21, 22, 23, 24, 26 and 27 October). Commits are never backdated, so one more day of real work completes it.                           |
| Live on Render with PostgreSQL, link tested in a private window                         | Met                       | Checked on 27 October 2026 from a fresh browser profile with no cookies; Render PostgreSQL, migrations at container start.                                                                                                           |
| `docs/`: architecture decisions, API docs, permission table, handover guide             | Met                       | [`docs/adr/`](adr/README.md) (ADRs 0001–0010), [`docs/api.md`](api.md), [`docs/permissions.md`](permissions.md), [`docs/handover.md`](handover.md).                                                                                  |
| One test login per role, all working on the live site                                   | Met                       | Listed in the [README](../README.md#test-logins); all five signed in on the live site on 27 October 2026. The shared password is given with the submission, not stored in Git.                                                       |
| `README.md` and `AI-USAGE.md` complete                                                  | Met                       | [`README.md`](../README.md) (what it is, live link, test logins, stack, setup, environment, tests, credits) and [`AI-USAGE.md`](../AI-USAGE.md) (Claude Code and Gemini, and how their output was checked).                          |
| Walkthrough video of 5 minutes or less, link viewable by anyone                         | **Not yet met** (owner)   | The script follows the handbook's outline: [`docs/demo-script.md`](demo-script.md). The owner records it.                                                                                                                            |
| No secrets anywhere in the repository history                                           | Met                       | A scan of the full history on 27 October 2026 found only placeholder connection strings (`change-me`); `.env` files are git-ignored and Render holds the real values.                                                                |

## Lighthouse

The handbook asks for 90+ in mobile mode on key pages (section 04, "Lighthouse 90+"). These
results are from 26 October 2026, before the redesign; they are rerun after each design step.

### Live site

Lighthouse 13.5.0, mobile preset with simulated throttling, against
<https://shiplens.onrender.com> on 26 October 2026 (deploy of `e471f32`, page loaded once
beforehand so the free plan was awake). Raw summary:
[`docs/seo/lighthouse/2026-10-26-live-before.json`](seo/lighthouse/2026-10-26-live-before.json).

| Page           | Performance | Accessibility | Best practices | SEO |
| -------------- | ----------- | ------------- | -------------- | --- |
| `/en`          | 99          | 100           | 100            | 100 |
| `/en/programs` | 100         | 100           | 100            | 100 |
| `/en/branches` | 99          | 100           | 100            | 100 |
| `/ur`          | 99          | 100           | 100            | 100 |
| `/ur/programs` | 99          | 100           | 100            | 100 |
| `/ur/branches` | 96          | 100           | 96\*\*         | 100 |

\*\* An intermittent hydration error logged during that run. It is fixed in the SEO change
(see [`docs/seo/IMPLEMENTATION.md`](seo/IMPLEMENTATION.md)), which is not yet deployed.

### Local production build

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

## Delivery requirements

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

1. **Owner: record the walkthrough video** from `docs/demo-script.md`.
2. **Owner: add the deploy hook secret.** Copy the URL from Render → shiplens → Settings →
   Deploy Hook into GitHub → Settings → Secrets and variables → Actions as
   `RENDER_DEPLOY_HOOK_URL`. Then one deploy through the hook is confirmed, and Render's own
   auto-deploy is turned off.
3. **Owner: turn on branch protection** for `main`, requiring the CI check.
4. **One more day with commits.** Real work on a later day completes the 7 distinct days.
5. **Owner: decide on the Urdu font trade-off** (Lighthouse), and on the stack deviations in ADR
   0009 and ADR 0010.
