# ADR 0010: Server-rendered tables instead of TanStack Table

- **Status:** Accepted, as a deviation from section 2, pending the project owner's approval
- **Recorded:** 26 October 2026 (the approach was used from Phase 2 without an ADR; this
  record documents it)

## Context

Section 2 lists TanStack Table in the UI stack. The admin area has list screens for
branches, users, applications, members, teams, collections, weekly reports, content, events,
messages and the audit log. Each screen:

- filters on the server by the user's scope;
- shows 25 rows per page;
- offers a CSV export that must contain exactly the rows the filters select (section 7.3).

## Decision

Lists are server components that render a plain HTML table (`DataTable` in
`components/admin/page.tsx`):

- **Filters** are a GET form, so they live in the URL. A filtered list can be bookmarked and
  shared, and the export link reuses the same query string.
- **Each list's query builder is shared with its CSV export** (`collectionWhere`,
  `memberWhere`, `reportWhere`, `applicationWhere`), so the two cannot drift.
- **Paging** happens in the database (`pageArgs` in `lib/services/shared.ts`).
- **No table JavaScript reaches the browser.** The tables work without JavaScript and under
  the nonce content security policy.

TanStack Table is not used. It is a client-side headless table library, so it would add
client components and JavaScript for sorting and filtering, which the server already does.

## Consequences

- **No client-side sorting.** Columns cannot be re-sorted in the browser. Each list has a
  fixed, meaningful order: newest first, or oldest unrouted first. The spec asks for none.
- **No new bundle.** The admin bundle stays small, and every list behaves the same way.
- **Adding interactivity later.** If interactive column sorting is wanted, TanStack Table can
  wrap the existing data on a single screen without changing the services.
- **Owner approval.** This is recorded as a deviation in `docs/OPEN-QUESTIONS.md` for the
  owner to approve or reverse.

## Evidence

- `tests/integration/exports.test.ts` proves that each list and its export share scope and
  filters.
- `e2e/access.spec.ts`: a Branch Lead's export stays in its branch whatever the URL asks.
