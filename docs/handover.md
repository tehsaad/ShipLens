# Handover

Operational notes for running the platform. Local setup and scripts are in the
[README](../README.md).

## Sample data and demo logins

`npm run db:seed` loads the sample data from `docs/SPEC.md` section 10: 6 branches (4 ACTIVE,
1 FORMING, 1 PAUSED), one user per staff role plus one Branch Lead per branch, 40 members in
teams, 20 applications, 120 collections over the 12 months ending 18 October 2026, 8 weekly
reports, 6 published content entries, 2 events and 1 contact message.

- Values and dates are fixed, so every run produces the same data.
- The script is safe to re-run: it creates only missing records and never overwrites
  existing ones, including passwords.
- Every demo account uses the password in `SEED_DEMO_PASSWORD` (at least 12 characters).
- On Render (and in the Docker image generally) the container runs the seed at every start
  while `SEED_DEMO_PASSWORD` is set. Remove the variable to stop seeding, for example once the
  demo accounts are retired; existing data is never touched either way.
- Demo accounts do not have to change their password on first sign-in, so the published
  credentials keep working (decision 5a). Accounts created any other way always must.

| Role             | Email                                 |
| ---------------- | ------------------------------------- |
| Super Admin      | `super.admin@demo.shiplens.test`      |
| Finance Reviewer | `finance.reviewer@demo.shiplens.test` |
| Content Editor   | `content.editor@demo.shiplens.test`   |
| HR Lead          | `hr.lead@demo.shiplens.test`          |
| Branch Lead      | `lead.kar001@demo.shiplens.test`      |

> **Warning:** the demo accounts share one known password. Before real use, change every demo
> password (or deactivate the demo accounts) and set a new `SEED_DEMO_PASSWORD`.

The other five Branch Lead accounts (`lead.kar002@…`, `lead.lah001@…`, `lead.isl001@…`,
`lead.pes001@…`, `lead.mul001@…`) exist for branch-scope testing.

## Database roles

Migrations create a `NOLOGIN` role, `shiplens_app`, with the privileges the application
needs. It has no `UPDATE` or `DELETE` on `audit_logs` (section 5), and no `DELETE` anywhere
except team assignments. To run the app with these restricted privileges:

1. Run migrations as the database owner (`DATABASE_MIGRATION_URL`).
2. Create a login role for the app:
   `CREATE ROLE shiplens_web LOGIN PASSWORD '<strong password>' IN ROLE shiplens_app;`
3. Point `DATABASE_URL` at that role.

If the migration user may not create roles, the migration skips this step. Database triggers
still enforce the append-only audit log, the 7-day collection lock, and the other rules.

## Security operations

The full OWASP mapping is in [security.md](security.md).

- **Rate limits are per instance.** Failed sign-ins (10 per 15 minutes), the volunteer
  application and the contact form (5 per hour each) are counted per client IP in the
  server's memory.
  - With more than one instance, each counts separately; a shared store (for example Redis)
    would be needed. A restart clears the counters.
  - The per-account lockout (5 failures, 15 minutes) is stored in the database and is not
    affected.
- **Logs.** The server writes one JSON object per line: server errors (`request.failed`, with
  the digest shown on the error page), exports, rate-limit refusals and health-check
  failures. Each line has a `requestId`.
  - On Render they are in the service's Logs tab.
  - Search for a digest a user reports, or for `"event":"request.failed"`.
- **Audit log.** Super Admins read it at `/admin/audit`. Every change and every export is
  there; filter the action by `export` to see who downloaded what.
- **Dependencies.**
  - CI fails when a production dependency has a high or critical advisory.
  - Dependabot opens weekly update pull requests, each of which must pass CI before merging.
  - Turn on Dependabot alerts and security updates in the repository settings
    (Settings → Code security).
