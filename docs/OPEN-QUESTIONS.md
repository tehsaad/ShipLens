# Open Questions and Decisions

Unresolved points found while reading `docs/SPEC.md`, with the decision taken on each.

This file is the record of approved clarifications, additions and deviations. Where an
approved decision below adds to, narrows or overrides `docs/SPEC.md`, the decision applies.

- Decisions approved: 2026-10-22, by the project owner (all 12 items, including 5a and 7a).
- The recovered `docs/SPEC.md` is preserved unchanged in commit `d6ad7fe`
  (SHA-256 `db82a0722ccbd8db241fc0e3d45f08918e73bf0b07a0f7d00ce0f45fa20d9890`).
- One approved deviation (7a) is also written into `docs/SPEC.md` as amendment A1, applied
  in commit `39f1b88`. It only appends lines after section 15; lines 1–285 still match the
  recovered source. See [SPEC.md amendment](#specmd-amendment).
- The implementation details for 7a were adopted at the start of Phase 1; they are listed
  under [7a follow-up details](#7a-follow-up-details-adopted).

| #   | Topic                             | Spec section(s) | Decision                                                               | Status              | Applies from |
| --- | --------------------------------- | --------------- | ---------------------------------------------------------------------- | ------------------- | ------------ |
| 1   | Existing landing page in the repo | 12, 13          | `git mv` to `docs/design/landing-reference/`; keep LICENSE; new README | Approved            | Phase 0      |
| 2   | "Exactly five" roles vs PUBLIC    | 3, 4            | PUBLIC means anonymous visitors, not a stored role                     | Approved            | Phase 1      |
| 3   | Branch Lead member edits          | 3, 6.2, 7.2     | Branch Lead: name, email, phone, teams; HR: status; Super Admin: all   | Approved            | Phase 1      |
| 4   | Branch contact email              | 5, 7.1          | Add optional `Branch.contactEmail`                                     | Approved            | Phase 1      |
| 5   | Forced password change            | 5, 7.2          | Add `User.mustChangePassword`, default true, enforced on the server    | Approved (incl. 5a) | Phase 1      |
| 6   | Event localisation                | 5, 7.4          | `titleEn` and `titleUr` fields, English fallback                       | Approved            | Phase 1      |
| 7   | Collection corrections            | 5, 6.3          | Explicit correction link and reason; only corrections may be negative  | Approved (7a: B)    | Phase 1      |
| 8   | Collections for approved weeks    | 6.3, 6.4        | Reject, in the service layer and in the database                       | Approved            | Phase 1–2    |
| 9   | Weeks with no report              | 6.4, 7.2        | Computed overdue-report indicator, no new tables                       | Approved            | Phase 3      |
| 10  | docker-compose scope              | 2, 12           | PostgreSQL by default; `app` service behind an optional profile        | Approved            | Phase 0      |
| 11  | Branch Leads in seed data         | 5, 10           | Six Branch Leads, one per branch                                       | Approved            | Phase 1      |
| 12  | Does merged PR #1 count           | 14              | Not counted as one of the implementation PRs                           | Approved            | Phase 0      |

---

## 1. Existing landing page in the repository

**Section:** 12 (Repository), 13 (README.md, LICENSE)

**Ambiguity:** The spec assumes a new Next.js repository. `main` already contains a static
bilingual landing page (`index.html`, `ur/index.html`, `styles.css`, `README.md`) from
PR #1. The spec does not say whether it should be kept, moved or removed. The branch
`feature/volunteer-landing-page` also has one commit (`54a054c`, announcement badge) that
was never merged into `main`.

**Decision (approved):** Preserve the landing page and its history.

- On the Phase 0 branch, move `index.html`, `ur/index.html` and `styles.css` to
  `docs/design/landing-reference/` with `git mv`, as a pure rename commit with no content
  changes, so `git log --follow` shows the full history of each file.
- All links in the pages are relative (`styles.css`, `ur/`, `../styles.css`, `../`), and
  the folder structure moves together, so they keep working after the move. As today, the
  pages are viewed by serving the folder with any static server (the README already says
  this); opened straight from disk, the folder-style language links show a directory
  listing instead of the other page. The move does not change that behaviour.
- Keep `LICENSE` (MIT) unchanged.
- Replace `README.md` with the platform README. Carry over the landing page's description,
  design tokens and placeholder notes into `docs/design/landing-reference/README.md`, and
  add a short "History" note in the root README pointing to it and to PR #1.
- Leave `feature/volunteer-landing-page` and its unmerged commit untouched.

**Check before committing (Phase 0):** confirm `git log --follow` works for each moved file
and the moved English page still links to the Urdu page and loads its stylesheet.

## 2. "Exactly five" roles versus PUBLIC

**Section:** 3 (Roles), 4 (Permission model)

**Ambiguity:** Section 3 says "exactly five" roles, then lists PUBLIC as a sixth entry.

**Decision (approved):** The `Role` enum has five values (SUPER_ADMIN, FINANCE_REVIEWER,
CONTENT_EDITOR, BRANCH_LEAD, HR_LEAD). PUBLIC means an anonymous visitor with no user
record. The permission matrix marks the public actions (read published content, read
active branches, submit application, submit contact form) as allowed without a session.

## 3. Which member fields a Branch Lead can edit

**Section:** 3 (BRANCH_LEAD, HR_LEAD), 6.2, 7.2 (Members)

**Ambiguity:** Section 3 says the Branch Lead "manages" its branch's members and section
7.2 allows "read and edit own branch", but HR_LEAD owns status changes. The editable
fields for each role are not listed.

**Decision (approved):**

- BRANCH_LEAD (own branch only): edit `fullName`, `email`, `phone` and team assignments.
- HR_LEAD: change `status`; create members only through accepted applications.
- SUPER_ADMIN: full permissions, including moving a member to another branch.
- Nobody edits `memberCode`, `applicationId` or `joinedAt` after creation.

## 4. Branch contact email

**Section:** 7.1 (Branches page), 5 (Branch)

**Ambiguity:** The public Branches page shows "code, city, and contact email", but the
Branch model has no email field.

**Decision (approved):** Add an optional (nullable) `contactEmail` field to Branch,
editable by SUPER_ADMIN. The public page shows it only when it is set.

## 5. Tracking the forced password change

**Section:** 7.2 (Users), 5 (User)

**Ambiguity:** Section 7.2 says an admin-set password "must be changed on first login",
but the User model has no field to record whether that has happened.

**Decision (approved):** Add `mustChangePassword` (boolean, default `true`) to User.

- Set to `true` when an admin creates a user or resets a password; cleared only after the
  user sets a new password.
- Enforced on the server: while it is `true`, the session check used by every admin page,
  server action and route handler allows only the change-password page, its action and
  sign-out. Any other admin request is redirected (pages) or refused (actions and routes).
  Hiding links in the UI is not the control.
- Setting and clearing the flag is audited.

**5a. Seeded demo accounts — Approved.**

- **Problem:** section 10 requires one demo login per role, and section 14 requires the
  live Render link to work with all five role logins. If seeded demo users started with
  `mustChangePassword = true`, the first person to sign in would have to change the
  password, and the published demo credentials would stop working for everyone else.
- **Decision:** the seed script creates demo users with `mustChangePassword = false`, so
  the published demo credentials stay usable.
- Every user created any other way (admin screen, admin password reset) gets
  `mustChangePassword = true`, enforced on the server as described above. Only the seed
  script may create a user with `false`.
- `docs/handover.md` keeps the section 10 warning to rotate the demo passwords before
  real use.
- **Deviation:** section 7.2 says an admin-set password "must be changed on first login".
  Seeded demo accounts are an approved exception to that rule.

## 6. How events are localised

**Section:** 5 (Event), 7.4 (Bilingual support)

**Ambiguity:** The Event model allows titles "via ContentEntry-style rows or separate
localised fields" and does not choose one.

**Decision (approved):** Separate fields on Event: `titleEn` (required) and `titleUr`
(nullable). If `titleUr` is missing, the Urdu page shows the English title with the
notice from section 7.4. This is one of the two options section 5 already allows.

## 7. Collection corrections

**Section:** 6.3 (Collections and the 7-day lock), 5 (Collection)

**Ambiguity:** Corrections are "a new collection entry plus a note", but Collection has
no link to the entry being corrected and no note field.

**Decision (approved):** Add nullable `correctsCollectionId` (reference to the original
collection) and `correctionNote` (the reason, required whenever `correctsCollectionId` is
set).

- Enforced on the server and with database constraints: the original must exist and
  belong to the same branch; a correction cannot point to itself; `correctionNote` cannot
  be empty when a correction link is set.
- Creating a correction writes an audit entry that records both collection IDs, the
  amount and the reason.
- No arbitrary negative collections.

**7a. Downward corrections — Approved: Option B.**

- **Problem:** sections 5 and 6.3 require every amount to be greater than zero, so an
  amount recorded too high could never be reduced after the 7-day lock.
- **Decision:** only explicit correction entries may have a negative amount. Rules,
  enforced on the server (service layer) and in PostgreSQL (check constraint plus
  trigger):
  1. A normal entry (`correctsCollectionId` is null) must have `amount > 0`, exactly as
     the spec says.
  2. A correction entry must reference the original collection (`correctsCollectionId`)
     and include a non-empty reason (`correctionNote`). Its amount may be positive or
     negative but never zero.
  3. A correction can never reduce the original below zero: the original amount plus the
     sum of all corrections that reference it must stay at or above zero. The check runs
     inside the same transaction as the insert or edit, with the original row locked, so
     two corrections at once cannot get past it together.
  4. Every correction is audit-logged (action, actor, original and correction IDs, amount,
     reason, before and after values).
  5. No other entry may be negative. Deletion stays forbidden for every role.
- **Deviation:** this overrides "amount (Decimal, > 0)" in section 5 and "Amount must be
  greater than zero" in section 6.3 for correction entries only. Because it changes the
  spec's wording, it is also to be written into `docs/SPEC.md` (see
  [SPEC.md amendment](#specmd-amendment)).

### 7a follow-up details (adopted)

These follow from Option B. Each default keeps to the spec's existing wording where it
can. They were proposed on 2026-10-22 and adopted at the start of Phase 1 under the project
owner's instruction to make sensible decisions consistent with the specification.

- **No chains:** a correction must point to an original (normal) entry, never to another
  correction, so each original has one flat list of corrections.
- **Date of a correction:** `collectedOn` is the date the correction is recorded. It is
  never in the future, and decision 8 applies (it cannot be dated in an approved week). The
  correction counts in the current week's report, and approved reports stay unchanged.
- **Lock on corrections:** a correction is a collection row, so the 7-day lock (section
  6.3) applies to it. Editing a correction while it is unlocked re-runs the
  never-below-zero check.
- **Totals and KPIs:** corrections are collection rows, so they are included as the
  section 7.2 definitions read today. Sums are net amounts, and counts include correction
  rows. The same applies to `totalsSnapshot` and the unrouted list.
- **Routing:** a correction is routed by FINANCE_REVIEWER like any other entry.

## SPEC.md amendment

**Approved content:** decision 7a (Option B).

**Status: applied.** The commit order kept the original version in Git history:

1. `d6ad7fe` adds `docs/SPEC.md` exactly as recovered (hash above).
2. `a32ec36` adds this file.
3. `39f1b88` appends the amendment below as a separate `docs(spec):` commit.

`git show d6ad7fe:docs/SPEC.md` returns the original text, and
`git diff d6ad7fe 39f1b88 -- docs/SPEC.md` shows the 15 added lines and nothing else.

**How it was applied:** the block below was added at the end of `docs/SPEC.md`, after
section 15, without editing any existing line. Lines 1–285 stay byte-for-byte identical to the
recovered source, so the original can still be checked by hashing those lines. Prettier
must keep ignoring `docs/SPEC.md`.

```markdown
## Amendments (approved after the original specification)

### A1. Collection correction entries (2026-10-22, see docs/OPEN-QUESTIONS.md, decision 7a)

Overrides "amount (Decimal, > 0)" in section 5 and "Amount must be greater than zero" in
section 6.3, for correction entries only.

- Collection gains correctsCollectionId (nullable, references the original collection in
  the same branch) and correctionNote (the reason; required when correctsCollectionId is set).
- A normal entry (correctsCollectionId is null) must have amount > 0.
- A correction entry may have a positive or negative amount, never zero.
- The original amount plus the sum of its corrections must never be below zero.
- Enforced in the service layer and in PostgreSQL. Every correction is written to the
  audit log. Deletion remains forbidden for all roles.
```

Other approved additions (decisions 4, 5, 5a, 6, 8, 9) are recorded only in this file
unless you ask for them to be added to `docs/SPEC.md` as further amendments.

## 8. New collections dated in an approved week

**Section:** 6.3, 6.4 (Weekly report workflow)

**Ambiguity:** The spec does not say what happens when a new collection's `collectedOn`
falls in a week whose report is already APPROVED.

**Decision (approved):** Reject it in two places: the service layer returns a clear error
(telling the Branch Lead to record it in the current week and mention the original date in
the description), and a PostgreSQL trigger rejects the insert. The week is the Monday-start
week in Asia/Karachi, matching `WeeklyReport.weekStart`.

**Relation to the spec:** section 6.3 describes the trigger as rejecting updates to locked
rows. This adds an insert check to that trigger design; it does not remove or weaken any
existing rule.

## 9. Weeks that never get a report

**Section:** 6.4 (Draft creation), 7.2 (Dashboard)

**Ambiguity:** A report row is created only when the Branch Lead first opens that week, so
a week nobody opens has no row and the dashboard cannot show it as missing.

**Decision (approved):** Keep lazy creation as specified. Add a computed "Overdue weekly
reports" indicator, calculated on request: for each ACTIVE branch, every completed week
since the branch's `openedAt` with no SUBMITTED or APPROVED report. No new tables or
columns.

**Relation to the spec:** section 7.2 lists the dashboard KPIs with exact definitions. The
indicator is an addition shown alongside them; none of the listed KPIs change.

## 10. What docker-compose runs

**Section:** 2 (Delivery), 12 (docker-compose.yml)

**Ambiguity:** Section 2 says docker-compose is "for local Postgres"; section 12 says
"app plus PostgreSQL for local development".

**Decision (approved):** `docker-compose.yml` defines:

- `db`: PostgreSQL 16, named volume, health check. Started by default with
  `docker compose up -d`, for use with `npm run dev`.
- `app`: built from the project Dockerfile, under the compose profile `app`, waiting for a
  healthy `db`. Started with `docker compose --profile app up`.

**Consistency with CI:** CI does not use docker-compose. The Phase 0 `ci.yml` runs lint,
typecheck and build only. Later phases that need a database in CI (section 12: migrate the
test database, tests, Playwright) will use a GitHub Actions PostgreSQL 16 service
container, and the section 12 "docker build" step builds the same Dockerfile that the
`app` profile uses.

## 11. Branch Leads in the seed data

**Section:** 10 (Sample data), 5 (User.branchId)

**Ambiguity:** "1 BRANCH_LEAD per branch" with 6 branches gives 6 leads, including the
FORMING and PAUSED branches.

**Decision (approved):** Six Branch Leads, one per branch, as specified. The documented
Branch Lead demo login belongs to an ACTIVE branch; the others support scope and IDOR tests.

## 12. Whether merged PR #1 counts toward the acceptance checklist

**Section:** 14 ("25+ commits over at least 7 distinct days; 3 merged pull requests")

**Ambiguity:** PR #1 (the static landing page) was merged into `main` before any CI
existed. The spec does not say whether it counts.

**Decision (approved):** PR #1 is not counted as one of the three implementation PRs. At
least three new feature-branch PRs will be merged with green CI, starting with
`feature/phase-0-foundation`.

---

## Interpretations made during implementation (for review)

These resolve wording in `docs/SPEC.md` without changing it. They are encoded in
`lib/permissions.ts` and tested; each can be changed if the project owner disagrees.

- **Super Admin and collections or reports.** Section 3 gives SUPER_ADMIN "all data", while
  section 7.2 says "SUPER_ADMIN read all" for collections. The more specific section 7.2 is
  followed: Super Admin reads and exports collections and reports but does not enter, edit,
  route, approve or return them. Approval stays with FINANCE_REVIEWER.
- **Contact messages.** No role is named for them; only SUPER_ADMIN (all data) reads and
  handles them.
- **Branch list for staff.** Every staff role can read branch names and codes for context
  (for example, a Content Editor linking an event to a branch); BRANCH_LEAD sees only its own.
- **Login audit entries.** A failed sign-in for an unknown email records no identifier, only
  the reason, so a mistyped password is never stored in the append-only audit log.

Added in Phase 2:

- **City letters in branch codes.** "First 3 letters of city" uses the first three Latin
  letters, ignoring other characters and accents ("D.I. Khan" -> `DIK`). A city with fewer
  than three Latin letters is rejected. Numbers continue from the highest code used for that
  prefix and are never reused; 999 is the limit.
- **Branch lifecycle.** A FORMING branch can only become ACTIVE (it never opened, so it
  cannot be paused or closed). `openedAt` is set to the business date of the first
  activation and never changes after that. The city cannot be edited, because the code is
  derived from it and never changes.
- **Branch lead.** `Branch.leadUserId` must be an active Branch Lead assigned to that branch.
  Deactivating that user, or moving them to another role or branch, clears it.
- **User management.** Built in Phase 2 although no phase listed it. Super Admins cannot
  deactivate themselves (section 7.2) or change their own role. A password reset also clears
  a lockout and sets `mustChangePassword`.
- **Applications.** Phone numbers are stored as `+92` followed by 10 digits. The submission's
  audit entry records only ids, not the applicant's details. HR may place the member in any
  branch that is not CLOSED; the joining date defaults to today and cannot be in the future.
  Declining frees the email for a new application.
- **Member branch moves.** Teams belong to one branch, so a member moved to another branch
  leaves its old teams (recorded in the audit entry).
- **Teams.** Only members of the team's branch can join it. Branch Leads add and remove
  members; a member's role in a team is free text.
- **Collections.** An edit is refused when either the old or the new date falls in an
  approved week. A correction takes the original's purpose. Routing is recorded once and is
  never changed afterwards.

Added in Phase 3:

- **When a week can be submitted.** A report can be opened for the current or an earlier
  week, but submitted only once its week has ended (after Sunday, Asia/Karachi), so the
  frozen totals cover the whole week.
- **Active members in report totals.** `activeMembers` counts members of the branch whose
  status is ACTIVE now and who had joined by the end of the week. Member status has no
  history, so a draft recomputed later uses today's statuses; the figure is frozen on
  submission.
- **Approval comment.** The reviewer may add an optional comment when approving; returning
  requires one (section 6.4).
- **Who sees which dashboard figures.** Super Admin and Finance Reviewer see everything.
  HR Lead sees active members, pending applications, active branches and the new-members
  chart. A Branch Lead sees its own branch's figures, including pending applications that
  name the branch, but not the active-branches count. Content Editors have no dashboard.
- **Overdue reports.** Counted per ACTIVE branch from the Monday of the week it opened. DRAFT
  and RETURNED reports count as overdue, since only SUBMITTED or APPROVED ones were filed.
  Branches without an opening date have no indicator.
- **Unrouted list.** The dashboard shows the oldest 25, with a link to the full filtered
  collections list.

## Register of approved deviations from `docs/SPEC.md`

Every approved decision, classified against the original spec text.

- **Deviation:** overrides or makes an exception to spec text.
- **Addition:** adds something the spec does not mention, without contradicting it.
- **Clarification / Choice:** resolves ambiguous wording or picks an option the spec allows.
- **As specified:** no change.

| Decision | Kind          | Spec text affected                                                  | What is approved                                                     | In SPEC.md               |
| -------- | ------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| 7a       | Deviation     | §5 "amount (Decimal, > 0)"; §6.3 "Amount must be greater than zero" | Correction entries only may be negative; never below zero in total   | Amendment A1 (`39f1b88`) |
| 5a       | Deviation     | §7.2 "must be changed on first login"                               | Seeded demo users start with `mustChangePassword = false`            | No (recorded here)       |
| 4        | Addition      | §5 Branch; §7.1 Branches page                                       | New nullable field `Branch.contactEmail`                             | No (recorded here)       |
| 5        | Addition      | §5 User; §7.2 Users                                                 | New field `User.mustChangePassword`, enforced on the server          | No (recorded here)       |
| 7        | Addition      | §5 Collection; §6.3 corrections                                     | New fields `correctsCollectionId`, `correctionNote`; audited         | Amendment A1 (`39f1b88`) |
| 8        | Addition      | §6.3 lock trigger                                                   | Reject new collections dated in an approved week (app and database)  | No (recorded here)       |
| 9        | Addition      | §7.2 Dashboard                                                      | Computed overdue-report indicator; listed KPIs unchanged             | No (recorded here)       |
| 1        | Addition      | §12, §13 (repository, README)                                       | Landing page moved to `docs/design/landing-reference/`; History note | Not needed               |
| 2        | Clarification | §3 "exactly five" roles                                             | PUBLIC is anonymous access, not a stored role                        | Not needed               |
| 3        | Clarification | §3 "manages"; §7.2 "read and edit own branch"                       | Field-level split between Branch Lead, HR Lead and Super Admin       | Not needed               |
| 6        | Choice        | §5 Event "rows or separate localised fields"                        | Separate fields `titleEn`, `titleUr`, English fallback               | Not needed               |
| 10       | Choice        | §2 vs §12 docker-compose wording                                    | `db` by default, `app` behind a compose profile                      | Not needed               |
| 12       | Stricter      | §14 "3 merged pull requests"                                        | PR #1 not counted                                                    | Not needed               |
| 11       | As specified  | §10 "1 BRANCH_LEAD per branch"                                      | Six Branch Leads                                                     | Not needed               |
