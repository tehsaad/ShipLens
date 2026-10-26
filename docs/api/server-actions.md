# Server actions

Every action below is a form submission (POST). How an action runs, and its result type, are
described in the [API README](README.md).

In the permission column:

- "own branch" means a Branch Lead may act only on records of its own branch. A record of
  another branch answers "not found".
- The roles behind each permission are listed in [permissions.md](../permissions.md).

Fields marked `?` are optional. Every successful action writes an audit entry.

## Public forms (no sign-in)

| Action                    | File                                   | Fields (schema)                                                                                                                  | Permission                       | Result                                                                                                                                     |
| ------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `submitApplicationAction` | `app/[locale]/get-involved/actions.ts` | `fullName`, `email`, `phone`, `preferredBranchId`, `skills?`, `availability`, `motivation`, `consentGiven` (`applicationSchema`) | `application.submit` (public)    | `ok: true`; `rateLimited` after 5 valid submissions per hour per IP; `applicationRejected` when this email already has an open application |
| `submitContactAction`     | `app/[locale]/contact/actions.ts`      | `name`, `email`, `message` (`contactSchema`)                                                                                     | `contactMessage.submit` (public) | `ok: true`; `rateLimited` after 5 per hour per IP                                                                                          |

Both forms carry a hidden honeypot field, `website`. When it is filled, the form answers
`ok: true` and stores nothing. Audit entries for public submissions record ids only.

## Sign-in and password (`app/admin/actions.ts`)

| Action           | Fields (schema)                                                              | Who                                         | Result                                                                                            |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `login`          | `email`, `password` (`loginSchema`)                                          | Anyone                                      | Redirects to `/admin`. Every failure gives one generic message (lockout and IP limit in ADR 0002) |
| `logout`         | none                                                                         | Signed in                                   | Audits `auth.logout`, then redirects to `/admin/login`                                            |
| `changePassword` | `currentPassword`, `newPassword`, `confirmPassword` (`changePasswordSchema`) | Signed in, also while the change is pending | Redirects to `/admin`. A wrong current password returns an error                                  |

## Branches (`app/admin/(console)/branches/actions.ts`)

| Action                     | Fields (schema)                                                     | Permission            | Result                                                                                    |
| -------------------------- | ------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------- |
| `createBranchAction`       | `name`, `city`, `contactEmail?` (`createBranchSchema`)              | `branch.create`       | Generates the code `BR-<CITY3>-<NNN>` and redirects to `/admin/branches/:id`              |
| `updateBranchAction`       | `id`, `name`, `contactEmail?`, `leadUserId?` (`updateBranchSchema`) | `branch.update`       | "Branch saved."                                                                           |
| `changeBranchStatusAction` | `id`, `status` (`changeBranchStatusSchema`)                         | `branch.changeStatus` | "Status changed." Allowed moves: FORMING → ACTIVE ↔ PAUSED, and ACTIVE or PAUSED → CLOSED |

The public site is refreshed after each successful branch change.

## Users (`app/admin/(console)/users/actions.ts`)

| Action                | Fields (schema)                                                       | Permission           | Result                                                                                                            |
| --------------------- | --------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `createUserAction`    | `name`, `email`, `role`, `branchId?`, `password` (`createUserSchema`) | `user.create`        | Redirects to `/admin/users/:id`. The user must change the password at first sign-in. A Branch Lead needs a branch |
| `updateUserAction`    | `id`, `name`, `role`, `branchId?`, `locale` (`updateUserSchema`)      | `user.update`        | "User saved."                                                                                                     |
| `setUserActiveAction` | `id`, `active` (`true` / `false`)                                     | `user.deactivate`    | "Account deactivated." or "Account reactivated." A deactivated user loses access on the next request              |
| `resetPasswordAction` | `id`, `password` (`resetPasswordSchema`, at least 12 characters)      | `user.resetPassword` | Sets a temporary password, which the user must change at next sign-in                                             |

## Applications (`app/admin/(console)/applications/actions.ts`)

| Action                     | Fields (schema)                                            | Permission           | Result                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `acceptApplicationAction`  | `id`, `branchId?`, `joinedAt?` (`acceptApplicationSchema`) | `application.decide` | "Accepted. Member MEM-###### was created." Creates the member and links it in one transaction; two concurrent decisions cannot both succeed |
| `declineApplicationAction` | `id`, `reason` (`declineApplicationSchema`, kept internal) | `application.decide` | "Application declined."                                                                                                                     |

## Members (`app/admin/(console)/members/actions.ts`)

| Action                | Fields (schema)                                            | Permission                          | Result                                                           |
| --------------------- | ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `updateContactAction` | `id`, `fullName`, `email`, `phone` (`memberContactSchema`) | `member.updateContact` (own branch) | "Contact details saved."                                         |
| `changeStatusAction`  | `id`, `status` (`memberStatusSchema`)                      | `member.changeStatus`               | "Status changed."                                                |
| `changeBranchAction`  | `id`, `branchId` (`memberBranchSchema`)                    | `member.changeBranch`               | "Member moved. Team assignments in the old branch were removed." |

