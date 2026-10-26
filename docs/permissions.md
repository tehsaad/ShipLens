# Permissions

<!-- Generated from lib/permissions.ts by `npm run docs:permissions`; do not edit by hand. -->

Which role may perform each action, generated from the permission matrix in
`lib/permissions.ts`. Every service checks the same matrix before it reads or writes; the
admin screens use it only to hide controls.

- **All**: on every branch's records.
- **Own branch**: only on records of the user's own branch; another branch's record
  answers 404, as if it did not exist.
- **—**: refused (403).
- **Public**: anonymous visitors may also perform the action.

## Users

| Action               | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| -------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `user.read`          | All         | —                | —              | —       | —           |        |
| `user.create`        | All         | —                | —              | —       | —           |        |
| `user.update`        | All         | —                | —              | —       | —           |        |
| `user.deactivate`    | All         | —                | —              | —       | —           |        |
| `user.resetPassword` | All         | —                | —              | —       | —           |        |

## Branches

| Action                | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| --------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `branch.read`         | All         | All              | All            | All     | Own branch  |        |
| `branch.create`       | All         | —                | —              | —       | —           |        |
| `branch.update`       | All         | —                | —              | —       | —           |        |
| `branch.changeStatus` | All         | —                | —              | —       | —           |        |
| `branch.readPublic`   | All         | All              | All            | All     | All         | Yes    |

## Teams

| Action               | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| -------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `team.read`          | All         | —                | —              | All     | Own branch  |        |
| `team.create`        | All         | —                | —              | —       | Own branch  |        |
| `team.update`        | All         | —                | —              | —       | Own branch  |        |
| `team.assignMembers` | All         | —                | —              | —       | Own branch  |        |

## Volunteer applications

| Action               | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| -------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `application.submit` | All         | All              | All            | All     | All         | Yes    |
| `application.read`   | All         | —                | —              | All     | —           |        |
| `application.decide` | All         | —                | —              | All     | —           |        |
| `application.export` | All         | —                | —              | All     | —           |        |

## Members

| Action                 | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| ---------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `member.read`          | All         | —                | —              | All     | Own branch  |        |
| `member.updateContact` | All         | —                | —              | —       | Own branch  |        |
| `member.changeStatus`  | All         | —                | —              | All     | —           |        |
| `member.changeBranch`  | All         | —                | —              | —       | —           |        |
| `member.export`        | All         | —                | —              | All     | Own branch  |        |

## Collections

| Action               | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| -------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `collection.read`    | All         | All              | —              | —       | Own branch  |        |
| `collection.create`  | —           | —                | —              | —       | Own branch  |        |
| `collection.update`  | —           | —                | —              | —       | Own branch  |        |
| `collection.correct` | —           | —                | —              | —       | Own branch  |        |
| `collection.route`   | —           | All              | —              | —       | —           |        |
| `collection.export`  | All         | All              | —              | —       | Own branch  |        |

## Weekly reports

| Action           | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| ---------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `report.read`    | All         | All              | —              | —       | Own branch  |        |
| `report.draft`   | —           | —                | —              | —       | Own branch  |        |
| `report.submit`  | —           | —                | —              | —       | Own branch  |        |
| `report.approve` | —           | All              | —              | —       | —           |        |
| `report.return`  | —           | All              | —              | —       | —           |        |
| `report.export`  | All         | All              | —              | —       | Own branch  |        |

## Dashboard

| Action                     | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| -------------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `dashboard.view`           | All         | All              | —              | All     | Own branch  |        |
| `dashboard.viewFinance`    | All         | All              | —              | —       | Own branch  |        |
| `dashboard.viewMembership` | All         | All              | —              | All     | Own branch  |        |
| `dashboard.exportUnrouted` | All         | All              | —              | —       | Own branch  |        |

## Site content

| Action                  | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| ----------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `content.read`          | All         | —                | All            | —       | —           |        |
| `content.create`        | All         | —                | All            | —       | —           |        |
| `content.update`        | All         | —                | All            | —       | —           |        |
| `content.publish`       | All         | —                | All            | —       | —           |        |
| `content.readPublished` | All         | All              | All            | All     | All         | Yes    |

## Events

| Action          | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| --------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `event.read`    | All         | —                | All            | —       | —           |        |
| `event.create`  | All         | —                | All            | —       | —           |        |
| `event.update`  | All         | —                | All            | —       | —           |        |
| `event.publish` | All         | —                | All            | —       | —           |        |

## Contact messages

| Action                  | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| ----------------------- | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `contactMessage.submit` | All         | All              | All            | All     | All         | Yes    |
| `contactMessage.read`   | All         | —                | —              | —       | —           |        |
| `contactMessage.handle` | All         | —                | —              | —       | —           |        |

## Audit log

| Action       | Super Admin | Finance Reviewer | Content Editor | HR Lead | Branch Lead | Public |
| ------------ | ----------- | ---------------- | -------------- | ------- | ----------- | ------ |
| `audit.read` | All         | —                | —              | —       | —           |        |
