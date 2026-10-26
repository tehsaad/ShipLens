# Walkthrough video: script

An outline for the walkthrough video (section 13): 5 minutes at most. It follows one week of
real work: a volunteer applies, a branch reports its collections, head office reviews them,
and every step is audited.

## Before recording

- **Use a database with fresh sample data.** A local `npm run db:seed` on an empty database
  works, or the live site if nobody has changed it. The steps below create records, so record
  once per fresh seed.
- **Have the demo logins ready** (password: `SEED_DEMO_PASSWORD`):

  | Role             | Email                                 |
  | ---------------- | ------------------------------------- |
  | Super Admin      | `super.admin@demo.shiplens.test`      |
  | Finance Reviewer | `finance.reviewer@demo.shiplens.test` |
  | HR Lead          | `hr.lead@demo.shiplens.test`          |
  | Branch Lead      | `lead.kar001@demo.shiplens.test`      |

- **Use separate windows.** Open one private window per role to switch between people without
  signing out.
- **Prepare the browser.** Zoom to 110% and close other tabs. Start on `/en`.

## Script

| Time      | Who              | Do                                                                                                                                                           | Say                                                                                                                                          |
| --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:35 | Visitor          | Show Home in English, then switch to اردو: the layout flips right to left in Nastaliq. Open Branches and Programs. Toggle the dark theme.                    | "One site in two languages. Urdu is right to left with a proper Nastaliq font, and pages are cached so they load fast."                      |
| 0:35–1:10 | Visitor          | On Get Involved, submit the form empty to show the errors in Urdu. Fill it in (use a new email) and submit.                                                  | "The same validation runs in the browser and on the server, in both languages. Bots and floods are limited."                                 |
| 1:10–1:40 | HR Lead          | Applications → open the new application → Accept. Point at "Member MEM-… was created".                                                                       | "Accepting creates the member with a database-generated code in one transaction. Two people accepting at once cannot create two members."    |
| 1:40–2:30 | Branch Lead      | Collections → record PKR 750 dated last Wednesday. Reports → open last week → add a note → Submit. Point at "Totals (frozen at submission)".                 | "Branch Leads see only their own branch. Entries can be edited for 7 days. Submitting freezes the week's totals."                            |
| 2:30–3:10 | Finance Reviewer | Reports → open the submitted week → Return without a comment, to show the error → Return with a comment.                                                     | "A return needs a reason. Every form carries the version it showed, so two reviewers cannot overwrite each other."                           |
| 3:10–3:35 | Branch Lead      | Open the report → read the comment → Resubmit.                                                                                                               |                                                                                                                                              |
| 3:35–4:05 | Finance Reviewer | Approve. Click Download PDF. On Collections, Download CSV.                                                                                                   | "Approval locks the report and its week's collections, in the app and in PostgreSQL itself. Exports respect the same scope and are audited." |
| 4:05–4:25 | Branch Lead      | Try to record another collection dated in the approved week: it is refused. Open `/admin/users` to show the 403 page.                                        | "Locked means locked, and each role sees only what it is allowed to."                                                                        |
| 4:25–5:00 | Super Admin      | Dashboard: KPIs and charts. Audit log: filter by the report's id to show draft, submit, return, resubmit, approve and the PDF export, with actors and times. | "Every change and every export lands in an append-only audit log that no role, not even the app, can edit."                                  |

## Tips

- If a step fails on camera, the cause is usually a re-used seed. The week is already
  approved, or the email already has an open application.
- Each step above has an automated counterpart in the Playwright suite (`e2e/`). Running it
  first (`npm run test:e2e`) is a quick rehearsal.