## Teams (`app/admin/(console)/teams/actions.ts`)

| Action               | Fields (schema)                                          | Permission                                                                 | Result                               |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| `createTeamAction`   | `name`, `branchId?` (`createTeamSchema`)                 | `team.create` (own branch: a Branch Lead's own branch is used)             | Redirects to `/admin/teams/:id`      |
| `renameTeamAction`   | `id`, `name` (`teamSchema`)                              | `team.update` (own branch)                                                 | "Team renamed."                      |
| `assignMemberAction` | `id`, `memberId`, `roleInTeam?` (`teamAssignmentSchema`) | `team.assignMembers` (own branch); the member must be in the team's branch | "Team updated."                      |
| `removeMemberAction` | `id`, `memberId`                                         | `team.assignMembers` (own branch)                                          | Refreshes the team page (no message) |

## Collections (`app/admin/(console)/collections/actions.ts`)

| Action                   | Fields (schema)                                                                                        | Permission                        | Result                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `createCollectionAction` | `amount`, `collectedOn`, `purpose`, `description?` (`collectionSchema`)                                | `collection.create` (own branch)  | Redirects to `/admin/collections/:id`. Refused for a future date, a closed branch or an approved week |
| `updateCollectionAction` | `id`, `amount`, `collectedOn`, `purpose`, `description?`, `correctionNote?` (`updateCollectionSchema`) | `collection.update` (own branch)  | "Collection saved." Only while the entry is within its 7 days and its week is not approved            |
| `createCorrectionAction` | `id` (the original), `amount` (signed, not zero), `correctionNote` (`correctionSchema`)                | `collection.correct` (own branch) | Redirects to the new correction entry. The original plus its corrections must stay at or above zero   |
| `routeCollectionAction`  | `id`, `routingReference` (`routingSchema`)                                                             | `collection.route`                | "Marked as routed to the main account." Also allowed on locked entries                                |

## Weekly reports (`app/admin/(console)/reports/actions.ts`)

Every form except `openReportAction` sends `id` and the `version` it showed. A stale version
gets a conflict message (optimistic locking, ADR 0006).

| Action                | Fields (schema)                                                      | Permission                   | Result                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `openReportAction`    | `week`: any date in the week (`dateOnlySchema`)                      | `report.draft` (own branch)  | Opens or creates the DRAFT for that Monday-to-Sunday week, then redirects to `/admin/reports/:id`. Refused for a future week or a closed branch |
| `saveNotesAction`     | `id`, `version`, `leadNotes?` (`reportNotesSchema`)                  | `report.draft` (own branch)  | "Notes saved." Only while DRAFT or RETURNED                                                                                                     |
| `submitReportAction`  | `id`, `version` (`reportTransitionSchema`)                           | `report.submit` (own branch) | DRAFT or RETURNED → SUBMITTED, only once the week has ended. Freezes the totals                                                                 |
| `approveReportAction` | `id`, `version`, `comment?` (`approveReportSchema`)                  | `report.approve`             | SUBMITTED → APPROVED. The report and its week's collections become read-only                                                                    |
| `returnReportAction`  | `id`, `version`, `comment` (3–2000 characters, `returnReportSchema`) | `report.return`              | SUBMITTED → RETURNED, with the comment shown to the Branch Lead                                                                                 |

## Content (`app/admin/(console)/content/actions.ts`)

| Action                | Fields (schema)                                                   | Permission                                                         | Result                                                                                                              |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `createContentAction` | `type`, `slug`, `locale`, `title`, `body` (`createContentSchema`) | `content.create`                                                   | Redirects to `/admin/content/:id`. Starts as a draft. The slug is unique per type and language                      |
| `updateContentAction` | `id`, `title`, `body`, `slug?` (`updateContentSchema`)            | `content.update`                                                   | "Saved." For a published entry, the edit is kept as a pending draft and the public page keeps the published version |
| `contentStatusAction` | `id`, `intent`: `publish`, `unpublish` or `discard`               | `content.publish` (publish, unpublish); `content.update` (discard) | "Published.", "Unpublished. …" or "Pending changes discarded." Publishing or unpublishing refreshes the public site |

## Events (`app/admin/(console)/events/actions.ts`)

| Action               | Fields (schema)                                                                                                                                      | Permission      | Result                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------- |
| `createEventAction`  | `titleEn`, `titleUr?`, `startsAt`, `endsAt`, `location`, `branchId?` (`eventSchema`; times are Asia/Karachi, and the end cannot be before the start) | `event.create`  | Redirects to `/admin/events/:id`                         |
| `updateEventAction`  | `id` and the same fields                                                                                                                             | `event.update`  | "Event saved." Refreshes the public site                 |
| `publishEventAction` | `id`, `intent`: `publish` or `unpublish`                                                                                                             | `event.publish` | "Published." or "Unpublished." Refreshes the public site |

## Contact messages (`app/admin/(console)/messages/actions.ts`)

| Action              | Fields | Permission              | Result                                        |
| ------------------- | ------ | ----------------------- | --------------------------------------------- |
| `markHandledAction` | `id`   | `contactMessage.handle` | Marks the message handled; refreshes the list |
