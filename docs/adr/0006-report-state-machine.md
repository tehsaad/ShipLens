# ADR 0006: Weekly report state machine

- **Status:** Accepted
- **Recorded:** 26 October 2026 (decided in Phase 3)

## Context

Section 6.4 defines the report workflow. The Branch Lead drafts, submits and, after a return,
resubmits. The Finance Reviewer returns (a comment is required) or approves. An APPROVED
report is terminal and locks its week. Each transition must be audited. Two reviewers acting
at once must not both succeed.

## Decision

- **Transitions as data.** `lib/rules/report.ts` holds the transitions as a table, with pure
  functions:

  | Transition | From      | To        |
  | ---------- | --------- | --------- |
  | submit     | DRAFT     | SUBMITTED |
  | resubmit   | RETURNED  | SUBMITTED |
  | approve    | SUBMITTED | APPROVED  |
  | return     | SUBMITTED | RETURNED  |

  The same file decides when a week can be opened (it has started) and when it can be
  submitted (its Sunday has passed in Asia/Karachi).

- **Optimistic locking.** Every report has a `version`, and forms send the version they
  showed. A transition is one conditional `UPDATE … WHERE id, version, status` that increments
  `version`. When no row matches, the user gets a conflict message.
- **Frozen totals.** While a report is DRAFT or RETURNED, its totals are computed live in a
  `RepeatableRead` snapshot. On submission they are frozen into `totalsSnapshot`, so the
  reviewer approves exactly what was submitted.
- **Audit and history.** Every transition writes an audit entry in the same transaction,
  recording the from and to states, the comment and the version. The report page reads its
  history from those entries; there is no second history table.
- **Database guard.** A trigger refuses any change to an APPROVED report (`SL010`). Check
  constraints keep `week_start` on a Monday and make a RETURNED report carry a comment.

## Consequences

- **One owner per transition.** A transition is allowed only for its role, enforced by the
  permission matrix (ADR 0003), and only from its source state, enforced by the rules and the
  conditional update.
- **Safe concurrency.** Concurrent reviews fail safely: one wins and the other sees a
  conflict, without database locks held across requests.
- **Locked weeks.** An approved week also locks its collections (ADR 0005).

## Evidence

- `tests/unit/report-rules.test.ts`.
- `tests/integration/reports.test.ts`: transitions, stale versions and concurrent reviews.
- `e2e/report-cycle.spec.ts`: the full cycle in the browser, with the audit trail visible to
  Super Admin.
