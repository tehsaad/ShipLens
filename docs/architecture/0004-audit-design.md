# ADR 0004: Audit log

- **Status:** Accepted
- **Recorded:** 26 October 2026 (decided in Phase 1; export entries added in Phase 5)

## Context

Section 5 requires an `AuditLog` row for every write. It must be:

- append-only;
- unchangeable by any role;
- backed by an application role with no UPDATE or DELETE on the table.

Section 8 (A09) asks for logging that supports investigation without storing secrets. Section
7.3 asks for every export to be audited.

## Decision

- **One writer.** `recordAudit()` in `lib/services/audit.ts` writes every entry:
  - the actor and role;
  - a dotted action (for example `report.approve` or `collection.export`);
  - the entity type and id, and the branch;
  - JSON `before` and `after`;
  - the client IP (`lib/request-context.ts`) and user agent.
- **Same transaction.** A service passes the transaction that made the change, so the entry
  exists if and only if the change commits.
- **Redaction.** `toAuditJson()` replaces password fields with `[redacted]`. Dates and decimals
  are stored as plain strings.
- **Enforced in the database.** The rules hold even if application code is wrong:
  - Triggers reject every `UPDATE`, `DELETE` and `TRUNCATE` on `audit_logs`, for every role
    (`integrity_rules` migration, SQLSTATE `SL009`).
  - The `shiplens_app` role (see `docs/handover.md`) has no UPDATE or DELETE on the table.
- **What gets an entry:**
  - every create, update, transition and decision;
  - every sign-in attempt;
  - every lockout;
  - every export. Export entries record the format, filters and row count, never the rows.

  Public submissions record ids only.

- **Reading.** Super Admin reads the log at `/admin/audit`, with filters for actor, entity,
  action and date. Weekly report pages show their own history (transitions and edits) from the
  same table.

## Consequences

- **No history table.** History is never reconstructed from mutable data; the audit log is the
  history.
- **The log only grows.** Retention or archiving would need a database-owner operation outside
  the application.
- **Request IDs.** Structured server logs (`lib/log.ts`) complement the audit log. They carry a
  request ID and never contain personal data.

## Evidence

- `tests/integration/database-rules.test.ts`: the append-only trigger and the role
  privileges.
- `tests/integration/audit-log.test.ts`: only Super Admin reads the log.
- `e2e/report-cycle.spec.ts`: each report step and the PDF export appear in the viewer.
