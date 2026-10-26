# ADR 0003: Permission model

- **Status:** Accepted
- **Recorded:** 26 October 2026 (decided in Phase 1)

## Context

Section 3 defines exactly five roles; each user has one. Section 4 asks for:

- one permission matrix as the single source of truth, used by the server and mirrored in the
  UI;
- branch scoping for Branch Leads;
- out-of-scope records answering 404 rather than revealing that they exist;
- `docs/permissions.md` generated from the same matrix.

## Decision

- **The matrix.** `lib/permissions.ts` holds `PERMISSIONS`: for every action (for example
  `collection.create`, `report.approve`), the roles allowed and their scope:
  - `all`: every branch;
  - `ownBranch`: only the user's branch.

  Public actions (the volunteer form, the contact form, published content) are marked
  `public`. Anonymous visitors are not a stored role (decision 2).

- **One decision function.** `decide(actor, action, resource?)` returns `allowed`,
  `unauthenticated`, `forbidden` or `outOfScope`. On top of it:
  - `can()` hides UI controls;
  - `authorize()` throws an `AppError` (403, or 404 for out of scope);
  - `requirePermission()` (pages) calls `forbidden()` or `notFound()`.
- **Every service authorizes before it reads or writes.** List queries call `listScope()`
  (`lib/services/shared.ts`), which puts the Branch Lead's branch into the WHERE clause. Rows
  of other branches are never read, whatever filter the request names. Each list page and its
  CSV export share one query builder, so they cannot drift.
- **The UI mirrors the server.** Pages call `can()` to hide what a role may not do. Hiding is a
  convenience; the service check is the rule.
- **Generated documentation.** `docs/permissions.md` is generated from `PERMISSIONS`
  (`npm run docs:permissions`). A unit test fails if the committed file differs from the
  generated text.

## Consequences

- **One edit point.** Adding or changing a permission is one entry in one file. The tests, the
  document and every check follow it.
- **Specific actions.** The matrix is action-based, not screen-based, so a page shows only the
  controls the role can actually use.
- **Interpretations.** Where the spec's wording was ambiguous, the interpretation is encoded in
  the matrix and recorded in `docs/OPEN-QUESTIONS.md`. Super Admin reads collections and
  reports but does not enter, route or approve them.

## Evidence

- `tests/unit/permissions.test.ts`: the matrix, role by role.
- IDOR and scope tests in `tests/integration/*`.
- `e2e/access.spec.ts`: real 403 and 404 responses per role. A replayed Approve form proves
  that the server refuses Super Admin.
