# Route handlers

## Exports (`GET`, signed-in staff)

Exports are plain links, not `next/link`, so a prefetch never creates an export or an audit
entry. Each one:

- runs the list's own query, with the same filters as the page;
- respects the role's scope: a Branch Lead stays in its own branch, whatever branch the URL
  names;
- writes one audit entry with the format, filters and row count.

Files are sent as attachments with `Cache-Control: no-store`.

CSV files are UTF-8 with a byte order mark, comma separated, RFC 4180 quoted, with CRLF line
ends. Text that a spreadsheet would run as a formula gets a leading apostrophe. Times are in
Asia/Karachi.

| Route                            | Query parameters                                              | Response                                         | Permission                 |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ | -------------------------- |
| `/admin/collections/export`      | `branchId`, `purpose`, `routed` (`yes`/`no`), `from`, `to`    | `collections-<date>.csv`                         | `collection.export`        |
| `/admin/members/export`          | `q`, `branchId`, `teamId`, `status`, `joinedFrom`, `joinedTo` | `members-<date>.csv` (with team names)           | `member.export`            |
| `/admin/applications/export`     | `status`, `branchId`, `from`, `to`                            | `applications-<date>.csv` (no free-text answers) | `application.export`       |
| `/admin/reports/export`          | `status`, `branchId`                                          | `weekly-reports-<date>.csv` (frozen totals)      | `report.export`            |
| `/admin/export/unrouted`         | none                                                          | `unrouted-collections-<date>.csv`, oldest first  | `dashboard.exportUnrouted` |
| `/admin/reports/:id/pdf`         | none                                                          | PDF of an APPROVED weekly report                 | `report.export`            |
| `/admin/reports/monthly-summary` | `branchId` (ignored for a Branch Lead), `month` (`YYYY-MM`)   | PDF summary of one branch's month                | `report.export`            |

Filter values that are not valid are ignored, as on the list pages. The query parameter names
are those of the list's filter schema in `lib/validation/`.

### Status codes

| Status | When                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------- |
| 200    | The file                                                                                                              |
| 307    | No session: `proxy.ts` redirects to `/admin/login` before the handler runs                                            |
| 401    | No session, if the request reaches the handler anyway (`lib/route-handler.ts`)                                        |
| 403    | The role lacks the permission, or the first-login password change is still pending                                    |
| 404    | Another branch's report, a missing report, or a malformed id                                                          |
| 422    | More than 10,000 rows match, the report is not approved, the month has not started, or the month or branch is missing |

Error bodies are short plain-text messages.

## Authentication: `/api/auth/*`

These are the Auth.js v5 handlers (`app/api/auth/[...nextauth]/route.ts`): the credentials
callback, session, CSRF token and sign-out. The admin login form goes through the `login`
server action, which calls them. Their POST endpoints require the Auth.js CSRF token. Failed
sign-ins are limited to 10 per IP per 15 minutes, as described in ADR 0002.

## Health: `GET /api/health`

| Status | Body                                   | Meaning                                                 |
| ------ | -------------------------------------- | ------------------------------------------------------- |
| 200    | `{"status":"ok","database":"up"}`      | The app is up and the database answered `SELECT 1`      |
| 503    | `{"status":"error","database":"down"}` | The database did not answer within 3 seconds, or failed |

- Always rendered on request, never cached (`Cache-Control: no-store`).
- Public: it reveals no data.
- Used by Render's health check, the Docker `HEALTHCHECK`, the CI smoke test and the E2E
  server.
