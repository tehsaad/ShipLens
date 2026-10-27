# ADR 0005: Collection lock and corrections

- **Status:** Accepted
- **Recorded:** 26 October 2026 (decided in Phase 1; corrections added by amendment A1)

## Context

Section 6.3: a collection is editable only while `now < lockedAt` and its week's report is
not APPROVED, where `lockedAt` is the creation time plus 7 days. The rule must hold in the UI
and in the database, and deletion is forbidden for every role.

Approved decisions extended it:

- **A1 and decision 7a: corrections.** Mistakes found after the lock are fixed with signed
  correction entries.
- **Decision 8.** A new entry dated in an approved week is refused.

## Decision

- **Database rules.** PostgreSQL enforces each rule with triggers in the `integrity_rules`
  migration:
  - **On insert,** the trigger sets `locked_at := created_at + 7 days`. It refuses:
    - a date in the future;
    - a closed branch;
    - a date in an approved week;
    - a correction of another branch's entry, or of another correction.
  - **On update,** it refuses changes after `locked_at` or in an approved week. It also refuses
    changes to the id, branch, author, creation time, `locked_at` and the corrected entry.
  - **Routing exception.** Updates that change only the routing fields are always allowed: the
    Finance Reviewer routes locked entries.
  - **Corrections.** `assert_correction_total()` keeps the original plus all its corrections at
    or above zero.
  - **No deletes.** `DELETE` and `TRUNCATE` are rejected for every role.
- **The same rules in the service layer first.** `lib/services/collections.ts` with the pure
  functions in `lib/rules/collection.ts` checks each rule and shows a clear message. A
  violation that reaches the database anyway comes back with its own SQLSTATE (`SL001`–`SL010`).
  `lib/db-errors.ts` maps it to the same message.
- **The screen explains the lock.** It shows why an entry is read-only: the 7 days have
  passed, or its week is approved.

## Consequences

- **Safe against bugs and direct access.** A bug in the app, or a direct database session,
  cannot rewrite locked financial history.
- **History is kept.** Corrections are new rows: the original amount stays visible, and each
  correction carries its reason and its audit entry.
- **Late receipts.** A receipt found after its week was approved is recorded in the current
  week, with the original date in the description (decision 8).

## Evidence

- `tests/integration/database-rules.test.ts` and `collection-rules.test.ts` exercise each
  trigger directly and through the service.
- `tests/unit/collection-rules.test.ts` covers the pure functions.
- `e2e/report-cycle.spec.ts` checks in the browser that an entry in an approved week is
  read-only and that a new entry dated in that week is refused.
